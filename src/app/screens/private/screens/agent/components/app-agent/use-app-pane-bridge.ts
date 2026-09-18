/**
 * Bridge for the traditional-app pane of a `componentType: "app"` agent.
 *
 * Like the home bridge it lives on a message-free surface, but it is the
 * PRIMARY surface of the screen, not a chat landing: `sendMessage` routes into
 * the assistant side panel, state persists to localStorage, and `callApi` is
 * the app's data path — a full application is expected to load its own data
 * through `POST /ai/apps/tool` (direct Lua tool runs, no model in the loop).
 *
 * The pane renders outside any ChatHostProvider (the assistant panel builds
 * its own host), so the transport is constructed here from the app's auth-aware
 * fetch instead of `useChatHost()`.
 */

import type {
    AppActionResult,
    AppPaneAction,
    AppPaneContext,
    BridgeCapabilities,
    BridgeStatus,
    BridgeTheme,
    GenUIBridge,
} from '@thefluentmind/genui-sdk';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useBridgeIo } from '@/components/agent-chat/genui/use-native-bridge';
import { authAwareFetch } from '@/lib/auth-aware-fetch';
import { getApiBaseUrl, getFilesBaseUrl } from '@/lib/axios';
import type { GenUIDataPayload } from '@/lib/genui/types';

import { publishAppPaneContext, registerAppPaneActionHandler, resetAppPaneChannel } from './app-pane-channel';

const APP_PANE_CAPABILITIES: BridgeCapabilities = {
    addResult: true,
    sendMessage: true,
    getState: true,
    setState: true,
    callApi: true,
    callMcp: true,
    uploadFile: true,
    publishContext: true,
    onAction: true,
};

const APP_PANE_STATUS: BridgeStatus = { type: 'complete' };

const readPaneState = (key: string): Record<string, unknown> | undefined => {
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

const writePaneState = (key: string, next: unknown): void => {
    try {
        localStorage.setItem(key, JSON.stringify(next));
    } catch {
        // Storage unavailable (private mode / quota); state is best-effort.
    }
};

interface AppPaneBridgeOptions {
    payload: GenUIDataPayload;
    /** Live args for the app; includes `assistantTurn` so the app can refresh after agent turns. */
    args: Record<string, unknown>;
    theme: BridgeTheme;
    locale: string;
    agentId: string;
    userId: string;
    /** Routes a message into the assistant side panel (opening it if collapsed). */
    onSendMessage: (text: string) => void;
}

export function useAppPaneBridge(options: AppPaneBridgeOptions): GenUIBridge {
    const transport = useMemo(
        () => ({
            endpoint: `${getApiBaseUrl()}/ai/chat`,
            baseUrl: getApiBaseUrl(),
            filesBaseUrl: getFilesBaseUrl(),
            fetch: authAwareFetch,
            credentials: 'include' as const,
        }),
        [],
    );
    const { callApi, callMcp, uploadFile } = useBridgeIo({
        transport,
        appId: options.payload.appId,
        agentId: options.agentId,
    });
    const optionsRef = useRef(options);

    optionsRef.current = options;

    const storageKey = useMemo(
        () => `fm.app-pane.${options.userId}.${options.agentId}.${options.payload.refName}`,
        [options.userId, options.agentId, options.payload.refName],
    );
    const storageKeyRef = useRef(storageKey);

    storageKeyRef.current = storageKey;

    // A pane that unmounts must stop being described to the assistant, and must
    // stop receiving actions — otherwise the next turn answers about a screen
    // nobody is looking at.
    useEffect(() => resetAppPaneChannel, []);

    const publishContext = useCallback((context: AppPaneContext | null): void => {
        publishAppPaneContext(context);
    }, []);

    const onAction = useCallback(
        (handler: (action: AppPaneAction) => AppActionResult): (() => void) => registerAppPaneActionHandler(handler),
        [],
    );

    const addResult = useCallback((result: unknown) => {
        optionsRef.current.onSendMessage(typeof result === 'string' ? result : JSON.stringify(result));
    }, []);

    const sendMessage = useCallback(async (text: string) => {
        optionsRef.current.onSendMessage(text);
    }, []);

    const getState = useCallback(
        <T = unknown>(): T | undefined => readPaneState(storageKeyRef.current) as T | undefined,
        [],
    );

    const setState = useCallback(<T = unknown>(next: T): void => {
        writePaneState(storageKeyRef.current, next);
    }, []);

    const { payload } = options;

    return useMemo<GenUIBridge>(
        () => ({
            appId: payload.appId,
            refName: payload.refName,
            toolCallId: payload.toolCallId,
            args: options.args,
            result: undefined,
            status: APP_PANE_STATUS,
            theme: options.theme,
            locale: options.locale,
            capabilities: APP_PANE_CAPABILITIES,
            addResult,
            sendMessage,
            getState,
            setState,
            callApi,
            callMcp,
            uploadFile,
            publishContext,
            onAction,
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
            publishContext,
            onAction,
        ],
    );
}
