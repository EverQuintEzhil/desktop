import { lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
import type { ChatOnDataCallback, ChatOnFinishCallback } from 'ai';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import type { FluentMindUIMessage, McpServerArgument, SkillArgument } from '@/components/agent-chat/types';
import { createToolProgressStore, type ToolProgressStore } from '@/components/chat';
import type { ChatEventSink, ChatTransportContext } from '@/components/chat-host';
import { useChatHost } from '@/components/chat-host';
import { useChatRuntimeFromConfig } from '@/components/chat/runtime/create-chat-runtime';
import type { DropDownValueObject } from '@/components/ui/dropdown-menu';
import { getMessageFileIds } from '@/lib/chat/file-attachments';
import { extractMessageText, findLastUserMessage } from '@/lib/chat/message-text';
import { normalizeToolName } from '@/lib/genui/normalize-tool-name';
import type { AppType, ModelValueType } from '@/types/admin';
import type { ConversationStatus, FileType, ParameterValue } from '@/types/chat';
import { getErrorToastOptions } from '@/utils/toast-theme';

import { getReconnectGateServerId } from '../reconnect-required';
import { clearSentWithDeepResearch, markSentWithDeepResearch } from '../research/deep-research-sent';
import { clearPlanConfirmAnswered, wasPlanConfirmAnsweredHere } from '../research/plan-confirm-answered';
import { PLAN_CONFIRM_TOOL_NAME } from '../research/research-contract';
import { getFileIds } from '../runtime/build-chat-request-body';
import { createFluentMindTransport } from '../runtime/create-fluentmind-transport';

interface AgentRuntimeOptions {
    agentIdentifier: string;
    conversationId: string | null;
    newChatEpoch?: number;
    projectId?: string | null;
    model: DropDownValueObject<ModelValueType> | null;
    parameters: Record<string, ParameterValue>;
    isWebSearchEnabled: boolean;
    isDeepSearchEnabled: boolean;
    isRelatedQuestionsEnabled: boolean;
    relatedQuestionsCount?: number;
    isIncognitoMode: boolean;
    isPublic: boolean;
    files: FileType[];
    mcpServers?: McpServerArgument[];
    skills?: SkillArgument[];
    // The agent's linked GenUI apps; interactive ones drive the form-submit resume.
    apps?: AppType[];
    // Names of browser-executed tools mounted on this runtime. Their schemas ride
    // the request as `clientTools`; their results resume the paused turn.
    clientToolNames?: string[];
    onConversationId: (id: string) => void;
    onTitle?: (conversationId: string, title: string) => void;
    onConversationStatus?: (conversationId: string, status: ConversationStatus) => void;
    // Fires when a turn (send/regenerate/resume) finishes — used to reconcile
    // the client branch tree with the server after a live turn.
    onFinish?: ChatOnFinishCallback<FluentMindUIMessage>;
    onSendStart?: () => void;
}

// On a turn paused by an interactive GenUI tool (a form), the app submitted its
// value via bridge.addResult -> the tool part is `output-available` with `output`.
// A browser-executed client tool pauses the run the same way. Collect the results
// of both kinds that haven't been sent yet AND whose
// turn hasn't already produced its post-tool response, so resume fires exactly
// once. `sent` guards against re-firing after the model continues; the "text after
// the tool" check guards a reopened, already-complete conversation.
type ToolUiPart = {
    type?: string;
    toolName?: string;
    toolCallId?: string;
    state?: string;
    output?: unknown;
    text?: string;
};

export function collectUnsentResumeResults(
    messages: FluentMindUIMessage[],
    resumeToolNames: ReadonlySet<string>,
    sent: ReadonlySet<string>,
): Array<{ toolCallId: string; output: unknown }> {
    if (resumeToolNames.size === 0) return [];

    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

    if (!lastAssistant) return [];

    const parts = lastAssistant.parts as ReadonlyArray<unknown> as ToolUiPart[];
    let lastTextIndex = -1;

    parts.forEach((part, index) => {
        if (part.type === 'text' && typeof part.text === 'string' && part.text.trim().length > 0) {
            lastTextIndex = index;
        }
    });

    const results: Array<{ toolCallId: string; output: unknown }> = [];

    parts.forEach((part, index) => {
        if (typeof part.type !== 'string') return;
        if (part.type !== 'dynamic-tool' && !part.type.startsWith('tool-')) return;
        const toolName = part.type === 'dynamic-tool' ? part.toolName : part.type.slice('tool-'.length);

        if (toolName === undefined || !resumeToolNames.has(toolName)) return;
        if (part.state !== 'output-available' || part.output === undefined) return;
        if ((part.output as { status?: string })?.status === 'dismissed') return;
        if (!part.toolCallId || sent.has(part.toolCallId)) return;
        // Turn already produced text after this tool call -> it's complete (e.g. a
        // reopened conversation), not a fresh pause awaiting resume.
        if (lastTextIndex > index) return;
        // A research plan gate can be the turn's last part — a cancelled plan needs no
        // answer text — so "text after the tool" cannot tell a fresh pause from a stored
        // one. Only the answer given in this session has a paused run behind it.
        if (toolName === PLAN_CONFIRM_TOOL_NAME && !wasPlanConfirmAnsweredHere(part.toolCallId)) return;
        results.push({ toolCallId: part.toolCallId, output: part.output });
    });

    return results;
}

interface ResolveRequestAnchorsOptions {
    messages: FluentMindUIMessage[];
    lastUserMessage: FluentMindUIMessage | undefined;
    isResume: boolean;
    isRegenerate: boolean;
    resolvePersistedMessageId: (id: string) => string;
}

type RequestAnchors = {
    trigger?: 'regenerate-message';
    parentMessageId?: string | null;
    clientMessageId?: string;
};

function resolveRequestAnchors({
    messages,
    lastUserMessage,
    isResume,
    isRegenerate,
    resolvePersistedMessageId,
}: ResolveRequestAnchorsOptions): RequestAnchors {
    if (isResume || !lastUserMessage) return {};

    if (isRegenerate) {
        return {
            trigger: 'regenerate-message',
            parentMessageId: resolvePersistedMessageId(lastUserMessage.id),
        };
    }

    const lastUserIndex = messages.lastIndexOf(lastUserMessage);
    const precedingMessage = lastUserIndex > 0 ? messages[lastUserIndex - 1] : undefined;

    return {
        parentMessageId: precedingMessage ? resolvePersistedMessageId(precedingMessage.id) : null,
        clientMessageId: lastUserMessage.id,
    };
}

// A tool part the user just approved/denied sits in `approval-responded` state
// with a resolved `approved` boolean. On a resume turn we send ONLY those
// decisions — the backend reconstructs the paused turn from its own stored
// history. Parts already resolved to `output-available`/`output-denied` still
// carry `approval.approved`, so they must be excluded by the state check or the
// decision would be re-sent on every later turn.
type ResolvedApprovalPart = {
    type: string;
    toolCallId: string;
    state?: string;
    approval?: { id: string; approved?: boolean; reason?: string };
};

// A reconnect gate (`mcp_<serverId>_reconnect_required`) rides the approval
// state but resolves through its own resume path, so it is excluded here.
const reconnectGateServerIdOfPart = (part: { type?: string }): string | null => {
    if (typeof part.type !== 'string' || !part.type.startsWith('tool-')) return null;

    return getReconnectGateServerId(part.type.slice('tool-'.length));
};

function extractApprovalDecisions(
    messages: FluentMindUIMessage[],
): Array<{ toolCallId: string; approved: boolean; reason?: string }> {
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');

    if (!lastAssistant) return [];

    const parts = lastAssistant.parts as ReadonlyArray<unknown> as ResolvedApprovalPart[];

    return parts.reduce<Array<{ toolCallId: string; approved: boolean; reason?: string }>>((decisions, part) => {
        const approval = part.approval;

        const isToolPart =
            typeof part.type === 'string' && (part.type.startsWith('tool-') || part.type === 'dynamic-tool');

        if (
            !isToolPart ||
            reconnectGateServerIdOfPart(part) !== null ||
            part.state !== 'approval-responded' ||
            approval === undefined ||
            typeof approval.approved !== 'boolean'
        ) {
            return decisions;
        }

        return [
            ...decisions,
            {
                toolCallId: part.toolCallId,
                approved: approval.approved,
                ...(approval.reason ? { reason: approval.reason } : {}),
            },
        ];
    }, []);
}

// Approved reconnect gates on the paused assistant message. The user reconnected
// the connector, so the paused turn is re-run with the server available — sent
// as server ids because memory-mode history does not persist the gate approval.
function extractReconnectGateApprovals(
    messages: FluentMindUIMessage[],
): Array<{ toolCallId: string; serverId: string }> {
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');

    if (!lastAssistant) return [];

    const parts = lastAssistant.parts as ReadonlyArray<unknown> as ResolvedApprovalPart[];

    return parts.reduce<Array<{ toolCallId: string; serverId: string }>>((entries, part) => {
        const serverId = reconnectGateServerIdOfPart(part);

        if (serverId === null || part.state !== 'approval-responded' || part.approval?.approved !== true) {
            return entries;
        }

        return [...entries, { toolCallId: part.toolCallId, serverId }];
    }, []);
}

// assistant-ui puts the mounted frontend tools on `body.tools` as
// `{ [name]: { description?, parameters, providerOptions? } }`; the backend's
// clientTools contract is the description+parameters pair, so narrow to that.
// Only the names the host actually mounted are forwarded — anything else on
// `body.tools` has no browser executor, so the backend must keep owning it.
export function toClientTools(
    body: unknown,
    clientToolNames: ReadonlySet<string>,
): Record<string, { description: string; parameters: unknown }> | undefined {
    if (clientToolNames.size === 0) return undefined;

    const tools = (body as { tools?: unknown } | undefined)?.tools;

    if (typeof tools !== 'object' || tools === null) return undefined;

    const entries = Object.entries(tools as Record<string, { description?: unknown; parameters?: unknown }>)
        .filter(([name, tool]) => clientToolNames.has(name) && tool?.parameters !== undefined)
        .map(([name, tool]) => [
            name,
            { description: typeof tool.description === 'string' ? tool.description : '', parameters: tool.parameters },
        ]);

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

// Max automatic reconnect resumes per server per conversation; bounds the loop
// when the backend keeps re-gating a connector despite reconnect attempts.
const RECONNECT_RESUME_LIMIT = 3;

export function useAgentRuntime(options: AgentRuntimeOptions) {
    const host = useChatHost();
    const optionsRef = useRef(options);

    optionsRef.current = options;

    const toolProgressStoreRef = useRef<ToolProgressStore | undefined>(undefined);

    if (!toolProgressStoreRef.current) {
        toolProgressStoreRef.current = createToolProgressStore();
    }
    const toolProgressStore = toolProgressStoreRef.current;

    const messageIdAliasRef = useRef<Map<string, string>>(new Map());
    const knownPersistedIdsRef = useRef<Set<string>>(new Set());
    // Last seen Temporal activity attempt per assistant message id; an attempt
    // bump means the turn re-ran — partial streamed content must be discarded.
    const turnAttemptRef = useRef<Map<string, number>>(new Map());
    const previousConversationIdRef = useRef(options.conversationId);

    useEffect(() => {
        const previousConversationId = previousConversationIdRef.current;

        previousConversationIdRef.current = options.conversationId;

        if (previousConversationId === options.conversationId) return;
        if (previousConversationId === null) return;

        messageIdAliasRef.current.clear();
        clearSentWithDeepResearch();
        clearPlanConfirmAnswered();
        knownPersistedIdsRef.current.clear();
        sentApprovalIdsRef.current.clear();
        reconnectResumeCountsRef.current.clear();
        reconnectCapToastedRef.current.clear();
        pendingReconnectResumeRef.current = false;
        pendingReconnectServerIdsRef.current = [];
        turnAttemptRef.current.clear();
        toolProgressStoreRef.current?.clear();
    }, [options.conversationId]);

    const resolvePersistedMessageId = useCallback((id: string): string => messageIdAliasRef.current.get(id) ?? id, []);

    const isPersistedMessageId = useCallback((id: string): boolean => knownPersistedIdsRef.current.has(id), []);

    const registerPersistedMessageIds = useCallback((ids: readonly string[]) => {
        ids.forEach((id) => knownPersistedIdsRef.current.add(id));
    }, []);

    // Normalized tool names of the agent's INTERACTIVE GenUI apps (form-card etc.),
    // kept in a ref so the once-created transport + the resume predicate read the
    // current set. `sentGenuiResultsRef` ensures each submitted result resumes the
    // turn exactly once (no auto-send loop after the model continues).
    // Client tool names join the same set: both pause the run and resume it on the
    // `genuiResults` rail.
    const resumeToolNamesRef = useRef<Set<string>>(new Set());

    const clientToolNamesRef = useRef<Set<string>>(new Set());

    clientToolNamesRef.current = new Set(options.clientToolNames ?? []);
    resumeToolNamesRef.current = new Set([
        ...(options.apps ?? []).filter((app) => app.interactive).map((app) => normalizeToolName(app.refName)),
        ...clientToolNamesRef.current,
        // The research plan gate is a human tool: the run pauses on it and only the answered
        // plan resumes the turn. Unlisted, an answered gate resolves the part and the run
        // never continues, so the plan is confirmed and nothing is ever researched.
        PLAN_CONFIRM_TOOL_NAME,
    ]);
    const sentGenuiResultsRef = useRef<Set<string>>(new Set());

    // Each approval decision resumes the turn exactly once. Without this a resume
    // that fails to resolve the tool part (e.g. a backend error) would leave the
    // part `approval-responded`, keeping `sendAutomaticallyWhen` true forever and
    // re-firing /chat in an infinite loop.
    const sentApprovalIdsRef = useRef<Set<string>>(new Set());

    // Automatic reconnect resumes sent per server id, capped at RECONNECT_RESUME_LIMIT
    // — `sentApprovalIdsRef` can't bound this because each re-gate carries a fresh toolCallId.
    const reconnectResumeCountsRef = useRef<Map<string, number>>(new Map());
    const reconnectCapToastedRef = useRef<Set<string>>(new Set());

    // Armed by the reconnect card right before it fires the resume send;
    // consumed (and cleared) by prepareRequestBody to mark the turn as a
    // reconnect resume instead of a fresh submit.
    const pendingReconnectResumeRef = useRef(false);
    const pendingReconnectServerIdsRef = useRef<string[]>([]);

    // Auto-resume the model when: an approval was responded to (existing), OR an
    // interactive GenUI tool (a form) was just submitted and not yet sent.
    const shouldSendAutomatically = useCallback((opts: { messages: FluentMindUIMessage[] }) => {
        const unsentGateApprovals = extractReconnectGateApprovals(opts.messages).filter(
            (gate) => !sentApprovalIdsRef.current.has(gate.toolCallId),
        );
        const hasUnsentGateApproval = unsentGateApprovals.some(
            (gate) => (reconnectResumeCountsRef.current.get(gate.serverId) ?? 0) < RECONNECT_RESUME_LIMIT,
        );

        if (hasUnsentGateApproval) return true;

        // Capped gates are dropped instead of resumed; surface that once per server
        // so the turn doesn't just end silently.
        unsentGateApprovals
            .filter((gate) => !reconnectCapToastedRef.current.has(gate.serverId))
            .forEach((gate) => {
                reconnectCapToastedRef.current.add(gate.serverId);
                toast.error(
                    'This connector keeps failing to resume. Please try again in a new message.',
                    getErrorToastOptions(),
                );
            });

        const hasUnsentApproval = extractApprovalDecisions(opts.messages).some(
            (decision) => !sentApprovalIdsRef.current.has(decision.toolCallId),
        );

        if (hasUnsentApproval && lastAssistantMessageIsCompleteWithApprovalResponses(opts)) return true;

        return (
            collectUnsentResumeResults(opts.messages, resumeToolNamesRef.current, sentGenuiResultsRef.current).length >
            0
        );
    }, []);

    // Rebuilt each render from the current options so buildRequestBody reads the
    // live model/params/flags at request-build time; a bag of closures, cheap to recreate.
    const transport = createFluentMindTransport({
        endpoint: host.transport.endpoint,
        baseUrl: host.transport.baseUrl,
        filesBaseUrl: host.transport.filesBaseUrl,
        fetch: host.transport.fetch,
        credentials: host.transport.credentials,
        config: {
            agentIdentifier: options.agentIdentifier,
            projectId: options.projectId,
            model: options.model,
            parameters: options.parameters,
            isWebSearchEnabled: options.isWebSearchEnabled,
            isDeepSearchEnabled: options.isDeepSearchEnabled,
            isRelatedQuestionsEnabled: options.isRelatedQuestionsEnabled,
            relatedQuestionsCount: options.relatedQuestionsCount,
            isIncognitoMode: options.isIncognitoMode,
            isPublic: options.isPublic,
            mcpServers: options.mcpServers,
            skills: options.skills,
        },
    });

    const handleData: ChatOnDataCallback<FluentMindUIMessage> = (dataPart) => {
        const sink: ChatEventSink = {
            onConversationId: (id) => optionsRef.current.onConversationId(id),
            onTitle: (id, title) => optionsRef.current.onTitle?.(id, title),
            onConversationStatus: ({ conversationId, status }) =>
                optionsRef.current.onConversationStatus?.(conversationId, status),
            onPersistedMessageId: ({ clientId, serverId }) => {
                knownPersistedIdsRef.current.add(serverId);

                if (clientId) messageIdAliasRef.current.set(clientId, serverId);
            },
            onProgress: (progressPart) => toolProgressStore.apply(progressPart),
            onTurnAttempt: ({ attempt, assistantMessageId }) => {
                const lastAttempt = turnAttemptRef.current.get(assistantMessageId) ?? 0;

                turnAttemptRef.current.set(assistantMessageId, attempt);

                // Only a bump over a PREVIOUSLY seen attempt is a re-run; the
                // first marker of a turn (including attempt 1 on attach) is not.
                // The replay after re-attach re-emits this marker with the same
                // attempt, which no longer exceeds lastAttempt — no loop.
                if (lastAttempt > 0 && attempt > lastAttempt) {
                    toolProgressStoreRef.current?.clear();
                    void reattachAfterAttemptBump(assistantMessageId);
                }
            },
        };

        transport.onData?.(dataPart, sink);
    };

    const handleFinish: ChatOnFinishCallback<FluentMindUIMessage> = (event) => {
        toolProgressStore.finalize();
        optionsRef.current.onFinish?.(event);
    };

    const { runtime, resumeSend, resumeStream, reattachAfterAttemptBump, streamedConversationId, abortAttach } =
        useChatRuntimeFromConfig<FluentMindUIMessage>({
            api: host.transport.endpoint,
            attachApi: ({ conversationId }) =>
                `${host.transport.endpoint}/attach?conversationId=${encodeURIComponent(conversationId)}`,
            fetch: host.transport.fetch,
            credentials: host.transport.credentials,
            conversationId: options.conversationId,
            newChatEpoch: options.newChatEpoch,
            onConversationId: options.onConversationId,
            onSendStart: options.onSendStart,
            onData: handleData,
            onFinish: handleFinish,
            sendAutomaticallyWhen: shouldSendAutomatically,
            prepareRequestBody: ({ messages, body, conversationId, trigger, messageId, requestMetadata }) => {
                const { files } = optionsRef.current;
                const isReconnectResume = pendingReconnectResumeRef.current;
                const resumeServerIds = pendingReconnectServerIdsRef.current;

                pendingReconnectResumeRef.current = false;
                pendingReconnectServerIdsRef.current = [];

                // The runtime owns the user message, so this is the only point where its id
                // and the composer's Deep Research state are both in hand.
                if (messageId && trigger === 'submit-message' && optionsRef.current.isDeepSearchEnabled) {
                    markSentWithDeepResearch(messageId);
                }

                const toolApprovals = isReconnectResume
                    ? []
                    : extractApprovalDecisions(messages).filter((d) => !sentApprovalIdsRef.current.has(d.toolCallId));
                const gateApprovals = isReconnectResume
                    ? []
                    : extractReconnectGateApprovals(messages).filter(
                          (g) =>
                              !sentApprovalIdsRef.current.has(g.toolCallId) &&
                              (reconnectResumeCountsRef.current.get(g.serverId) ?? 0) < RECONNECT_RESUME_LIMIT,
                      );
                const genuiResults = isReconnectResume
                    ? []
                    : collectUnsentResumeResults(messages, resumeToolNamesRef.current, sentGenuiResultsRef.current);

                toolApprovals.forEach((d) => sentApprovalIdsRef.current.add(d.toolCallId));
                gateApprovals.forEach((g) => {
                    sentApprovalIdsRef.current.add(g.toolCallId);
                    reconnectResumeCountsRef.current.set(
                        g.serverId,
                        (reconnectResumeCountsRef.current.get(g.serverId) ?? 0) + 1,
                    );
                });
                genuiResults.forEach((r) => sentGenuiResultsRef.current.add(r.toolCallId));

                const reconnectApprovedServerIds = isReconnectResume
                    ? [...new Set(resumeServerIds)]
                    : [...new Set(gateApprovals.map((g) => g.serverId))];
                const isResume =
                    isReconnectResume ||
                    toolApprovals.length > 0 ||
                    gateApprovals.length > 0 ||
                    genuiResults.length > 0;
                const isRegenerate = trigger === 'regenerate-message';
                const anchorUserMessage = messageId
                    ? messages.find(
                          (message) =>
                              message.role === 'user' &&
                              (message.id === messageId || resolvePersistedMessageId(message.id) === messageId),
                      )
                    : undefined;
                const lastUserMessage = anchorUserMessage ?? findLastUserMessage(messages);
                const messageText = isRegenerate || isReconnectResume ? undefined : extractMessageText(lastUserMessage);
                const metadataFileIds = getMessageFileIds(lastUserMessage?.metadata);
                const fileIds = metadataFileIds.length > 0 ? metadataFileIds : getFileIds(files);
                const anchors = resolveRequestAnchors({
                    messages,
                    lastUserMessage,
                    isResume,
                    isRegenerate,
                    resolvePersistedMessageId,
                });
                const requestModelId = isRegenerate
                    ? (requestMetadata as { custom?: { modelId?: string } } | undefined)?.custom?.modelId
                    : undefined;

                const ctx: ChatTransportContext<FluentMindUIMessage> = {
                    messages,
                    conversationId,
                    trigger,
                    messageId,
                    requestMetadata,
                    anchors,
                    fileIds,
                    toolApprovals,
                    reconnectApprovedServerIds,
                    genuiResults,
                    reconnectResume: isReconnectResume,
                    messageText,
                    modelIdOverride: requestModelId,
                    clientTools: toClientTools(body, clientToolNamesRef.current),
                };

                return transport.buildRequestBody(ctx);
            },
        });

    const resumeAfterReconnect = useCallback(
        (serverIds?: string[]) => {
            pendingReconnectResumeRef.current = true;
            pendingReconnectServerIdsRef.current = serverIds ?? [];
            void resumeSend();
        },
        [resumeSend],
    );

    const activeConversationId = options.conversationId ?? streamedConversationId;

    return {
        runtime,
        resolvePersistedMessageId,
        isPersistedMessageId,
        registerPersistedMessageIds,
        resumeAfterReconnect,
        resumeStream,
        streamedConversationId,
        activeConversationId,
        toolProgressStore,
        abortAttach,
    };
}
