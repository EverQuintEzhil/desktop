import type {
    FileMessagePartComponent,
    GroupByContext,
    ImageMessagePartComponent,
    PartState,
    TextMessagePartComponent,
    ToolCallMessagePartComponent,
} from '@assistant-ui/react';
import type { ComponentType, ReactNode } from 'react';

export type ToolLabelResolver = (toolName: string, phase: 'running' | 'done') => string | undefined;

export interface ToolGroupStateResult {
    defaultOpen: boolean;
    active: boolean;
}

export type GetToolGroupState = (
    indices: readonly number[],
    parts: readonly unknown[],
    isMessageRunning: boolean,
    partStatusType: string | undefined,
) => ToolGroupStateResult;

type GroupByFn<TKey extends `group-${string}`> = (part: PartState, context: GroupByContext) => readonly TKey[] | null;

export interface ChatAssistantMessageProps<TKey extends `group-${string}` = `group-${string}`> {
    groupBy: GroupByFn<TKey>;
    getToolGroupState: GetToolGroupState;
    ToolCall: ToolCallMessagePartComponent;
    renderText?: () => ReactNode;
    renderReasoning?: (part: unknown) => ReactNode;
    renderExtraPart?: (part: unknown) => ReactNode | null;
    /** Renders a `group-*` key the shell has no built-in case for; return null to fall through. */
    renderGroup?: (part: unknown, children: ReactNode) => ReactNode | null;
    resolveToolLabel?: ToolLabelResolver;
    indicatorLabel: string;
    actionsRow?: ReactNode;
    beforeActions?: ReactNode;
    afterContent?: ReactNode;
    avatar?: ReactNode;
    rootClassName?: string;
    contentClassName?: string;
}

export interface ChatUserMessageProps {
    Text: TextMessagePartComponent;
    File?: FileMessagePartComponent;
    Image?: ImageMessagePartComponent;
    wrapParts?: (parts: ReactNode) => ReactNode;
    hideBubble?: boolean;
    beforeBubble?: ReactNode;
    actions?: ReactNode;
    afterContent?: ReactNode;
    AttachmentRenderer?: ComponentType;
    attachmentsMode?: 'always' | 'when-present';
    rootClassName?: string;
    bubbleClassName?: string;
    attachmentsWrapperClassName?: string;
}
