import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import AgentAdvancedSettings from './agent-advanced-settings';

/**
 * `AgentDetail` is the admin console's agent screen — hundreds of lines and a
 * dozen admin endpoints, all of which belong to the admin surface and its own
 * tests. It is stubbed here (not a `src/lib/api/` module, so the MSW-only rule
 * stands) so the props this wrapper hardcodes stay assertable, which is the
 * entire reason the file exists.
 */
const agentDetailProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('@/admin/screens/private/screens/admin/components/agents/components/agent-detail', () => ({
    default: (props: Record<string, unknown>) => {
        agentDetailProps.current = props;

        return <div data-testid="agent-detail-stub">Agent detail</div>;
    },
}));

const renderAt = (route: string) =>
    renderWithProviders(
        <Routes>
            <Route
                path="/agent-builder/:id/*"
                element={<AgentAdvancedSettings agentName="Research Bot" onBack={vi.fn()} />}
            />
        </Routes>,
        { route },
    );

describe('AgentAdvancedSettings', () => {
    it('renders the admin agent detail on the advanced-settings sub-route', () => {
        renderAt('/agent-builder/agent-1/advanced-settings');

        expect(screen.getByTestId('agent-detail-stub')).toBeInTheDocument();
    });

    it('renders nothing on the builder root, only on the nested route', () => {
        renderAt('/agent-builder/agent-1');

        expect(screen.queryByTestId('agent-detail-stub')).not.toBeInTheDocument();
    });

    it('derives the base path from the route param', () => {
        renderAt('/agent-builder/agent-42/advanced-settings');

        expect(agentDetailProps.current?.basePath).toBe('/agent-builder/agent-42/advanced-settings');
    });

    it('forwards the agent name and mounts in app view with no parent breadcrumbs', () => {
        renderAt('/agent-builder/agent-1/advanced-settings');

        expect(agentDetailProps.current?.agentName).toBe('Research Bot');
        expect(agentDetailProps.current?.isAppView).toBe(true);
        expect(agentDetailProps.current?.parentBreadcrumbs).toEqual([]);
    });

    it('grants every builder permission except history viewing', () => {
        renderAt('/agent-builder/agent-1/advanced-settings');

        expect(agentDetailProps.current?.appPermissions).toEqual({
            canEdit: true,
            canDelete: true,
            canClone: true,
            canViewConfigs: true,
            canEditConfigs: true,
            canViewHistories: false,
        });
    });

    it('passes the back handler straight through', () => {
        const onBack = vi.fn();

        renderWithProviders(
            <Routes>
                <Route
                    path="/agent-builder/:id/*"
                    element={<AgentAdvancedSettings agentName="Research Bot" onBack={onBack} />}
                />
            </Routes>,
            { route: '/agent-builder/agent-1/advanced-settings' },
        );

        (agentDetailProps.current?.onBack as () => void)();

        expect(onBack).toHaveBeenCalledTimes(1);
    });
});
