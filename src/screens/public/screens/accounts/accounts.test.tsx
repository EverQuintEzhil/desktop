import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { testTenant } from '@/test/fixtures/auth';
import { renderWithProviders } from '@/test/test-utils';

import Accounts from './accounts';

const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

/**
 * `Accounts` reads `redirect_uri` off `window.location.search`, not off the
 * router, so MemoryRouter cannot supply it — the global has to be replaced.
 */
const setSearch = (search: string) => {
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, search },
    });
};

const renderAccounts = (route = '/') =>
    renderWithProviders(<Accounts />, {
        route,
        preloadedState: {
            tenant: {
                ...testTenant,
                companyName: 'Fluent Mind',
                logoHorizontal: '/assets/logo-horizontal.png',
                loginText: 'Sign in to access Fluent Mind',
            },
        },
    });

beforeEach(() => {
    sessionStorage.clear();
    setSearch('');
});

afterEach(() => {
    if (locationDescriptor) {
        Object.defineProperty(window, 'location', locationDescriptor);
    }
});

describe('Accounts shell', () => {
    it('renders the tenant logo', () => {
        renderAccounts();

        expect(screen.getByRole('img', { name: 'Fluent Mind' })).toHaveAttribute('src', '/assets/logo-horizontal.png');
    });

    it('renders the copyright line for the current year', () => {
        renderAccounts();

        expect(screen.getByText(new RegExp(`Copyright © ${new Date().getFullYear()} Fluent Mind`))).toBeInTheDocument();
    });

    it('renders the login step at the accounts root', () => {
        renderAccounts();

        expect(screen.getByRole('button', { name: 'Sign in with website' })).toBeInTheDocument();
    });

    it('locks page scrolling while the sign-in screen is mounted', () => {
        const { unmount } = renderAccounts();

        expect(document.body.style.overflow).toBe('hidden');
        expect(document.documentElement.style.overflow).toBe('hidden');

        unmount();

        expect(document.body.style.overflow).toBe('');
    });
});

describe('Accounts deep link capture', () => {
    it('stores a plain redirect_uri verbatim', () => {
        setSearch('?redirect_uri=/agent/agent-1/spaces/project-9');

        renderAccounts();

        expect(sessionStorage.getItem('deep_link')).toBe('/agent/agent-1/spaces/project-9');
    });

    it('decodes a base64 redirect_uri', () => {
        setSearch('?redirect_uri=aHR0cDovL2xvY2FsaG9zdDozMDAwL2xpYnJhcnk%3D&redirect_uri_type=base64');

        renderAccounts();

        expect(sessionStorage.getItem('deep_link')).toBe('http://localhost:3000/library');
    });

    it('treats the redirect_uri_type case-insensitively', () => {
        setSearch('?redirect_uri=aHR0cDovL2xvY2FsaG9zdDozMDAwL2xpYnJhcnk%3D&redirect_uri_type=BASE64');

        renderAccounts();

        expect(sessionStorage.getItem('deep_link')).toBe('http://localhost:3000/library');
    });

    it('stores the raw value when redirect_uri_type is not base64', () => {
        setSearch('?redirect_uri=/library&redirect_uri_type=plain');

        renderAccounts();

        expect(sessionStorage.getItem('deep_link')).toBe('/library');
    });

    it('stores nothing when there is no redirect_uri', () => {
        setSearch('?redirect_uri_type=base64');

        renderAccounts();

        expect(sessionStorage.getItem('deep_link')).toBeNull();
    });

    /**
     * BUG: `atob` throws `InvalidCharacterError` on a non-base64 value and the
     * call is unguarded, so the effect tears down the whole sign-in screen.
     * Anyone can build a link that makes the login page unusable.
     */
    /**
     * Regression guard: `atob` used to run unguarded, so this URL — craftable by
     * any unauthenticated visitor — threw `InvalidCharacterError` out of the
     * effect and tore down the whole sign-in screen.
     */
    it('survives a malformed base64 redirect_uri', () => {
        setSearch('?redirect_uri=!!!!&redirect_uri_type=base64');

        expect(() => renderAccounts()).not.toThrow();
        expect(screen.getByRole('button', { name: 'Sign in with website' })).toBeInTheDocument();
    });

    /**
     * Storing the undecoded value is worse than storing nothing: the redirect
     * allowlist rewrites it to a same-origin path built from raw base64, so the
     * user lands on a 404 instead of the default screen.
     */
    it('stores nothing when base64 decoding fails', () => {
        setSearch('?redirect_uri=!!!!&redirect_uri_type=base64');

        renderAccounts();

        expect(sessionStorage.getItem('deep_link')).toBeNull();
    });
});
