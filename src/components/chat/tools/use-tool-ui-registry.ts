import { useAssistantToolUI } from '@assistant-ui/react';

import type { ChatToolRenderer } from './types';

// Upper bound on tool renderers a single chat surface registers; keeps the hook
// order stable across renders (assistant-ui requires unconditional hook calls).
const MAX_TOOL_RENDERERS = 32;

/**
 * Registers tool-UI renderers with assistant-ui by config. Hooks must be called
 * unconditionally and in a stable order, so we invoke `useAssistantToolUI` a
 * fixed number of times, passing `null` (a no-op) for empty slots.
 */
export function useToolUIRegistry(renderers: ReadonlyArray<ChatToolRenderer>): void {
    for (let i = 0; i < MAX_TOOL_RENDERERS; i += 1) {
        const renderer = renderers[i];

        // eslint-disable-next-line react-hooks/rules-of-hooks
        useAssistantToolUI(renderer ? { toolName: renderer.toolName, render: renderer.render } : null);
    }
}
