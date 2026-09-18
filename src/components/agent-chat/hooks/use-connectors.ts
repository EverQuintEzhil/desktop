import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { isTokenExpired, useConnectAction, useDisconnectAction } from '@/hooks/use-mcp-connectors';
import { mcpServersApi } from '@/lib/api';
import type { McpConnection } from '@/lib/api';
import { cancelAgentCaches, PREVIEW_AGENT_DETAIL_KEY } from '@/lib/api/common/agent-cache';
import {
    CONNECTED_CONNECTORS_QUERY_KEY,
    customConnectorsKey,
    NOT_CONNECTED_CONNECTORS_QUERY_KEY,
    patchConnectorEnabledInCaches,
    sharedConnectorsKey,
} from '@/lib/api/common/mcp-servers';
import type { McpType } from '@/types/admin';

import type { DisconnectedConnector, McpServerArgument, NonOauthConnector, UseConnectorsResult } from '../types';

export type ConnectorSource = Pick<
    McpType,
    '_id' | 'name' | 'authType' | 'preference' | 'agentEnabled' | 'effectiveEnabled' | 'connection'
> &
    Partial<Pick<McpType, 'description' | 'serverUrl'>> & {
        /** Admin switch on the server record itself; no user action can change it. */
        status?: string;
    };

interface UseConnectorsParams {
    agentId: string | null | undefined;
    agentMcpServers?: ConnectorSource[];
}

export const useConnectors = ({ agentId, agentMcpServers }: UseConnectorsParams): UseConnectorsResult => {
    const queryClient = useQueryClient();

    const activeServers = useMemo(() => agentMcpServers ?? [], [agentMcpServers]);

    const oauthServers = useMemo(() => activeServers.filter((server) => server.authType === 'oauth'), [activeServers]);

    // Connection status is read straight off the connector object (`server.connection`),
    // resolved per-user by the backend. Only `connected` entries are usable, so they alone
    // reach `enabledIds`/`mcpServers` and the /chat payload; connected-but-expired ones stay
    // here (status is still `connected`) so they can be reconnected in place. Everything else
    // is offered as a connect action instead — see `disconnectedConnectors` below.
    const connections = useMemo<McpConnection[]>(
        () =>
            oauthServers
                .filter((server) => server.connection?.status === 'connected')
                .map((server) => ({
                    _id: server._id,
                    mcpServerId: server._id,
                    userId: '',
                    status: server.connection?.status ?? 'disconnected',
                    tokenExpiry: server.connection?.tokenExpiry ?? null,
                    mcpServerName: server.name,
                    createdAt: '',
                    updatedAt: '',
                })),
        [oauthServers],
    );

    // OAuth connectors with no usable connection, including ones stuck mid-flow (`pending`).
    // They are listed so the user can start the OAuth flow from the composer, and are
    // deliberately kept out of `enabledIds`, `mcpServers` and the /chat payload until a
    // connection exists.
    const disconnectedConnectors = useMemo<DisconnectedConnector[]>(
        () =>
            oauthServers
                .filter((server) => server.connection?.status !== 'connected')
                .map((server) => ({ _id: server._id, name: server.name })),
        [oauthServers],
    );

    // `McpConnection` is a shared API type with no description field, so the description cannot
    // ride on `connections`; surfaces that need it (the "@" mention list) look it up by `_id`.
    const connectorDescriptions = useMemo<Record<string, string>>(() => {
        const map: Record<string, string> = {};

        activeServers.forEach((server) => {
            const description = server.description?.trim();

            if (description) {
                map[server._id] = description;
            }
        });

        return map;
    }, [activeServers]);

    // `McpConnection` has no `serverUrl`, so like `connectorDescriptions` the favicon origin is
    // resolved by `_id` at the surfaces (mention chips, dropdown) that need it.
    const connectorServerUrls = useMemo<Record<string, string>>(() => {
        const map: Record<string, string> = {};

        activeServers.forEach((server) => {
            if (server.serverUrl) {
                map[server._id] = server.serverUrl;
            }
        });

        return map;
    }, [activeServers]);

    const nonOauthServers = useMemo(
        () => activeServers.filter((server) => server.authType !== 'oauth'),
        [activeServers],
    );

    const nonOauthConnectors = useMemo<NonOauthConnector[]>(
        () => nonOauthServers.map((server) => ({ _id: server._id, name: server.name })),
        [nonOauthServers],
    );

    // Effective per-agent enabled state from the server. Attached connectors carry
    // `effectiveEnabled` (agent payload); merged-in custom/shared connectors carry
    // `agentEnabled` (composer list). Both already fold agent over global over default.
    const serverEnabledMap = useMemo(() => {
        const map: Record<string, boolean> = {};

        (agentMcpServers ?? []).forEach((server) => {
            map[server._id] = (server.effectiveEnabled ?? server.agentEnabled ?? true) !== false;
        });

        return map;
    }, [agentMcpServers]);

    // Optimistic overrides layered on the server state (mcpServerId -> disabled).
    const [overrides, setOverrides] = useState<Record<string, boolean>>({});
    const [enablingId, setEnablingId] = useState<string | null>(null);
    // Standing "enable then connect" intent, per connector: a slot shared across rows would
    // let a click on one row cancel another row's pending redirect.
    const redirectIntentRef = useRef<Record<string, boolean>>({});
    // Latest intent per connector, the part of it not yet sent, and the drain working
    // through it. Writes are serialised per connector so a slow response can never land
    // on top of a newer click.
    const desiredRef = useRef<Record<string, boolean>>({});
    const unsentRef = useRef<Record<string, boolean>>({});
    const drainRef = useRef<Record<string, Promise<boolean | null>>>({});
    const overridesRef = useRef(overrides);

    overridesRef.current = overrides;
    const serverEnabledRef = useRef(serverEnabledMap);

    serverEnabledRef.current = serverEnabledMap;

    const disabledMap = useMemo(() => {
        const map: Record<string, boolean> = {};

        (agentMcpServers ?? []).forEach((server) => {
            const override = overrides[server._id];

            map[server._id] = override !== undefined ? override : serverEnabledMap[server._id] === false;
        });

        return map;
    }, [agentMcpServers, overrides, serverEnabledMap]);

    const { connect, connectingId } = useConnectAction();

    // The row's own connection rides along, not just the id: a revoked row is ALREADY `error`, and
    // without it an abandoned reconnect from this surface reports a failure the user never had.
    const reconnect = useCallback(
        (mcpServerId: string) =>
            connect({
                _id: mcpServerId,
                connection: activeServers.find((server) => server._id === mcpServerId)?.connection,
            }),
        [activeServers, connect],
    );

    const { disconnect, disconnectingId } = useDisconnectAction();

    const cancelConnection = useCallback(
        (mcpServerId: string) =>
            disconnect(
                { _id: mcpServerId },
                { successMessage: 'Connection cancelled.', errorMessage: 'Failed to cancel connection.' },
            ),
        [disconnect],
    );

    const clearOverride = useCallback((mcpServerId: string) => {
        setOverrides((prev) => {
            if (prev[mcpServerId] === undefined) return prev;

            const next = { ...prev };

            delete next[mcpServerId];

            return next;
        });
    }, []);

    const preferenceMutation = useMutation({
        mutationKey: ['connector-preference'],
        mutationFn: ({ mcpServerId, disabled }: { mcpServerId: string; disabled: boolean; previousEnabled: boolean }) =>
            mcpServersApi.putServerPreference(mcpServerId, disabled, agentId ?? undefined),
        onMutate: async ({ mcpServerId, disabled }) => {
            if (!agentId) return;

            await Promise.all([
                queryClient.cancelQueries({ queryKey: customConnectorsKey(agentId) }),
                queryClient.cancelQueries({ queryKey: sharedConnectorsKey(agentId) }),
                cancelAgentCaches(queryClient, agentId),
            ]);
            patchConnectorEnabledInCaches(queryClient, agentId, mcpServerId, !disabled);
        },
        onError: (_error, { mcpServerId, previousEnabled }) => {
            if (agentId) {
                patchConnectorEnabledInCaches(queryClient, agentId, mcpServerId, previousEnabled);
            }
            toast.error("Couldn't update connector. Please try again.");
        },
        onSettled: () => {
            // Only refetch once the last pending toggle settles; the settling
            // mutation still counts itself, so `=== 1` means "I'm the last one".
            if (agentId && queryClient.isMutating({ mutationKey: ['connector-preference'] }) === 1) {
                queryClient.invalidateQueries({ queryKey: ['connectors', 'custom'] });
                queryClient.invalidateQueries({ queryKey: ['connectors', 'shared'] });
                queryClient.invalidateQueries({ queryKey: CONNECTED_CONNECTORS_QUERY_KEY });
                queryClient.invalidateQueries({ queryKey: NOT_CONNECTED_CONNECTORS_QUERY_KEY });
                queryClient.invalidateQueries({ queryKey: ['connectors', 'detail'] });
                queryClient.invalidateQueries({ queryKey: ['agent'] });
                queryClient.invalidateQueries({ queryKey: PREVIEW_AGENT_DETAIL_KEY });
            }
        },
    });

    // Reads the latest intended state synchronously so rapid consecutive clicks
    // don't compute their next value from a stale render.
    const readDisabled = useCallback((mcpServerId: string) => {
        const queued = desiredRef.current[mcpServerId];

        if (queued !== undefined) {
            return !queued;
        }

        return overridesRef.current[mcpServerId] !== undefined
            ? overridesRef.current[mcpServerId]
            : serverEnabledRef.current[mcpServerId] === false;
    }, []);

    // Sends the standing intent for one connector, one request at a time, and keeps going
    // while clicks keep arriving. Intermediate clicks are coalesced: only the state the
    // viewer actually stopped on is sent, and the optimistic override is held until the
    // queue is empty so a settling response cannot repaint the switch against a newer click.
    // Resolves with the state that actually landed on the server, or `null` when a write
    // failed — a bare "it worked" cannot tell a caller whether its own target is the one
    // the drain ended on.
    const drainConnector = useCallback(
        async (mcpServerId: string): Promise<boolean | null> => {
            let ok = true;
            // Server truth as this drain starts; each committed write becomes the state a
            // later failure has to roll back to, which an absolute setter cannot derive
            // from its own target.
            let previousEnabled = serverEnabledRef.current[mcpServerId] !== false;

            while (unsentRef.current[mcpServerId] !== undefined) {
                const enabled = unsentRef.current[mcpServerId];

                delete unsentRef.current[mcpServerId];

                try {
                    await preferenceMutation.mutateAsync({ mcpServerId, disabled: !enabled, previousEnabled });
                    previousEnabled = enabled;
                } catch {
                    // `onError` has already rolled the caches back and toasted. Anything
                    // queued behind a failed write is dropped rather than left waiting on a
                    // drain that is ending — the row falls back to the rolled-back server
                    // state, which is what the toast tells the viewer to expect.
                    delete unsentRef.current[mcpServerId];
                    ok = false;
                    break;
                }
            }

            if (unsentRef.current[mcpServerId] === undefined) {
                delete desiredRef.current[mcpServerId];
                clearOverride(mcpServerId);
            }

            return ok ? previousEnabled : null;
        },
        [clearOverride, preferenceMutation],
    );

    const enqueueEnabled = useCallback(
        (mcpServerId: string, enabled: boolean): Promise<boolean | null> => {
            desiredRef.current[mcpServerId] = enabled;
            unsentRef.current[mcpServerId] = enabled;
            setOverrides((prev) => ({ ...prev, [mcpServerId]: !enabled }));

            const running = drainRef.current[mcpServerId];

            if (running) {
                return running;
            }

            const drain = drainConnector(mcpServerId).finally(() => {
                delete drainRef.current[mcpServerId];
            });

            drainRef.current[mcpServerId] = drain;

            return drain;
        },
        [drainConnector],
    );

    const toggleMcpServer = useCallback(
        (mcpServerId: string) => {
            if (!agentId) {
                return;
            }

            void enqueueEnabled(mcpServerId, readDisabled(mcpServerId));
        },
        [agentId, enqueueEnabled, readDisabled],
    );

    // Unlike `toggleMcpServer` this states the target rather than flipping it, so a
    // surface that only ever turns a connector on cannot switch it back off.
    const setConnectorEnabled = useCallback(
        async (mcpServerId: string, enabled: boolean): Promise<boolean> => {
            if (!agentId) {
                return false;
            }

            setEnablingId(mcpServerId);

            try {
                // True only when the connector ended up in the state this caller asked for:
                // a coalesced click the other way wins, and the caller must not report the
                // enable as done.
                return (await enqueueEnabled(mcpServerId, enabled)) === enabled;
            } finally {
                // Overlapping saves share this slot, so only the one still holding it may
                // clear it — otherwise the first to settle drops the later one's spinner.
                setEnablingId((current) => (current === mcpServerId ? null : current));
            }
        },
        [agentId, enqueueEnabled],
    );

    // A logged-out OAuth connector has nothing to use until its auth flow has run, so
    // switching it on continues straight into that flow instead of leaving the viewer on
    // an enabled-but-unusable row. Switching it off is only a preference, and a failed
    // save must not redirect.
    const toggleDisconnectedConnector = useCallback(
        async (mcpServerId: string): Promise<void> => {
            if (!readDisabled(mcpServerId)) {
                // Switching off withdraws the redirect this row may have queued, so a
                // click during the save is honoured instead of being swallowed by it.
                delete redirectIntentRef.current[mcpServerId];
                toggleMcpServer(mcpServerId);

                return;
            }

            redirectIntentRef.current[mcpServerId] = true;

            const saved = await setConnectorEnabled(mcpServerId, true);
            const stillWanted = redirectIntentRef.current[mcpServerId] === true;

            delete redirectIntentRef.current[mcpServerId];

            // Only redirect while this is still the standing intent for this connector: the
            // save is awaited, and in that window the viewer may have switched it back off.
            if (saved && stillWanted) {
                await reconnect(mcpServerId);
            }
        },
        [readDisabled, reconnect, setConnectorEnabled, toggleMcpServer],
    );

    const enabledIds = useMemo(
        () => [
            ...connections
                .filter(
                    (c) => c.status === 'connected' && !isTokenExpired(c.tokenExpiry) && !disabledMap[c.mcpServerId],
                )
                .map((c) => c.mcpServerId),
            ...nonOauthConnectors.filter((server) => !disabledMap[server._id]).map((server) => server._id),
        ],
        [connections, nonOauthConnectors, disabledMap],
    );

    const mcpServers = useMemo<McpServerArgument[]>(
        () => [
            ...connections
                .filter((c) => c.status !== 'pending')
                .map((c) => ({ _id: c.mcpServerId, isEnabled: !disabledMap[c.mcpServerId] })),
            ...nonOauthConnectors.map((server) => ({ _id: server._id, isEnabled: !disabledMap[server._id] })),
        ],
        [connections, nonOauthConnectors, disabledMap],
    );

    return {
        connections,
        isLoading: false,
        enabledIds,
        disabledMap,
        toggleMcpServer,
        setConnectorEnabled,
        toggleDisconnectedConnector,
        enablingId,
        mcpServers,
        nonOauthConnectors,
        disconnectedConnectors,
        connectorDescriptions,
        connectorServerUrls,
        reconnect,
        connectingId,
        cancelConnection,
        cancellingId: disconnectingId,
    };
};
