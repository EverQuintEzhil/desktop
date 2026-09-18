'use client';

/**
 * Host-side renderer for app-inside-app nesting: loads a child bundle and hands
 * it a display-only bridge with all capabilities disabled — nested bricks get
 * no backend I/O and no conversation injection.
 */

import type { BridgeCapabilities, BridgeTheme, GenUIAppProps, GenUIBridge } from '@thefluentmind/genui-sdk';
import type { RemoteAppRenderer, RemoteAppRequest } from '@thefluentmind/genui-sdk/host';
import { useEffect, useMemo, useState, type FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { loadAppModule } from '@/lib/genui/load-app-module';

export interface RenderChildContext {
    theme: BridgeTheme;
    locale: string;
    agentId: string;
    conversationId: string | null;
    messageId: string | undefined;
    parentToolCallId: string;
}

interface RemoteChildProps extends RenderChildContext {
    req: RemoteAppRequest;
}

const DISPLAY_CAPABILITIES: BridgeCapabilities = {
    addResult: false,
    sendMessage: false,
    getState: false,
    setState: false,
    callApi: false,
    callMcp: false,
    uploadFile: false,
    publishContext: false,
    onAction: false,
};

const ChildSkeleton = () => (
    <Skeleton
        data-slot="genui-child-skeleton"
        className="genui-child-skeleton my-1 h-16 w-full rounded-lg bg-muted/50"
        aria-busy="true"
        aria-label="Loading app"
    />
);

const ChildError = ({ message }: { message: string }) => (
    <div
        data-slot="genui-child-error"
        className="genui-child-error my-1 rounded-lg bg-card px-3 py-2.5 text-sm text-muted-foreground"
    >
        {message}
    </div>
);

const noop = (): void => {};

const sendMessageUnavailable: GenUIBridge['sendMessage'] = async () => {};

const callApiUnavailable: GenUIBridge['callApi'] = async () => {
    throw new Error('callApi is not available to display-only bricks');
};

const callMcpUnavailable: GenUIBridge['callMcp'] = async () => {
    throw new Error('callMcp is not available to display-only bricks');
};

function RemoteChild({ req, theme, locale, parentToolCallId }: RemoteChildProps) {
    const [Component, setComponent] = useState<FC<GenUIAppProps> | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (Component) return;

        let cancelled = false;

        loadAppModule(req.refName, req.version, req.bundleUrl)
            .then((component) => {
                if (!cancelled) setComponent(() => component as unknown as FC<GenUIAppProps>);
            })
            .catch((error: unknown) => {
                if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Failed to load app.');
            });

        return () => {
            cancelled = true;
        };
    }, [req.refName, req.version, req.bundleUrl, Component]);

    const bridge = useMemo<GenUIBridge>(
        () => ({
            appId: '',
            refName: req.refName,
            toolCallId: `${parentToolCallId}#${req.slot}`,
            args: req.args,
            result: undefined,
            status: { type: 'complete' },
            theme,
            locale,
            capabilities: DISPLAY_CAPABILITIES,
            addResult: noop,
            getState: () => undefined,
            setState: noop,
            sendMessage: sendMessageUnavailable,
            callApi: callApiUnavailable,
            callMcp: callMcpUnavailable,
        }),
        [req.refName, req.slot, req.args, parentToolCallId, theme, locale],
    );

    if (loadError) return <ChildError message={loadError} />;

    if (!Component) return <ChildSkeleton />;

    return <Component bridge={bridge} />;
}

export function useRenderChild(ctx: RenderChildContext): RemoteAppRenderer {
    const { theme, locale, agentId, conversationId, messageId, parentToolCallId } = ctx;

    return useMemo<RemoteAppRenderer>(
        () => (req: RemoteAppRequest) => (
            <RemoteChild
                key={`${req.slot}:${req.refName}:${req.version}`}
                req={req}
                theme={theme}
                locale={locale}
                agentId={agentId}
                conversationId={conversationId}
                messageId={messageId}
                parentToolCallId={parentToolCallId}
            />
        ),
        [theme, locale, agentId, conversationId, messageId, parentToolCallId],
    );
}
