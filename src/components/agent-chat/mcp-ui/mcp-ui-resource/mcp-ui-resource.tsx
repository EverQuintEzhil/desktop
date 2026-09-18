import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { useAuiState } from '@assistant-ui/react';
import { AppRenderer } from '@mcp-ui/client';
import type { McpUiHostCapabilities } from '@mcp-ui/client';
import type { McpUiResourceCsp } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AlertCircleIcon, CodeXml as CodeXmlIcon, Globe, Loader2, Maximize2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { ChatBlock } from '@/components/chat/blocks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { AppLoadingSkeleton } from '../../app-loading-skeleton';
import { useMcpUiAction } from '../use-mcp-ui-action';

import './mcp-ui-resource.scss';

interface McpUiDataPayload {
    toolCallId: string;
    serverId: string;
    toolName: string;
    html: string;
    csp?: McpUiResourceCsp;
    toolInput?: Record<string, unknown>;
    toolResult?: CallToolResult;
    resourceUri?: string;
}

type MessagePart = { type: string; name?: string; data?: unknown };
type McpUiFrameIssue = {
    title: string;
    message: string;
};

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
const MIN_FRAME_HEIGHT = 150;
const FRAME_LOADING_TIMEOUT_MS = 8000;

const deriveSandboxUrl = (): URL | null => {
    if (typeof window === 'undefined') return null;

    const hostname = window.location.hostname;

    if (!hostname || LOCAL_HOSTNAMES.has(hostname)) {
        return null;
    }

    try {
        return new URL(`https://sandbox.${hostname}/index.html`);
    } catch {
        return null;
    }
};

export const isMcpUiDataPart = (part: MessagePart, toolCallId: string): boolean =>
    part.type === 'data' &&
    part.name === 'mcpui' &&
    (part.data as McpUiDataPayload | undefined)?.toolCallId === toolCallId;

const normalizeFrameHeight = (height: number): number => Math.max(Math.ceil(height), MIN_FRAME_HEIGHT);

const buildSandboxErrorMessage = (message: string, sandboxUrl: URL | null): string => {
    if (message.toLowerCase().includes('timed out')) {
        return `The sandbox proxy did not respond in time${sandboxUrl ? ` at ${sandboxUrl.hostname}` : ''}.`;
    }

    return message || 'The sandbox proxy could not load this app.';
};

const HOST_CAPABILITIES: McpUiHostCapabilities = {
    message: { text: {} },
    openLinks: {},
};

const McpUiSkeleton = () => <AppLoadingSkeleton slot="mcp-ui-skeleton" className="mcp-ui-skeleton" />;

const McpUiUnavailable = () => (
    <div
        data-slot="mcp-ui-unavailable"
        className="mcp-ui-unavailable my-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground"
    >
        Interactive app unavailable (sandbox not configured).
    </div>
);

const McpUiFrameLoading = () => (
    <div
        data-slot="mcp-ui-frame-loading"
        className="mcp-ui-frame-loading absolute inset-0 flex items-center justify-center bg-card"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading app"
    >
        <Loader2 className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
    </div>
);

const FRAME_FALLBACK_BADGE_CLASS =
    'flex size-11 shrink-0 items-center justify-center rounded-full ' +
    'bg-amber-50 text-amber-600 ring-1 ring-amber-100 ' +
    'dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900/50';

const McpUiFrameFallback = ({ title, message }: McpUiFrameIssue) => (
    <div
        data-slot="mcp-ui-frame-fallback"
        className="mcp-ui-frame-fallback flex flex-col items-center justify-center gap-3 bg-card px-6 py-10 text-center"
    >
        <span className={FRAME_FALLBACK_BADGE_CLASS}>
            <AlertCircleIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex max-w-[420px] flex-col gap-1">
            <span className="text-h5 leading-5 font-semibold text-foreground">{title}</span>
            <span className="text-sm leading-5 text-muted-foreground">{message}</span>
        </div>
    </div>
);

type McpUiFrameVariant = 'inline' | 'fullscreen';

interface McpUiAppFrameProps {
    payload: McpUiDataPayload;
    sandbox: { url: URL; csp?: McpUiResourceCsp };
    sandboxUrl: URL | null;
    handlers: ReturnType<typeof useMcpUiAction>;
    variant?: McpUiFrameVariant;
}

const McpUiAppFrame = ({ payload, sandbox, sandboxUrl, handlers, variant = 'inline' }: McpUiAppFrameProps) => {
    const [frameHeight, setFrameHeight] = useState(MIN_FRAME_HEIGHT);
    const [isFrameReady, setIsFrameReady] = useState(false);
    const [frameIssue, setFrameIssue] = useState<McpUiFrameIssue | null>(null);

    const isFullscreen = variant === 'fullscreen';

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
        if (isFrameReady || frameIssue) return undefined;

        const timeoutId = window.setTimeout(() => {
            setFrameIssue({
                title: 'Sandbox unavailable',
                message: buildSandboxErrorMessage('Timed out waiting for sandbox proxy iframe to be ready', sandboxUrl),
            });
        }, FRAME_LOADING_TIMEOUT_MS);

        return () => window.clearTimeout(timeoutId);
    }, [frameIssue, isFrameReady, sandboxUrl]);

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
            console.error('[McpUiResource] AppRenderer error', error);
        },
        [sandboxUrl],
    );

    if (frameIssue) {
        return (
            <div className="mcp-ui-frame mcp-ui-frame--issue">
                <McpUiFrameFallback title={frameIssue.title} message={frameIssue.message} />
            </div>
        );
    }

    return (
        <div
            className={isFullscreen ? 'mcp-ui-frame mcp-ui-frame--fullscreen' : 'mcp-ui-frame'}
            style={isFullscreen ? undefined : frameStyle}
        >
            <AppRenderer
                html={payload.html}
                toolName={payload.toolName}
                toolInput={payload.toolInput}
                toolResult={payload.toolResult}
                sandbox={sandbox}
                hostCapabilities={HOST_CAPABILITIES}
                onMessage={handlers.onMessage}
                onOpenLink={handlers.onOpenLink}
                onCallTool={handlers.onCallTool}
                onSizeChanged={handleSizeChanged}
                onError={handleAppError}
            />
            {!isFrameReady ? <McpUiFrameLoading /> : null}
        </div>
    );
};

type McpUiResourceProps = ToolCallMessagePartProps & {
    appName?: string;
    toolLabel?: string;
    faviconUrl?: string;
};

export const McpUiResource = ({ toolCallId, status, appName, toolLabel, faviconUrl }: McpUiResourceProps) => {
    const messageParts = useAuiState((s) => s.message.parts as unknown as MessagePart[]);
    const handlers = useMcpUiAction();
    const [showCode, setShowCode] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const rawPayload = useMemo<McpUiDataPayload | undefined>(() => {
        const dataPart = messageParts.find((p) => isMcpUiDataPart(p, toolCallId));

        return dataPart?.data as McpUiDataPayload | undefined;
    }, [messageParts, toolCallId]);

    const payloadKey = useMemo(
        () =>
            rawPayload
                ? JSON.stringify({
                      uri: rawPayload.resourceUri,
                      toolName: rawPayload.toolName,
                      htmlLength: rawPayload.html?.length ?? 0,
                      toolInput: rawPayload.toolInput ?? null,
                      toolResult: rawPayload.toolResult ?? null,
                      csp: rawPayload.csp ?? null,
                  })
                : '',
        [rawPayload],
    );

    const stablePayloadRef = useRef<{ key: string; value: McpUiDataPayload | undefined }>({
        key: '',
        value: undefined,
    });

    if (stablePayloadRef.current.key !== payloadKey) {
        stablePayloadRef.current = { key: payloadKey, value: rawPayload };
    }

    const payload = stablePayloadRef.current.value;

    const sandboxUrl = useMemo(() => deriveSandboxUrl(), []);

    const sandbox = useMemo(() => {
        if (!sandboxUrl) return null;

        return { url: sandboxUrl, csp: payload?.csp };
    }, [sandboxUrl, payload?.csp]);

    useEffect(() => {
        if (!isFullscreen) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsFullscreen(false);
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    const renderApp = (variant: McpUiFrameVariant = 'inline') => {
        if (!sandbox) return <McpUiUnavailable />;

        return (
            <McpUiAppFrame
                payload={payload!}
                sandbox={sandbox}
                sandboxUrl={sandboxUrl}
                handlers={handlers}
                variant={variant}
            />
        );
    };

    const renderFavicon = () => {
        if (faviconUrl) {
            return <img src={faviconUrl} alt="" className="size-5 shrink-0 rounded" />;
        }

        return <Globe className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />;
    };

    const getResponseText = (): string => {
        const result = payload?.toolResult;

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
        <div className="scrollbar-controller scrollbar-vertical flex max-h-[42svh] flex-col gap-4 p-4">
            {renderDetail('Request', payload?.toolInput ? JSON.stringify(payload.toolInput, null, 2) : '{}')}
            {renderDetail('Response', getResponseText())}
        </div>
    );

    if (!payload?.html) {
        if (status?.type === 'running') return <McpUiSkeleton />;

        return null;
    }

    return (
        <>
            <ChatBlock
                dataSlot="mcp-ui-resource"
                className="mcp-ui-resource my-3"
                header={
                    <>
                        {renderFavicon()}
                        <span className="text-sm font-medium text-foreground">{appName ?? 'App'}</span>
                        {toolLabel ? (
                            <span className="font-mono text-sm text-muted-foreground">{toolLabel}</span>
                        ) : null}
                        <TooltipProvider>
                            <div className="ml-auto flex items-center gap-0.5">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            className="justify-center"
                                            onClick={() => setIsFullscreen(true)}
                                            aria-label="Full screen"
                                        >
                                            <Maximize2 aria-hidden="true" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Full screen</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            className="justify-center"
                                            onClick={() => setShowCode((prev) => !prev)}
                                            aria-label={showCode ? 'Hide source' : 'View source'}
                                        >
                                            <CodeXmlIcon aria-hidden="true" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{showCode ? 'Hide source' : 'View source'}</TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </>
                }
            >
                <div data-slot="mcp-ui-body">
                    <div hidden={showCode} className="scrollbar-controller scrollbar-vertical max-h-[42svh]">
                        {renderApp()}
                    </div>
                    {showCode ? renderCode() : null}
                </div>
            </ChatBlock>
            <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
                <DialogContent
                    className="top-0 left-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none"
                    onOpenAutoFocus={(event) => event.preventDefault()}
                >
                    <DialogHeader className="flex-row items-center justify-between bg-muted-foreground/5 py-2">
                        <DialogTitle className="flex min-w-0 items-center gap-2 text-base font-medium">
                            {renderFavicon()}
                            <span className="truncate">{appName ?? 'App'}</span>
                        </DialogTitle>
                        <DialogClose asChild>
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                className="justify-center"
                                aria-label="Close full screen"
                            >
                                <X />
                            </Button>
                        </DialogClose>
                    </DialogHeader>
                    <DialogBody className="flex-1 overflow-hidden bg-card p-0">{renderApp('fullscreen')}</DialogBody>
                </DialogContent>
            </Dialog>
        </>
    );
};
