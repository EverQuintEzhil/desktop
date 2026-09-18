/**
 * The two live channels between the app pane and the assistant beside it.
 *
 * The pane is a remote bundle mounted through the GenUI bridge, so it shares
 * no React tree with the chat panel and cannot register assistant-ui context
 * or tools itself. This module is the meeting point.
 *
 * READ (pane -> assistant): the pane calls `bridge.publishContext(...)`. We
 * keep the object and ALSO render it into `window.__fmAppPaneContext`, which
 * `create-fluentmind-transport` already appends to outgoing messages inside
 * `<app_context>` markers. Reusing that global is deliberate: bundles built
 * against SDK <=0.2.x write the global themselves as a plain sentence, and
 * they keep working untouched.
 *
 * WRITE (assistant -> pane): the pane calls `bridge.onAction(handler)`; the
 * `set_app_view` frontend tool dispatches into it. Actions are named by the
 * pane, not by the host, so nothing here knows what a "sort" is.
 */

import type { AppActionResult, AppPaneAction, AppPaneContext } from '@thefluentmind/genui-sdk';

const APP_PANE_CONTEXT_GLOBAL = '__fmAppPaneContext';

type ActionHandler = (action: AppPaneAction) => AppActionResult;

let currentContext: AppPaneContext | null = null;
let actionHandler: ActionHandler | null = null;
let lastPublished: AppPaneContext | null = null;
const publishWaiters = new Set<(context: AppPaneContext | null) => void>();

const writeGlobal = (text: string | null): void => {
    if (typeof window === 'undefined') return;

    const store = window as unknown as Record<string, unknown>;

    if (text) store[APP_PANE_CONTEXT_GLOBAL] = text;
    else delete store[APP_PANE_CONTEXT_GLOBAL];
};

const validSpecs = (context: AppPaneContext | null) =>
    (Array.isArray(context?.actions) ? context.actions : []).filter(
        (spec) => spec && typeof spec.name === 'string' && spec.name.trim() !== '',
    );

/**
 * Render a published context as the block the model reads.
 *
 * This rides EVERY user message, so it drops each action's prose description —
 * the long part — and keeps its NAME AND ARGUMENTS. The arguments cannot go:
 * without the accepted values the model invents them and `set_app_view` fails
 * with "Unknown view", and it does not reliably reach for `get_app_view` first.
 * That tool supplements this block, it does not replace it. Anything
 * unserializable is dropped rather than throwing — a bad publish must not
 * break the turn.
 */
export const formatAppPaneContext = (context: AppPaneContext): string | null => {
    const summary = typeof context.summary === 'string' ? context.summary.trim() : '';
    const lines: string[] = [];

    if (summary) lines.push(summary);

    if (context.state && typeof context.state === 'object' && !Array.isArray(context.state)) {
        try {
            const json = JSON.stringify(context.state);

            if (json && json !== '{}') lines.push(`Current view state: ${json}`);
        } catch {
            // Circular or otherwise unserializable — the summary still stands.
        }
    }

    const rendered = describeAppPaneActions(context);

    if (rendered.length > 0) {
        lines.push(
            `This view accepts these actions — CALL set_app_view with one of these names and its arguments: ${rendered.join(', ')}. Call get_app_view for what each one does.`,
        );
    }

    return lines.length > 0 ? lines.join('\n') : null;
};

const notifyPublishWaiters = (context: AppPaneContext | null): void => {
    if (publishWaiters.size === 0) return;

    const waiters = [...publishWaiters];

    publishWaiters.clear();
    waiters.forEach((resolve) => resolve(context));
};

/**
 * A page swap publishes `null` from the outgoing page's effect cleanup before
 * the incoming page publishes its own context, and React commits both in the
 * same tick. Resolving on that `null` would report the pane as offering nothing
 * — which is exactly the blindness this wait exists to prevent — so a waiter
 * ignores it and holds out for a real context or its timeout.
 */

/**
 * How long to give the pane to re-render and re-publish after a tool changed it.
 * A hash change and an action both settle in a frame or two; the ceiling only
 * matters when nothing publishes at all (already on that route, or an older
 * bundle that never calls `publishContext`), and it must stay well inside the
 * model's tool-call patience.
 */
const PUBLISH_SETTLE_MS = 700;

const waitForNextPublish = (): Promise<AppPaneContext | null> =>
    new Promise((resolve) => {
        let settled = false;
        const finish = (context: AppPaneContext | null) => {
            if (settled) return;
            settled = true;
            publishWaiters.delete(finish);
            resolve(context);
        };

        publishWaiters.add(finish);
        // `currentContext` is null between an outgoing page's cleanup and the
        // incoming page's first publish, so a slow mount would time out onto
        // nothing. The last real view is a stale answer; no view at all is a
        // wrong one, and wrong is what sends the model back to the user.
        setTimeout(() => finish(currentContext ?? lastPublished), PUBLISH_SETTLE_MS);
    });

/**
 * The pane's action list, rendered for a TOOL RESULT.
 *
 * The `<app_context>` block only rides a user message, so a tool that changes
 * the pane mid-turn leaves the model blind to whatever the new view offers —
 * which is how it ends up telling the user to click something itself. A tool
 * result IS visible in-turn, so both pane tools report the live actions here.
 */
export const describeAppPaneActions = (context: AppPaneContext | null): string[] =>
    validSpecs(context).map((spec) => {
        const args = spec.args && typeof spec.args === 'object' ? spec.args : {};
        const argText = Object.entries(args)
            .map(([key, description]) => `${key}: ${String(description)}`)
            .join('; ');

        return argText ? `${spec.name}(${argText})` : spec.name;
    });

/**
 * The full action list, for `get_app_view` — each action as one line carrying
 * its arguments and what it does. Strings, not objects: the backend nulls a
 * genui tool output containing an array of objects.
 */
export const detailAppPaneActions = (context: AppPaneContext | null): string[] =>
    validSpecs(context).map((spec) => {
        const args = spec.args && typeof spec.args === 'object' ? spec.args : {};
        const argText = Object.entries(args)
            .map(([key, description]) => `${key}: ${String(description)}`)
            .join('; ');
        const description = typeof spec.description === 'string' ? spec.description : '';

        return `${spec.name}(${argText})${description ? ` — ${description}` : ''}`;
    });

/** What the pane is showing once it has settled after a change. */
export interface SettledAppPane {
    page?: string;
    actions: string[];
}

let paneQueue: Promise<unknown> = Promise.resolve();

/**
 * Apply one change to the pane and report where it landed, one at a time.
 *
 * A single assistant step can emit both pane tools at once and the runtime
 * runs them concurrently. Their waiters would then all resolve on whichever
 * publish came first, so the second tool would describe the first tool's
 * screen. Queueing keeps each result about its own change.
 */
export const changeAppPane = <T>(change: () => T): Promise<{ change: T; settled: SettledAppPane }> => {
    const run = async () => {
        const result = change();

        return { change: result, settled: await settledAppPane() };
    };
    const next = paneQueue.then(run, run);

    paneQueue = next.then(
        () => undefined,
        () => undefined,
    );

    return next;
};

export const settledAppPane = async (): Promise<SettledAppPane> => {
    const context = await waitForNextPublish();
    const page = context?.state && typeof context.state === 'object' ? context.state.page : undefined;

    return {
        ...(typeof page === 'string' && page !== '' && { page }),
        actions: describeAppPaneActions(context),
    };
};

/** Store what the pane is showing, and mirror it to the transport's global. */
export const publishAppPaneContext = (context: AppPaneContext | null): void => {
    if (!context || typeof context !== 'object') {
        currentContext = null;
        writeGlobal(null);

        return;
    }

    currentContext = context;
    lastPublished = context;
    writeGlobal(formatAppPaneContext(context));
    notifyPublishWaiters(context);
};

export const readAppPaneContext = (): AppPaneContext | null => currentContext;

/** Register the pane's action handler. Returns an unsubscribe. */
export const registerAppPaneActionHandler = (handler: ActionHandler): (() => void) => {
    actionHandler = handler;

    return () => {
        if (actionHandler === handler) actionHandler = null;
    };
};

/**
 * Hand an action to the pane.
 *
 * Every failure is RETURNED, never thrown: a thrown frontend-tool execute
 * leaves the tool part in `output-error`, which the resume collector skips and
 * the turn stalls (same reason `navigate_app` returns its refusals).
 */
export const dispatchAppPaneAction = (action: AppPaneAction): AppActionResult => {
    if (!actionHandler) {
        return {
            ok: false,
            error: 'The app pane does not accept view actions. Tell the user what to change on screen themselves.',
        };
    }

    const declared = readAppPaneContext()?.actions;

    if (Array.isArray(declared) && declared.length > 0 && !declared.some((spec) => spec?.name === action.name)) {
        const names = declared
            .map((spec) => spec?.name)
            .filter(Boolean)
            .join(', ');

        return { ok: false, error: `"${action.name}" is not an action this view accepts. Available: ${names}.` };
    }

    try {
        const result = actionHandler(action);

        // A pane that returns nothing usable still counts as handled — the user
        // saw the change; only an explicit refusal should read as a failure.
        if (!result || typeof result !== 'object') return { ok: true };

        return result;
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'The app pane could not apply that.' };
    }
};

/** Test/teardown seam: forget the context and handler. */
export const resetAppPaneChannel = (): void => {
    currentContext = null;
    lastPublished = null;
    actionHandler = null;
    paneQueue = Promise.resolve();
    writeGlobal(null);
    notifyPublishWaiters(null);
};
