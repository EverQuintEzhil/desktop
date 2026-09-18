import { render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it } from 'vitest';

import { envelope, httpError, respond, server } from '@/test/msw';

import AppWrapper from './app';

/**
 * `AppWrapper` brings its own `Provider store={store}` (the real singleton
 * store), so it is rendered bare rather than through `renderWithProviders`.
 * The real store starts unauthenticated, so the session probe decides whether
 * the tree lands on `Public` or `Private`; leaving `/authentication/userinfo`
 * failing keeps every test on the cheap public branch.
 */
const stubSession = () => {
    server.use(respond('get', '/public', () => envelope({ name: 'Fluent Mind', description: 'Test tenant' })));
    server.use(respond('get', '/authentication/userinfo', () => httpError(401)));
};

describe('AppWrapper', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it('renders the public shell once the session probe resolves anonymously', async () => {
        stubSession();

        render(<AppWrapper />);

        expect(await screen.findByRole('button', { name: 'Sign in One-Time Password' })).toBeInTheDocument();
    });

    it('applies the tenant details from the session probe to the document title', async () => {
        stubSession();

        render(<AppWrapper />);

        await screen.findByRole('button', { name: 'Sign in One-Time Password' });

        expect(document.title).toContain('Fluent Mind');
    });

    it('mounts the toast region so app-level toasts have somewhere to render', async () => {
        stubSession();

        render(<AppWrapper />);

        await screen.findByRole('button', { name: 'Sign in One-Time Password' });

        toast('Saved your changes');

        expect(await screen.findByText('Saved your changes')).toBeInTheDocument();
        toast.dismiss();
    });
});
