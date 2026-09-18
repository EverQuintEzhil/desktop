/**
 * Registers a GenUI tool-UI renderer for each of the agent's linked apps
 * (spec §12 requirement 1), keyed by the normalized `refName` (identical to the
 * `ai` tool-name rule, spec §16). Each registration delegates to {@link GenUIApp}.
 *
 * This satisfies the spec's `useAssistantToolUI({ toolName, render })` contract
 * for any standard `MessagePrimitive.Parts` consumer. The chat-agent thread
 * additionally dispatches GenUI tool calls to {@link GenUIApp} directly in its
 * custom `GroupedParts` switch (the accepted catch-all, spec §12), so rendering
 * works regardless of which path resolves the tool-call part.
 *
 * This is a thin agent-specific wrapper over the generic
 * {@link useToolUIRegistry}; it maps apps to `ChatToolRenderer`s and delegates.
 */

import { useToolUIRegistry } from '@/components/chat/tools';
import { normalizeToolName } from '@/lib/genui/normalize-tool-name';
import type { AppType } from '@/types/admin';

import { GenUIApp } from './genui-app';

/**
 * Registers GenUI renderers for the given apps by delegating to the core tool
 * registry.
 */
export function useGenUIToolUI(apps: AppType[] | undefined): void {
    const renderers = (apps ?? []).map((app) => ({
        toolName: normalizeToolName(app.refName),
        render: GenUIApp,
    }));

    useToolUIRegistry(renderers);
}
