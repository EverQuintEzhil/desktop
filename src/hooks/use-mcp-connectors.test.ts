import { act, renderHook } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { failureEnvelope, httpError, respond, server } from '@/test/msw';
import { renderHookWithProviders } from '@/test/test-utils';

import {
    getConnectorStatus,
    PENDING_CONNECT_STORAGE_KEY,
    useConnectAction,
    useConnectResultNotice,
    useDisconnectAction,
    type ConnectResultSource,
} from './use-mcp-connectors';

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const HOUR_MS = 60 * 60 * 1000;

const seedPendingConnect = (
    mcpServerId: string,
    startedAt = Date.now(),
    prior: { priorStatus?: string | null; priorTokenExpiry?: string | null } = {},
) => {
    window.sessionStorage.setItem(PENDING_CONNECT_STORAGE_KEY, JSON.stringify({ mcpServerId, startedAt, ...prior }));
};

const makeServer = (connection: ConnectResultSource['connection']): ConnectResultSource => ({
    _id: 'server-1',
    name: 'Microsoft 365',
    connection,
});

afterEach(() => {
    window.sessionStorage.clear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
});

const oauthServer = { _id: 'server-1', authType: 'oauth' } as Parameters<typeof getConnectorStatus>[0];

/**
 * The five values `mcp_servers_connections_status_check` permits, folded onto the presentation
 * states. Pinned exhaustively because three of them used to fall through to `not_connected` and
 * read as a connector nobody ever set up (AMP-569).
 */
describe('getConnectorStatus', () => {
    it('reads a live connection as connected', () => {
        expect(getConnectorStatus(oauthServer, { status: 'connected', tokenExpiry: null })).toBe('connected');
        expect(
            getConnectorStatus(oauthServer, {
                status: 'connected',
                tokenExpiry: new Date(Date.now() + HOUR_MS).toISOString(),
            }),
        ).toBe('connected');
    });

    it('reads a connection whose token has lapsed as expired', () => {
        expect(
            getConnectorStatus(oauthServer, {
                status: 'connected',
                tokenExpiry: new Date(Date.now() - HOUR_MS).toISOString(),
            }),
        ).toBe('expired');
    });

    it('reads a revoked grant as expired, so it asks for a reconnect and not a first connect', () => {
        expect(getConnectorStatus(oauthServer, { status: 'error', tokenExpiry: null })).toBe('expired');
    });

    it('reads the column own expired spelling as expired', () => {
        expect(getConnectorStatus(oauthServer, { status: 'expired', tokenExpiry: null })).toBe('expired');
    });

    it('reads a handshake still in flight as pending', () => {
        expect(getConnectorStatus(oauthServer, { status: 'pending', tokenExpiry: null })).toBe('pending');
    });

    // Only `POST /mcp-servers/:id/disconnect` writes this, so its owner asked for it and is owed
    // Connect. Reading it as expired would offer a Reconnect nobody wanted.
    it('reads a connection the user disconnected as not connected', () => {
        expect(getConnectorStatus(oauthServer, { status: 'disconnected', tokenExpiry: null })).toBe('not_connected');
    });

    it('reads a connector with no row at all as not connected', () => {
        expect(getConnectorStatus(oauthServer, null)).toBe('not_connected');
        expect(getConnectorStatus(oauthServer, undefined)).toBe('not_connected');
    });

    // ai can ship a status ahead of app; inventing an affordance for one would be worse than the
    // Connect button already on screen.
    it('reads a status it does not know as not connected', () => {
        expect(getConnectorStatus(oauthServer, { status: 'quarantined', tokenExpiry: null })).toBe('not_connected');
    });

    it('reads a connector needing no oauth as available, whatever the row says', () => {
        const openServer = { _id: 'server-2', authType: 'none' } as Parameters<typeof getConnectorStatus>[0];

        expect(getConnectorStatus(openServer, { status: 'error', tokenExpiry: null })).toBe('available');
    });
});

describe('useConnectResultNotice', () => {
    it('reports success once the connector comes back connected', () => {
        seedPendingConnect('server-1');

        renderHook(() => useConnectResultNotice([makeServer({ status: 'connected', tokenExpiry: null })]));

        expect(toast.success).toHaveBeenCalledExactlyOnceWith('Connected to Microsoft 365');
        expect(window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY)).toBeNull();
    });

    it('reports failure when the connection came back in error', () => {
        seedPendingConnect('server-1');

        renderHook(() => useConnectResultNotice([makeServer({ status: 'error', tokenExpiry: null })]));

        expect(toast.error).toHaveBeenCalledExactlyOnceWith("Couldn't connect to Microsoft 365. Please try again.");
    });

    // Reconnecting a revoked connector starts from `error` and ends on `error` if the person walks
    // away from the provider. Reporting that as a failure would invent an attempt they abandoned.
    it('reports nothing when an abandoned reconnect leaves a pre-existing error unchanged', () => {
        seedPendingConnect('server-1', Date.now(), { priorStatus: 'error', priorTokenExpiry: null });

        renderHook(() => useConnectResultNotice([makeServer({ status: 'error', tokenExpiry: null })]));

        expect(toast.error).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY)).not.toBeNull();
    });

    it('reports success when a reconnect from a revoked row does connect', () => {
        seedPendingConnect('server-1', Date.now(), { priorStatus: 'error', priorTokenExpiry: null });

        renderHook(() => useConnectResultNotice([makeServer({ status: 'connected', tokenExpiry: null })]));

        expect(toast.success).toHaveBeenCalledExactlyOnceWith('Connected to Microsoft 365');
    });

    // The sibling of the case above, and pre-existing rather than introduced by AMP-569: a lapsed row
    // is already `connected` with a past expiry, which the outcome check reads as a failure. Walking
    // away from the provider there must be as quiet as walking away from a revoked one.
    it('reports nothing when an abandoned reconnect leaves a lapsed token unchanged', () => {
        const lapsed = new Date(Date.now() - HOUR_MS).toISOString();

        seedPendingConnect('server-1', Date.now(), { priorStatus: 'connected', priorTokenExpiry: lapsed });

        renderHook(() => useConnectResultNotice([makeServer({ status: 'connected', tokenExpiry: lapsed })]));

        expect(toast.error).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('reports success when that same lapsed row comes back with a fresh token', () => {
        seedPendingConnect('server-1', Date.now(), {
            priorStatus: 'connected',
            priorTokenExpiry: new Date(Date.now() - HOUR_MS).toISOString(),
        });

        renderHook(() =>
            useConnectResultNotice([
                makeServer({ status: 'connected', tokenExpiry: new Date(Date.now() + HOUR_MS).toISOString() }),
            ]),
        );

        expect(toast.success).toHaveBeenCalledExactlyOnceWith('Connected to Microsoft 365');
    });

    // `failed` is the spelling the client read before AMP-569 and the column has never been able to
    // hold it. Reporting nothing is the point: a stale client must not invent a failure the user
    // never had, and the marker stays for a later payload that carries a real outcome.
    it('reports nothing for the failed status the column can never hold', () => {
        seedPendingConnect('server-1');

        renderHook(() => useConnectResultNotice([makeServer({ status: 'failed', tokenExpiry: null })]));

        expect(toast.error).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY)).not.toBeNull();
    });

    it('waits instead of reporting failure while the handshake is still pending', () => {
        seedPendingConnect('server-1');

        const { rerender } = renderHook(
            ({ status }: { status: string }) => useConnectResultNotice([makeServer({ status, tokenExpiry: null })]),
            { initialProps: { status: 'pending' } },
        );

        expect(toast.error).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY)).not.toBeNull();

        rerender({ status: 'connected' });

        expect(toast.success).toHaveBeenCalledExactlyOnceWith('Connected to Microsoft 365');
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('waits when the connection row has not appeared yet', () => {
        seedPendingConnect('server-1');

        renderHook(() => useConnectResultNotice([makeServer(null)]));

        expect(toast.error).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY)).not.toBeNull();
    });

    it('reports failure when the returned token is already expired', () => {
        seedPendingConnect('server-1');

        renderHook(() =>
            useConnectResultNotice([
                makeServer({ status: 'connected', tokenExpiry: new Date(Date.now() - HOUR_MS).toISOString() }),
            ]),
        );

        expect(toast.error).toHaveBeenCalledOnce();
    });

    it('stays quiet until the connector data is ready', () => {
        seedPendingConnect('server-1');

        const { rerender } = renderHook(
            ({ isReady }: { isReady: boolean }) =>
                useConnectResultNotice(
                    isReady ? [makeServer({ status: 'connected', tokenExpiry: null })] : undefined,
                    isReady,
                ),
            { initialProps: { isReady: false } },
        );

        expect(toast.success).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY)).not.toBeNull();

        rerender({ isReady: true });

        expect(toast.success).toHaveBeenCalledOnce();
    });

    it('keeps the marker for another surface when the connector is not in this list', () => {
        seedPendingConnect('server-2');

        renderHook(() => useConnectResultNotice([makeServer({ status: 'connected', tokenExpiry: null })]));

        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY)).not.toBeNull();
    });

    it('drops a stale marker without reporting anything', () => {
        seedPendingConnect('server-1', Date.now() - HOUR_MS);

        renderHook(() => useConnectResultNotice([makeServer({ status: 'connected', tokenExpiry: null })]));

        expect(toast.success).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY)).toBeNull();
    });
});

const CONNECT_PATH = '/mcpservers/server-1/connect';

const DISCONNECT_PATH = '/mcpservers/server-1/disconnect';

const OAUTH_NOT_CONFIGURED_MESSAGE =
    "The OAuth server for this connector (https://github.com) doesn't let apps register themselves. " +
    "Register an OAuth app with it manually, then save its client_id and client_secret as this connector's auth credentials.";

const startConnect = async () => {
    const { result } = renderHookWithProviders(() => useConnectAction());

    await act(async () => {
        await result.current.connect({ _id: 'server-1' });
    });

    return vi.mocked(toast.error).mock.calls[0]?.[0];
};

describe('useConnectAction', () => {
    it('shows the message the api sent when the connector has no OAuth credentials', async () => {
        server.use(respond('get', CONNECT_PATH, () => httpError(400, OAUTH_NOT_CONFIGURED_MESSAGE)));

        expect(await startConnect()).toBe(OAUTH_NOT_CONFIGURED_MESSAGE);
    });

    it('shows the message the api sent for a connector it cannot find', async () => {
        const message = 'There is no such mcp server with id "server-1" found.';

        server.use(respond('get', CONNECT_PATH, () => httpError(404, message)));

        const shown = await startConnect();

        expect(shown).toBe(message);
    });

    it('shows the message from a success:false envelope', async () => {
        const message = 'MCP server is not configured for OAuth authentication';

        server.use(respond('get', CONNECT_PATH, () => failureEnvelope(message)));

        expect(await startConnect()).toBe(message);
    });

    it('falls back to its own words when the request never reached the api', async () => {
        server.use(respond('get', CONNECT_PATH, () => HttpResponse.error()));

        expect(await startConnect()).toBe('Failed to start connection.');
    });

    it('drops the in-progress marker so the return trip reports nothing', async () => {
        server.use(respond('get', CONNECT_PATH, () => httpError(400, OAUTH_NOT_CONFIGURED_MESSAGE)));
        seedPendingConnect('server-1');

        await startConnect();

        expect(window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY)).toBeNull();
    });
});

describe('useDisconnectAction', () => {
    const startDisconnect = async (options?: { errorMessage?: string }) => {
        const { result } = renderHookWithProviders(() => useDisconnectAction());

        await act(async () => {
            await result.current.disconnect({ _id: 'server-1' }, options);
        });

        return vi.mocked(toast.error).mock.calls[0]?.[0];
    };

    it('shows the message the api sent when the disconnect is refused', async () => {
        const message = 'You are not allowed to disconnect this connector.';

        server.use(respond('post', DISCONNECT_PATH, () => httpError(403, message)));

        const shown = await startDisconnect();

        expect(shown).toBe(message);
    });

    it("falls back to the caller's own words when the api sent no message", async () => {
        server.use(
            respond('post', DISCONNECT_PATH, () => HttpResponse.json({ success: false, value: null }, { status: 500 })),
        );

        expect(await startDisconnect({ errorMessage: 'Failed to cancel connection.' })).toBe(
            'Failed to cancel connection.',
        );
    });
});
