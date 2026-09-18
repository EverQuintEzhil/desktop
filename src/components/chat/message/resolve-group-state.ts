import { getToolGroupProgress, type ToolGroupProgress } from '@/components/assistant-ui/tool-label';

import type { GetToolGroupState, ToolLabelResolver } from './types';

interface ResolveGroupStateInput {
    indices: readonly number[];
    messageParts: readonly unknown[];
    messagePartsCount: number;
    isMessageRunning: boolean;
    statusType: string | undefined;
    getToolGroupState: GetToolGroupState;
    toolProgress: ReadonlyMap<string, { startedAt: number; phase: 'running' | 'done'; durationMs?: number }>;
    persistedToolDurations?: Record<string, number>;
    resolveToolLabel?: ToolLabelResolver;
}

export interface GroupState {
    isGroupDone: boolean;
    defaultOpen: boolean;
    groupProgress: ToolGroupProgress;
}

/**
 * Shared done/active resolution for both the thought panel and a bare tool group.
 *
 * Once the message stops running every group in it has settled — even one whose tool call was
 * left without a result by a mid-tool-call stop, which assistant-ui leaves `requires-action` so
 * the group status never reaches `complete`. Without the `!isMessageRunning` shortcut such a
 * group would shimmer forever. A real pending approval keeps it active through `defaultOpen`.
 */
export const resolveGroupState = ({
    indices,
    messageParts,
    messagePartsCount,
    isMessageRunning,
    statusType,
    getToolGroupState,
    toolProgress,
    persistedToolDurations,
    resolveToolLabel,
}: ResolveGroupStateInput): GroupState => {
    const { defaultOpen, active } = getToolGroupState(indices, messageParts, isMessageRunning, statusType);
    const lastIndex = indices[indices.length - 1];
    const segmentDone = !isMessageRunning || (statusType === 'complete' && lastIndex < messagePartsCount - 1);

    return {
        isGroupDone: segmentDone && !active,
        defaultOpen,
        groupProgress: getToolGroupProgress(
            indices,
            messageParts,
            toolProgress,
            persistedToolDurations,
            resolveToolLabel,
        ),
    };
};
