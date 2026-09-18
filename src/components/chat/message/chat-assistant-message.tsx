import { ErrorPrimitive, MessagePrimitive, useAuiState } from '@assistant-ui/react';
import { useRef, type ComponentProps, type ReactNode } from 'react';

import { MarkdownText } from '@/components/assistant-ui/markdown-text';
import { ReasoningGroup } from '@/components/assistant-ui/reasoning';
import { ThoughtGroup, ThoughtReasoningStep, useIsInsideThoughtGroup } from '@/components/assistant-ui/thought-group';
import { ToolGroup } from '@/components/assistant-ui/tool-group';
import { getToolGroupLabel, type ToolGroupProgress } from '@/components/assistant-ui/tool-label';
import { useIsMessageSettled } from '@/components/assistant-ui/use-is-message-settled';
import { useChatClassNames } from '@/components/chat-host';
import { cn } from '@/lib/utils';

import { useToolProgressSnapshot } from '../progress';

import { resolveGroupState } from './resolve-group-state';
import { SelectionQuote } from './selection-quote';
import type { ChatAssistantMessageProps, ToolLabelResolver } from './types';

const resolveGroupToolLabel = (
    isGroupDone: boolean,
    indices: readonly number[],
    messageParts: readonly unknown[],
    groupProgress: ToolGroupProgress,
    resolveToolLabel?: ToolLabelResolver,
): string => {
    if (isGroupDone) {
        return getToolGroupLabel(indices, messageParts, resolveToolLabel);
    }

    return groupProgress.runningLabel ?? 'Using tools';
};

const HTML_ERROR_PATTERN = /<\s*(!doctype|html|head|body|title|h\d|center)\b/i;
const FALLBACK_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const getDisplayErrorMessage = (error: unknown): string => {
    const text = String(error).trim();

    if (!text || HTML_ERROR_PATTERN.test(text)) {
        return FALLBACK_ERROR_MESSAGE;
    }

    return text;
};

type ReasoningGroupSlotProps = {
    startIndex: number;
    endIndex: number;
    children: ReactNode;
};

/** A reasoning run renders as a rail step when a thought group already owns the collapsible,
 * and as its own collapsible on the surfaces that do not merge steps. */
const ReasoningGroupSlot = ({ startIndex, endIndex, children }: ReasoningGroupSlotProps) => {
    const isInsideThoughtGroup = useIsInsideThoughtGroup();

    if (isInsideThoughtGroup) {
        return <ThoughtReasoningStep>{children}</ThoughtReasoningStep>;
    }

    return (
        <ReasoningGroup startIndex={startIndex} endIndex={endIndex}>
            {children}
        </ReasoningGroup>
    );
};

type ToolGroupSlotProps = ComponentProps<typeof ToolGroup>;

const ToolGroupSlot = ({ children, ...props }: ToolGroupSlotProps) => {
    const isInsideThoughtGroup = useIsInsideThoughtGroup();

    if (isInsideThoughtGroup) {
        return <>{children}</>;
    }

    return <ToolGroup {...props}>{children}</ToolGroup>;
};

const ChatAssistantMessageError = () => {
    const error = useAuiState((s) => {
        if (s.message.status?.type === 'incomplete' && s.message.status.reason === 'error') {
            return s.message.status.error ?? 'An error occurred';
        }

        return undefined;
    });

    if (error === undefined) {
        return null;
    }

    return (
        <ErrorPrimitive.Root className="flex text-h5 text-destructive">
            <ErrorPrimitive.Message>{getDisplayErrorMessage(error)}</ErrorPrimitive.Message>
        </ErrorPrimitive.Root>
    );
};

export const ChatAssistantMessage = ({
    groupBy,
    getToolGroupState,
    ToolCall,
    renderText,
    renderReasoning,
    renderExtraPart,
    renderGroup,
    resolveToolLabel,
    indicatorLabel,
    actionsRow,
    beforeActions,
    afterContent,
    avatar,
    rootClassName = 'answer-list-item message-list-item group/assistant-message flex flex-col py-3',
    contentClassName = 'answer-content message-content flex flex-col w-full',
}: ChatAssistantMessageProps) => {
    const isMessageRunning = useAuiState((s) => s.message.status?.type === 'running');
    const isMessageSettled = useIsMessageSettled();
    const hasMessageError = useAuiState(
        (s) => s.message.status?.type === 'incomplete' && s.message.status.reason === 'error',
    );
    // Logo pulses like Claude's while the response is still pending — from run
    // start until the first visible text lands, then it settles.
    const isAwaitingContent = useAuiState((s) => {
        if (s.message.status?.type !== 'running') return false;

        return !s.message.parts.some((part) => part.type === 'text' && part.text.trim().length > 0);
    });
    const messageParts = useAuiState((s) => s.message.parts);
    const messagePartsCount = useAuiState((s) => s.message.parts.length);
    const selectableContentRef = useRef<HTMLDivElement>(null);
    const classNames = useChatClassNames();
    const toolProgress = useToolProgressSnapshot();
    const messageReasoningCount = messageParts.filter((part) => part.type === 'reasoning').length;
    const persistedToolDurations = useAuiState(
        (s) => (s.message.metadata?.custom as { toolDurations?: Record<string, number> } | undefined)?.toolDurations,
    );

    return (
        <MessagePrimitive.Root
            className={cn(rootClassName, classNames.message, classNames.assistantMessage)}
            data-role="assistant"
        >
            <div className="message-answer flex gap-3">
                <div
                    className={cn(
                        'shrink-0 self-start',
                        isAwaitingContent && 'logo-generating motion-reduce:animate-none',
                    )}
                >
                    {avatar}
                </div>
                <div className={contentClassName}>
                    <div ref={selectableContentRef} data-selectable-message="" className="flex w-full flex-col gap-2">
                        {messagePartsCount === 0 && !isMessageRunning && !hasMessageError ? (
                            <p className="text-sm text-muted-foreground">No response was generated.</p>
                        ) : (
                            <MessagePrimitive.GroupedParts groupBy={groupBy}>
                                {({ part, children }) => {
                                    switch (part.type) {
                                        case 'group-reasoning':
                                            return (
                                                <ReasoningGroupSlot
                                                    startIndex={part.indices[0]}
                                                    endIndex={part.indices[part.indices.length - 1]}
                                                >
                                                    {children}
                                                </ReasoningGroupSlot>
                                            );
                                        case 'group-thought': {
                                            const { isGroupDone, defaultOpen, groupProgress } = resolveGroupState({
                                                indices: part.indices,
                                                messageParts,
                                                messagePartsCount,
                                                isMessageRunning,
                                                statusType: part.status.type,
                                                getToolGroupState,
                                                toolProgress,
                                                persistedToolDurations,
                                                resolveToolLabel,
                                            });
                                            const hasReasoning = part.indices.some(
                                                (index) => messageParts[index]?.type === 'reasoning',
                                            );
                                            const hasTools = part.indices.some(
                                                (index) => messageParts[index]?.type === 'tool-call',
                                            );
                                            const groupReasoningCount = part.indices.filter(
                                                (index) => messageParts[index]?.type === 'reasoning',
                                            ).length;
                                            const ownsAllReasoning = groupReasoningCount === messageReasoningCount;

                                            return (
                                                <ThoughtGroup
                                                    key={part.indices[0]}
                                                    settleKey={isMessageSettled ? 'settled' : 'running'}
                                                    startIndex={part.indices[0]}
                                                    endIndex={part.indices[part.indices.length - 1]}
                                                    hasReasoning={hasReasoning}
                                                    hasTools={hasTools}
                                                    ownsAllReasoning={ownsAllReasoning}
                                                    // Positive evidence only: `hasTools` counts any
                                                    // `tool-call` part, while `toolCount` skips one
                                                    // with no string id, so an equal-zero compare
                                                    // would call such a group fully timed.
                                                    allToolsTimed={
                                                        groupProgress.toolCount > 0 &&
                                                        groupProgress.timedToolCount === groupProgress.toolCount
                                                    }
                                                    toolLabel={resolveGroupToolLabel(
                                                        isGroupDone,
                                                        part.indices,
                                                        messageParts,
                                                        groupProgress,
                                                        resolveToolLabel,
                                                    )}
                                                    toolDurationMs={groupProgress.durationMs ?? undefined}
                                                    active={!isGroupDone}
                                                    done={isGroupDone}
                                                    defaultOpen={defaultOpen}
                                                    forceOpen={defaultOpen}
                                                >
                                                    {children}
                                                </ThoughtGroup>
                                            );
                                        }
                                        case 'group-tool': {
                                            const { isGroupDone, defaultOpen, groupProgress } = resolveGroupState({
                                                indices: part.indices,
                                                messageParts,
                                                messagePartsCount,
                                                isMessageRunning,
                                                statusType: part.status.type,
                                                getToolGroupState,
                                                toolProgress,
                                                persistedToolDurations,
                                                resolveToolLabel,
                                            });

                                            return (
                                                <ToolGroupSlot
                                                    key={`${part.indices[0]}-${isMessageSettled ? 'settled' : 'running'}`}
                                                    count={part.indices.length}
                                                    active={!isGroupDone}
                                                    done={isGroupDone}
                                                    defaultOpen={defaultOpen}
                                                    forceOpen={defaultOpen}
                                                    label={resolveGroupToolLabel(
                                                        isGroupDone,
                                                        part.indices,
                                                        messageParts,
                                                        groupProgress,
                                                        resolveToolLabel,
                                                    )}
                                                    elapsedMs={
                                                        isGroupDone
                                                            ? (groupProgress.durationMs ?? undefined)
                                                            : undefined
                                                    }
                                                >
                                                    {children}
                                                </ToolGroupSlot>
                                            );
                                        }
                                        case 'text':
                                            return renderText ? renderText() : <MarkdownText />;
                                        case 'reasoning':
                                            return renderReasoning ? renderReasoning(part) : <MarkdownText />;
                                        case 'tool-call':
                                            return <ToolCall {...part} />;
                                        case 'indicator':
                                            return (
                                                <span
                                                    data-slot="aui-grouped-indicator"
                                                    role="status"
                                                    className="inline-block shimmer text-sm text-muted-foreground motion-reduce:animate-none"
                                                >
                                                    {indicatorLabel}
                                                </span>
                                            );
                                        default: {
                                            const group = renderGroup?.(part, children);

                                            if (group !== undefined && group !== null) return group;

                                            return renderExtraPart ? renderExtraPart(part) : null;
                                        }
                                    }
                                }}
                            </MessagePrimitive.GroupedParts>
                        )}
                    </div>
                    <SelectionQuote containerRef={selectableContentRef} disabled={isMessageRunning} />
                    <MessagePrimitive.Error>
                        <ChatAssistantMessageError />
                    </MessagePrimitive.Error>
                    {beforeActions}
                    <div
                        className={cn('chat-source-actions flex min-h-8 items-center gap-2', classNames.messageActions)}
                    >
                        {actionsRow}
                    </div>
                    {afterContent}
                </div>
            </div>
        </MessagePrimitive.Root>
    );
};
