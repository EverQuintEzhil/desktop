import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSessionToken, clearSessionToken } from '@/lib/auth/session-token';
import { testTenant } from '@/test/fixtures/auth';
import { getJson, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import Login from './login';

/**
 * Desktop sign-in goes through the WEBSITE only: the button opens
 * `<website>/desktop-auth?state=<nonce>&port=<loopback>` in the system browser,
 * and the session comes back either through the `fluentmind-desktop://auth`
 * deep link or the 127.0.0.1 loopback listener (src-tauri/auth_server.rs). All
 * Tauri plugins are mocked — jsdom has no Tauri host.
 */

const openUrl = vi.fn();
let deepLinkHandler: ((urls: string[]) => void) | undefined;
let loopbackHandler: ((payload: string) => void) | undefined;
const unlisten = vi.fn();
const stopLoopback = vi.fn();
const LOOPBACK_PORT = 49512;

vi.mock('@tauri-apps/plugin-opener', () => ({
    openUrl: (url: string) => openUrl(url),
}));

vi.mock('@tauri-apps/plugin-deep-link', () => ({
    onOpenUrl: (handler: (urls: string[]) => void) => {
        deepLinkHandler = handler;

        return Promise.resolve(unlisten);
    },
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: (command: string) =>
        command === 'start_desktop_auth_server' ? Promise.resolve(LOOPBACK_PORT) : Promise.resolve(),
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: (_event: string, handler: (event: { payload: string }) => void) => {
        loopbackHandler = (payload: string) => handler({ payload });

        return Promise.resolve(stopLoopback);
    },
}));

const renderLogin = () =>
    renderWithProviders(<Login />, {
        route: '/accounts',
        preloadedState: { tenant: { ...testTenant, loginText: 'Sign in to access Fluent Mind' } },
    });

const storedState = () => sessionStorage.getItem('desktop_auth_state');

beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    // session-token.ts caches the session in a module-level variable that
    // outlives storage.clear(); reset it so a token from one test cannot leak.
    clearSessionToken();
    openUrl.mockClear();
    unlisten.mockClear();
    stopLoopback.mockClear();
    deepLinkHandler = undefined;
    loopbackHandler = undefined;
});

describe('Login', () => {
    it('renders the tenant login text', () => {
        renderLogin();

        expect(screen.getByText('Sign in to access Fluent Mind')).toBeInTheDocument();
    });

    it('offers only the website sign-in — no OTP, email or IdP options', () => {
        renderLogin();

        expect(screen.getByRole('button', { name: 'Sign in with website' })).toBeInTheDocument();
        expect(screen.queryByText(/One-Time Password/)).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('opens the website desktop-auth page in the system browser with a stored state nonce', async () => {
        renderLogin();

        await userEvent.click(screen.getByRole('button', { name: 'Sign in with website' }));

        await waitFor(() => expect(openUrl).toHaveBeenCalledTimes(1));

        const url = new URL(openUrl.mock.calls[0][0] as string);

        expect(url.pathname).toBe('/desktop-auth');
        expect(url.searchParams.get('state')).toBe(storedState());
        expect(storedState()).toBeTruthy();
    });

    it('shows the waiting state and can reopen the browser', async () => {
        renderLogin();

        await userEvent.click(screen.getByRole('button', { name: 'Sign in with website' }));

        expect(await screen.findByText('Finish signing in from your browser')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Open the browser again' }));

        await waitFor(() => expect(openUrl).toHaveBeenCalledTimes(2));
    });

    it('stores the session from a deep-link callback that echoes the nonce', async () => {
        // Success mounts on a stored token and boots the session from these.
        server.use(
            getJson('/authentication/userinfo', { sub: 'user-1', email: 'test@example.com', name: 'Test' }),
            getJson('/public', { name: 'Fluent Mind', description: 'Test tenant' }),
        );

        renderLogin();

        await waitFor(() => expect(deepLinkHandler).toBeDefined());

        await userEvent.click(screen.getByRole('button', { name: 'Sign in with website' }));

        const state = storedState();

        deepLinkHandler?.([`fluentmind-desktop://auth?token=tok-1&state=${state}&expires_at=2099-01-01T00:00:00.000Z`]);

        // Success mounts and starts booting the session.
        expect(await screen.findByText('Success. Please Wait.')).toBeInTheDocument();
        expect(getSessionToken()).toBe('tok-1');
        expect(storedState()).toBeNull();
    });

    it('rejects a deep-link callback whose state does not match', async () => {
        renderLogin();

        await waitFor(() => expect(deepLinkHandler).toBeDefined());

        await userEvent.click(screen.getByRole('button', { name: 'Sign in with website' }));

        deepLinkHandler?.(['fluentmind-desktop://auth?token=evil&state=not-the-nonce']);

        expect(await screen.findByRole('alert')).toHaveTextContent(/could not be verified/);
        expect(getSessionToken()).toBeNull();
    });

    it('passes the loopback port to the website URL', async () => {
        renderLogin();

        // The listener is started asynchronously in an effect; wait for it.
        await waitFor(() => expect(loopbackHandler).toBeDefined());

        await userEvent.click(screen.getByRole('button', { name: 'Sign in with website' }));

        await waitFor(() => expect(openUrl).toHaveBeenCalledTimes(1));

        const url = new URL(openUrl.mock.calls[0][0] as string);

        expect(url.searchParams.get('port')).toBe(String(LOOPBACK_PORT));
    });

    it('stores the session from a loopback callback that echoes the nonce', async () => {
        server.use(
            getJson('/authentication/userinfo', { sub: 'user-1', email: 'test@example.com', name: 'Test' }),
            getJson('/public', { name: 'Fluent Mind', description: 'Test tenant' }),
        );

        renderLogin();

        await waitFor(() => expect(loopbackHandler).toBeDefined());

        await userEvent.click(screen.getByRole('button', { name: 'Sign in with website' }));

        const state = storedState();

        loopbackHandler?.(`http://127.0.0.1:${LOOPBACK_PORT}/auth?token=tok-2&state=${state}&expires_at=2099-01-01T00:00:00.000Z`);

        expect(await screen.findByText('Success. Please Wait.')).toBeInTheDocument();
        expect(getSessionToken()).toBe('tok-2');
        expect(storedState()).toBeNull();
    });

    it('ignores deep links that are not sign-in callbacks', async () => {
        renderLogin();

        await waitFor(() => expect(deepLinkHandler).toBeDefined());

        deepLinkHandler?.(['fluentmind-desktop://something-else?x=1']);

        expect(screen.getByRole('button', { name: 'Sign in with website' })).toBeInTheDocument();
        expect(getSessionToken()).toBeNull();
    });
});
