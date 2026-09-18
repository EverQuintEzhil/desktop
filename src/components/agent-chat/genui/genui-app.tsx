'use client';

/**
 * GenUI loader (spec §6 step 4, §12).
 *
 * Rendered for a GenUI tool-call part. Reads the correlated `data-genui` part
 * (authoritative `bundleUrl` + `props` + `version`) by `toolCallId`, lazily
 * imports the remote bundle (cached per `refName@version`), and renders its
 * default export with the native bridge. A skeleton is shown while the backing
 * tool call is still running.
 */

import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { useAuiState } from '@assistant-ui/react';
import type { BridgeStatus, BridgeTheme, GenUIAppProps } from '@thefluentmind/genui-sdk';
import { RemoteAppHostProvider } from '@thefluentmind/genui-sdk/host';
import isEqual from 'lodash/isEqual';
import { TriangleAlertIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FC } from 'react';

import { useChatHost } from '@/components/chat-host';
import { buildGenUIPayload, type GenUIResultRef } from '@/lib/genui/build-app-payload';
import { loadAppModule } from '@/lib/genui/load-app-module';
import { useRenderChild } from '@/lib/genui/render-child';
import type { GenUIDataPayload } from '@/lib/genui/types';

import { AppLoadingSkeleton } from '../app-loading-skeleton';
import { useChatViewContext } from '../view/chat-view-context';

import { GenUIFrame } from './genui-frame';
import { persistGenUIState, useNativeBridge } from './use-native-bridge';

const BUNDLE_LOAD_TIMEOUT_MS = 15000;

type MessagePart = { type: string; name?: string; data?: unknown };

const isGenuiDataPart = (part: MessagePart, toolCallId: string): boolean =>
    part.type === 'data' &&
    part.name === 'genui' &&
    (part.data as GenUIDataPayload | undefined)?.toolCallId === toolCallId;

const GenUISkeleton = () => <AppLoadingSkeleton slot="genui-skeleton" className="genui-skeleton" />;

const GenUIDismissed = () => (
    <div
        data-slot="genui-dismissed"
        className="genui-dismissed my-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground"
    >
        This card was dismissed.
    </div>
);

const GenUIError = ({ title, description }: { title: string; description: string }) => (
    <div
        data-slot="genui-error"
        className="genui-error my-2 flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
    >
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{title}</span>
            <span className="text-sm text-muted-foreground">{description}</span>
        </div>
    </div>
);

const resolveTheme = (): BridgeTheme =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const resolveLocale = (): string =>
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

export function GenUIApp(part: ToolCallMessagePartProps) {
    const { toolCallId, toolName, args, result, status, addResult } = part;
    const { agent, conversationId, isReadOnly } = useChatViewContext();
    const { conversations } = useChatHost();

    // Locate the correlated data-genui part within this message (spec D10).
    const messageParts = useAuiState((s) => s.message.parts as unknown as MessagePart[]);
    const messageId = useAuiState((s) => s.message.id);
    // Persisted widget state lives under metadata.custom — assistant-ui only
    // preserves `custom` through importExternalState (top-level metadata is
    // dropped on reopen), so reading it from there is what restores state.
    const persistedState = useAuiState(
        (s) => (s.message.metadata?.custom as { genuiState?: Record<string, unknown> } | undefined)?.genuiState,
    );

    const payload = useMemo<GenUIDataPayload | undefined>(() => {
        const dataPart = messageParts.find((p) => isGenuiDataPart(p, toolCallId));
        const streamed = dataPart?.data as GenUIDataPayload | undefined;

        if (streamed) return streamed;

        return buildGenUIPayload({
            apps: agent.apps,
            toolCallId,
            toolName,
            args: args as Record<string, unknown> | undefined,
            ref: (result as { _genui?: GenUIResultRef } | undefined)?._genui,
        });
    }, [messageParts, toolCallId, agent, toolName, args, result]);

    // The SDK signature returns `unknown` (it stays React-free at the types-only
    // entrypoint); in practice the default export is a React component, so we
    // render it as an FC.
    const [Component, setComponent] = useState<FC<GenUIAppProps> | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadTimedOut, setLoadTimedOut] = useState(false);

    // Widget state (spec D5): rehydrate from the message record, hold in session.
    const [state, setState] = useState<Record<string, unknown> | undefined>(
        () => persistedState?.[toolCallId] as Record<string, unknown> | undefined,
    );
    const hydratedRef = useRef(false);

    useEffect(() => {
        if (hydratedRef.current) return;

        const restored = persistedState?.[toolCallId];

        if (restored !== undefined) {
            setState(restored as Record<string, unknown>);
            hydratedRef.current = true;
        }
    }, [persistedState, toolCallId]);

    useEffect(() => {
        if (!payload || Component) return;

        let cancelled = false;

        setLoadError(null);

        loadAppModule(payload.refName, payload.version, payload.bundleUrl)
            .then((component) => {
                if (!cancelled) setComponent(() => component as unknown as FC<GenUIAppProps>);
            })
            .catch((error: unknown) => {
                console.error('[genui] failed to load app bundle', error);

                if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Failed to load app.');
            });

        return () => {
            cancelled = true;
        };
    }, [payload, Component]);

    useEffect(() => {
        if (!payload || Component || loadError) {
            setLoadTimedOut(false);

            return undefined;
        }

        const timer = setTimeout(() => setLoadTimedOut(true), BUNDLE_LOAD_TIMEOUT_MS);

        return () => clearTimeout(timer);
    }, [payload, Component, loadError]);

    const handleStateChange = (next: unknown) => {
        if (isEqual(next, state)) return;

        setState(next as Record<string, unknown>);
        void persistGenUIState({
            conversations,
            conversationId,
            messageId,
            toolCallId,
            state: next,
        }).catch((error) => {
            console.error('[genui] failed to persist widget state', error);
        });
    };

    const bridge = useNativeBridge({
        payload: payload ?? {
            toolCallId,
            appId: '',
            refName: '',
            version: '',
            bundleUrl: '',
            props: {},
        },
        args: (payload?.props ?? args ?? {}) as Record<string, unknown>,
        result,
        status: (status ?? { type: 'running' }) as BridgeStatus,
        theme: resolveTheme(),
        locale: resolveLocale(),
        agentId: agent._id,
        conversationId,
        messageId,
        addResult,
        state,
        onStateChange: handleStateChange,
        readOnly: isReadOnly,
    });

    const renderChild = useRenderChild({
        theme: bridge.theme,
        locale: bridge.locale,
        agentId: agent._id,
        conversationId,
        messageId,
        parentToolCallId: toolCallId,
    });

    if ((result as { status?: string } | undefined)?.status === 'dismissed') return <GenUIDismissed />;

    if (loadError) {
        return (
            <GenUIError
                title="Couldn't load this app"
                description="Something went wrong while loading this interactive app. Try regenerating the response."
            />
        );
    }

    if (status?.type === 'running') return <GenUISkeleton />;

    if (!payload) {
        return (
            <GenUIError
                title="App unavailable"
                description="This interactive app is no longer available for this agent. It may have been removed or unlinked."
            />
        );
    }

    if (!Component) {
        if (loadTimedOut) {
            return (
                <GenUIError
                    title="Taking too long to load"
                    description="This interactive app is taking longer than expected to load. Try regenerating the response."
                />
            );
        }

        return <GenUISkeleton />;
    }

    const renderApp = () => {
        const maxWidth = payload.display?.maxWidth;
        const app = <Component bridge={bridge} />;

        if (maxWidth) {
            return <div style={{ maxWidth }}>{app}</div>;
        }

        return app;
    };

    const argsTitle = (bridge.args as { title?: unknown }).title;
    const frameTitle = typeof argsTitle === 'string' ? argsTitle : undefined;

    return (
        <div data-slot="genui-app" className="genui-app mb-3">
            <RemoteAppHostProvider value={renderChild}>
                {payload.display?.framed ? <GenUIFrame title={frameTitle} renderContent={renderApp} /> : renderApp()}
            </RemoteAppHostProvider>
        </div>
    );
}
