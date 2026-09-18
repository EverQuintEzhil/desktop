import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { authenticatedUser, testTenant } from '@/test/fixtures/auth';
import { renderWithProviders } from '@/test/test-utils';

import SettingsSidebar from './settings-sidebar';

vi.mock('@/components', () => ({ AvatarMenu: () => null }));

const renderSidebar = (preloadedState?: Parameters<typeof renderWithProviders>[1]) =>
    renderWithProviders(<SettingsSidebar isMobileOpen={false} onMobileClose={() => {}} returnPath="/" />, {
        route: '/settings/connectors',
        ...preloadedState,
    });

describe('SettingsSidebar — Routines nav item', () => {
    it('is absent while the tenant has never enabled Routines', () => {
        renderSidebar();

        expect(screen.queryByRole('link', { name: 'Routines' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Memories' })).toBeInTheDocument();
    });

    it('appears once the tenant makes Routines visible', () => {
        renderSidebar({ preloadedState: { tenant: { ...testTenant, hideRoutines: false } } });

        expect(screen.getByRole('link', { name: 'Routines' })).toBeInTheDocument();
    });

    it('stays hidden from a role outside the tenant role list', () => {
        renderSidebar({
            preloadedState: {
                tenant: { ...testTenant, hideRoutines: { visibleToRoles: ['admin'] } },
                user: { ...authenticatedUser, role: 'user' },
            },
        });

        expect(screen.queryByRole('link', { name: 'Routines' })).not.toBeInTheDocument();
    });
});
