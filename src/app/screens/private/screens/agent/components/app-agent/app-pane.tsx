import type { BridgeTheme, GenUIAppProps } from '@thefluentmind/genui-sdk';
import { RemoteAppHostProvider } from '@thefluentmind/genui-sdk/host';
import { TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState, type FC } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { buildGenUIPayload } from '@/lib/genui/build-app-payload';
import { loadAppModule } from '@/lib/genui/load-app-module';
import { normalizeToolName } from '@/lib/genui/normalize-tool-name';
import { useRenderChild } from '@/lib/genui/render-child';
import type { AppAgentType } from '@/types/admin';

import { useAppPaneBridge } from './use-app-pane-bridge';

const resolveTheme = (): BridgeTheme =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const resolveLocale = (): string =>
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

interface AppPaneProps {
    agent: AppAgentType;
    userId: string;
    /** Increments after each cleanly finished assistant turn — the app re-queries on change. */
    assistantTurn: number;
    /** Routes a message into the assistant panel (opening it when collapsed). */
    onAskAssistant: (text: string) => void;
}

const PaneMessage = ({ message, error = false }: { message: string; error?: boolean }) => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
        {error && <TriangleAlert className="size-6 text-muted-foreground" />}
        <div className="max-w-md text-sm text-muted-foreground">{message}</div>
    </div>
);

/**
 * The main (non-chat) surface of a `componentType: "app"` agent: a full-page
 * GenUI bundle resolved from `uiConfig.app.refName` against the agent's linked
 * apps. The bundle owns its data — it queries the agent's tools directly via
 * `bridge.callApi` (`POST /ai/apps/tool`), so no model tokens are spent here.
 */
const AppPane = ({ agent, userId, assistantTurn, onAskAssistant }: AppPaneProps) => {
    const refName = agent.uiConfig.app?.refName;

    const payload = useMemo(() => {
        if (!refName) return undefined;

        return buildGenUIPayload({
            apps: agent.apps,
            toolCallId: 'app-pane',
            toolName: normalizeToolName(refName),
            args: {},
        });
    }, [agent.apps, refName]);

    const [Component, setComponent] = useState<FC<GenUIAppProps> | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [theme] = useState<BridgeTheme>(resolveTheme);
    const [locale] = useState<string>(resolveLocale);

    useEffect(() => {
        if (!payload) return undefined;

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
    }, [payload]);

    // `agentId` lets the bundle target `/ai/apps/tool` (which needs the agent
    // identifier in its body); `assistantTurn` is the refresh signal.
    const args = useMemo(
        () => ({ ...(payload?.props ?? {}), agentId: agent.identifier, assistantTurn }),
        [payload, agent.identifier, assistantTurn],
    );

    const bridge = useAppPaneBridge({
        payload: payload ?? {
            toolCallId: 'app-pane',
            appId: '',
            refName: refName ?? '',
            version: '',
            bundleUrl: '',
            props: {},
        },
        args,
        theme,
        locale,
        agentId: agent._id,
        userId,
        onSendMessage: onAskAssistant,
    });

    const renderChild = useRenderChild({
        theme,
        locale,
        agentId: agent._id,
        conversationId: null,
        messageId: undefined,
        parentToolCallId: payload?.toolCallId ?? 'app-pane',
    });

    if (!refName) return <PaneMessage error message="This agent has no app configured (uiConfig.app.refName)." />;

    if (!payload) {
        return <PaneMessage error message={`App “${refName}” is not linked to this agent or has no bundle.`} />;
    }

    if (loadError) return <PaneMessage error message={loadError} />;

    if (!Component) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Spinner className="size-6 text-muted-foreground" />
            </div>
        );
    }

    return (
        <div data-slot="app-pane" className="h-full w-full overflow-auto">
            <RemoteAppHostProvider value={renderChild}>
                <Component bridge={bridge} />
            </RemoteAppHostProvider>
        </div>
    );
};

export default AppPane;
