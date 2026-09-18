import { useChat } from '@ai-sdk/react';
import { useAui, useAuiState, useCloudThreadListAdapter, useRemoteThreadListRuntime } from '@assistant-ui/react';
import { AssistantChatTransport, useAISDKRuntime } from '@assistant-ui/react-ai-sdk';
import type { ChatOnDataCallback, ChatOnFinishCallback, UIMessage } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';

import { authAwareFetch } from '@/lib/auth-aware-fetch';
import { rememberChatDeepLink } from '@/lib/auth/handle-session-expired';

import { type AttachAbortHandle, createAttachFetch } from './attach-fetch';
import { useClearOptimisticOnSettle } from './use-clear-optimistic-on-settle';
import { useStreamResumeController } from './use-stream-resume-controller';

export interface PrepareRequestArgs<TMsg extends UIMessage> {
    messages: TMsg[];
    body?: unknown;
    trigger?: 'submit-message' | 'regenerate-message';
    messageId?: string;
    requestMetadata?: unknown;
    conversationId: string | null;
}

export interface ChatRuntimeConfig<TMsg extends UIMessage> {
    api: string;
    conversationId?: string | null;
    newChatEpoch?: number;
    onConversationId?: (id: string) => void;
    prepareRequestBody: (args: PrepareRequestArgs<TMsg>) => { body: Record<string, unknown> };
    onData?: ChatOnDataCallback<TMsg>;
    onFinish?: ChatOnFinishCallback<TMsg>;
    sendAutomaticallyWhen?: (opts: { messages: TMsg[] }) => boolean;
    initialMessages?: TMsg[];
    fetch?: typeof fetch;
    credentials?: RequestCredentials;
    /** Fires when a POST send starts, before its stream exists. */
    onSendStart?: () => void;
    /** Builds the GET endpoint that re-attaches to an in-flight turn's stream
     *  (Temporal chat path). Enables resumeStream() and 409-in_flight rescue. */
    attachApi?: (args: { conversationId: string }) => string;
}

export function useChatRuntimeFromConfig<TMsg extends UIMessage>(config: ChatRuntimeConfig<TMsg>) {
    const configRef = useRef(config);
    const conversationIdRef = useRef<string | null | undefined>(config.conversationId);
    const lastEpochRef = useRef(config.newChatEpoch);
    // "A stream in THIS runtime instance produced this conversation id" — it
    // gates work that must not run while this tab owns the live stream. It
    // must start null: seeding it from the route id made a hard reload of
    // /chat/<id> look like an active local stream, which killed the
    // mid-turn recovery path (no pending indicator, no status poll, no
    // re-attach) on exactly the load where it is needed most.
    const [streamedConversationId, setStreamedConversationId] = useState<string | null>(null);

    configRef.current = config;

    if (config.newChatEpoch !== undefined) {
        // Epoch-controlled surface (app): a null id WITHOUT an epoch bump must not
        // clobber an id minted mid-stream; only a fresh epoch resets the ref to null.
        if (config.newChatEpoch !== lastEpochRef.current) {
            lastEpochRef.current = config.newChatEpoch;
            conversationIdRef.current = config.conversationId ?? null;
        } else if (config.conversationId != null) {
            conversationIdRef.current = config.conversationId;
        }
    } else if (config.conversationId !== undefined) {
        // Legacy controlled surface (builder): null re-pins the ref to null.
        conversationIdRef.current = config.conversationId;
    }
    // Floating (id undefined, no epoch): fall through and keep the ref as-is.

    const transportRef = useRef<AssistantChatTransport<TMsg> | null>(null);
    const initializeThreadRef = useRef<(() => Promise<unknown>) | null>(null);
    const attachAbortRef = useRef<AttachAbortHandle | null>(null);
    const sendInFlightRef = useRef(false);

    if (!transportRef.current) {
        const baseFetch = config.fetch ?? authAwareFetch;

        const fetchAttach = createAttachFetch(baseFetch, attachAbortRef);

        // POST /chat answers 409 {value:{in_flight:true}} when a turn is already
        // running for this conversation (Temporal path enforces one at a time).
        // Rescue by attaching to the in-flight stream instead of surfacing an
        // error; a 204 attach (turn just finished) completes as an empty stream
        // and hydration picks up the persisted result.
        const fetchWithInFlightRescue: typeof fetch = async (input, init) => {
            if ((init?.method ?? 'GET').toUpperCase() === 'GET') return fetchAttach(input, init);

            const response = await baseFetch(input, init);

            if (response.status !== 409) return response;

            const attachApi = configRef.current.attachApi;
            const conversationId = conversationIdRef.current;

            if (!attachApi || !conversationId) return response;

            let inFlight = false;

            try {
                const payload = (await response.clone().json()) as { value?: { in_flight?: boolean } };

                inFlight = payload?.value?.in_flight === true;
            } catch {
                return response;
            }

            if (!inFlight) return response;

            const attached = await fetchAttach(attachApi({ conversationId }), {
                method: 'GET',
                credentials: init?.credentials ?? 'include',
                signal: init?.signal,
            });

            if (attached.status === 204) {
                return new Response('', { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
            }

            return attached;
        };

        transportRef.current = new AssistantChatTransport<TMsg>({
            api: config.api,
            credentials: config.credentials ?? 'include',
            fetch: fetchWithInFlightRescue,
            prepareReconnectToStreamRequest: () => {
                const attachApi = configRef.current.attachApi;
                const conversationId = conversationIdRef.current;

                // Without an attach endpoint or a known conversation there is
                // nothing to reconnect to; the stock URL would be wrong, so
                // point at the POST endpoint — resumeStream() is only invoked
                // by surfaces that configured attachApi with a live id.
                if (!attachApi || !conversationId) return { api: configRef.current.api };

                return { api: attachApi({ conversationId }) };
            },
            prepareSendMessagesRequest: ({ messages, body, trigger, messageId, requestMetadata }) => {
                // Mirrors useChatRuntime: flip the remote thread list item from
                // "new" to "regular" on send so switchToNewThread mints a fresh thread.
                void initializeThreadRef.current?.();

                // chat.status is a committed useSyncExternalStore snapshot and still
                // reads 'ready' until the next render.
                sendInFlightRef.current = true;
                configRef.current.onSendStart?.();

                return configRef.current.prepareRequestBody({
                    messages,
                    body,
                    trigger,
                    messageId,
                    requestMetadata,
                    conversationId: conversationIdRef.current ?? null,
                });
            },
        });
    }

    const transport = transportRef.current;

    const handleData: ChatOnDataCallback<TMsg> = (dataPart) => {
        if (dataPart.type === 'data-conversation') {
            const data = dataPart.data as { conversation_id?: unknown } | undefined;
            const conversationId = typeof data?.conversation_id === 'string' ? data.conversation_id : null;

            if (conversationId && conversationId !== conversationIdRef.current) {
                conversationIdRef.current = conversationId;
                setStreamedConversationId(conversationId);
                configRef.current.onConversationId?.(conversationId);

                const { pathname, origin } = window.location;
                const chatHref = /\/chat\/[^/?#]+/.test(pathname)
                    ? window.location.href
                    : `${origin}${pathname.replace(/\/$/, '')}/chat/${conversationId}`;

                rememberChatDeepLink(chatHref);
            }
        }

        configRef.current.onData?.(dataPart);
    };

    // Drop a stale streamed id when the external id diverges (e.g. navigating back
    // to a prior conversation) so a reload is not wrongly skipped.
    useEffect(() => {
        if (config.conversationId && streamedConversationId && config.conversationId !== streamedConversationId) {
            setStreamedConversationId(null);
        }
    }, [config.conversationId, streamedConversationId]);

    // A new-chat epoch bump resets the streamed id for a fresh thread.
    useEffect(() => {
        setStreamedConversationId(null);
    }, [config.newChatEpoch]);

    // Re-submits the current messages without a new user message or regenerate;
    // bound to the active thread's chat instance on each RuntimeHook render.
    const resumeSendRef = useRef<(() => Promise<void>) | null>(null);
    const setMessagesRef = useRef<((updater: (messages: TMsg[]) => TMsg[]) => void) | null>(null);

    // Discards the streamed parts of one assistant message (Temporal attempt
    // reset): the re-streamed content rebuilds it from scratch.
    const resetAssistantMessage = useCallback((messageId: string) => {
        setMessagesRef.current?.((messages) =>
            messages.map((message) =>
                message.role === 'assistant' && message.id === messageId
                    ? { ...message, parts: [] as TMsg['parts'] }
                    : message,
            ),
        );
    }, []);

    const abortAttach = useCallback(() => {
        attachAbortRef.current?.abortInternal();
        attachAbortRef.current = null;
        // Every caller is tearing the current run down, so the send signal cannot
        // outlive them even if the SDK reports no finish.
        sendInFlightRef.current = false;
    }, []);

    useEffect(() => () => abortAttach(), [config.conversationId, abortAttach]);

    // Reconnects to an in-flight turn's stream (GET attach); no-op resolve when
    // the server answers 204 (nothing in flight).
    const { bindChat, resumeStream, reattachAfterAttemptBump } = useStreamResumeController({
        conversationIdRef,
        resetAssistantMessage,
        abortAttach,
        isSendInFlight: () => sendInFlightRef.current,
    });

    const runtime = useRemoteThreadListRuntime({
        runtimeHook: function RuntimeHook() {
            const aui = useAui();
            const threadId = useAuiState((s) => s.threadListItem.id);

            initializeThreadRef.current = aui.threadListItem.source ? () => aui.threadListItem.initialize() : null;
            const chat = useChat<TMsg>({
                id: threadId,
                transport,
                onData: handleData,
                onFinish: (event) => {
                    sendInFlightRef.current = false;
                    configRef.current.onFinish?.(event);
                },
                sendAutomaticallyWhen: (opts) => configRef.current.sendAutomaticallyWhen?.(opts) ?? false,
                ...(configRef.current.initialMessages ? { messages: configRef.current.initialMessages } : {}),
            });
            const threadRuntime = useAISDKRuntime<TMsg>(chat);

            // Clears the stale isOptimistic flag the AI SDK converter freezes onto
            // the finished assistant message, which otherwise gets evicted as an
            // off-branch optimistic node on the next edit/regenerate fork.
            useClearOptimisticOnSettle<TMsg>(chat);

            resumeSendRef.current = () => chat.sendMessage();
            setMessagesRef.current = (updater) => chat.setMessages(updater);
            bindChat(chat);
            transport.setRuntime(threadRuntime);

            return threadRuntime;
        },
        adapter: useCloudThreadListAdapter({}),
        allowNesting: true,
    });

    // OAuth returns via full navigation; the RuntimeHook may not have bound
    // resumeSendRef yet when the reconnect card tries to continue the turn.
    const resumeSend = useCallback(async () => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const send = resumeSendRef.current;

            if (send) {
                await send();

                return;
            }

            await new Promise<void>((resolve) => {
                window.setTimeout(resolve, 50);
            });
        }
    }, []);

    return {
        runtime,
        conversationIdRef,
        resumeSend,
        resumeStream,
        resetAssistantMessage,
        reattachAfterAttemptBump,
        streamedConversationId,
        abortAttach,
    };
}
