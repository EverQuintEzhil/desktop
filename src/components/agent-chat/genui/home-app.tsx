import type { BridgeTheme, GenUIAppProps } from '@thefluentmind/genui-sdk';
import { RemoteAppHostProvider } from '@thefluentmind/genui-sdk/host';
import { useEffect, useState, type FC } from 'react';

import { useHomeBridge } from '@/components/agent-chat/genui/use-native-bridge';
import { Spinner } from '@/components/ui/spinner';
import { loadAppModule } from '@/lib/genui/load-app-module';
import { useRenderChild } from '@/lib/genui/render-child';
import type { GenUIDataPayload } from '@/lib/genui/types';

const resolveTheme = (): BridgeTheme =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const resolveLocale = (): string =>
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

interface HomeAppProps {
    payload: GenUIDataPayload;
    agentId: string;
    userId: string;
    onSendMessage: (text: string) => void;
}

const HomeSkeleton = () => (
    <div className="flex h-full w-full items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
    </div>
);

const HomeError = ({ message }: { message: string }) => (
    <div data-slot="home-genui-error" className="rounded-lg bg-card px-3 py-2.5 text-sm text-muted-foreground">
        {message}
    </div>
);

const HomeApp = ({ payload, agentId, userId, onSendMessage }: HomeAppProps) => {
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

    const bridge = useHomeBridge({
        payload,
        args: payload.props,
        theme,
        locale,
        agentId,
        userId,
        onSendMessage,
    });

    const renderChild = useRenderChild({
        theme,
        locale,
        agentId,
        conversationId: null,
        messageId: undefined,
        parentToolCallId: payload.toolCallId,
    });

    if (loadError) return <HomeError message={loadError} />;
    if (!Component) return <HomeSkeleton />;

    // Respect an app-declared width cap; otherwise the wrapper hugs the app's own width
    // (w-fit) so a narrow card is centered on its real width, not left-aligned in a column.
    const maxWidth = payload.display?.maxWidth;

    return (
        // Center the app in the viewport whatever its size; auto margins collapse when it
        // outgrows the region so tall apps scroll from the top instead of clipping.
        <div data-slot="home-genui-app" className="flex min-h-full w-full px-4 py-4">
            <div className="m-auto w-fit max-w-full" style={maxWidth ? { maxWidth } : undefined}>
                <RemoteAppHostProvider value={renderChild}>
                    <Component bridge={bridge} />
                </RemoteAppHostProvider>
            </div>
        </div>
    );
};

export default HomeApp;
