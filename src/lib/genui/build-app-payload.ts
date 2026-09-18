/**
 * Rebuilds a GenUI ui-ref for a message that lacks the streamed `data-genui`
 * part (re-opened conversations): the version-pinned ref on the tool output
 * wins, else the app is resolved from `agent.apps` by normalized tool name.
 */

import type { AppType } from '@/types/admin';

import { normalizeToolName } from './normalize-tool-name';
import type { GenUIDataPayload } from './types';

/** The ui-ref persisted on a GenUI tool's output (`ai` repo build_genui_app_tools). */
export interface GenUIResultRef {
    appId: string;
    refName: string;
    version: string;
    bundleUrl: string;
    display?: { framed?: boolean; maxWidth?: string };
}

const enrichChildren = (apps: AppType[], props: Record<string, unknown>): Record<string, unknown> => {
    const children = (props as { children?: unknown }).children;

    if (!Array.isArray(children)) return props;

    return {
        ...props,
        children: children.map((child) => {
            if (!child || typeof child !== 'object') return child;

            const refName = (child as { refName?: string }).refName;
            const app = refName
                ? apps.find((a) => normalizeToolName(a.refName) === normalizeToolName(refName))
                : undefined;

            if (!app?.bundleUrl) return child;

            return {
                ...child,
                appId: app._id,
                refName: app.refName,
                version: app.version,
                bundleUrl: app.bundleUrl,
            };
        }),
    };
};

const resolveRef = (
    apps: AppType[] | undefined,
    toolName: string,
    ref: GenUIResultRef | undefined,
): GenUIResultRef | undefined => {
    const app = (apps ?? []).find((a) => normalizeToolName(a.refName) === toolName);

    if (ref?.bundleUrl) {
        return { ...ref, display: ref.display ?? app?.display };
    }

    if (!app?.bundleUrl) return undefined;

    return {
        appId: app._id,
        refName: app.refName,
        version: app.version ?? '',
        bundleUrl: app.bundleUrl,
        display: app.display,
    };
};

interface BuildGenUIPayloadArgs {
    apps: AppType[] | undefined;
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown> | undefined;
    /** The version-pinned ref read from the tool output (`result._genui`), if present. */
    ref?: GenUIResultRef;
}

export const buildGenUIPayload = ({
    apps,
    toolCallId,
    toolName,
    args,
    ref,
}: BuildGenUIPayloadArgs): GenUIDataPayload | undefined => {
    const resolved = resolveRef(apps, toolName, ref);

    if (!resolved) return undefined;

    return {
        toolCallId,
        appId: resolved.appId,
        refName: resolved.refName,
        version: resolved.version,
        bundleUrl: resolved.bundleUrl,
        display: resolved.display,
        props: enrichChildren(apps ?? [], (args ?? {}) as Record<string, unknown>),
    };
};
