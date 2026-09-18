import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import AuthWrapper, { APPLICATION_VERSION } from './auth-wrapper';

const cachedTenant = {
    name: 'Cached Tenant',
    description: 'Cached description',
    'hide-whats-new': false,
};

const freshTenant = {
    name: 'Fresh Tenant',
    description: 'Fresh description',
    'hide-whats-new': true,
};

const storedUser = {
    _id: 'user-1',
    name: { first: 'Test', last: 'User', middle: null },
    email: 'test@example.com',
    role: 'user',
    security_groups: [],
    avatar: null,
    isAuthenticated: true,
};

const seedCachedSession = () => {
    localStorage.setItem('application-version', APPLICATION_VERSION);
    localStorage.setItem('user', JSON.stringify({ ...storedUser, expiry: Date.now() + 30 * 60 * 1000 }));
    localStorage.setItem('tenant', JSON.stringify(cachedTenant));
};

const renderWrapper = () =>
    renderWithProviders(
        <AuthWrapper>
            <div>App content</div>
        </AuthWrapper>,
    );

describe('AuthWrapper', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('refreshes the cached tenant from /public so settings changed outside the app take effect', async () => {
        seedCachedSession();
        server.use(respond('get', '/public', () => envelope(freshTenant)));

        const { store } = renderWrapper();

        await waitFor(() => expect(store.getState().tenant.hideWhatsNew).toBe(true));
        expect(store.getState().tenant.name).toBe('Fresh Tenant');
    });

    it('rewrites the cached tenant in localStorage with the fresh payload', async () => {
        seedCachedSession();
        server.use(respond('get', '/public', () => envelope(freshTenant)));

        renderWrapper();

        await waitFor(() => {
            expect(JSON.parse(localStorage.getItem('tenant') ?? '{}')).toEqual(freshTenant);
        });
    });

    it('paints the cached session immediately instead of waiting on the background refresh', async () => {
        seedCachedSession();

        let releaseRequest = () => {};
        const pending = new Promise<void>((resolve) => {
            releaseRequest = resolve;
        });

        server.use(
            respond('get', '/public', async () => {
                await pending;

                return envelope(freshTenant);
            }),
        );

        const { store } = renderWrapper();

        expect(screen.getByText('App content')).toBeInTheDocument();
        expect(store.getState().tenant.name).toBe('Cached Tenant');

        releaseRequest();
        await waitFor(() => expect(store.getState().tenant.name).toBe('Fresh Tenant'));
    });

    it('keeps the cached tenant and children rendered when the background refresh fails', async () => {
        seedCachedSession();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        let publicRequests = 0;

        server.use(
            http.get(apiUrl('/public'), () => {
                publicRequests += 1;

                return httpError(500);
            }),
        );

        const { store } = renderWrapper();

        await waitFor(() => expect(publicRequests).toBe(1));
        await waitFor(() => expect(consoleError).toHaveBeenCalled());

        expect(screen.getByText('App content')).toBeInTheDocument();
        expect(store.getState().tenant.name).toBe('Cached Tenant');
        expect(JSON.parse(localStorage.getItem('tenant') ?? '{}')).toEqual(cachedTenant);

        consoleError.mockRestore();
    });
});
