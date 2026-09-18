import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import Logout from './logout';

const tenantPublic = {
    name: 'Fluent Mind',
    description: 'Test tenant',
    logoWhite: '/assets/logo.png',
};

const stubSuccessfulLogout = () => {
    server.use(
        respond('post', '/authentication/logout', () => envelope({})),
        respond('get', '/public', () => envelope(tenantPublic)),
    );
};

describe('Logout screen', () => {
    it('shows the signing-out state while the request is in flight', async () => {
        server.use(
            http.post(apiUrl('/authentication/logout'), async () => {
                await delay('infinite');

                return envelope({});
            }),
        );

        renderWithProviders(<Logout />, { route: '/logout' });

        expect(screen.getByText('Signing you out')).toBeInTheDocument();
        expect(screen.getByText('Clearing session data')).toBeInTheDocument();
    });

    it('calls the logout endpoint on mount', async () => {
        let logoutCalls = 0;

        server.use(
            http.post(apiUrl('/authentication/logout'), () => {
                logoutCalls += 1;

                return envelope({});
            }),
            respond('get', '/public', () => envelope(tenantPublic)),
        );

        renderWithProviders(<Logout />, { route: '/logout' });

        await waitFor(() => {
            expect(logoutCalls).toBe(1);
        });
    });

    it('clears the cached user and session storage', async () => {
        localStorage.setItem('user', '{"_id":"user-1"}');
        localStorage.setItem('tenant', '{"name":"old"}');
        sessionStorage.setItem('deep_link', 'http://localhost:3000/library');

        stubSuccessfulLogout();

        renderWithProviders(<Logout />, { route: '/logout' });

        await waitFor(() => {
            expect(localStorage.getItem('user')).toBeNull();
        });

        expect(sessionStorage.getItem('deep_link')).toBeNull();
    });

    it('marks the store as unauthenticated', async () => {
        stubSuccessfulLogout();

        const { store } = renderWithProviders(<Logout />, { route: '/logout' });

        await waitFor(() => {
            expect(store.getState().user.isAuthenticated).toBe(false);
        });
    });

    it('offers a retry when the logout request fails', async () => {
        server.use(respond('post', '/authentication/logout', () => httpError(500)));

        renderWithProviders(<Logout />, { route: '/logout' });

        expect(await screen.findByText("We couldn't sign you out")).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    });

    it('retries the logout request when Try again is clicked', async () => {
        let attempts = 0;

        server.use(
            http.post(apiUrl('/authentication/logout'), () => {
                attempts += 1;

                return httpError(500);
            }),
            respond('get', '/public', () => envelope(tenantPublic)),
        );

        renderWithProviders(<Logout />, { route: '/logout' });

        await screen.findByRole('button', { name: /Try again/ });

        await userEvent.click(screen.getByRole('button', { name: /Try again/ }));

        await waitFor(() => {
            expect(attempts).toBe(2);
        });
    });
});
