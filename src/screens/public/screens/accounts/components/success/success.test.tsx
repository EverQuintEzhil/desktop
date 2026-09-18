import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { envelope, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import Success from './success';

const userinfo = {
    sub: 'user-9',
    email: 'user@example.com',
    name: 'Ada Lovelace',
    role: 'user',
    security_groups: ['everyone'],
    avatar: null,
};

const tenantPublic = {
    name: 'Fluent Mind',
    description: 'Driving Business Through AI Flows',
    companyName: 'Fluent Mind',
    loginText: 'Sign in',
};

const stubSession = () =>
    server.use(
        respond('get', '/authentication/userinfo', () => envelope(userinfo)),
        respond('get', '/public', () => envelope(tenantPublic)),
    );

const renderSuccess = () =>
    renderWithProviders(
        <Routes>
            <Route path="/accounts" element={<h3>Sign in landing</h3>} />
            <Route path="/success" element={<Success />} />
        </Routes>,
        { route: '/success' },
    );

const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

const stubLocation = () => {
    const stub = { ...window.location, href: 'http://localhost:3000/success' };

    Object.defineProperty(window, 'location', { configurable: true, value: stub });

    return stub;
};

beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
});

afterEach(() => {
    if (locationDescriptor) {
        Object.defineProperty(window, 'location', locationDescriptor);
    }
});

describe('Success', () => {
    it('renders the holding message', () => {
        stubSession();

        renderSuccess();

        expect(screen.getByText('Success. Please Wait.')).toBeInTheDocument();
    });

    it('puts the authenticated user into the store', async () => {
        stubSession();

        const { store } = renderSuccess();

        await waitFor(() => {
            expect(store.getState().user.isAuthenticated).toBe(true);
        });

        expect(store.getState().user._id).toBe('user-9');
        expect(store.getState().user.email).toBe('user@example.com');
    });

    it('puts the tenant details into the store', async () => {
        stubSession();

        const { store } = renderSuccess();

        await waitFor(() => {
            expect(store.getState().tenant.description).toBe('Driving Business Through AI Flows');
        });
    });

    it('caches the user and tenant for the next boot', async () => {
        stubSession();

        renderSuccess();

        await waitFor(() => {
            expect(localStorage.getItem('user')).not.toBeNull();
        });

        expect(localStorage.getItem('tenant')).not.toBeNull();
    });

    it('sets the document title from the tenant details', async () => {
        stubSession();

        renderSuccess();

        await waitFor(() => {
            expect(document.title).toContain('Fluent Mind');
        });
    });

    it('clears stale session keys but keeps an internal deep link for the app to consume', async () => {
        stubSession();
        sessionStorage.setItem('otp_email', 'user@example.com');
        sessionStorage.setItem('deep_link', 'http://localhost:3000/agent/agent-1');

        renderSuccess();

        await waitFor(() => {
            expect(sessionStorage.getItem('otp_email')).toBeNull();
        });

        expect(sessionStorage.getItem('deep_link')).toBe('http://localhost:3000/agent/agent-1');
    });

    it('leaves for an external deep link on the API origin without loading the session', async () => {
        const location = stubLocation();

        sessionStorage.setItem('deep_link', 'https://api.localhost/download/file-1');

        renderSuccess();

        await waitFor(() => {
            expect(location.href).toBe('https://api.localhost/download/file-1');
        });
    });

    it('ignores a deep link pointing at an untrusted origin', async () => {
        const location = stubLocation();

        stubSession();
        sessionStorage.setItem('deep_link', 'https://evil.example.com/steal');

        renderSuccess();

        await waitFor(() => {
            expect(localStorage.getItem('user')).not.toBeNull();
        });

        expect(location.href).toBe('http://localhost:3000/success');
    });

    it('returns to sign-in and clears the user when the session lookup fails', async () => {
        server.use(
            respond('get', '/authentication/userinfo', () => httpError(401, 'Not authenticated.')),
            respond('get', '/public', () => envelope(tenantPublic)),
        );

        const { store } = renderSuccess();

        expect(await screen.findByRole('heading', { name: 'Sign in landing' })).toBeInTheDocument();

        await waitFor(() => {
            expect(store.getState().user.isAuthenticated).toBe(false);
        });
    });

    it('returns to sign-in when the tenant lookup fails', async () => {
        server.use(
            respond('get', '/authentication/userinfo', () => envelope(userinfo)),
            respond('get', '/public', () => httpError(500, 'Tenant lookup failed.')),
        );

        renderSuccess();

        expect(await screen.findByRole('heading', { name: 'Sign in landing' })).toBeInTheDocument();
    });

    /**
     * Regression guard: `sessionUserinfoSchema` used to declare `name`, `role`,
     * and `security_groups` as bare `z.unknown()`, which is a REQUIRED key in
     * zod v4. A userinfo payload omitting any of them threw inside
     * `mapSessionUserinfoToUserState` and dropped the user back on sign-in —
     * even though the cookie the backend had just issued was perfectly valid.
     */
    it('signs the user in when userinfo omits the unvalidated claims', async () => {
        server.use(
            respond('get', '/authentication/userinfo', () => envelope({ sub: 'user-9', email: 'user@example.com' })),
            respond('get', '/public', () => envelope(tenantPublic)),
        );

        const { store } = renderSuccess();

        await waitFor(() => {
            expect(store.getState().user.isAuthenticated).toBe(true);
        });

        const { user } = store.getState();

        expect(user._id).toBe('user-9');
        expect(user.name).toEqual({ first: null, last: null, middle: null });
        expect(user.role).toBeNull();
        expect(user.security_groups).toBeNull();
        expect(screen.queryByRole('heading', { name: 'Sign in landing' })).not.toBeInTheDocument();
    });
});
