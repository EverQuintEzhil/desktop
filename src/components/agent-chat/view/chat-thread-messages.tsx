import { ComposerPrimitive, MessagePrimitive, groupPartByType, useAuiState } from '@assistant-ui/react';
import type {
    FileMessagePartComponent,
    GroupByContext,
    ImageMessagePartComponent,
    PartState,
    ReasoningMessagePartProps,
} from '@assistant-ui/react';
import { InfoIcon, TelescopeIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import AddPrompt from '@/components/agent-chat/prompt-library/components/add-prompt/add-prompt';
import { Reasoning } from '@/components/assistant-ui/reasoning';
import { useChatHost } from '@/components/chat-host';
import { ChatAssistantMessage } from '@/components/chat/message/chat-assistant-message';
import { ChatUserMessage } from '@/components/chat/message/chat-user-message';
import { splitLeadingQuote } from '@/components/chat/message/parse-quote';
import { QuoteBlock } from '@/components/chat/message/quote-block';
import { scrollToQuoteSource } from '@/components/chat/message/scroll-to-quote-source';
import type { GetToolGroupState } from '@/components/chat/message/types';
import CollapsibleMessageText from '@/components/chat/primitives/collapsible-message-text';
import { UserFileRenderer, UserImageRenderer } from '@/components/chat/primitives/user-file-parts';
import TenantAssistantAvatar from '@/components/tenant-assistant-avatar';
import { Button } from '@/components/ui/button';
import { normalizeToolName } from '@/lib/genui/normalize-tool-name';
import { cn } from '@/lib/utils';
import type { PromptType } from '@/types/admin';
import { showErrorToast } from '@/utils';

import { getReconnectGateServerId, isReconnectRequiredToolResult } from '../reconnect-required';
import { wasSentWithDeepResearch } from '../research/deep-research-sent';
import { ResearchCard } from '../research/research-card';
import {
    isPlanConfirmToolName,
    isResearchPart,
    isRunResearchToolName,
    parseDeepResearchReceipt,
    RESEARCH_GROUP_KEY,
} from '../research/research-contract';
import ResearchReportChip from '../research/research-report-chip';
import { extractMessageAiInfo } from '../runtime/ai-info-part';
import { submitMessageFeedback } from '../runtime/submit-message-feedback';
import type { BranchResult, FluentMindMessageMetadata } from '../types';
import { hasPendingApprovalTool } from '../utils/tool-approval-state';

import {
    AgentMarkdownText,
    AssistantActions,
    ChatAgentToolStep,
    ChatDirectiveText,
    ChatMessageSources,
    ChatMessageSuggestions,
    FluentMindDataPart,
    UserActionBar,
} from './chat-thread-message-parts';
import { ChatViewContext, useChatViewContext } from './chat-view-context';
import { MessageBranchPicker } from './message-branch-picker';
import { createToolLabelResolver } from './resolve-tool-label';

export { ChatViewContext, useChatViewContext };

export const UserMessage = () => {
    const isEditing = useAuiState((s) => s.message.composer.isEditing);

    if (isEditing) return <EditComposer />;

    return <UserMessageContent />;
};

const UserMessageContent = () => {
    const { agent, onPromptAdded } = useChatViewContext();
    const { slots } = useChatHost();
    const [isAddPromptOpen, setIsAddPromptOpen] = useState(false);
    const messageContent = useAuiState((s) => s.message.content);
    const messageText = messageContent
        .filter((part) => part.type === 'text')
        .map((part) => (part as { type: 'text'; text: string }).text)
        .join('');

    const { quote, body } = useMemo(() => splitLeadingQuote(messageText), [messageText]);
    const hideBubble = body.trim() === '';
    // Persisted flag on reload; the send-time record for the message just sent, which the
    // runtime creates and so carries no metadata of ours.
    const isDeepResearch = useAuiState(
        (s) =>
            parseDeepResearchReceipt(s.message.metadata.custom) !== undefined || wasSentWithDeepResearch(s.message.id),
    );

    const renderBeforeBubble = () => (
        <>
            {isDeepResearch && (
                <div className="flex w-full justify-end">
                    <span className="deep-research-tag flex items-center gap-1 text-xs text-muted-foreground">
                        <TelescopeIcon className="size-3.5" aria-hidden />
                        Deep Research
                    </span>
                </div>
            )}
            {quote !== null && (
                <div className="flex w-full justify-end">
                    <QuoteBlock text={quote} onClick={() => scrollToQuoteSource(quote)} />
                </div>
            )}
        </>
    );

    const handlePromptAdded = (prompt: PromptType) => {
        if (onPromptAdded) {
            onPromptAdded(prompt);
        } else {
            slots?.onOpenPrompt?.(prompt._id);
        }
    };

    return (
        <ChatUserMessage
            Text={ChatDirectiveText}
            File={UserFileRenderer as FileMessagePartComponent}
            Image={UserImageRenderer as ImageMessagePartComponent}
            wrapParts={(parts) => <CollapsibleMessageText>{parts}</CollapsibleMessageText>}
            hideBubble={hideBubble}
            beforeBubble={renderBeforeBubble()}
            actions={
                <div className="flex items-center justify-end gap-2">
                    <MessageBranchPicker />
                    <UserActionBar
                        onAddPrompt={
                            agent.uiConfig.promptLibrary?.enabled && !slots?.hidePromptLibrary
                                ? () => setIsAddPromptOpen(true)
                                : undefined
                        }
                    />
                </div>
            }
            afterContent={
                agent.uiConfig.promptLibrary?.enabled &&
                !slots?.hidePromptLibrary && (
                    <AddPrompt
                        isOpen={isAddPromptOpen}
                        onClose={() => setIsAddPromptOpen(false)}
                        prompt={{ prompt: messageText, agentIds: [agent._id] } as PromptType}
                        agent={agent}
                        onAddPrompt={handlePromptAdded}
                    />
                )
            }
        />
    );
};

export const EditComposer = () => {
    const { onEditStart, onEditEnd } = useChatViewContext();

    useEffect(() => {
        onEditStart();

        return () => onEditEnd();
    }, [onEditStart, onEditEnd]);

    return (
        <MessagePrimitive.Root className="message-list-item question-list-item flex flex-col">
            <ComposerPrimitive.Root className="ml-auto flex w-full max-w-[640px] flex-col rounded-lg bg-card p-4">
                <ComposerPrimitive.Input
                    className={cn(
                        'max-h-[20vh] min-h-5 w-full resize-none rounded-md border border-input bg-transparent p-2',
                        'scrollbar-controller scrollbar-vertical text-sm outline-none focus:border-primary',
                    )}
                    autoFocus
                />
                <div className="mt-4 flex items-center gap-3">
                    <p className="flex flex-1 items-start gap-2 text-xs text-muted-foreground">
                        <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span>
                            Editing this message will create a new conversation branch. You can switch between branches
                            using the arrow navigation buttons.
                        </span>
                    </p>
                    <ComposerPrimitive.Cancel asChild>
                        <Button variant="ghost" size="sm" className="rounded-full">
                            Cancel
                        </Button>
                    </ComposerPrimitive.Cancel>
                    <ComposerPrimitive.Send asChild>
                        <Button size="sm" className="rounded-full">
                            Update
                        </Button>
                    </ComposerPrimitive.Send>
                </div>
            </ComposerPrimitive.Root>
        </MessagePrimitive.Root>
    );
};

export const AssistantMessage = () => {
    const { agent, conversationId, isPendingGeneration, isReadOnly } = useChatViewContext();
    const { conversations, navigation, slots } = useChatHost();

    const isMessageRunning = useAuiState((s) => s.message.status?.type === 'running');
    const isMessageError = useAuiState(
        (s) => s.message.status?.type === 'incomplete' && s.message.status.reason === 'error',
    );
    const isLastMessage = useAuiState((s) => s.message.isLast);

    const genuiToolNames = useMemo(
        () => new Set((agent.apps ?? []).map((app) => normalizeToolName(app.refName))),
        [agent.apps],
    );
    const persistedMessageId = useAuiState((s) => s.message.id);

    const submittedFeedback = useAuiState((s) => s.message.metadata.submittedFeedback?.type);
    const liveCreatedAt = useAuiState((s) => s.message.createdAt as unknown as string);
    const aiInfo = useAuiState((s) => s.message.metadata.custom as unknown as FluentMindMessageMetadata['custom']);
    const messageParts = useAuiState(
        (s) => s.message.parts as unknown as { type: string; name?: string; data?: unknown; toolCallId?: string }[],
    );

    const streamedAiInfo = useMemo(() => extractMessageAiInfo(messageParts), [messageParts]);
    const usage = aiInfo?.usage ?? streamedAiInfo?.usage;
    const aiModel = aiInfo?.aiModel ?? streamedAiInfo?.aiModel;
    const messageCreatedAt = aiInfo?.createdAt ?? liveCreatedAt;

    const [isLiked, setIsLiked] = useState(submittedFeedback === 'positive');
    const [isDisliked, setIsDisliked] = useState(submittedFeedback === 'negative');
    const [isFeedbackPending, setIsFeedbackPending] = useState(false);
    const [isBranchPending, setIsBranchPending] = useState(false);

    useEffect(() => {
        setIsLiked(submittedFeedback === 'positive');
        setIsDisliked(submittedFeedback === 'negative');
    }, [persistedMessageId, submittedFeedback]);

    const handleFeedback = async (liked: boolean, disliked: boolean) => {
        const previousLiked = isLiked;
        const previousDisliked = isDisliked;

        setIsLiked(liked);
        setIsDisliked(disliked);
        setIsFeedbackPending(true);

        try {
            await submitMessageFeedback({
                conversations,
                conversationId,
                messageId: persistedMessageId,
                liked,
                disliked,
            });
        } catch (error) {
            setIsLiked(previousLiked);
            setIsDisliked(previousDisliked);
            showErrorToast('Failed to update like/dislike');
            console.error('Failed to update like/dislike', error);
        } finally {
            setIsFeedbackPending(false);
        }
    };

    const handleBranch = async () => {
        if (!conversationId || !persistedMessageId) return;

        setIsBranchPending(true);

        try {
            const result = (await conversations.branch(conversationId, {
                messageId: persistedMessageId,
            })) as BranchResult;

            navigation.setConversationId(result._id);
        } catch (error) {
            showErrorToast('Failed to branch conversation. Please try again.');
            console.error('Failed to branch conversation', error);
        } finally {
            setIsBranchPending(false);
        }
    };

    const resolveToolLabel = useMemo(() => createToolLabelResolver(agent), [agent]);

    const getToolGroupState: GetToolGroupState = (indices, parts, _isMessageRunning, partStatusType) => {
        const hasPendingApproval = hasPendingApprovalTool(indices, parts);
        const active = partStatusType === 'running' || hasPendingApproval;

        return { defaultOpen: hasPendingApproval, active };
    };

    const artifactToolCallIds = useMemo(() => {
        const ids = new Set<string>();

        for (const part of messageParts) {
            if (part.type === 'data' && part.name === 'artifact') {
                const id = (part.data as { toolCallId?: string } | undefined)?.toolCallId;

                if (id) ids.add(id);
            }
        }

        return ids;
    }, [messageParts]);

    const mcpUiToolCallIds = useMemo(() => {
        const ids = new Set<string>();

        for (const part of messageParts) {
            if (part.type === 'data' && part.name === 'mcpui') {
                const id = (part.data as { toolCallId?: string } | undefined)?.toolCallId;

                if (id) ids.add(id);
            }
        }

        return ids;
    }, [messageParts]);

    // Only the parts between the first and last phase belong to the run. Prefixing the whole
    // message instead pulls in tool calls that merely follow the report, and every ungrouped
    // part between them breaks adjacency into another research group.
    const researchRunParts = useMemo(() => {
        const first = messageParts.findIndex(isResearchPart);

        if (first === -1) return null;

        const last = messageParts.reduce((found, part, index) => (isResearchPart(part) ? index : found), first);

        return new Set(messageParts.slice(first, last + 1));
    }, [messageParts]);

    const baseGroupBy = useMemo(
        () =>
            groupPartByType({
                reasoning: ['group-thought', 'group-reasoning'],
                'tool-call': ['group-thought', 'group-tool'],
                'standalone-tool-call': ['group-thought', 'group-tool'],
            }),
        [],
    );

    const groupBy = useCallback(
        (part: PartState, context: GroupByContext) => {
            if (part.type === 'tool-call' && part.toolCallId && mcpUiToolCallIds.has(part.toolCallId)) {
                return [];
            }

            if (part.type === 'tool-call' && part.toolCallId && artifactToolCallIds.has(part.toolCallId)) {
                return [];
            }

            if (part.type === 'tool-call' && genuiToolNames.has(part.toolName)) {
                return [];
            }

            // The plan gate renders as its own card, never inside a tool-group accordion —
            // once answered the accordion collapses by default and would hide it entirely.
            if (part.type === 'tool-call' && isPlanConfirmToolName(part.toolName)) {
                return [];
            }

            // Reconnect UI renders as its own card (gate tool or reconnect_required
            // result), never inside a tool-group accordion.
            if (
                part.type === 'tool-call' &&
                (getReconnectGateServerId(part.toolName) !== null || isReconnectRequiredToolResult(part.result))
            ) {
                return [];
            }

            if (isResearchPart(part)) {
                return [RESEARCH_GROUP_KEY];
            }

            // The run tool belongs to the run, so it keeps the research prefix. Returning an empty
            // path would make it an ungrouped root part, and an empty path closes the open group —
            // splitting one run into two and stranding anything nested after it outside the card.
            // Hiding the duplicate header is the renderer's job, not the grouping's.
            if (part.type === 'tool-call' && isRunResearchToolName(part.toolName) && researchRunParts !== null) {
                return [RESEARCH_GROUP_KEY];
            }

            const base = baseGroupBy(part, context);

            // Grouping coalesces adjacent runs only, so a searching/thinking part between two
            // phases would split the run; sharing the research prefix nests it instead.
            if (base.length > 0 && researchRunParts?.has(part)) {
                return [RESEARCH_GROUP_KEY, ...base];
            }

            return base;
        },
        [baseGroupBy, mcpUiToolCallIds, artifactToolCallIds, genuiToolNames, researchRunParts],
    );

    if (isPendingGeneration && isLastMessage && messageParts.length === 0 && !isMessageRunning && !isMessageError) {
        return null;
    }

    return (
        <ChatAssistantMessage
            groupBy={groupBy}
            getToolGroupState={getToolGroupState}
            ToolCall={ChatAgentToolStep}
            avatar={
                slots?.renderAssistantAvatar ? (
                    slots.renderAssistantAvatar('flex size-6 shrink-0 items-center justify-center')
                ) : (
                    <TenantAssistantAvatar className="flex size-6 shrink-0 items-center justify-center" />
                )
            }
            renderText={() => <AgentMarkdownText />}
            renderReasoning={(part) => <Reasoning {...(part as ReasoningMessagePartProps)} />}
            resolveToolLabel={resolveToolLabel}
            renderGroup={(part, children) => {
                const group = part as { type: string; indices: readonly number[] };

                if (group.type !== RESEARCH_GROUP_KEY) return null;

                return <ResearchCard indices={group.indices}>{children}</ResearchCard>;
            }}
            renderExtraPart={(part) => {
                const typedPart = part as { type: string; name?: string; data?: unknown };

                if (typedPart.type === 'data') {
                    return <FluentMindDataPart name={typedPart.name ?? ''} data={typedPart.data} />;
                }

                return null;
            }}
            indicatorLabel="Generating"
            actionsRow={
                <>
                    <MessageBranchPicker />
                    {slots?.renderMessageActions ? (
                        slots.renderMessageActions({ messageId: persistedMessageId, role: 'assistant' })
                    ) : (
                        <AssistantActions
                            isLiked={isLiked}
                            isDisliked={isDisliked}
                            isFeedbackPending={isFeedbackPending}
                            isBranchPending={isBranchPending}
                            canBranch={Boolean(conversationId && persistedMessageId) && !isReadOnly}
                            messageCreatedAt={messageCreatedAt}
                            usage={usage}
                            aiModel={aiModel}
                            onFeedback={handleFeedback}
                            onBranch={() => {
                                void handleBranch();
                            }}
                        />
                    )}
                    <ChatMessageSources />
                </>
            }
            beforeActions={<ResearchReportChip />}
            afterContent={<ChatMessageSuggestions />}
        />
    );
};
