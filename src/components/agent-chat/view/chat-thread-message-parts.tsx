import { ActionBarPrimitive, useAui, useAuiState } from '@assistant-ui/react';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { CornerDownRightIcon, Loader2Icon } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { CitationSourcesProvider, type CitationSource } from '@/components/assistant-ui/citation-sources-context';
import { MarkdownText } from '@/components/assistant-ui/markdown-text';
import { ToolFallback } from '@/components/assistant-ui/tool-fallback';
import { ToolRailItem } from '@/components/assistant-ui/tool-group';
import { formatToolName } from '@/components/assistant-ui/tool-label';
import { useChatHost } from '@/components/chat-host';
import { AssistantActions as AssistantActionsShell } from '@/components/chat/message/assistant-actions';
import { splitLeadingQuote } from '@/components/chat/message/parse-quote';
import { UserActions } from '@/components/chat/message/user-actions';
import DirectiveText from '@/components/chat/primitives/directive-text';
import { Button } from '@/components/ui/button';
import { normalizeToolName } from '@/lib/genui/normalize-tool-name';
import { cn } from '@/lib/utils';

import { ArtifactChip, isArtifactDataPart, readArtifactPointer } from '../artifact';
import { useAgentComposerContext } from '../context/agent-composer-context';
import { GenUIApp } from '../genui/genui-app';
import { useForkConversation } from '../hooks/use-fork-conversation';
import { useMentionSuggestions } from '../hooks/use-mention-suggestions';
import { McpUiResource, isMcpUiDataPart } from '../mcp-ui/mcp-ui-resource';
import {
    getReconnectGateServerId,
    isReconnectRequiredToolResult,
    ReconnectGateTool,
    ReconnectResultTool,
} from '../reconnect-required';
import {
    collectResearchContent,
    hasRenderableResearch,
    isPlanConfirmToolName,
    isResearchPart,
    isResearchPartName,
    isRunResearchToolName,
    parseDeepResearchReceipt,
    readResearchRunOutcome,
} from '../research/research-contract';
import { ResearchPlanConfirm } from '../research/research-plan-confirm';
import { replaceInlineCitations } from '../runtime/inline-citations';
import { extractMessageSources, extractMessageSuggestions, getWebSearchTurns } from '../runtime/source-parts';
import type { ChatSource, FluentMindMessageMetadata } from '../types';
import { isToolPendingApproval } from '../utils/tool-approval-state';

import { useChatViewContext } from './chat-view-context';
import { createToolLabelResolver } from './resolve-tool-label';
import ToolApproval, { buildMcpFaviconUrl, getMcpServerId } from './tool-approval';

const stripRelatedQuestions = (text: string): string =>
    text
        .replace(/<related_questions>[\s\S]*?<\/related_questions>/g, '')
        .replace(/<related_questions>[\s\S]*$/g, '')
        .trimEnd();

export const AgentMarkdownText = () => {
    const messageParts = useAuiState((s) => s.message.parts);

    const { resolveCitation, citationSources } = useMemo(() => {
        const turns = getWebSearchTurns(messageParts);
        const flatSources = extractMessageSources(messageParts);

        const resolve = (turn: number, index: number): ChatSource | undefined => {
            const direct = turns[turn]?.[index];

            if (direct) return direct;
            if (turns.length === 1) return turns[0][index];

            return flatSources[index];
        };

        const sourcesByUrl = new Map<string, CitationSource>();

        for (const source of [...flatSources, ...turns.flat()]) {
            if (sourcesByUrl.has(source.url)) continue;

            sourcesByUrl.set(source.url, {
                url: source.url,
                title: source.title,
                siteName: source.siteName,
                description: source.description,
                faviconUrl: source.faviconUrl,
            });
        }

        return { resolveCitation: resolve, citationSources: sourcesByUrl };
    }, [messageParts]);

    const preprocess = useCallback(
        (text: string) => replaceInlineCitations(stripRelatedQuestions(text), resolveCitation),
        [resolveCitation],
    );

    return (
        <CitationSourcesProvider sources={citationSources}>
            <MarkdownText preprocess={preprocess} />
        </CitationSourcesProvider>
    );
};

export const ChatDirectiveText = (props: { text: string }) => {
    const { agent } = useChatViewContext();
    const suggestions = useMentionSuggestions(agent);

    // The leading quote is lifted out of the message-question bubble and
    // rendered above it by UserMessageContent; here we render only the body.
    const { quote, body } = useMemo(() => splitLeadingQuote(props.text), [props.text]);

    return <DirectiveText text={quote !== null ? body : props.text} suggestions={suggestions} />;
};

export const ChatAgentToolStep: ToolCallMessagePartComponent = (part) => {
    const { toolCallId, toolName, args, status, approval, interrupt, respondToApproval, resume, addResult, result } =
        part;
    const { agent, isReadOnly } = useChatViewContext();

    const messageParts = useAuiState(
        (s) =>
            s.message.parts as unknown as readonly {
                type: string;
                name?: string;
                data?: unknown;
                toolCallId?: string;
                toolName?: string;
                result?: unknown;
            }[],
    );
    const isMessageRunning = useAuiState((s) => s.message.status?.type === 'running');

    const mcpServerId = getMcpServerId(toolName);
    const mcpServer = mcpServerId ? agent.mcpServers.find((server) => server._id === mcpServerId) : undefined;
    const faviconUrl = mcpServer?.serverUrl ? buildMcpFaviconUrl(mcpServer.serverUrl) : undefined;

    // A read-only viewer must never be handed the live approval card: its buttons
    // answer someone else's paused run, and it captures Enter/Escape window-wide.
    const isPendingApproval = !isReadOnly && isToolPendingApproval({ status, approval, interrupt });

    const isGenUIToolCall = (agent.apps ?? []).some((app) => normalizeToolName(app.refName) === toolName);

    const hasMcpUiPart = messageParts.some((p) => isMcpUiDataPart(p, toolCallId));

    const hasArtifactPart = messageParts.some((p) => isArtifactDataPart(p, toolCallId));

    const reconnectGateServerId = getReconnectGateServerId(toolName);
    const isReconnectResult = isReconnectRequiredToolResult(result);
    // One card per connector when several tools return reconnect_required in the same turn.
    const firstReconnectResultToolCallId =
        mcpServerId && isReconnectResult
            ? messageParts.find(
                  (p) =>
                      p.type === 'tool-call' &&
                      typeof p.toolName === 'string' &&
                      getMcpServerId(p.toolName) === mcpServerId &&
                      isReconnectRequiredToolResult(p.result),
              )?.toolCallId
            : undefined;

    const resolveToolLabel = useMemo(() => createToolLabelResolver(agent), [agent]);

    const renderContent = () => {
        if (isPendingApproval) {
            return (
                <ToolApproval
                    toolCallId={toolCallId}
                    toolName={toolName}
                    faviconUrl={faviconUrl}
                    approval={approval}
                    interrupt={interrupt}
                    respondToApproval={respondToApproval}
                    resume={resume}
                    addResult={addResult}
                />
            );
        }

        // Any tool registered via useToolUIRegistry surfaces its renderer as
        // part.toolUI; this catches all registered renderers.
        const toolUI = (part as { toolUI?: ReactNode }).toolUI;

        if (toolUI) return <>{toolUI}</>;

        const isToolRunning = status?.type === 'running';
        const title = resolveToolLabel(toolName, isToolRunning ? 'running' : 'done') ?? formatToolName(toolName);

        return <ToolFallback {...part} title={title} faviconUrl={faviconUrl} />;
    };

    // The card narrates the same run, so a plain step is a duplicate header. It keeps its step
    // only when it has something the card cannot show: an approval to answer, or a failed result
    // whose error text is the only account of what went wrong. A stopped call has neither — the
    // card's own "Research stopped" is the whole story. Judged against the card actually being
    // drawn, not against research parts existing: a routine has no gate, and one stopped during
    // the planning announcement would otherwise render an empty message.
    //
    // The verdict is read message-wide, not off this part: a model that calls the tool twice is
    // refused on the second, and judging that part alone would render a bare failed step under a
    // report that is perfectly fine.
    const isPlainRunTool =
        isRunResearchToolName(toolName) &&
        !isPendingApproval &&
        readResearchRunOutcome(messageParts as never) !== 'failed' &&
        hasRenderableResearch(collectResearchContent(messageParts as never), isMessageRunning);

    if (isPlainRunTool) {
        return null;
    }

    if (isPlanConfirmToolName(toolName)) {
        return (
            <ResearchPlanConfirm
                toolCallId={toolCallId}
                args={args}
                result={result}
                status={status}
                addResult={isReadOnly ? undefined : addResult}
            />
        );
    }

    if (reconnectGateServerId && !isReadOnly) {
        const gateServer = agent.mcpServers.find((server) => server._id === reconnectGateServerId);

        return (
            <ReconnectGateTool
                serverId={reconnectGateServerId}
                serverName={gateServer?.name ?? 'this connector'}
                result={result}
                approval={approval}
                respondToApproval={respondToApproval}
            />
        );
    }

    if (mcpServerId && isReconnectResult && !isReadOnly) {
        if (firstReconnectResultToolCallId !== toolCallId) return null;

        return <ReconnectResultTool serverId={mcpServerId} serverName={mcpServer?.name ?? 'this connector'} />;
    }

    if (isGenUIToolCall) {
        return <GenUIApp {...part} />;
    }

    if (hasArtifactPart) {
        return null;
    }

    if (hasMcpUiPart) {
        return (
            <McpUiResource
                {...part}
                appName={mcpServer?.name}
                toolLabel={formatToolName(toolName)}
                faviconUrl={faviconUrl}
            />
        );
    }

    return <ToolRailItem>{renderContent()}</ToolRailItem>;
};

type FluentMindDataPartProps = {
    name: string;
    data: unknown;
};

export const FluentMindDataPart = ({ name, data }: FluentMindDataPartProps) => {
    if (isResearchPartName(name)) return null;

    if (name === 'artifact') {
        const pointer = readArtifactPointer({ type: 'data', name, data });

        return pointer ? <ArtifactChip pointer={pointer} /> : null;
    }

    if (name === 'status') {
        const statusData = data as { message: string } | null;

        if (!statusData?.message) return null;

        return <span className="my-3 flex text-h5 text-muted-foreground">{statusData.message}</span>;
    }

    return null;
};

export const ChatMessageSources = () => {
    const { onShowSources } = useChatViewContext();
    const messageParts = useAuiState((s) => s.message.parts);
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const isLast = useAuiState((s) => s.message.isLast);
    const webSources = useMemo(() => extractMessageSources(messageParts), [messageParts]);

    if (isRunning && isLast) return null;
    if (webSources.length === 0) return null;

    return (
        <ActionBarPrimitive.Root autohide="not-last" className={'animate-in duration-150 fade-in'}>
            <div
                className="flex w-fit cursor-pointer items-center gap-2 rounded-full py-1 pr-3 pl-[6px] transition-colors duration-150 hover:bg-primary/10"
                onClick={() => onShowSources(webSources)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onShowSources(webSources)}
            >
                <div className="flex items-center">
                    {webSources.slice(0, 3).map((result) => (
                        <figure
                            key={result.id}
                            className="size-3.5 shrink-0 overflow-hidden rounded-circle border-2 border-background not-first:-ml-1"
                        >
                            <img className="size-full object-cover" src={result.faviconUrl} alt={result.title} />
                        </figure>
                    ))}
                </div>
                <span className="text-sm">Sources ({webSources.length})</span>
            </div>
        </ActionBarPrimitive.Root>
    );
};

export const ChatMessageSuggestions = () => {
    const aui = useAui();
    const { conversationId, isForeignConversation, isReadOnly } = useChatViewContext();
    const { fork, isPending: isForkPending } = useForkConversation(conversationId);
    const isLast = useAuiState((s) => s.message.isLast);
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const messageParts = useAuiState((s) => s.message.parts);
    const suggestions = useMemo(() => extractMessageSuggestions(messageParts), [messageParts]);
    const [forkingSuggestion, setForkingSuggestion] = useState<string | null>(null);

    if (!isLast || suggestions.length === 0) return null;

    const handleSuggestionClick = (suggestion: string) => {
        if (isReadOnly) return;

        if (isForeignConversation) {
            setForkingSuggestion(suggestion);
            void fork(suggestion);

            return;
        }

        aui.thread.append({
            role: 'user',
            content: [{ type: 'text', text: suggestion }],
        });
    };

    return (
        <div className="chat-thread-related-questions mt-5 flex flex-col gap-3">
            <h5 className="chat-thread-related-questions-title text-base font-medium">Related questions</h5>
            <div className="chat-thread-related-questions-list flex flex-col">
                {suggestions.map((suggestion) => (
                    <Button
                        key={suggestion}
                        variant="link"
                        type="button"
                        disabled={isRunning || isForkPending || isReadOnly}
                        className={cn(
                            'chat-thread-related-question flex h-auto w-full cursor-pointer items-start justify-start rounded-none px-0 py-2',
                            'border-t border-r-0 border-b-0 border-l-0 border-foreground/10 transition-colors',
                            'text-left whitespace-normal text-foreground hover:text-primary hover:no-underline',
                        )}
                        onClick={() => handleSuggestionClick(suggestion)}
                    >
                        {isForkPending && forkingSuggestion === suggestion ? (
                            <Loader2Icon className="mt-1 size-4 shrink-0 animate-spin text-muted-foreground" />
                        ) : (
                            <CornerDownRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 text-h5 font-normal break-words">{suggestion}</span>
                    </Button>
                ))}
            </div>
        </div>
    );
};

interface AssistantActionsProps {
    isLiked: boolean;
    isDisliked: boolean;
    isFeedbackPending: boolean;
    isBranchPending: boolean;
    canBranch: boolean;
    messageCreatedAt?: string;
    usage?: FluentMindMessageMetadata['usage'];
    aiModel?: string;
    onFeedback: (liked: boolean, disliked: boolean) => void;
    onBranch: () => void;
}

export const AssistantActions = ({
    isLiked,
    isDisliked,
    isFeedbackPending,
    isBranchPending,
    canBranch,
    messageCreatedAt,
    usage,
    aiModel,
    onFeedback,
    onBranch,
}: AssistantActionsProps) => {
    const { conversationId, isForeignConversation, isMessageInterrupted } = useChatViewContext();
    const { composer } = useAgentComposerContext();
    const { slots } = useChatHost();
    const status = useAuiState((s) => s.message.status);
    const messageId = useAuiState((s) => s.message.id);
    const isPartial = useAuiState((s) => (s.message.metadata.custom as { partial?: boolean } | undefined)?.partial);
    const isDeepResearch = useAuiState((s) => parseDeepResearchReceipt(s.message.metadata.custom) !== undefined);
    // The card is the receipt, so the tag covers only answers without one. Keyed on the
    // card's own parse, not on part presence: a malformed payload renders no card.
    // The cheap `some` runs first: this selector re-runs on every store emission, and a full
    // collect is a zod parse per part — far too much to spend on a boolean that is false for
    // every message that carries no research part at all.
    const hasResearchCard = useAuiState(
        (s) =>
            s.message.parts.some(isResearchPart) &&
            hasRenderableResearch(collectResearchContent(s.message.parts), s.message.status?.type === 'running'),
    );
    const [isUsageOpen, setIsUsageOpen] = useState(false);

    const interrupted =
        isPartial === true ||
        isMessageInterrupted?.(messageId) === true ||
        (status?.type === 'incomplete' && status.reason === 'cancelled');

    const showRegenerate = !isForeignConversation && !composer.isIncognitoMode && Boolean(conversationId);
    const models = composer.availableModels
        .filter((model) => model.value?.modelId)
        .map((model) => ({ modelId: model.value.modelId, label: model.label ?? model.value.name }));

    return (
        <>
            <AssistantActionsShell
                copyFormatted
                className="like-unlike"
                feedback={
                    !isForeignConversation
                        ? {
                              isLiked,
                              isDisliked,
                              isPending: isFeedbackPending,
                              onFeedback,
                          }
                        : undefined
                }
                regenerate={showRegenerate ? { models } : undefined}
                branch={canBranch ? { isPending: isBranchPending, onBranch } : undefined}
                usage={usage && slots?.renderTokenUsageDialog ? { onShow: () => setIsUsageOpen(true) } : undefined}
                messageCreatedAt={messageCreatedAt}
                interrupted={interrupted}
                deepResearch={isDeepResearch && !hasResearchCard}
            />
            {usage
                ? (slots?.renderTokenUsageDialog?.({
                      open: isUsageOpen,
                      onOpenChange: setIsUsageOpen,
                      usage,
                      model: aiModel,
                  }) ?? null)
                : null}
        </>
    );
};

export const UserActionBar = ({ onAddPrompt }: { onAddPrompt?: () => void }) => {
    const { isForeignConversation } = useChatViewContext();

    return (
        <UserActions
            edit={!isForeignConversation}
            onAddPrompt={onAddPrompt}
            className="copy-button-container opacity-0 max-lg:opacity-100"
        />
    );
};
