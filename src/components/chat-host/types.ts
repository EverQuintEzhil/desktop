import type { UIMessage } from 'ai';
import type { ReactNode } from 'react';

import type { AgentType } from '@/types/admin';
import type { ConversationStatus } from '@/types/chat';

export interface ChatSession {
    user: { id: string; email?: string; name?: { first?: string; last?: string } } | null;
    tenant: { id?: string; name?: string; logoSrc?: string; logoSrcDark?: string } | null;
}

export interface ChatTransportContext<TMsg extends UIMessage> {
    messages: TMsg[];
    conversationId: string | null;
    trigger?: 'submit-message' | 'regenerate-message';
    messageId?: string;
    requestMetadata?: unknown;
    // resolved BEFORE calling buildRequestBody (impure work stays in the feature hook):
    anchors: { trigger?: 'regenerate-message'; parentMessageId?: string | null; clientMessageId?: string };
    fileIds: string[];
    toolApprovals: Array<{ toolCallId: string; approved: boolean; reason?: string }>;
    reconnectApprovedServerIds: string[];
    genuiResults: Array<{ toolCallId: string; output: unknown }>;
    reconnectResume: boolean;
    /** Browser-executed tool schemas exposed to the model for this run. */
    clientTools?: Record<string, { description: string; parameters: unknown }>;
    messageText?: string;
    modelIdOverride?: string;
}

export interface ChatEventSink {
    onConversationId(id: string): void;
    onPersistedMessageId(x: { clientId?: string; serverId: string }): void;
    onTitle(conversationId: string, title: string): void;
    onConversationStatus?(x: { conversationId: string; status: ConversationStatus }): void;
    onProgress?(part: {
        id: string;
        phase?: string;
        toolName?: string;
        refName?: string;
        kind?: string;
        elapsedMs?: number;
    }): void;
    onTurnAttempt?(part: { attempt: number; assistantMessageId: string }): void;
}

export interface ChatTransport<TMsg extends UIMessage> {
    endpoint: string;
    baseUrl: string;
    filesBaseUrl: string;
    fetch: typeof fetch;
    credentials?: RequestCredentials;
    buildRequestBody(ctx: ChatTransportContext<TMsg>): { body: Record<string, unknown> };
    onData?(part: unknown, sink: ChatEventSink): void;
    mapHistoryToMessages?(raw: unknown[]): TMsg[];
}

export interface NavigationAdapter {
    setConversationId(id: string | null, opts?: { replace?: boolean; pendingPrompt?: string }): void;
    startNewConversation(): void;
}

export interface ConversationAdapter {
    list(p: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
    loadMessages(id: string, p?: unknown): Promise<{ messages: unknown[]; headId?: string | null }>;
    loadConversation(id: string): Promise<unknown | null>;
    delete(id: string): Promise<void>;
    deleteAll(opts: { force?: boolean }): Promise<void>;
    rename(id: string, title: string): Promise<void>;
    toggleFavorite(id: string): Promise<{ favorited: boolean; favoritedAt: number | null }>;
    branch(id: string, p: unknown): Promise<unknown>;
    updateMessage(id: string, messageId: string, p: unknown): Promise<unknown>;
    updateConversation(id: string, p: unknown): Promise<unknown>;
    moveToProject(id: string, projectId: string | null): Promise<unknown>;
    getConversation(id: string): Promise<unknown>;
    getConversationMessages(id: string, p?: unknown): Promise<unknown>;
}

export type ChatThemeTokens = Partial<Record<string, string>>;

export type ChatAgentTypeLike = AgentType;

export interface TokenUsageLike {
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

export interface TokenUsageDialogSlotProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    usage: TokenUsageLike;
    model?: string;
}

export interface InstructionsEditorSlotProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    enableMentions?: boolean;
    className?: string;
    contentClassName?: string;
    editorClassName?: string;
}

export type ChatSidePane = 'sources' | 'files' | 'tools' | 'research' | 'routine' | 'artifact' | null;

export interface ChatSidePanelController {
    activePane: ChatSidePane;
    open: (pane: Exclude<ChatSidePane, null>) => void;
    close: () => void;
    toggle: (pane: Exclude<ChatSidePane, null>) => void;
}

export interface AgentLauncherSlot {
    launcherName?: string;
    renderAgentDetailsSidesheet?: () => ReactNode;
    renderInfoIcon?: (wrapperClassName?: string) => ReactNode;
}

/** Context handed to {@link ChatSlots.renderHeader}. */
export interface ChatHeaderSlotContext {
    agent: ChatAgentTypeLike;
    conversationId: string | null;
}

/** Context handed to {@link ChatSlots.useAgentMenuItems}. */
export interface AgentMenuItemsSlotContext {
    agent: ChatAgentTypeLike;
}

/** Context handed to the conversation menu/badge slots. */
export interface ConversationMenuSlotContext {
    agent: ChatAgentTypeLike;
    conversationId: string;
}

/** Context handed to the home/empty-state slots (no conversation yet). */
export interface HomeSlotContext {
    agent: ChatAgentTypeLike;
}

/** Context handed to {@link ChatSlots.renderComposer}. */
export interface ChatComposerSlotContext {
    /** Submit a message on the active thread (routed through the safe send path). */
    send: (message: string) => void;
    /** True while a turn is streaming. */
    isRunning: boolean;
    /** True when submitting should be blocked (e.g. a turn is in flight). */
    isDisabled: boolean;
}

/** Context handed to {@link ChatSlots.renderMessageActions}. */
export interface ChatMessageActionsSlotContext {
    messageId: string;
    role: 'assistant' | 'user';
}

export interface ChatSlots {
    // Agent launcher / details sidesheet (home + chat-view header). Hook-shaped: returns render fns.
    useAgentLauncher?: (agent: ChatAgentTypeLike) => AgentLauncherSlot;
    // Single-active-pane coordinator for the right-hand side panes (sources,
    // files, tools, research). Hook-shaped like useAgentLauncher. Absent →
    // chat-view falls back to a local controller with the same semantics.
    useSidePanel?: () => ChatSidePanelController;
    // Items acting on the agent itself (e.g. "Edit agent"), injected into the
    // conversation header "..." menu below the conversation items. Hook-shaped so
    // the slot can gate on the viewer's permissions and return null — the header
    // uses that to decide whether the "..." menu exists at all.
    // Two consequences of it being hook-shaped: a host must supply it (or not) for
    // the whole lifetime of a mounted chat view, since the header's hook count
    // depends on its presence; and it runs even when `renderHeader` wins and the
    // result is discarded. Gate inside the hook, not by omitting it.
    // App-only; absent → nothing renders.
    useAgentMenuItems?: (ctx: AgentMenuItemsSlotContext) => ReactNode;
    renderFooter?: () => ReactNode;
    renderTokenUsageDialog?: (props: TokenUsageDialogSlotProps) => ReactNode;
    renderInstructionsEditor?: (props: InstructionsEditorSlotProps) => ReactNode;
    // Connectors "Manage" is a real link so it keeps anchor semantics (cmd/ctrl
    // click, open-in-new-tab). The host wraps the row content in its router's
    // Link; when the slot is absent (e.g. the SDK, which has no router) the row
    // is hidden. Skills/memories navigate on click and hide the same way.
    renderManageConnectorsLink?: (children: ReactNode) => ReactNode;
    // Same pattern for in-chat links to another conversation (e.g. the
    // "Branched from" banner): host wraps in its router's Link; when absent the
    // chat falls back to a click handler via the navigation adapter.
    renderConversationLink?: (conversationId: string, children: ReactNode) => ReactNode;
    // Resolve the absolute share URL for a conversation. Absent → the share
    // modal falls back to the current window location (e.g. hosts routed on the
    // real URL). Used by hosts that run under an isolated router (e.g. preview).
    resolveShareUrl?: (conversationId: string) => string;
    // Assistant message avatar. Absent → the default tenant-logo avatar. Hosts
    // without a tenant logo (e.g. the SDK in an external app) supply their own
    // node, or return null to hide the avatar entirely.
    renderAssistantAvatar?: (className: string) => ReactNode;
    // Suppress the user-message "Add to prompt library" action. The prompt
    // library also needs host wiring (onPromptAdded / onOpenPrompt), so hosts
    // that can't service it (e.g. the SDK in an external app) hide the action.
    hidePromptLibrary?: boolean;
    onManageSkills?: () => void;
    onManageMemories?: () => void;
    onOpenPrompt?: (promptId: string) => void;
    // Replace the conversation header row (brand name + share/menu). Absent → the
    // built-in header renders.
    renderHeader?: (ctx: ChatHeaderSlotContext) => ReactNode;
    // Extra items injected into the conversation header "..." menu, above the
    // built-in Delete item (e.g. Pin, Rename, move-to-space). App-only; absent →
    // only the default Delete item renders.
    renderConversationMenuItems?: (ctx: ConversationMenuSlotContext) => ReactNode;
    // A chip shown beside the agent name in the header (e.g. the space the
    // conversation belongs to). App-only; absent → nothing renders.
    renderConversationBadge?: (ctx: ConversationMenuSlotContext) => ReactNode;
    // Extra action(s) rendered in the conversation header, to the LEFT of the
    // built-in Share button (e.g. a files-panel toggle). App-only; absent → nothing.
    renderHeaderActions?: (ctx: ConversationMenuSlotContext) => ReactNode;
    // An app-owned panel rendered as the right-hand flex sibling of the message
    // column (same slot as the built-in sources pane). App-only; absent → nothing.
    renderChatSidePanel?: (ctx: ConversationMenuSlotContext) => ReactNode;
    // Extra action(s) rendered in the home/empty-state header cluster, beside the
    // built-in temporary-chat toggle (e.g. a connectors/skills panel toggle).
    // App-only; absent → nothing.
    renderHomeHeaderActions?: (ctx: HomeSlotContext) => ReactNode;
    // An app-owned panel rendered as the right-hand flex sibling of the home
    // screen (same shell as {@link renderChatSidePanel}). App-only; absent → nothing.
    renderHomeSidePanel?: (ctx: HomeSlotContext) => ReactNode;
    // Replace the home/empty state shown before the first message. Absent → the
    // built-in home screen renders.
    renderEmptyState?: () => ReactNode;
    // Replace the composer at both the home and in-conversation sites. Absent →
    // the built-in composer renders.
    renderComposer?: (ctx: ChatComposerSlotContext) => ReactNode;
    // Content rendered directly above the in-conversation composer (e.g. a
    // notification-permission prompt). App-only; absent → nothing renders.
    renderAboveComposer?: () => ReactNode;
    // Replace the assistant message copy/regenerate/feedback action row (the
    // branch picker and sources row stay). Absent → the built-in actions render.
    renderMessageActions?: (ctx: ChatMessageActionsSlotContext) => ReactNode;
}

export interface ChatHost {
    session: ChatSession;
    transport: Pick<ChatTransport<UIMessage>, 'endpoint' | 'baseUrl' | 'filesBaseUrl' | 'fetch' | 'credentials'>;
    navigation: NavigationAdapter;
    conversations: ConversationAdapter;
    onConversationCreated?: (id: string, meta: { title?: string; projectId?: string }) => void;
    onHistoryLoaded?: (messageIds: string[]) => void;
    theme?: ChatThemeTokens;
    slots?: ChatSlots;
}

/**
 * Per-part className overrides. Every key is optional and merged (via the
 * project's `cn`/tailwind-merge) over the built-in classes at its render site,
 * so overrides win predictably. Absent keys are a no-op — the default classes
 * render exactly as before. Delivered through {@link ChatClassNamesProvider}.
 */
export interface ChatClassNames {
    /** Outermost widget container. */
    root?: string;
    /** Conversation header row. */
    header?: string;
    /** Thread root element. */
    thread?: string;
    /** Scrollable message viewport. */
    viewport?: string;
    /** Every message root (user and assistant). */
    message?: string;
    /** User message root (in addition to `message`). */
    userMessage?: string;
    /** Assistant message root (in addition to `message`). */
    assistantMessage?: string;
    /** Assistant message action row wrapper. */
    messageActions?: string;
    /** Composer wrapper. */
    composer?: string;
    /** Composer text input element. */
    composerInput?: string;
    /** Home/empty state root. */
    emptyState?: string;
    /** Recents surface (reserved for a later phase). */
    recents?: string;
    /** Floating launcher button (only used when `type="floating"`). */
    launcher?: string;
    /** Floating panel container (only used when `type="floating"`). */
    panel?: string;
}

export interface ChatFeatureFlags {
    branching: boolean;
    approvals: boolean;
    genui: boolean;
    webSearch: boolean;
    deepSearch: boolean;
    sources: boolean;
    fileUpload: boolean;
    persistence: boolean;
    historySidebar: boolean;
    recents: boolean;
    projects: boolean;
    promptLibrary: boolean;
}
