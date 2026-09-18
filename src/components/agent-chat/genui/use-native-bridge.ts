/**
 * Native bridge implementation (spec §9.4 / §9 capability table, P1).
 *
 * Builds a {@link GenUIBridge} for the in-page React surface from the
 * `useAssistantToolUI` render props + `useAui()` runtime + the allowlist-aware
 * host fetch. The app component talks ONLY to this bridge (spec §2).
 *
 * - reads (`appId`/`refName`/`toolCallId`/`args`/`result`/`status`/`theme`/
 *   `locale`/`capabilities`) come from the tool-call part + host context.
 * - `addResult` → the render-prop `addResult` (completes the tool call, once).
 * - `sendMessage` → chat-view queue via WidgetSendContext (a follow-up turn);
 *   falls back to `useAui()` thread append when the queue is unavailable
 *   (admin preview).
 * - `getState`/`setState` → persisted on the message record (spec D5), keyed by
 *   `toolCallId`, so a re-opened conversation restores widget state.
 * - `callApi` → allowlist-aware host fetch; external origins go through the
 *   `api.{fqdn}` proxy (`POST /apps/proxy`, spec D2).
 * - `callMcp` → host-run MCP tool call (`POST /ai/apps/mcp`, routed to the ai
 *   service via the gateway); the host runs the tool with the user's OAuth
 *   token. No allowlist, no proxy.
 */

import { useAui } from '@assistant-ui/react';
import type {
    BridgeCapabilities,
    BridgeStatus,
    BridgeTheme,
    CallApiRequest,
    CallMcpRequest,
    GenUIBridge,
    UploadFileRequest,
    UploadFileResult,
} from '@thefluentmind/genui-sdk';
import { useCallback, useMemo, useRef } from 'react';

import type { ConversationAdapter } from '@/components/chat-host';
import { useChatHost } from '@/components/chat-host';
import type { GenUIDataPayload } from '@/lib/genui/types';

import { useWidgetSend } from './widget-send-context';

type BridgeTransport = ReturnType<typeof useChatHost>['transport'];

interface BridgeIoOptions {
    transport: BridgeTransport;
    appId: string;
    agentId: string;
}

interface NativeBridgeOptions {
    payload: GenUIDataPayload;
    args: Record<string, unknown>;
    result: unknown;
    status: BridgeStatus;
    theme: BridgeTheme;
    locale: string;
    agentId: string;
    conversationId: string | null;
    messageId: string | undefined;
    addResult: (result: unknown) => void;
    // In-session widget state (rehydrated from the message record on open).
    state: Record<string, unknown> | undefined;
    onStateChange: (next: unknown) => void;
    /** Read-only viewer (admin conversation preview): the widget renders, but no
     *  write or backend call may run with the viewer's credentials. */
    readOnly?: boolean;
}

// All native (P1) capabilities are implemented.
const NATIVE_CAPABILITIES: BridgeCapabilities = {
    addResult: true,
    sendMessage: true,
    getState: true,
    setState: true,
    callApi: true,
    callMcp: true,
    uploadFile: true,
    publishContext: false,
    onAction: false,
};

const READ_ONLY_CAPABILITIES: BridgeCapabilities = {
    addResult: false,
    sendMessage: false,
    getState: true,
    setState: false,
    callApi: false,
    callMcp: false,
    uploadFile: false,
    publishContext: false,
    onAction: false,
};

const readOnlyNoop = (): void => {};

const readOnlySendMessage: GenUIBridge['sendMessage'] = async () => {};

const readOnlyCallApi: GenUIBridge['callApi'] = async () => {
    throw new Error('callApi is not available in a read-only conversation view');
};

const readOnlyCallMcp: GenUIBridge['callMcp'] = async () => {
    throw new Error('callMcp is not available in a read-only conversation view');
};

const readOnlyUploadFile: NonNullable<GenUIBridge['uploadFile']> = async () => {
    throw new Error('uploadFile is not available in a read-only conversation view');
};

const extractBridgeError = async (response: Response, label: string): Promise<string> => {
    const fallback = `${label} failed: ${response.status} ${response.statusText}`;
    const text = await response.text().catch(() => '');

    if (!text) return fallback;

    try {
        const parsed = JSON.parse(text) as { message?: unknown };

        if (typeof parsed.message === 'string' && parsed.message.trim() !== '') {
            return parsed.message.replace(/^Error:\s*/, '');
        }
    } catch {
        // Non-JSON error body; fall through to the raw text or the fallback.
    }

    return text || fallback;
};

/**
 * The live `callApi`/`callMcp` implementations shared by every bridge. They
 * depend only on the host transport plus the app/agent identifiers, so they are
 * message-independent and reusable by both the in-message and home bridges.
 */
export const useBridgeIo = ({
    transport,
    appId,
    agentId,
}: BridgeIoOptions): Pick<GenUIBridge, 'callApi' | 'callMcp'> & {
    uploadFile: NonNullable<GenUIBridge['uploadFile']>;
} => {
    const { baseUrl, filesBaseUrl, fetch: hostFetch, credentials } = transport;
    const idsRef = useRef({ appId, agentId });

    idsRef.current = { appId, agentId };

    const callApi = useCallback(
        async (req: CallApiRequest) => {
            const method = req.method ?? 'GET';
            const base = baseUrl;
            const hasBody = req.body !== undefined && method !== 'GET' && method !== 'HEAD';

            // External origins are proxied through api.{fqdn} which enforces the
            // manifest `connect` allowlist (spec D2). Same-origin (host API) calls
            // hit the path directly. hello-card has an empty `connect`, so the
            // proxy branch is implemented but not exercised in P1.
            const url = req.origin ? `${base}/apps/proxy` : `${base}${req.path}`;
            let requestBody: string | undefined;

            if (req.origin) {
                requestBody = JSON.stringify({
                    appId: idsRef.current.appId,
                    origin: req.origin,
                    path: req.path,
                    method,
                    body: req.body,
                });
            } else if (hasBody) {
                requestBody = JSON.stringify(req.body);
            }

            const response = await hostFetch(url, {
                method: req.origin ? 'POST' : method,
                credentials,
                headers: req.origin || hasBody ? { 'Content-Type': 'application/json' } : undefined,
                body: requestBody,
            });

            if (!response.ok) {
                throw new Error(await extractBridgeError(response, 'callApi'));
            }

            const contentType = response.headers.get('content-type') ?? '';

            return contentType.includes('application/json') ? response.json() : response.text();
        },
        [baseUrl, hostFetch, credentials],
    );

    const callMcp = useCallback(
        async (req: CallMcpRequest) => {
            const response = await hostFetch(`${baseUrl}/ai/apps/mcp`, {
                method: 'POST',
                credentials,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appId: idsRef.current.appId,
                    agentIdOrIdentifier: idsRef.current.agentId,
                    tool: req.tool,
                    args: req.args,
                }),
            });

            if (!response.ok) {
                throw new Error(await extractBridgeError(response, 'callMcp'));
            }

            const data = (await response.json()) as {
                value?: { content?: Array<{ text?: unknown }>; isError?: boolean };
            };
            const result = data?.value;

            if (result?.isError === true) {
                const text = Array.isArray(result.content)
                    ? result.content
                          .map((part) => (typeof part?.text === 'string' ? part.text : ''))
                          .filter(Boolean)
                          .join('\n')
                    : '';

                throw new Error(text || 'MCP tool returned an error.');
            }

            return data;
        },
        [baseUrl, hostFetch, credentials],
    );

    // Multipart upload to the files service as the signed-in user — callApi
    // JSON-stringifies bodies, so FormData needs its own bridge method. Mirrors
    // use-chat-files' uploadViaTransport (no explicit Content-Type: the browser
    // must add the multipart boundary).
    const uploadFile = useCallback(
        async (req: UploadFileRequest): Promise<UploadFileResult> => {
            const form = new FormData();
            const fileName = req.fileName ?? (req.file instanceof File ? req.file.name : 'upload.bin');

            form.append('files', req.file, fileName);

            if (req.title) form.append('title', req.title);

            if (req.description) form.append('description', req.description);
            const tags = req.tags ?? [];

            tags.forEach((tag) => form.append('tags', tag));
            // A SINGLE repeated field parses as a string (not an array) in the
            // files service, breaking terms filters — mirror tags into
            // custom_fields so consumers always have the array form.
            const customFields = {
                ...(req.customFields ?? {}),
                ...(tags.length === 1 ? { tags } : {}),
            };

            if (Object.keys(customFields).length > 0) {
                form.append('custom_fields', JSON.stringify(customFields));
            }

            if (req.datastoreId) form.append('datastore_id', req.datastoreId);
            form.append('is_public', String(req.isPublic ?? true));

            const response = await hostFetch(`${filesBaseUrl}/upload`, {
                method: 'POST',
                credentials,
                body: form,
            });

            if (!response.ok) {
                throw new Error(await extractBridgeError(response, 'uploadFile'));
            }

            const data = (await response.json()) as {
                value?: {
                    values?: Array<{ _id?: string; name?: string; url?: string; size?: number; mimeType?: string }>;
                };
            };
            const uploaded = data.value?.values?.[0];

            if (!uploaded?._id || !uploaded.url) {
                throw new Error('uploadFile failed: the files service returned no file record.');
            }

            const name = uploaded.name || fileName;

            return {
                fileId: uploaded._id,
                name,
                url: uploaded.url,
                extension: name.includes('.') ? name.split('.').pop() : undefined,
                size: uploaded.size,
                mimeType: uploaded.mimeType,
            };
        },
        [filesBaseUrl, hostFetch, credentials],
    );

    return { callApi, callMcp, uploadFile };
};

export function useNativeBridge(options: NativeBridgeOptions): GenUIBridge {
    const aui = useAui();
    const widgetSend = useWidgetSend();
    const { transport } = useChatHost();
    const {
        callApi: liveCallApi,
        callMcp: liveCallMcp,
        uploadFile: liveUploadFile,
    } = useBridgeIo({
        transport,
        appId: options.payload.appId,
        agentId: options.agentId,
    });
    const optionsRef = useRef(options);

    optionsRef.current = options;

    const addResultOnce = useRef(false);

    const liveAddResult = useCallback((result: unknown) => {
        if (addResultOnce.current) return;

        addResultOnce.current = true;
        optionsRef.current.addResult(result);
    }, []);

    const widgetSendRef = useRef(widgetSend);

    widgetSendRef.current = widgetSend;
    const liveSendMessage = useCallback(
        async (text: string) => {
            const queuedSend = widgetSendRef.current;

            if (queuedSend) {
                queuedSend(text);

                return;
            }

            await aui.thread.append({
                role: 'user',
                content: [{ type: 'text', text }],
            });
        },
        [aui],
    );

    const getState = useCallback(<T = unknown>(): T | undefined => optionsRef.current.state as T | undefined, []);

    const liveSetState = useCallback(<T = unknown>(next: T): void => {
        optionsRef.current.onStateChange(next);
    }, []);

    const { payload, readOnly } = options;
    const addResult = readOnly ? readOnlyNoop : liveAddResult;
    const sendMessage = readOnly ? readOnlySendMessage : liveSendMessage;
    const setState = readOnly ? readOnlyNoop : liveSetState;
    const callApi = readOnly ? readOnlyCallApi : liveCallApi;
    const callMcp = readOnly ? readOnlyCallMcp : liveCallMcp;
    const uploadFile = readOnly ? readOnlyUploadFile : liveUploadFile;

    return useMemo<GenUIBridge>(
        () => ({
            appId: payload.appId,
            refName: payload.refName,
            toolCallId: payload.toolCallId,
            args: options.args,
            result: options.result,
            status: options.status,
            theme: options.theme,
            locale: options.locale,
            capabilities: readOnly ? READ_ONLY_CAPABILITIES : NATIVE_CAPABILITIES,
            addResult,
            sendMessage,
            getState,
            setState,
            callApi,
            callMcp,
            uploadFile,
        }),
        [
            readOnly,
            payload.appId,
            payload.refName,
            payload.toolCallId,
            options.args,
            options.result,
            options.status,
            options.theme,
            options.locale,
            addResult,
            sendMessage,
            getState,
            setState,
            callApi,
            callMcp,
            uploadFile,
        ],
    );
}

const HOME_CAPABILITIES: BridgeCapabilities = {
    addResult: true,
    sendMessage: true,
    getState: true,
    setState: true,
    callApi: true,
    callMcp: true,
    uploadFile: true,
    publishContext: false,
    onAction: false,
};

const HOME_STATUS: BridgeStatus = { type: 'complete' };

const readHomeState = (key: string): Record<string, unknown> | undefined => {
    try {
        const raw = localStorage.getItem(key);

        if (!raw) return undefined;

        const parsed = JSON.parse(raw) as unknown;

        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
};

const writeHomeState = (key: string, next: unknown): void => {
    try {
        localStorage.setItem(key, JSON.stringify(next));
    } catch {
        // Storage unavailable (private mode / quota); state is best-effort.
    }
};

interface HomeBridgeOptions {
    payload: GenUIDataPayload;
    args: Record<string, unknown>;
    theme: BridgeTheme;
    locale: string;
    agentId: string;
    userId: string;
    onSendMessage: (text: string) => void;
}

/**
 * Bridge for a GenUI app rendered as the agent home/landing screen. Unlike
 * {@link useNativeBridge} it lives on a message-free surface: there is no live
 * tool call to complete, so both `sendMessage` and `addResult` route through
 * the composer path (not `thread().append`) to start a real conversation, and
 * state is persisted to `localStorage` instead of the message record. The live
 * `callApi`/`callMcp` are shared with the in-message bridge.
 */
export function useHomeBridge(options: HomeBridgeOptions): GenUIBridge {
    const { transport } = useChatHost();
    const { callApi, callMcp, uploadFile } = useBridgeIo({
        transport,
        appId: options.payload.appId,
        agentId: options.agentId,
    });
    const optionsRef = useRef(options);

    optionsRef.current = options;

    const storageKey = useMemo(
        () => `fm.home-app.${options.userId}.${options.agentId}.${options.payload.refName}`,
        [options.userId, options.agentId, options.payload.refName],
    );
    const storageKeyRef = useRef(storageKey);

    storageKeyRef.current = storageKey;

    const addResult = useCallback((result: unknown) => {
        optionsRef.current.onSendMessage(typeof result === 'string' ? result : JSON.stringify(result));
    }, []);

    const sendMessage = useCallback(async (text: string) => {
        optionsRef.current.onSendMessage(text);
    }, []);

    const getState = useCallback(
        <T = unknown>(): T | undefined => readHomeState(storageKeyRef.current) as T | undefined,
        [],
    );

    const setState = useCallback(<T = unknown>(next: T): void => {
        writeHomeState(storageKeyRef.current, next);
    }, []);

    const { payload } = options;

    return useMemo<GenUIBridge>(
        () => ({
            appId: payload.appId,
            refName: payload.refName,
            toolCallId: payload.toolCallId,
            args: options.args,
            result: undefined,
            status: HOME_STATUS,
            theme: options.theme,
            locale: options.locale,
            capabilities: HOME_CAPABILITIES,
            addResult,
            sendMessage,
            getState,
            setState,
            callApi,
            callMcp,
            uploadFile,
        }),
        [
            payload.appId,
            payload.refName,
            payload.toolCallId,
            options.args,
            options.theme,
            options.locale,
            addResult,
            sendMessage,
            getState,
            setState,
            callApi,
            callMcp,
            uploadFile,
        ],
    );
}

/**
 * Persists a widget's state onto the message record (spec D5), keyed by
 * `toolCallId`, so a re-opened conversation restores it. This is an
 * out-of-band update mirroring the existing message-feedback path
 * (`submitMessageFeedback`).
 */
export async function persistGenUIState(params: {
    conversations: ConversationAdapter;
    conversationId: string | null;
    messageId: string | undefined;
    toolCallId: string;
    state: unknown;
}): Promise<void> {
    const { conversations, conversationId, messageId, toolCallId, state } = params;

    if (!conversationId || !messageId) return;

    await conversations.updateMessage(conversationId, messageId, { genuiState: { [toolCallId]: state } });
}
