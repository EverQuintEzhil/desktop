import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import Public from './public';

const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

/**
 * `Public` reads the bare global `location`, not the router location, so the
 * browser URL has to be stubbed to exercise anything other than the redirect.
 */
const setWindowPathname = (pathname: string) => {
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, pathname, search: '' },
    });
};

beforeEach(() => {
    sessionStorage.clear();
});

afterEach(() => {
    if (locationDescriptor) {
        Object.defineProperty(window, 'location', locationDescriptor);
    }
});

describe('Public shell', () => {
    it('renders the accounts screen at /accounts', async () => {
        setWindowPathname('/accounts');

        renderWithProviders(<Public />, { route: '/accounts' });

        expect(await screen.findByRole('button', { name: 'Sign in with website' })).toBeInTheDocument();
    });

    it('redirects an unknown public path to the accounts screen', async () => {
        setWindowPathname('/somewhere-else');

        renderWithProviders(<Public />, { route: '/somewhere-else' });

        expect(await screen.findByRole('button', { name: 'Sign in with website' })).toBeInTheDocument();
    });

    it('renders the accounts screen at the root path', async () => {
        setWindowPathname('/');

        renderWithProviders(<Public />, { route: '/' });

        expect(await screen.findByRole('button', { name: 'Sign in with website' })).toBeInTheDocument();
    });

    /**
     * Sign-in is website-only now: the retired email/OTP URLs must land back on
     * the single sign-in screen instead of a dead route.
     */
    it('redirects a retired otp URL back to the sign-in screen', async () => {
        setWindowPathname('/accounts/otp');

        renderWithProviders(<Public />, { route: '/accounts/otp' });

        expect(await screen.findByRole('button', { name: 'Sign in with website' })).toBeInTheDocument();
    });
});
