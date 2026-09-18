import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { accountApi, mcpServersApi } from '@/lib/api';
import type { McpConnection, McpServer } from '@/lib/api';
import { invalidateConnectorSurfaces } from '@/lib/api/common/mcp-servers';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';

/**
 * Presentation states, NOT the row's `status` column. `mcp_servers_connections_status_check` allows
 * `pending | connected | disconnected | expired | error`, and `getConnectorStatus` folds those five
 * into these — so there is deliberately no `failed` here: the column can never hold it, and giving a
 * revoked grant a red "Failed" would take away the Reconnect that is the only way back (AMP-569).
 */
export type ConnectorStatus = 'connected' | 'pending' | 'not_connected' | 'available' | 'expired';

export const isTokenExpired = (tokenExpiry: string | null): boolean =>
    tokenExpiry ? new Date(tokenExpiry).getTime() <= Date.now() : false;

// The OAuth callback drops the user back on the page that started the flow with no
// outcome in the URL, so the started connection is stashed here and reconciled against
// the refreshed connector data on the way back — see `useConnectResultNotice`.
export const PENDING_CONNECT_STORAGE_KEY = 'mcp-connect-in-progress';
const PENDING_CONNECT_TTL_MS = 5 * 60 * 1000;

const pendingConnectSchema = z.object({
    mcpServerId: z.string(),
    startedAt: z.number(),
    /**
     * The row as it stood when the redirect began. The outcome is inferred from the row rather than
     * told to us, so the only honest signal that this attempt did anything is that the row CHANGED:
     * a revoked row is already `error`, and a lapsed one is already `connected` with a past expiry,
     * so without this an abandoned reconnect reports a failure the user never had.
     *
     * Optional: a marker written before these fields existed carries neither, and absent reads as
     * "changed", which is right for the first connect the toast exists for.
     */
    priorStatus: z.string().nullable().optional(),
    priorTokenExpiry: z.string().nullable().optional(),
});

type PendingConnect = z.infer<typeof pendingConnectSchema>;

const readPendingConnect = (): PendingConnect | null => {
    try {
        const raw = window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY);

        if (!raw) return null;

        const parsed = pendingConnectSchema.safeParse(JSON.parse(raw));

        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
};

const writePendingConnect = (
    mcpServerId: string,
    prior: Pick<McpConnection, 'status' | 'tokenExpiry'> | null,
): void => {
    try {
        window.sessionStorage.setItem(
            PENDING_CONNECT_STORAGE_KEY,
            JSON.stringify({
                mcpServerId,
                startedAt: Date.now(),
                priorStatus: prior?.status ?? null,
                priorTokenExpiry: prior?.tokenExpiry ?? null,
            } satisfies PendingConnect),
        );
    } catch {
        // A blocked sessionStorage only costs the post-redirect toast.
    }
};

const clearPendingConnect = (): void => {
    try {
        window.sessionStorage.removeItem(PENDING_CONNECT_STORAGE_KEY);
    } catch {
        // Nothing to clean up when storage is unavailable.
    }
};

// Captured at module load before React effects can clear sessionStorage.
// Also refreshed from storage on bfcache restore (see syncPendingConnectServerIdFromStorage).
let pendingConnectServerIdAtLoad: string | null = (() => {
    if (typeof window === 'undefined') return null;

    const pending = readPendingConnect();

    if (!pending) return null;
    if (Date.now() - pending.startedAt > PENDING_CONNECT_TTL_MS) return null;

    return pending.mcpServerId;
})();

/**
 * Server id of an in-flight OAuth connect (module-load capture, or synced from
 * sessionStorage after bfcache), or null when none / expired.
 */
export const peekPendingConnectServerId = (): string | null => pendingConnectServerIdAtLoad;

/**
 * Re-read the OAuth-in-progress marker from sessionStorage into the in-memory
 * capture. Needed on bfcache restore where the module does not reload but storage
 * still holds the id written before the redirect.
 */
export const syncPendingConnectServerIdFromStorage = (): string | null => {
    if (typeof window === 'undefined') return pendingConnectServerIdAtLoad;

    const pending = readPendingConnect();

    if (!pending) return pendingConnectServerIdAtLoad;
    if (Date.now() - pending.startedAt > PENDING_CONNECT_TTL_MS) return pendingConnectServerIdAtLoad;

    pendingConnectServerIdAtLoad = pending.mcpServerId;

    return pendingConnectServerIdAtLoad;
};

/** Drop the OAuth-in-progress marker after the reconnect gate consumes it. */
export const clearPendingConnectMarker = (): void => {
    pendingConnectServerIdAtLoad = null;
    clearPendingConnect();
};

export interface ConnectResultSource {
    _id: string;
    name: string;
    connection?: { status: string; tokenExpiry: string | null } | null;
}

type ConnectOutcome = 'connected' | 'failed' | 'unresolved';

/**
 * A connection the backend is still working on reads as `pending` — the detail pane polls
 * on exactly that state — and the first payload after the redirect can also arrive before
 * the row exists. Neither is an outcome, so they are reported as `unresolved` rather than
 * as a failure the user never had.
 */
const getConnectOutcome = (connection: ConnectResultSource['connection'], prior?: PendingConnect): ConnectOutcome => {
    // A row identical to the one the redirect started from says nothing about this attempt, so it is
    // reported as nothing. Closing the provider tab on a connector that was ALREADY unusable — a
    // revoked `error`, or a `connected` row whose token had lapsed — is the case this covers; both
    // otherwise read as a fresh failure. The Reconnect affordance is still on screen either way.
    if (
        prior !== undefined &&
        prior.priorStatus !== undefined &&
        prior.priorStatus === (connection?.status ?? null) &&
        (prior.priorTokenExpiry ?? null) === (connection?.tokenExpiry ?? null)
    ) {
        return 'unresolved';
    }

    if (connection?.status === 'connected') {
        return isTokenExpired(connection.tokenExpiry) ? 'failed' : 'connected';
    }

    return connection?.status === 'error' ? 'failed' : 'unresolved';
};

/**
 * Reports the outcome of an OAuth connect once the provider redirects back. `servers`
 * must be the freshly loaded connector data; `isReady` gates the check until it arrives.
 * An outcome that never resolves is dropped silently when the marker goes stale — the
 * connector's own Connect affordance is still on screen to say the same thing.
 */
export const useConnectResultNotice = (servers: ConnectResultSource[] | undefined, isReady = true): void => {
    useEffect(() => {
        if (!isReady) return;

        const pending = readPendingConnect();

        if (!pending) return;

        if (Date.now() - pending.startedAt > PENDING_CONNECT_TTL_MS) {
            clearPendingConnect();

            return;
        }

        const server = servers?.find((item) => item._id === pending.mcpServerId);

        // The flow may have been started from a surface this list does not cover;
        // leave the marker for that surface until it goes stale.
        if (!server) return;

        const outcome = getConnectOutcome(server.connection, pending);

        // Keep the marker so a later payload — this effect re-runs whenever the connector
        // data changes — can still report the real outcome.
        if (outcome === 'unresolved') return;

        clearPendingConnect();

        if (outcome === 'connected') {
            toast.success(`Connected to ${server.name}`);

            return;
        }

        toast.error(`Couldn't connect to ${server.name}. Please try again.`);
    }, [isReady, servers]);
};

export interface McpConnector {
    server: McpServer;
    status: ConnectorStatus;
    requiresAuth: boolean;
    isConnected: boolean;
}

interface UseMcpConnectorsParams {
    enabled?: boolean;
}

interface UseMcpConnectorsResult {
    connectors: McpConnector[];
    isLoading: boolean;
    isError: boolean;
    connect: (server: McpServer) => Promise<boolean>;
    connectingId: string | null;
}

export const getConnectorStatus = (
    server: McpServer,
    connection?: Pick<McpConnection, 'status' | 'tokenExpiry'> | null,
): ConnectorStatus => {
    if (server.authType !== 'oauth') {
        return 'available';
    }

    if (connection?.status === 'connected') {
        return isTokenExpired(connection.tokenExpiry) ? 'expired' : 'connected';
    }

    if (connection?.status === 'pending') {
        return 'pending';
    }

    // A grant the provider refused is written as `error`; `expired` is the column's own spelling of a
    // lapsed one. Both are a connector the user once had, so both owe them "Reconnect" rather than the
    // "Connect" of one that was never set up. `disconnected` is NOT here — only `POST /disconnect`
    // writes it, so its owner asked for this and is owed "Connect".
    if (connection?.status === 'error' || connection?.status === 'expired') {
        return 'expired';
    }

    return 'not_connected';
};

const resolveStatus = (server: McpServer, connection: McpConnection | undefined): McpConnector => {
    const status = getConnectorStatus(server, connection);

    return {
        server,
        status,
        requiresAuth: server.authType === 'oauth',
        isConnected: status === 'connected' || status === 'available',
    };
};

interface UseConnectActionResult {
    /**
     * Resolves `false` when the authorization URL could not be obtained; `true` while the redirect runs.
     *
     * `connection` is read only to record the row the attempt started from, so an abandoned
     * reconnect is not reported as a failure. Optional, because a caller that has only the id
     * loses nothing but that distinction.
     */
    connect: (server: ConnectActionServer) => Promise<boolean>;
    connectingId: string | null;
}

type ConnectActionServer = Pick<McpServer, '_id'> & Partial<Pick<McpServer, 'connection'>>;

export const useConnectAction = (): UseConnectActionResult => {
    const queryClient = useQueryClient();
    const [connectingId, setConnectingId] = useState<string | null>(null);

    // Handle browser back button (bfcache)
    React.useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                setConnectingId(null);
                queryClient.invalidateQueries({ queryKey: ['account', 'mcp-connections'] });
                // Connection status also rides on the connector objects (`server.connection`),
                // so a bfcache restore must refresh those or the pane shows pre-connect state.
                invalidateConnectorSurfaces(queryClient);
            }
        };

        window.addEventListener('pageshow', handlePageShow);

        return () => {
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, [queryClient]);

    const connect = useCallback(async (server: ConnectActionServer): Promise<boolean> => {
        setConnectingId(server._id);

        try {
            const { authorizationUrl } = await mcpServersApi.connect(server._id, window.location.href);

            writePendingConnect(server._id, server.connection ?? null);
            window.location.href = authorizationUrl;

            return true;
        } catch (error) {
            clearPendingConnect();
            // An `AxiosError` is an `Error`, so its own `message` is transport text
            // ("Request failed with status code 404"). The api's own message says why.
            toast.error(getApiErrorMessage(error, 'Failed to start connection.'));
            setConnectingId(null);

            return false;
        }
    }, []);

    return { connect, connectingId };
};

interface UseDisconnectActionResult {
    disconnect: (
        server: Pick<McpServer, '_id'>,
        options?: { successMessage?: string; errorMessage?: string },
    ) => Promise<void>;
    disconnectingId: string | null;
}

export const useDisconnectAction = (): UseDisconnectActionResult => {
    const queryClient = useQueryClient();
    const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

    const disconnect = useCallback(
        async (server: Pick<McpServer, '_id'>, options?: { successMessage?: string; errorMessage?: string }) => {
            setDisconnectingId(server._id);

            try {
                await mcpServersApi.disconnect(server._id);
                await queryClient.invalidateQueries({ queryKey: ['account', 'mcp-connections'] });
                // Connection status is embedded on the connector objects (`server.connection`),
                // so refresh the lists/agent that carry it — the connections query above only
                // powers the live reconnect gate.
                invalidateConnectorSurfaces(queryClient);
                toast.success(options?.successMessage ?? 'Disconnected successfully.');
            } catch (error) {
                // Same reason as the connect toast: never show axios' transport text.
                toast.error(getApiErrorMessage(error, options?.errorMessage ?? 'Failed to disconnect.'));
            } finally {
                setDisconnectingId(null);
            }
        },
        [queryClient],
    );

    return { disconnect, disconnectingId };
};

export const useMcpConnectors = ({ enabled = true }: UseMcpConnectorsParams = {}): UseMcpConnectorsResult => {
    const { connect, connectingId } = useConnectAction();

    const catalogQuery = useQuery({
        queryKey: ['mcp-servers', 'catalog'],
        queryFn: () => mcpServersApi.list({ size: 50 }),
        enabled,
    });

    const connectionsQuery = useQuery({
        queryKey: ['account', 'mcp-connections'],
        queryFn: () => accountApi.listMcpConnections({ size: 50 }),
        enabled,
    });

    const connectors = useMemo<McpConnector[]>(() => {
        const servers = catalogQuery.data?.values ?? [];
        const connections = connectionsQuery.data?.values ?? [];

        return servers.map((server) => {
            const connection = connections.find((item) => item.mcpServerId === server._id);

            return resolveStatus(server, connection);
        });
    }, [catalogQuery.data, connectionsQuery.data]);

    return {
        connectors,
        isLoading: catalogQuery.isLoading || connectionsQuery.isLoading,
        isError: catalogQuery.isError || connectionsQuery.isError,
        connect,
        connectingId,
    };
};
