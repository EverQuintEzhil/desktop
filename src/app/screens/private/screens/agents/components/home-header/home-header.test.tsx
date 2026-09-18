import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { authenticatedUser, testTenant } from '@/test/fixtures/auth';
import { renderWithProviders, screen } from '@/test/test-utils';
import type { Role, TenantType } from '@/types/store';

import HomeHeader from './home-header';

const renderHeader = (tenant: TenantType, role: Role = 'user') =>
    renderWithProviders(<HomeHeader tenant={tenant} scope="my" onScopeChange={vi.fn()} />, {
        preloadedState: { tenant, user: { ...authenticatedUser, role } },
    });

describe('HomeHeader — the What’s New menu', () => {
    it('opens both destinations from the What’s New menu', async () => {
        renderHeader(testTenant);

        await userEvent.click(screen.getByRole('button', { name: /what.s new/i }));

        expect(await screen.findByRole('link', { name: 'Announcements' })).toHaveAttribute('href', '/announcements');
        expect(screen.getByRole('link', { name: 'Help Center' })).toHaveAttribute('href', '/help-center');
    });

    it('hides the What’s New menu when the tenant disables it', () => {
        renderHeader({ ...testTenant, hideWhatsNew: true });

        expect(screen.queryByRole('button', { name: /what.s new/i })).not.toBeInTheDocument();
    });
});

describe('HomeHeader — per-role visibility', () => {
    it('keeps the What’s New menu for an admin when it is hidden from users only', () => {
        renderHeader({ ...testTenant, hideWhatsNew: { visibleToRoles: ['admin'] } }, 'admin');

        expect(screen.getByRole('button', { name: /what.s new/i })).toBeInTheDocument();
    });

    it('hides the What’s New menu from a role left off the list', () => {
        renderHeader({ ...testTenant, hideWhatsNew: { visibleToRoles: ['admin'] } }, 'user');

        expect(screen.queryByRole('button', { name: /what.s new/i })).not.toBeInTheDocument();
    });

    it('hides the What’s New menu from everyone once the master hide is on', () => {
        renderHeader({ ...testTenant, hideWhatsNew: { hidden: true, visibleToRoles: ['admin'] } }, 'admin');

        expect(screen.queryByRole('button', { name: /what.s new/i })).not.toBeInTheDocument();
    });

    it('shows the scope switch when all four roles are listed', () => {
        renderHeader(
            { ...testTenant, hideScopeSwitch: { visibleToRoles: ['admin', 'owner', 'developer', 'user'] } },
            'user',
        );

        expect(screen.getByText('My')).toBeInTheDocument();
    });
});

describe('HomeHeader — scope switch', () => {
    it('offers the My and Firmwide options by default', () => {
        renderHeader(testTenant);

        expect(screen.getByText('My')).toBeInTheDocument();
        expect(screen.getByText('Firmwide')).toBeInTheDocument();
    });

    it('hides the scope switch when the tenant disables it', () => {
        renderHeader({ ...testTenant, hideScopeSwitch: true });

        expect(screen.queryByText('My')).not.toBeInTheDocument();
        expect(screen.queryByText('Firmwide')).not.toBeInTheDocument();
    });

    it('keeps the remaining header controls when the scope switch is hidden', () => {
        renderHeader({ ...testTenant, hideScopeSwitch: true });

        expect(screen.getByRole('button', { name: /what.s new/i })).toBeInTheDocument();
    });
});

describe('HomeHeader — documentation links', () => {
    const documentationLinks = [
        { id: 'link-1', label: 'AI Vision and Strategy', url: 'https://example.com/vision' },
        { id: 'link-2', label: 'AI Field Guide', url: 'https://example.com/guide' },
        { id: 'link-3', label: 'AI Policies', url: 'https://example.com/policies' },
    ];

    it('lists the tenant documentation links in their stored order, each opening in a new tab', async () => {
        renderHeader({ ...testTenant, documentationLinks });

        await userEvent.click(screen.getByRole('button', { name: `About ${testTenant.name}` }));

        const links = await screen.findAllByRole('link', { name: /^AI / });

        expect(links.map((link) => link.textContent)).toEqual([
            'AI Vision and Strategy',
            'AI Field Guide',
            'AI Policies',
        ]);

        links.forEach((link, index) => {
            expect(link).toHaveAttribute('href', documentationLinks[index].url);
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
        });
    });

    it('hides the About button when the tenant has no documentation links', () => {
        renderHeader({ ...testTenant, documentationLinks: [] });

        expect(screen.getByRole('button', { name: /what.s new/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: `About ${testTenant.name}` })).not.toBeInTheDocument();
    });

    it('hides the About button when the tenant hides documentation links', () => {
        renderHeader({ ...testTenant, documentationLinks, hideDocumentationLinks: true });

        expect(screen.getByRole('button', { name: /what.s new/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: `About ${testTenant.name}` })).not.toBeInTheDocument();
    });

    it('keeps the About button for an admin when it is hidden from users only', () => {
        renderHeader(
            { ...testTenant, documentationLinks, hideDocumentationLinks: { visibleToRoles: ['admin'] } },
            'admin',
        );

        expect(screen.getByRole('button', { name: `About ${testTenant.name}` })).toBeInTheDocument();
    });

    it('hides the About button from a role left off the list', () => {
        renderHeader(
            { ...testTenant, documentationLinks, hideDocumentationLinks: { visibleToRoles: ['admin'] } },
            'user',
        );

        expect(screen.queryByRole('button', { name: `About ${testTenant.name}` })).not.toBeInTheDocument();
    });
});
