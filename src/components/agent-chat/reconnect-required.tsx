import { useAui, useAuiState } from '@assistant-ui/react';
import type { ToolCallMessagePart, ToolCallMessagePartProps } from '@assistant-ui/react';
import { PlugZap, RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
    clearPendingConnectMarker,
    isTokenExpired,
    peekPendingConnectServerId,
    syncPendingConnectServerIdFromStorage,
} from '@/hooks/use-mcp-connectors';
import { accountApi, type McpConnection } from '@/lib/api';
import { getErrorToastOptions } from '@/utils/toast-theme';

import { useAgentComposerContext } from './context/agent-composer-context';

export interface ReconnectServer {
    serverId: string;
    name: string;
}

// The backend surfaces a disconnected connector as a synthetic approval-gated
// tool named `mcp_<serverId>_reconnect_required`; the capture group is the id.
const GATE_TOOL_RE = /^mcp_(.+)_reconnect_required$/;

export const getReconnectGateServerId = (toolName: string): string | null => toolName.match(GATE_TOOL_RE)?.[1] ?? null;

/**
 * Backend may surface reconnect as a completed tool result
 * (`{ status: "reconnect_required", message }`) instead of the approval-gated
 * `mcp_<serverId>_reconnect_required` tool. Both need the same card.
 */
export const isReconnectRequiredToolResult = (result: unknown): boolean => {
    if (typeof result !== 'object' || result === null || Array.isArray(result)) return false;

    return (result as { status?: unknown }).status === 'reconnect_required';
};

const isConnected = (connection: McpConnection | undefined): boolean =>
    connection?.status === 'connected' && !isTokenExpired(connection.tokenExpiry);

// After OAuth redirect the connection row can lag as `pending`; keep checking
// briefly so auto-approve does not miss the transition to `connected`.
const OAUTH_STATUS_POLL_MS = 1500;
const OAUTH_STATUS_POLL_MAX = 20;

// Gate + result cards can both mount after OAuth return; only one may resume.
let claimedOAuthResumeServerId: string | null = null;

const claimOAuthResume = (serverId: string): boolean => {
    if (claimedOAuthResumeServerId === serverId) return false;

    claimedOAuthResumeServerId = serverId;

    return true;
};

interface ReconnectRequiredProps {
    servers: ReconnectServer[];
    connectingId: string | null;
    onReconnect: (serverId: string) => void;
}

const renderReconnectIcon = (isReconnecting: boolean) => {
    if (isReconnecting) return <Spinner className="size-3.5" />;

    return <RotateCw className="size-3.5" aria-hidden="true" />;
};

interface ReconnectDismissedProps {
    serverName: string;
}

/**
 * Passive, non-actionable form of the reconnect card for a superseded (non-last)
 * turn: the gate is no longer live, so it shows the outcome without a Reconnect
 * button rather than rendering an empty message or a misleading live CTA.
 */
export const ReconnectDismissed = ({ serverName }: ReconnectDismissedProps) => (
    <div className="reconnect-required reconnect-dismissed mb-3 flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div className="reconnect-required-header flex items-start gap-2">
            <PlugZap className="size-6 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">Reconnect skipped</span>
                <span className="text-sm text-muted-foreground">
                    This response needed a connector that wasn&apos;t reconnected.
                </span>
            </div>
        </div>
        <div className="reconnect-required-servers flex flex-col gap-3 pl-8">
            <span className="text-sm font-medium text-muted-foreground">{serverName}</span>
        </div>
    </div>
);

export const ReconnectRequired = ({ servers, connectingId, onReconnect }: ReconnectRequiredProps) => {
    if (servers.length === 0) return null;

    const renderServerRow = (server: ReconnectServer) => {
        const isReconnecting = connectingId === server.serverId;
        const label = isReconnecting ? 'Reconnecting…' : 'Reconnect';

        return (
            <div key={server.serverId} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-foreground">{server.name}</span>
                <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={isReconnecting}
                    aria-label={`${label} ${server.name}`}
                    onClick={() => onReconnect(server.serverId)}
                >
                    {renderReconnectIcon(isReconnecting)}
                    {label}
                </Button>
            </div>
        );
    };

    return (
        <div className="reconnect-required mb-3 flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <div className="reconnect-required-header flex items-start gap-2">
                <PlugZap className="size-6 text-foreground" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">Reconnect to continue</span>
                    <span className="text-sm text-muted-foreground">
                        This response needs a connector that has to be reconnected before it can run.
                    </span>
                </div>
            </div>
            <div className="reconnect-required-servers flex flex-col gap-3 pl-8">{servers.map(renderServerRow)}</div>
        </div>
    );
};

const useMcpReconnectStatus = (serverId: string, enabled: boolean) => {
    const sawDisconnectedRef = useRef(false);
    const oauthReturnServerIdRef = useRef(peekPendingConnectServerId());
    const [freshConnection, setFreshConnection] = useState<McpConnection | null | undefined>(undefined);
    const [statusCheckEpoch, setStatusCheckEpoch] = useState(0);

    useEffect(() => {
        if (!enabled) return;

        const pendingId = syncPendingConnectServerIdFromStorage();

        if (pendingId === serverId) oauthReturnServerIdRef.current = pendingId;

        let cancelled = false;
        let attempts = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const applyConnection = (connection: McpConnection | null): boolean => {
            const nowConnected = isConnected(connection ?? undefined);

            if (!nowConnected) sawDisconnectedRef.current = true;
            setFreshConnection(connection);

            return nowConnected;
        };

        const schedulePollIfNeeded = (nowConnected: boolean) => {
            const returning = oauthReturnServerIdRef.current === serverId;

            if (!returning || nowConnected || attempts >= OAUTH_STATUS_POLL_MAX) return;

            timer = setTimeout(() => {
                void runCheck();
            }, OAUTH_STATUS_POLL_MS);
        };

        const runCheck = async () => {
            attempts += 1;

            try {
                const page = await accountApi.listMcpConnections({ size: 50 });

                if (cancelled) return;

                const connection = page.values.find((item) => item.mcpServerId === serverId) ?? null;

                schedulePollIfNeeded(applyConnection(connection));
            } catch {
                if (cancelled) return;

                sawDisconnectedRef.current = true;
                setFreshConnection(null);
                schedulePollIfNeeded(false);
            }
        };

        void runCheck();

        return () => {
            cancelled = true;
            if (timer !== undefined) clearTimeout(timer);
        };
    }, [enabled, serverId, statusCheckEpoch]);

    useEffect(() => {
        if (!enabled) return;

        const onPageShow = (event: PageTransitionEvent) => {
            if (!event.persisted) return;

            const pendingId = syncPendingConnectServerIdFromStorage();

            if (pendingId === serverId) oauthReturnServerIdRef.current = pendingId;
            setStatusCheckEpoch((epoch) => epoch + 1);
        };

        window.addEventListener('pageshow', onPageShow);

        return () => {
            window.removeEventListener('pageshow', onPageShow);
        };
    }, [enabled, serverId]);

    const connected = isConnected(freshConnection ?? undefined);
    const returningFromOAuth = oauthReturnServerIdRef.current === serverId;
    const canResume = connected && (returningFromOAuth || sawDisconnectedRef.current);

    return {
        hasFreshStatus: freshConnection !== undefined,
        connected,
        returningFromOAuth,
        canResume,
        bumpStatusCheck: () => setStatusCheckEpoch((epoch) => epoch + 1),
    };
};

interface ReconnectResultToolProps {
    serverId: string;
    serverName: string;
}

/**
 * Reconnect card for a completed tool that returned `status: "reconnect_required"`.
 * The turn already finished — `reconnectResume` only works for paused approval
 * gates. After OAuth we regenerate this assistant message so the model retries
 * with the live connector (mid-conversation reconnect).
 */
export const ReconnectResultTool = ({ serverId, serverName }: ReconnectResultToolProps) => {
    const aui = useAui();
    const auiRef = useRef(aui);
    const { composer } = useAgentComposerContext();
    const { reconnect, connectingId } = composer.connectors;
    const isLast = useAuiState((s) => s.message.isLast);
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const { hasFreshStatus, connected, returningFromOAuth, canResume } = useMcpReconnectStatus(serverId, true);
    const resumedRef = useRef(false);
    const [resumed, setResumed] = useState(false);

    auiRef.current = aui;

    const retryTurn = (): boolean => {
        try {
            auiRef.current.message().reload();

            return true;
        } catch {
            return false;
        }
    };

    useEffect(() => {
        if (!isLast || isRunning || resumedRef.current || !hasFreshStatus || !canResume || !returningFromOAuth) {
            return;
        }

        if (!claimOAuthResume(serverId)) return;

        clearPendingConnectMarker();

        if (!retryTurn()) {
            claimedOAuthResumeServerId = null;
            toast.error('Could not resume after reconnecting. Please try again.', getErrorToastOptions());

            return;
        }

        resumedRef.current = true;
        setResumed(true);
    }, [isLast, isRunning, hasFreshStatus, canResume, returningFromOAuth, serverId]);

    const handleReconnect = (id: string) => {
        if (connected) {
            if (!isLast || resumedRef.current) return;
            if (!claimOAuthResume(id)) return;

            clearPendingConnectMarker();

            if (!retryTurn()) {
                claimedOAuthResumeServerId = null;
                toast.error('Could not resume after reconnecting. Please try again.', getErrorToastOptions());

                return;
            }

            resumedRef.current = true;
            setResumed(true);

            return;
        }

        void reconnect(id);
    };

    // Older turns: drop the card once the connector is healthy again.
    if (resumed || (!isLast && connected)) return null;

    return (
        <ReconnectRequired
            servers={[{ serverId, name: serverName }]}
            connectingId={connectingId}
            onReconnect={handleReconnect}
        />
    );
};

// The gate tool executes on approval and returns one of these; a skipped gate
// never executes, so it has no such result. This is the gate's OWN output — the
// one signal that tells "this gate ran" without inspecting neighbouring parts.
const isGateExecutedResult = (result: unknown): boolean => {
    if (typeof result !== 'object' || result === null) return false;

    const status = (result as { status?: unknown }).status;

    return status === 'reconnected' || status === 'still_disconnected';
};

interface ReconnectGateToolProps {
    serverId: string;
    serverName: string;
    result?: unknown;
    approval?: ToolCallMessagePart['approval'];
    respondToApproval?: ToolCallMessagePartProps['respondToApproval'];
}

export const ReconnectGateTool = ({
    serverId,
    serverName,
    result,
    approval,
    respondToApproval,
}: ReconnectGateToolProps) => {
    const { composer, resumeAfterReconnect } = useAgentComposerContext();
    const { reconnect, connectingId } = composer.connectors;
    // Same settle signal as AssistantActions (hideLastWhileRunning): OAuth and
    // auto-approve wait for it, but the card itself mounts as soon as the gate
    // is pending so gate-only turns are not blank during the Generating gap.
    const isTurnSettled = useAuiState((s) => {
        const actionsHidden = s.thread.isRunning && s.message.isLast;

        return !actionsHidden && s.message.status?.type === 'requires-action';
    });
    const isLast = useAuiState((s) => s.message.isLast);
    const isRunning = useAuiState((s) => s.thread.isRunning);
    // Did THIS gate run? The gate executes only on approval and its result is its
    // own persisted output — independent of neighbouring parts, so a sibling tool
    // call in the same turn cannot be mistaken for this gate resuming, and it
    // survives history reload (unlike approval.approved, which memory-mode drops).
    const gateExecuted = isGateExecutedResult(result);
    const autoRespondedRef = useRef(false);
    const reconnectRef = useRef(reconnect);
    const respondToApprovalRef = useRef(respondToApproval);
    const [queuedServerId, setQueuedServerId] = useState<string | null>(null);

    reconnectRef.current = reconnect;
    respondToApprovalRef.current = respondToApproval;

    const isPending = approval != null && approval.approved === undefined;
    // Keep status checks alive on OAuth return even when history reload dropped
    // the pending approval — otherwise mid-conversation reconnect never resumes.
    // Only the live/last gate needs status polling — both resume effects require
    // isLast, so a superseded gate polling connected would do nothing but burn
    // requests.
    const checkStatus = isLast && (isPending || peekPendingConnectServerId() === serverId);
    const {
        hasFreshStatus,
        connected,
        returningFromOAuth,
        canResume: canAutoApprove,
    } = useMcpReconnectStatus(serverId, checkStatus);
    const effectiveConnectingId = connectingId ?? queuedServerId;

    // Resume only after a real reconnect (OAuth return, or disconnected→connected),
    // never because the first status check still looked connected while the gate is up.
    useEffect(() => {
        if (
            !isPending ||
            !isLast ||
            !isTurnSettled ||
            autoRespondedRef.current ||
            !hasFreshStatus ||
            !canAutoApprove ||
            !respondToApproval
        ) {
            return;
        }

        // Only the live/last gate for a server may auto-approve. A superseded
        // (off-branch) gate keeps polling connected once the user reconnects X
        // elsewhere; without this claim it would fire respondToApproval against a
        // message with no live run — surfacing a stray error toast on a turn the
        // user has moved past, or silently resuming a superseded branch.
        if (!claimOAuthResume(serverId)) return;

        autoRespondedRef.current = true;
        setQueuedServerId(null);

        try {
            respondToApproval({ approved: true });
            if (returningFromOAuth) clearPendingConnectMarker();
        } catch {
            claimedOAuthResumeServerId = null;
            autoRespondedRef.current = false;
            toast.error('Could not resume after reconnecting. Please try again.', getErrorToastOptions());
        }
    }, [
        isPending,
        isLast,
        isTurnSettled,
        hasFreshStatus,
        canAutoApprove,
        respondToApproval,
        returningFromOAuth,
        serverId,
    ]);

    // History reload after OAuth often drops the pending approval. Fall back to an
    // explicit reconnect resume so mid-conversation reconnect still continues.
    useEffect(() => {
        if (
            isPending ||
            !isLast ||
            isRunning ||
            autoRespondedRef.current ||
            !hasFreshStatus ||
            !returningFromOAuth ||
            !connected ||
            !resumeAfterReconnect
        ) {
            return;
        }

        if (!claimOAuthResume(serverId)) return;

        autoRespondedRef.current = true;
        clearPendingConnectMarker();
        resumeAfterReconnect([serverId]);
    }, [isPending, isLast, isRunning, hasFreshStatus, returningFromOAuth, connected, resumeAfterReconnect, serverId]);

    // Flush a Reconnect click that arrived before the turn settled.
    useEffect(() => {
        if (!queuedServerId || !isTurnSettled || !isPending) return;

        // Auto-approve will resume this turn; starting OAuth would navigate away for nothing.
        if (canAutoApprove) {
            setQueuedServerId(null);

            return;
        }

        // Already connected (OAuth finished, auto-approve missed) — resume in place.
        if (connected && respondToApprovalRef.current) {
            const respond = respondToApprovalRef.current;

            setQueuedServerId(null);
            autoRespondedRef.current = true;

            try {
                respond({ approved: true });
                clearPendingConnectMarker();
            } catch {
                autoRespondedRef.current = false;
                toast.error('Could not resume after reconnecting. Please try again.', getErrorToastOptions());
            }

            return;
        }

        const id = queuedServerId;

        setQueuedServerId(null);
        void reconnectRef.current(id);
    }, [queuedServerId, isTurnSettled, isPending, canAutoApprove, connected]);

    // Drop a queued click if the gate resolves before settle (cancel / error / approve).
    useEffect(() => {
        if (!isPending) setQueuedServerId(null);
    }, [isPending]);

    const handleReconnect = (id: string) => {
        if (!isTurnSettled) {
            setQueuedServerId(id);

            return;
        }

        // Already connected — resume without another OAuth redirect.
        if (connected && respondToApproval) {
            autoRespondedRef.current = true;

            try {
                respondToApproval({ approved: true });
                clearPendingConnectMarker();
            } catch {
                autoRespondedRef.current = false;
                toast.error('Could not resume after reconnecting. Please try again.', getErrorToastOptions());
            }

            return;
        }

        void reconnect(id);
    };

    // Superseded (non-last) gate. If the turn produced an answer the gate ran
    // (approved → resumed into this same message), so render nothing. A text-less
    // turn was skipped and the gate is its only content, so show the passive card
    // rather than an empty bubble — this holds in both the live state (runtime
    // cancels the approval, isPending already false) and the reloaded state (which
    // drops the approval entirely), which approval.approved cannot distinguish.
    if (!isLast) return gateExecuted ? null : <ReconnectDismissed serverName={serverName} />;

    if (!isPending) return null;

    return (
        <ReconnectRequired
            servers={[{ serverId, name: serverName }]}
            connectingId={effectiveConnectingId}
            onReconnect={handleReconnect}
        />
    );
};
