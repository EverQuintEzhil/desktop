import { AppRenderer } from '@mcp-ui/client';
import type { AppRendererProps, McpUiHostCapabilities } from '@mcp-ui/client';
import type { McpUiResourceCsp } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AlertCircleIcon, CodeXmlIcon, Globe, Loader2Icon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';

import { Button } from '@/components/ui/button';
import '@/components/agent-chat/mcp-ui/mcp-ui-resource/mcp-ui-resource.scss';

export interface AdminMcpUiPayload {
    toolCallId: string;
    serverId: string;
    toolName: string;
    html: string;
    csp?: McpUiResourceCsp;
    toolInput?: Record<string, unknown>;
    toolResult?: CallToolResult;
    resourceUri?: string;
}

interface AdminMcpUiResourceProps {
    payload: AdminMcpUiPayload;
    appName?: string;
    toolLabel?: string;
    faviconUrl?: string;
}

type McpUiFrameIssue = {
    title: string;
    message: string;
};

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
const MIN_FRAME_HEIGHT = 150;
const FRAME_LOADING_TIMEOUT_MS = 8000;

const HOST_CAPABILITIES: McpUiHostCapabilities = {
    message: { text: {} },
    openLinks: {},
};

const deriveSandboxUrl = (): URL | null => {
    if (typeof window === 'undefined') return null;

    const hostname = window.location.hostname;

    if (!hostname || LOCAL_HOSTNAMES.has(hostname)) return null;

    try {
        return new URL(`https://sandbox.${hostname}/index.html`);
    } catch {
        return null;
    }
};

const normalizeFrameHeight = (height: number): number => Math.max(Math.ceil(height), MIN_FRAME_HEIGHT);

const buildSandboxErrorMessage = (message: string, sandboxUrl: URL | null): string => {
    if (message.toLowerCase().includes('timed out')) {
        return `The sandbox proxy did not respond in time${sandboxUrl ? ` at ${sandboxUrl.hostname}` : ''}.`;
    }

    return message || 'The sandbox proxy could not load this app.';
};

const McpUiUnavailable = () => (
    <div className="my-2 rounded-lg bg-card px-3 py-2.5 text-sm text-muted-foreground">
        Interactive app unavailable (sandbox not configured).
    </div>
);

const McpUiFrameLoading = () => (
    <div
        className="absolute inset-0 flex items-center justify-center gap-2 bg-card text-sm text-muted-foreground"
        aria-live="polite"
    >
        <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        Loading app...
    </div>
);

const McpUiFrameFallback = ({ title, message }: McpUiFrameIssue) => (
    <div className="mcp-ui-frame-fallback flex bg-card px-5 py-4">
        <div className="flex max-w-[640px] items-start gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                <AlertCircleIcon className="size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-0.5">
                <span className="text-h5 leading-5 font-medium text-foreground">{title}</span>
                <span className="text-sm leading-5 text-muted-foreground">{message}</span>
            </div>
        </div>
    </div>
);

const AdminMcpUiResource = ({ payload, appName, toolLabel, faviconUrl }: AdminMcpUiResourceProps) => {
    const [showCode, setShowCode] = useState(false);
    const [frameHeight, setFrameHeight] = useState(MIN_FRAME_HEIGHT);
    const [isFrameReady, setIsFrameReady] = useState(false);
    const [frameIssue, setFrameIssue] = useState<McpUiFrameIssue | null>(null);
    const sandboxUrl = useMemo(() => deriveSandboxUrl(), []);
    const sandbox = useMemo(
        () => (sandboxUrl ? { url: sandboxUrl, csp: payload.csp } : null),
        [sandboxUrl, payload.csp],
    );
    const frameStyle = useMemo(
        () =>
            ({
                '--mcp-ui-frame-height': `${frameHeight}px`,
            }) as CSSProperties,
        [frameHeight],
    );

    useEffect(() => {
        setFrameHeight(MIN_FRAME_HEIGHT);
        setIsFrameReady(false);
        setFrameIssue(null);
    }, [payload.html, payload.toolCallId]);

    useEffect(() => {
        if (!payload.html || isFrameReady || frameIssue) return undefined;

        const timeoutId = window.setTimeout(() => {
            setFrameIssue({
                title: 'Sandbox unavailable',
                message: buildSandboxErrorMessage('Timed out waiting for sandbox proxy iframe to be ready', sandboxUrl),
            });
        }, FRAME_LOADING_TIMEOUT_MS);

        return () => window.clearTimeout(timeoutId);
    }, [frameIssue, isFrameReady, payload.html, sandboxUrl]);

    const handleSizeChanged = useCallback(({ height }: { height?: number }) => {
        setIsFrameReady(true);
        setFrameIssue(null);
        if (height !== undefined) setFrameHeight(normalizeFrameHeight(height));
    }, []);

    const handleAppError = useCallback(
        (error: Error) => {
            setFrameIssue({
                title: 'Unable to load app',
                message: buildSandboxErrorMessage(error.message, sandboxUrl),
            });
        },
        [sandboxUrl],
    );

    const handleMessage = useCallback<NonNullable<AppRendererProps['onMessage']>>(async () => ({}), []);

    const handleOpenLink = useCallback<NonNullable<AppRendererProps['onOpenLink']>>(async ({ url }) => {
        window.open(url, '_blank', 'noopener,noreferrer');

        return {};
    }, []);

    const renderFavicon = () => {
        if (faviconUrl) return <img src={faviconUrl} alt="" className="size-5 shrink-0 rounded" />;

        return <Globe className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />;
    };

    const getResponseText = (): string => {
        const result = payload.toolResult;

        if (!result) return 'No response.';

        const textPart = result.content?.find((part): part is { type: 'text'; text: string } => part.type === 'text');

        if (textPart?.text) return textPart.text;
        if (result.structuredContent) return JSON.stringify(result.structuredContent, null, 2);

        return JSON.stringify(result, null, 2);
    };

    const renderDetail = (label: string, body: string) => (
        <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <pre className="scrollbar-controller scrollbar-vertical scrollbar-horizontal rounded-lg bg-muted/40 p-4 text-xs leading-relaxed text-foreground">
                <code>{body}</code>
            </pre>
        </div>
    );

    const renderCode = () => (
        <div className="scrollbar-controller scrollbar-vertical scrollbar-horizontal flex max-h-[480px] flex-col gap-4 p-4">
            {renderDetail('Request', payload.toolInput ? JSON.stringify(payload.toolInput, null, 2) : '{}')}
            {renderDetail('Response', getResponseText())}
        </div>
    );

    const renderApp = () => {
        if (!sandbox) return <McpUiUnavailable />;

        if (frameIssue) {
            return (
                <div className="mcp-ui-frame mcp-ui-frame--issue">
                    <McpUiFrameFallback title={frameIssue.title} message={frameIssue.message} />
                </div>
            );
        }

        return (
            <div className="mcp-ui-frame" style={frameStyle}>
                <AppRenderer
                    html={payload.html}
                    toolName={payload.toolName}
                    toolInput={payload.toolInput}
                    toolResult={payload.toolResult}
                    sandbox={sandbox}
                    hostCapabilities={HOST_CAPABILITIES}
                    onMessage={handleMessage}
                    onOpenLink={handleOpenLink}
                    onSizeChanged={handleSizeChanged}
                    onError={handleAppError}
                />
                {!isFrameReady ? <McpUiFrameLoading /> : null}
            </div>
        );
    };

    return (
        <div className="mcp-ui-resource my-2 w-full overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                {renderFavicon()}
                <span className="text-sm font-medium text-foreground">{appName ?? 'App'}</span>
                {toolLabel ? <span className="font-mono text-sm text-muted-foreground">{toolLabel}</span> : null}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setShowCode((prev) => !prev)}
                    aria-label={showCode ? 'Hide source' : 'View source'}
                    className="ml-auto justify-center"
                >
                    <CodeXmlIcon className="size-4" aria-hidden="true" />
                </Button>
            </div>
            <div>
                <div hidden={showCode}>{renderApp()}</div>
                {showCode ? renderCode() : null}
            </div>
        </div>
    );
};

export default AdminMcpUiResource;
