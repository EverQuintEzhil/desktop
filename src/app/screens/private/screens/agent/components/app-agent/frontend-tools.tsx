import type { Toolkit } from '@assistant-ui/react';
import { useMemo, useRef } from 'react';
import { z } from 'zod';

import { ToolFallback } from '@/components/assistant-ui/tool-fallback';

const navigateAppParameters = z.object({
    hash: z
        .string()
        .describe(
            'Hash route inside the app pane. Must start with "#/". The routes are defined by the app ' +
                'currently in the pane, so only use ones you know it serves — an unknown route silently ' +
                'lands on the app home page. The pursuit app serves "#/" (dashboard), "#/pipeline" ' +
                '(optionally filtered, e.g. "#/pipeline?market=Healthcare"), "#/new" (create form), ' +
                '"#/pursuit/<id>" and "#/pursuit/<id>/edit".',
        ),
    // Widened past `string` on purpose: zod rejects before `execute` runs, and a
    // rejected call leaves the part in `output-error`, which never resumes the turn.
    prefill: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
            'Field values to pre-fill the destination form with, as flat scalars — the destination ' +
                'reads them as text. Only applies to form routes.',
        ),
});

const setAppViewParameters = z.object({
    action: z
        .string()
        .describe(
            'Name of the action to run, taken VERBATIM from the action list in the <app_context> block ' +
                "of the user's message. Never invent one — the list describes the page the user is " +
                'looking at right now, and it changes as they navigate.',
        ),
    // Widened past a concrete shape for the same reason as `prefill` above: zod
    // rejects before `execute` runs, and a rejected call leaves the part in
    // `output-error`, which never resumes the turn. The APP validates instead.
    args: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Arguments for the action, using the names the action list gives.'),
});

const getAppViewParameters = z.object({
    reason: z.string().optional().describe('Why you need the view, e.g. "need the arguments for set_sort". Free text.'),
});

export type NavigateAppArgs = z.infer<typeof navigateAppParameters>;
export type SetAppViewArgs = z.infer<typeof setAppViewParameters>;

/**
 * What the pane is showing, in full — the detail the `<app_context>` block leaves out.
 *
 * Every field is a string or a string array. The backend nulls a genui tool
 * output that carries a nested object or an array of objects, and a nulled
 * output ends the turn with nothing said, so `state` travels as JSON text.
 */
export type GetAppViewResult =
    | { ok: true; page?: string; summary?: string; state?: string; actions: string[] }
    | { ok: false; error: string };

/**
 * Both results carry the destination's live actions. The `<app_context>` block
 * only rides a user message, so without this the model cannot see what the view
 * it just changed will accept, and ends up asking the user to click.
 */
export type NavigateAppResult = { ok: true; page?: string; actions: string[] } | { ok: false; error: string };
export type SetAppViewResult =
    | { ok: true; note?: string; page?: string; actions: string[] }
    | { ok: false; error: string };

export interface AppAgentToolHandlers {
    onNavigateApp: (args: NavigateAppArgs) => Promise<NavigateAppResult>;
    onSetAppView: (args: SetAppViewArgs) => Promise<SetAppViewResult>;
    onGetAppView: () => Promise<GetAppViewResult>;
}

const createAppAgentToolkit = (handlers: AppAgentToolHandlers): Toolkit => ({
    navigate_app: {
        type: 'frontend',
        description:
            'Route the app pane next to this chat to a different page. Use it whenever the user asks to open, ' +
            'show or create something that has a page in the app — the user sees the page immediately, ' +
            'while you continue the turn. Pass `prefill` to open a create form with values already filled in.',
        parameters: navigateAppParameters,
        // Rejections are returned, never thrown: a thrown execute leaves the part in
        // `output-error`, which the resume collector skips, stalling the turn.
        execute: async (args: NavigateAppArgs) => handlers.onNavigateApp(args),
        render: ToolFallback,
    },
    set_app_view: {
        type: 'frontend',
        description:
            'Change what the app pane next to this chat is SHOWING, without navigating away — sort, tab, ' +
            'filter, scope, whichever controls the current page offers. The actions available right now, ' +
            "and their argument names, are listed in the <app_context> block of the user's message; the " +
            'user sees the change immediately. Use `navigate_app` instead to open a different page.',
        parameters: setAppViewParameters,
        // Refusals are returned, not thrown — see `navigate_app` above.
        execute: async (args: SetAppViewArgs) => handlers.onSetAppView(args),
        render: ToolFallback,
    },
    get_app_view: {
        type: 'frontend',
        description:
            'Read what the app pane next to this chat is showing RIGHT NOW, in full: its state and every ' +
            "action it accepts with each action's arguments. The <app_context> block on the user's message " +
            'already names the page and the available actions, so call this only when you need an ' +
            "action's arguments before running set_app_view, or when the user may have changed the view " +
            'since they sent their message.',
        parameters: getAppViewParameters,
        // Refusals are returned, not thrown — see `navigate_app` above.
        execute: async () => handlers.onGetAppView(),
        render: ToolFallback,
    },
});

/**
 * Browser-executed tools for a `componentType: "app"` agent. Returns the raw
 * toolkit (not an aui client) because the runtime it must attach to lives
 * inside the chat panel — the host hands it down through ChatShellContext.
 */
export const useAppAgentTools = (handlers: AppAgentToolHandlers): Toolkit => {
    const handlersRef = useRef(handlers);

    handlersRef.current = handlers;

    return useMemo(
        () =>
            createAppAgentToolkit({
                onNavigateApp: (args) => handlersRef.current.onNavigateApp(args),
                onSetAppView: (args) => handlersRef.current.onSetAppView(args),
                onGetAppView: () => handlersRef.current.onGetAppView(),
            }),
        [],
    );
};
