import type { CompleteAttachment } from '@assistant-ui/react';
import type { InfiniteData } from '@tanstack/react-query';
import type { UIMessage } from 'ai';
import type { MutableRefObject, ReactNode } from 'react';

import type { ArtifactPointer } from '@/components/agent-chat/artifact/artifact-types';
import type { DeepResearchCustom, ResearchContent } from '@/components/agent-chat/research/research-contract';
import type { RequestedResearchView } from '@/components/agent-chat/research/research-pane';
import type { DropDownValueObject } from '@/components/ui/dropdown-menu';
import type { McpConnection } from '@/lib/api';
import type { GenUIDataPayload } from '@/lib/genui/types';
import type { ChatAgentType, ModelValueType, PromptType, SkillType } from '@/types/admin';
import type { PagedList } from '@/types/api-types';
import type {
    ChatFilesState,
    ConversationDataPart,
    ConversationStatus,
    HistoryType,
    ParameterValue,
    PlusDropdownOption,
} from '@/types/chat';

export interface McpServerArgument {
    _id: string;
    isEnabled: boolean;
}

export interface SkillArgument {
    _id: string;
    isEnabled: boolean;
}

export interface DisabledAgentSkill {
    _id: string;
    name: string;
    isRecommended?: boolean;
}

export interface NonOauthConnector {
    _id: string;
    name: string;
}

/** An OAuth connector the user has not connected yet (or whose connection failed). */
export interface DisconnectedConnector {
    _id: string;
    name: string;
}

// The agent config the transport needs to assemble a /ai/chat request body.
export interface FluentMindTransportConfig {
    agentIdentifier: string;
    projectId?: string | null;
    model: DropDownValueObject<ModelValueType> | null;
    parameters: Record<string, ParameterValue>;
    isWebSearchEnabled: boolean;
    isDeepSearchEnabled: boolean;
    isRelatedQuestionsEnabled: boolean;
    relatedQuestionsCount?: number;
    isIncognitoMode: boolean;
    isPublic: boolean;
    mcpServers?: McpServerArgument[];
    skills?: SkillArgument[];
}

export interface HomeSubmitPayload {
    message: string;
    attachments?: CompleteAttachment[];
    fileIds?: string[];
    /** Stamp the conversation created by this send into a project. */
    projectId?: string;
}

export type ChatAgentLocationState = { payload?: HomeSubmitPayload; pendingBranchPrompt?: string } | null;

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';
export type ReasoningSummary = 'auto' | 'concise' | 'detailed';

export interface ReasoningOptions {
    effort?: ReasoningEffort;
    summary?: ReasoningSummary;
}

type ChatArgumentValue =
    | string
    | number
    | boolean
    | string[]
    | ReasoningOptions
    | McpServerArgument[]
    | SkillArgument[]
    | undefined;

export interface FluentMindChatRequestBody {
    agentIdOrIdentifier: string;
    conversationId: string | null;
    /** When set on a new conversation, stamps it into the project. */
    projectId?: string;
    trigger?: 'submit-message' | 'regenerate-message';
    parentMessageId?: string | null;
    clientMessageId?: string;
    truncateFromMessageId?: string | null;
    modelId?: string;
    fileIds?: string[];
    toolApprovals?: Array<{ toolCallId: string; approved: boolean; reason?: string }>;
    /** Resume a turn paused on MCP reconnect; the backend streams under the paused message's id. */
    reconnectResume?: boolean;
    arguments: {
        message?: string;
        reasoning?: ReasoningOptions;
        tools?: string[];
        mcpServers?: McpServerArgument[];
        skills?: SkillArgument[];
        webSearch?: boolean;
        deepSearch?: boolean;
        relatedQuestions?: number;
        temperature?: number;
        topP?: number;
        topK?: number;
        maxOutputTokens?: number;
        [parameter: string]: ChatArgumentValue;
    };
    options: {
        stream: boolean;
        queue?: boolean;
        incognito?: boolean;
        public?: boolean;
    };
}

export interface TokenUsage {
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
    total_tokens: number;
    cached_input_tokens?: number | null;
    cache_write_input_tokens?: number | null;
    input_tokens_co2?: number | null;
    cached_input_tokens_co2?: number | null;
    cache_write_input_tokens_co2?: number | null;
    output_tokens_co2?: number | null;
    reasoning_tokens_co2?: number | null;
    total_tokens_co2?: number | null;
    co2_multiplier_per_token?: number | null;
    input_tokens_cost?: number | null;
    cached_input_tokens_cost?: number | null;
    cache_write_input_tokens_cost?: number | null;
    output_tokens_cost?: number | null;
    reasoning_tokens_cost?: number | null;
    total_tokens_cost?: number | null;
    input_cost_per_million_tokens?: number | null;
    cached_input_cost_per_million_tokens?: number | null;
    cache_write_input_cost_per_million_tokens?: number | null;
    output_cost_per_million_tokens?: number | null;
    reasoning_cost_per_million_tokens?: number | null;
}

export interface StreamedAiInfo {
    provider?: string;
    model?: string;
    model_id?: string;
    token_usage?: TokenUsage;
}

export interface MessageAiInfo extends DeepResearchCustom {
    createdAt?: string;
    usage?: TokenUsage;
    aiProvider?: string;
    aiModel?: string;
    // Persisted GenUI widget state (spec D5), keyed by toolCallId. Lives under
    // `custom` because assistant-ui only preserves `metadata.custom` through
    // importExternalState — top-level metadata fields are dropped on reopen.
    genuiState?: Record<string, unknown>;
    // Set when the turn was stopped/aborted mid-stream (client disconnect); drives the Interrupted tag.
    partial?: boolean;
    // Set when the turn ended with no answer.
    error?: string;
    pending?: boolean;
    // Final elapsed (ms) per tool call that streamed progress; drives "Used X · 10s" on reopen.
    toolDurations?: Record<string, number>;
    // Reasoning wall-clock (ms); drives "Thought for {n}s" on reopen.
    reasoningMs?: number;
}

export interface FluentMindMessageMetadata {
    conversationId?: string;
    messageId?: string;
    fileIds?: string[];
    createdAt?: string;
    generationStatus?: 'in_progress' | 'completed' | 'failed';
    submittedFeedback?: { type: 'positive' | 'negative' };
    aiProvider?: string;
    aiModel?: string;
    usage?: TokenUsage;
    custom?: MessageAiInfo;
}

export interface WebSource {
    title?: string;
    url: string;
    description?: string;
    favicon?: string;
    site_name?: string;
    thumbnail?: string;
    type?: 'url';
}

export type FluentMindDataParts = {
    conversation: ConversationDataPart & {
        status: ConversationStatus;
        message_id?: string | null;
        parent_id?: string | null;
        user_message_id?: string | null;
        user_message_parent_id?: string | null;
        client_message_id?: string | null;
    };
    sources: WebSource[];
    suggestions: string[];
    relatedQuestions: string[];
    status: {
        message: string;
    };
    title: {
        conversation_id: string;
        title: string;
    };
    artifact: ArtifactPointer;
    // GenUI ui ref (spec D10) — correlated to its tool call by toolCallId.
    genui: GenUIDataPayload;
    'ai-info': {
        message_id?: string | null;
        ai_info?: StreamedAiInfo | null;
        related_questions_ai_info?: StreamedAiInfo | null;
    };
    progress: {
        kind?: string;
        label?: string;
        phase?: string;
        toolName?: string;
        refName?: string;
        elapsedMs?: number;
    };
    // Temporal relay reset marker (transient): the turn's activity attempt
    // re-ran — discard partial in-flight assistant content for this message.
    'turn-attempt': {
        attempt: number;
        assistantMessageId: string;
    };
};

export type FluentMindUIMessage = UIMessage<FluentMindMessageMetadata, FluentMindDataParts>;

export type RawFilePart = {
    type: 'file';
    data: string;
    mediaType: string;
    filename?: string;
};

export type RawImagePart = {
    type: 'image';
    image: string;
    filename?: string;
};

export type RawTextPart = {
    type: 'text';
    text: string;
};

export type RawReasoningPart = {
    type: 'reasoning';
    text: string;
};

export type RawMessagePart = RawTextPart | RawFilePart | RawImagePart | RawReasoningPart | Record<string, unknown>;

export interface ConversationMessage {
    _id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    user_id?: string;
    created_at?: string;
    parent_id?: string | null;
    reasoning?: unknown | null;
    content: RawMessagePart[];
    ai_info?: {
        token_usage?: FluentMindMessageMetadata['usage'];
        provider?: string;
        model?: string;
    } | null;
    liked?: boolean;
    disliked?: boolean;
    liked_by_user_ids?: string[];
    disliked_by_user_ids?: string[];
    metadata?: {
        rating?: 'positive' | 'negative' | null;
        partial?: boolean;
        pending?: boolean;
        error?: string;
        sources?: WebSource[];
        related_questions?: string[];
        files?: MessageFile[];
        // Persisted GenUI widget state (spec D5), keyed by toolCallId.
        genui_state?: Record<string, unknown>;
        // Final elapsed (ms) per tool call that streamed progress.
        tool_durations?: Record<string, number>;
        // Reasoning wall-clock (ms).
        reasoning_ms?: number;
    } | null;
}

export interface MessageFile {
    _id: string;
    name: string;
    extension?: string;
    type?: string;
    ai?: unknown;
}

export interface ChatSource {
    id: string;
    url: string;
    title: string;
    description?: string;
    siteName: string;
    faviconUrl?: string;
    thumbnailUrl?: string;
}

export interface UseConnectorsResult {
    connections: McpConnection[];
    isLoading: boolean;
    enabledIds: string[];
    disabledMap: Record<string, boolean>;
    toggleMcpServer: (mcpServerId: string) => void;
    /** Idempotent counterpart to `toggleMcpServer`; resolves `false` when the preference could not be saved. */
    setConnectorEnabled: (mcpServerId: string, enabled: boolean) => Promise<boolean>;
    /**
     * Switches a logged-out OAuth connector on and continues into its auth flow, or
     * switches it back off. For rows where enabling alone leaves nothing usable.
     */
    toggleDisconnectedConnector: (mcpServerId: string) => Promise<void>;
    enablingId: string | null;
    mcpServers: McpServerArgument[];
    nonOauthConnectors: NonOauthConnector[];
    disconnectedConnectors: DisconnectedConnector[];
    /** Connector description keyed by `_id`, for surfaces whose connector shape cannot carry one. */
    connectorDescriptions: Record<string, string>;
    /** Connector origin URL keyed by `_id`, for resolving the connector favicon in mention surfaces. */
    connectorServerUrls: Record<string, string>;
    /** Starts the OAuth flow; resolves `false` when the authorization URL could not be obtained. */
    reconnect: (mcpServerId: string) => Promise<boolean>;
    connectingId: string | null;
    cancelConnection: (mcpServerId: string) => void;
    cancellingId: string | null;
}

export interface UseSkillsResult {
    skills: SkillType[];
    customIds: string[];
    sharedIds: string[];
    enabledIds: string[];
    toggleSkill: (skillId: string) => void;
    skillArguments: SkillArgument[];
    disabledAgentSkills: DisabledAgentSkill[];
    enableSkill: (skillId: string) => Promise<boolean>;
}

export interface ComposerActions {
    openFilePicker?: () => void;
    openModelSelector?: () => void;
}

export interface AgentComposerState {
    model: DropDownValueObject<ModelValueType> | null;
    setModel: (model: DropDownValueObject<ModelValueType> | null) => void;
    availableModels: DropDownValueObject<ModelValueType>[];
    parameters: Record<string, ParameterValue>;
    setParameter: (key: string, value: ParameterValue) => void;
    setParameters: (params: Record<string, ParameterValue>) => void;
    removeParameter: (key: string) => void;
    isWebSearchEnabled: boolean;
    setIsWebSearchEnabled: (enabled: boolean) => void;
    isDeepSearchEnabled: boolean;
    setIsDeepSearchEnabled: (enabled: boolean) => void;
    /** Admin gate (uiConfig.home.search.showDeepSearch): whether the composer offers the toggle at all. */
    showDeepSearch: boolean;
    isIncognitoMode: boolean;
    toggleIncognitoMode: () => void;
    isPublic: boolean;
    setIsPublic: (enabled: boolean) => void;
    plusDropdownOptions: PlusDropdownOption[];
    handlePlusDropdownSelect: (option: PlusDropdownOption) => void;
    showPlusDropdown: boolean;
    setShowPlusDropdown: (open: boolean) => void;
    renderSelectedParameters: () => ReactNode;
    connectors: UseConnectorsResult;
    customConnectorIds: string[];
    sharedConnectorIds: string[];
    skills: UseSkillsResult;
    composerActionsRef: MutableRefObject<ComposerActions | null>;
}

export interface ConversationHistoryState {
    loading: boolean;
    error: boolean;
    page: number;
    pages: number;
    showMoreLoading: boolean;
    favoritesLoading: boolean;
    allLoading: boolean;
    allError: boolean;
    allPage: number;
    allPages: number;
    allShowMoreLoading: boolean;
    favoritesPage: number;
    favoritesPages: number;
    favoritesShowMoreLoading: boolean;
}

export interface UseConversationHistoryReturn {
    histories: HistoryType[];
    favoriteHistories: HistoryType[];
    allHistories: HistoryType[];
    state: ConversationHistoryState;
    fetchConversations: (page: number) => Promise<void>;
    fetchAllConversations: (page: number) => Promise<void>;
    fetchFavorites: () => Promise<void>;
    deleteConversation: (historyId: string, onSuccess?: () => void) => Promise<void>;
    clearAllConversations: (force?: boolean) => Promise<void>;
    renameConversation: (historyId: string, title: string, onSuccess?: () => void) => Promise<void>;
    favoriteConversation: (historyId: string, onSuccess?: () => void) => Promise<void>;
    isDeleteSubmitting: boolean;
    isRenameSubmitting: boolean;
    isFavoriteSubmitting: boolean;
}

export type ConversationHistoryQueryData = InfiniteData<PagedList<HistoryType>, number>;

export interface AgentComposerContextValue {
    composer: AgentComposerState;
    filesState: ChatFilesState;
    /** Resume the paused/failed turn after an MCP OAuth reconnect; optional server ids become reconnectApprovedServerIds. */
    resumeAfterReconnect?: (serverIds?: string[]) => void;
    onStopGeneration?: () => void;
}

export interface ToolApprovalContextValue {
    isAlwaysAllowed: (toolName: string) => boolean;
    addAlwaysAllowed: (toolName: string) => void;
    register: (id: string) => void;
    unregister: (id: string) => void;
    isActive: (id: string) => boolean;
}

export interface Conversation {
    _id: string;
    title: string;
    status: string;
    user_id: string;
    branched_from_conversation_id?: string | null;
    branched_from_message_id?: string | null;
    branch_message_id?: string | null;
    active_leaf_message_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface BranchResult extends Conversation {}

export interface ChatViewContextValue {
    agent: ChatAgentType | null;
    conversationId: string | null;
    onShowSources: (sources: ChatSource[]) => void;
    onShowResearch: (
        messageId: string,
        content: ResearchContent,
        isRunning: boolean,
        view?: RequestedResearchView,
    ) => void;
    /** Id of the message whose research trace the side panel is currently showing. */
    activeResearchMessageId: string | null;
    onShowArtifact: (artifact: ArtifactPointer) => void;
    activeArtifactId: string | null;
    isFromAdmin: boolean;
    onPromptAdded?: (prompt: PromptType) => void;
    onEditStart: () => void;
    onEditEnd: () => void;
    branchedFromConversation: { id: string; title: string; messageId?: string | null } | null;
    isForeignConversation?: boolean;
    /** Read-only viewer (admin conversation preview): every write path is gated off. */
    isReadOnly?: boolean;
    isMessageInterrupted?: (id: string) => boolean;
    isPendingGeneration?: boolean;
}
