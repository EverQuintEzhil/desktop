import type { ChatTransport } from '@/components/chat-host';

import type { FluentMindDataParts, FluentMindTransportConfig, FluentMindUIMessage } from '../types';

import { buildChatRequestBody } from './build-chat-request-body';
import { APP_CONTEXT_CLOSE, APP_CONTEXT_OPEN, mapHistoryToUIMessages } from './map-history-to-ui-messages';

/**
 * App-pane context convention (componentType "app" agents): the app bundle
 * publishes a short description of what the user is currently looking at on
 * `window.__fmAppPaneContext` (set/cleared on its route changes). Outgoing
 * user messages get it appended inside <app_context> markers so the MODEL can
 * resolve "it / this pursuit / this page"; the live bubble renders the local
 * composer text (context-free) and the history mapper strips the block.
 */
const APP_PANE_CONTEXT_GLOBAL = '__fmAppPaneContext';

const readAppPaneContext = (): string | null => {
    if (typeof window === 'undefined') return null;
    const raw = (window as unknown as Record<string, unknown>)[APP_PANE_CONTEXT_GLOBAL];

    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
};

const withAppPaneContext = (messageText: string | undefined): string | undefined => {
    if (!messageText) return messageText;
    const context = readAppPaneContext();

    if (!context) return messageText;

    return `${messageText}\n\n${APP_CONTEXT_OPEN}\n${context}\n${APP_CONTEXT_CLOSE}`;
};

export function createFluentMindTransport(opts: {
    endpoint: string;
    baseUrl: string;
    filesBaseUrl: string;
    fetch: typeof fetch;
    credentials?: RequestCredentials;
    config: FluentMindTransportConfig;
}): ChatTransport<FluentMindUIMessage> {
    return {
        endpoint: opts.endpoint,
        baseUrl: opts.baseUrl,
        filesBaseUrl: opts.filesBaseUrl,
        fetch: opts.fetch,
        credentials: opts.credentials,
        buildRequestBody(ctx) {
            const requestBody = buildChatRequestBody({
                agentIdentifier: opts.config.agentIdentifier,
                conversationId: ctx.conversationId,
                projectId: opts.config.projectId,
                ...ctx.anchors,
                ...(ctx.modelIdOverride && { modelIdOverride: ctx.modelIdOverride }),
                model: opts.config.model,
                parameters: opts.config.parameters || {},
                isWebSearchEnabled: opts.config.isWebSearchEnabled || false,
                isDeepSearchEnabled: opts.config.isDeepSearchEnabled || false,
                isRelatedQuestionsEnabled: opts.config.isRelatedQuestionsEnabled || false,
                relatedQuestionsCount: opts.config.relatedQuestionsCount,
                isIncognitoMode: opts.config.isIncognitoMode || false,
                isPublic: opts.config.isPublic || false,
                fileIds: ctx.fileIds,
                mcpServers: opts.config.mcpServers,
                skills: opts.config.skills,
                messageText: withAppPaneContext(ctx.messageText),
            });

            return {
                body: {
                    ...requestBody,
                    ...(ctx.toolApprovals.length > 0 ? { toolApprovals: ctx.toolApprovals } : {}),
                    ...(ctx.reconnectApprovedServerIds.length > 0
                        ? { reconnectApprovedServerIds: ctx.reconnectApprovedServerIds }
                        : {}),
                    ...(ctx.genuiResults.length > 0 ? { genuiResults: ctx.genuiResults } : {}),
                    ...(ctx.reconnectResume ? { reconnectResume: true } : {}),
                    ...(ctx.clientTools ? { clientTools: ctx.clientTools } : {}),
                },
            };
        },
        onData(part, sink) {
            const dataPart = part as { type?: string; id?: string; data?: unknown };

            if (dataPart.type === 'data-progress') {
                if (dataPart.id && typeof dataPart.data === 'object' && dataPart.data !== null) {
                    const data = dataPart.data as FluentMindDataParts['progress'];

                    sink.onProgress?.({
                        id: dataPart.id,
                        phase: data.phase,
                        toolName: data.toolName,
                        refName: data.refName,
                        kind: data.kind,
                        elapsedMs: data.elapsedMs,
                    });
                }

                return;
            }

            if (dataPart.type === 'data-title') {
                const data = dataPart.data as FluentMindDataParts['title'];

                sink.onTitle(data.conversation_id, data.title);

                return;
            }

            if (dataPart.type === 'data-turn-attempt') {
                const data = dataPart.data as FluentMindDataParts['turn-attempt'] | undefined;

                if (data && typeof data.attempt === 'number' && typeof data.assistantMessageId === 'string') {
                    sink.onTurnAttempt?.({ attempt: data.attempt, assistantMessageId: data.assistantMessageId });
                }

                return;
            }

            if (dataPart.type === 'data-conversation') {
                const data = dataPart.data as FluentMindDataParts['conversation'];

                if (data.status) {
                    sink.onConversationStatus?.({ conversationId: data.conversation_id, status: data.status });
                }

                if (data.message_id) sink.onPersistedMessageId({ serverId: data.message_id });

                if (data.user_message_id) {
                    sink.onPersistedMessageId({
                        clientId: data.client_message_id ?? undefined,
                        serverId: data.user_message_id,
                    });
                }
            }
        },
        mapHistoryToMessages: mapHistoryToUIMessages,
    };
}
