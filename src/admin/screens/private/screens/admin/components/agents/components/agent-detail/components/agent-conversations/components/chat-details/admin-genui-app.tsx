import type {
    BridgeCapabilities,
    BridgeStatus,
    BridgeTheme,
    GenUIAppProps,
    GenUIBridge,
} from '@thefluentmind/genui-sdk';
import { RemoteAppHostProvider } from '@thefluentmind/genui-sdk/host';
import { useEffect, useMemo, useState, type FC } from 'react';

import { AppLoadingSkeleton } from '@/components/agent-chat/app-loading-skeleton';
import { GenUIFrame } from '@/components/agent-chat/genui/genui-frame';
import { loadAppModule } from '@/lib/genui/load-app-module';
import { useRenderChild } from '@/lib/genui/render-child';
import type { GenUIDataPayload } from '@/lib/genui/types';

const DISPLAY_CAPABILITIES: BridgeCapabilities = {
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

const resolveTheme = (): BridgeTheme =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const resolveLocale = (): string =>
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

const noop = (): void => {};
const sendMessageUnavailable: GenUIBridge['sendMessage'] = async () => {};

const callApiUnavailable: GenUIBridge['callApi'] = async () => {
    throw new Error('callApi is not available in admin conversation inspection.');
};

const callMcpUnavailable: GenUIBridge['callMcp'] = async () => {
    throw new Error('callMcp is not available in admin conversation inspection.');
};

interface AdminGenUIAppProps {
    payload: GenUIDataPayload;
    result: unknown;
    status: BridgeStatus;
    agentId: string;
    conversationId: string | null;
    messageId: string;
    state?: Record<string, unknown>;
}

const GenUISkeleton = () => <AppLoadingSkeleton slot="admin-genui-skeleton" />;

const GenUIError = ({ message }: { message: string }) => (
    <div data-slot="admin-genui-error" className="my-2 rounded-lg bg-card px-3 py-2.5 text-sm text-muted-foreground">
        {message}
    </div>
);

const AdminGenUIApp = ({ payload, result, status, agentId, conversationId, messageId, state }: AdminGenUIAppProps) => {
    const [Component, setComponent] = useState<FC<GenUIAppProps> | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [theme] = useState<BridgeTheme>(resolveTheme);
    const [locale] = useState<string>(resolveLocale);

    useEffect(() => {
        let cancelled = false;

        setComponent(null);
        setLoadError(null);

        loadAppModule(payload.refName, payload.version, payload.bundleUrl)
            .then((component) => {
                if (!cancelled) setComponent(() => component as unknown as FC<GenUIAppProps>);
            })
            .catch((error: unknown) => {
                if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Failed to load app.');
            });

        return () => {
            cancelled = true;
        };
    }, [payload.refName, payload.version, payload.bundleUrl]);

    const bridge = useMemo<GenUIBridge>(
        () => ({
            appId: payload.appId,
            refName: payload.refName,
            toolCallId: payload.toolCallId,
            args: payload.props,
            result,
            status,
            theme,
            locale,
            capabilities: DISPLAY_CAPABILITIES,
            addResult: noop,
            sendMessage: sendMessageUnavailable,
            getState: <T = unknown,>() => state as T | undefined,
            setState: noop,
            callApi: callApiUnavailable,
            callMcp: callMcpUnavailable,
        }),
        [payload, result, status, theme, locale, state],
    );

    const renderChild = useRenderChild({
        theme,
        locale,
        agentId,
        conversationId,
        messageId,
        parentToolCallId: payload.toolCallId,
    });

    if ((result as { status?: string } | undefined)?.status === 'dismissed') {
        return <GenUIError message="This card was dismissed." />;
    }

    if (loadError) return <GenUIError message={loadError} />;
    if (!Component) return <GenUISkeleton />;

    const renderApp = () => {
        const maxWidth = payload.display?.maxWidth;
        const app = <Component bridge={bridge} />;

        if (maxWidth) return <div style={{ maxWidth }}>{app}</div>;

        return app;
    };

    const argsTitle = (payload.props as { title?: unknown }).title;
    const frameTitle = typeof argsTitle === 'string' ? argsTitle : undefined;

    return (
        <div data-slot="admin-genui-app" className="my-2">
            <RemoteAppHostProvider value={renderChild}>
                {payload.display?.framed ? <GenUIFrame title={frameTitle} renderContent={renderApp} /> : renderApp()}
            </RemoteAppHostProvider>
        </div>
    );
};

export default AdminGenUIApp;
