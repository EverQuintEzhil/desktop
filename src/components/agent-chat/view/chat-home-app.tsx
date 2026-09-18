import { HatGlassesIcon, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { useChatHost } from '@/components/chat-host';
import type { TextAreaRef } from '@/components/text-area';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Spinner } from '@/components/ui/spinner';
import { buildGenUIPayload } from '@/lib/genui/build-app-payload';
import { normalizeToolName } from '@/lib/genui/normalize-tool-name';
import type { GenUIDataPayload } from '@/lib/genui/types';
import type { ChatAgentType } from '@/types/admin';

import { useAgentComposerContext } from '../context/agent-composer-context';
import { useChatShell } from '../context/chat-shell-context';
import HomeApp from '../genui/home-app';
import type { HomeSubmitPayload } from '../types';

import ChatComposer from './agent-chat-composer';

type PrefetchStatus = 'loading' | 'ready' | 'fallback' | 'error';

const reasonFromError = (e: unknown): string => (e instanceof Error && e.message ? e.message : 'Unexpected error.');

const reasonFromEnvelope = (json: { message?: unknown; error?: unknown }): string => {
    if (typeof json.message === 'string') return json.message;

    if (typeof json.error === 'string') return json.error;

    return 'Unknown error.';
};

interface Props {
    agent: ChatAgentType;
    isFromAdmin?: boolean;
    resetKey?: string | number;
    onSubmit: (payload: HomeSubmitPayload) => void;
    renderFallback: () => ReactNode;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// The data tool echoes a text summary under `value` and the widget args under a named
// payload key (e.g. `output.dashboard`); pick the first nested object/array that is not
// that summary.
const pickWidgetArgs = (output: Record<string, unknown>): Record<string, unknown> => {
    const entry = Object.entries(output).find(
        ([key, value]) => key !== 'value' && (isPlainObject(value) || Array.isArray(value)),
    );

    if (entry && isPlainObject(entry[1])) return entry[1];

    return output;
};

const ChatHomeApp = ({ agent, isFromAdmin = false, resetKey, onSubmit, renderFallback }: Props) => {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<PrefetchStatus>('loading');
    const [payload, setPayload] = useState<GenUIDataPayload>();
    const [errorMessage, setErrorMessage] = useState<string>();
    const [retryCount, setRetryCount] = useState(0);
    const textAreaRef = useRef<TextAreaRef>(null);

    const { composer, filesState } = useAgentComposerContext();
    const { variant } = useChatShell();
    const fillParent = isFromAdmin || variant === 'panel';
    const { setParameters } = composer;
    const { clearFiles } = filesState;
    const { slots, session, transport } = useChatHost();
    const userId = session.user?.id ?? 'anon';

    const startedKeyRef = useRef<string | number | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        setParameters({});
        clearFiles();
    }, [setParameters, clearFiles]);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const key = `${resetKey ?? '__mount__'}:${retryCount}`;

        if (startedKeyRef.current === key) return;
        startedKeyRef.current = key;

        setStatus('loading');
        setPayload(undefined);
        setErrorMessage(undefined);

        // A late-landing fetch from a superseded attempt (agent switch, re-run) must not
        // write over the current one's state, and nothing writes after unmount.
        const isCurrent = () => mountedRef.current && startedKeyRef.current === key;

        const failWith = (reason: string) => {
            if (isCurrent()) {
                setErrorMessage(reason);
                setStatus('error');
                // Stable id collapses duplicates so a remount/re-render can't stack toasts.
                toast.error("Couldn't load the home app", { id: 'home-app-load-error', description: reason });
            }
        };

        const homeApp = agent.uiConfig?.home?.homeApp;
        const refName = homeApp?.refName;

        if (!refName) {
            setStatus('fallback');

            return;
        }

        const shell = buildGenUIPayload({
            apps: agent.apps,
            toolCallId: 'home-app',
            toolName: normalizeToolName(refName),
            args: {},
        });

        if (!shell) {
            setStatus('fallback');

            return;
        }

        const appName = agent.apps?.find((app) => app.refName === refName)?.name ?? refName;

        const dataTool = homeApp?.dataTool;

        const runLive = async (tool: NonNullable<typeof dataTool>) => {
            try {
                const response = await transport.fetch(`${transport.baseUrl}/ai/apps/tool`, {
                    method: 'POST',
                    credentials: transport.credentials,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agentIdOrIdentifier: agent.identifier,
                        tool: tool.refName,
                        args: tool.args ?? {},
                    }),
                });

                if (!response.ok) {
                    failWith(`Couldn't load the “${appName}” app.`);

                    return;
                }

                const json = (await response.json()) as {
                    success?: boolean;
                    value?: unknown;
                    message?: unknown;
                    error?: unknown;
                };

                if (json.success === false) {
                    failWith(`Couldn't load the “${appName}” app — ${reasonFromEnvelope(json)}`);

                    return;
                }

                const value = isPlainObject(json.value) ? json.value : {};
                const props = pickWidgetArgs(value);

                if (!isCurrent()) return;

                setPayload({ ...shell, props });
                setStatus('ready');
            } catch (e) {
                failWith(`Couldn't load the “${appName}” app — ${reasonFromError(e)}`);
            }
        };

        // A data tool is optional. With one, call it and feed its result into the app.
        // Without one, render the app shell directly — it may collect its own input.
        if (dataTool?.refName) {
            void runLive(dataTool);
        } else {
            setPayload(shell);
            setStatus('ready');
        }
    }, [agent, resetKey, transport, retryCount]);

    const handleSendMessage = useCallback(
        (message: string) => {
            onSubmit({ message });
        },
        [onSubmit],
    );

    const handleRetry = useCallback(() => setRetryCount((c) => c + 1), []);

    const renderHeaderCluster = () => {
        const headerActions = slots?.renderHomeHeaderActions?.({ agent });
        const isIncognitoEnabled = agent.uiConfig?.home?.search?.isIncognitoEnabled;

        if (!headerActions && !isIncognitoEnabled) {
            return null;
        }

        return (
            <div className="home-header-actions absolute top-2 right-4 z-2 flex items-center gap-2">
                {headerActions}
                {isIncognitoEnabled && (
                    <SimpleTooltip
                        content={composer.isIncognitoMode ? 'Turn off Temporary chat' : 'Turn on Temporary chat'}
                        side="bottom"
                    >
                        <div
                            className={`incognito-button flex items-center justify-center ${composer.isIncognitoMode ? 'active' : ''}`}
                            onClick={composer.toggleIncognitoMode}
                            onKeyDown={(e) => e.key === 'Enter' && composer.toggleIncognitoMode()}
                            role="button"
                            tabIndex={0}
                        >
                            <HatGlassesIcon className="size-5" />
                        </div>
                    </SimpleTooltip>
                )}
            </div>
        );
    };

    const renderComposer = () => {
        if (slots?.renderComposer) {
            return slots.renderComposer({
                send: (message) => onSubmit({ message }),
                isRunning: false,
                isDisabled: false,
            });
        }

        return (
            <ChatComposer
                agent={agent}
                onSubmit={onSubmit}
                value={query}
                onChange={setQuery}
                textAreaRef={textAreaRef}
                autoFocus
                enableSpaceSelection
            />
        );
    };

    if (status === 'fallback') {
        return <>{renderFallback()}</>;
    }

    const renderError = () => (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
            <TriangleAlert className="size-6 text-muted-foreground" />
            <div className="text-sm font-medium">Couldn&apos;t load the home app</div>
            <div className="max-w-md text-xs text-muted-foreground">{errorMessage}</div>
            <Button variant="outline" size="sm" onClick={handleRetry}>
                Retry
            </Button>
        </div>
    );

    const renderAppRegion = () => {
        if (status === 'error') {
            return renderError();
        }

        if (status === 'loading' || !payload) {
            return (
                <div className="flex h-full w-full items-center justify-center">
                    <Spinner className="size-6 text-muted-foreground" />
                </div>
            );
        }

        return <HomeApp payload={payload} agentId={agent._id} userId={userId} onSendMessage={handleSendMessage} />;
    };

    return (
        <>
            <div className={`chat-home-app relative flex w-full flex-col ${fillParent ? 'h-full' : 'h-svh'}`}>
                {renderHeaderCluster()}
                <div className="scrollbar-controller min-h-0 flex-1">{renderAppRegion()}</div>
                <div className="shrink-0">
                    <div className="mx-auto w-full max-w-[810px] px-4 pb-4">{renderComposer()}</div>
                </div>
            </div>
            {slots?.renderHomeSidePanel?.({ agent })}
        </>
    );
};

export default ChatHomeApp;
