import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation, useParams } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { HelpCenterAgent } from '@/lib/tenant/help-center-agent';
import { testTenant } from '@/test/fixtures/auth';
import { renderWithProviders } from '@/test/test-utils';

import BlogAskAgent from './blog-ask-agent';

/** Reads the route param and router state the button hands to the agent route. */
const AgentProbe = () => {
    const { agentId } = useParams();
    const location = useLocation();
    const state = location.state as { prompt?: string; showHome?: boolean } | null;

    return (
        <div>{`Agent home for ${agentId} with: ${state?.prompt ?? 'nothing'} showHome=${String(state?.showHome)}`}</div>
    );
};

const renderButton = (props: { title?: string; slug?: string }, helpCenterAgent: HelpCenterAgent | null) =>
    renderWithProviders(
        <Routes>
            <Route path="/help-center/:blogPostId" element={<BlogAskAgent {...props} />} />
            <Route path="/agent/:agentId" element={<AgentProbe />} />
        </Routes>,
        { route: '/help-center/managing-spaces', preloadedState: { tenant: { ...testTenant, helpCenterAgent } } },
    );

describe('BlogAskAgent', () => {
    it('renders nothing when no agent is configured', () => {
        renderButton({ title: 'Managing spaces', slug: 'managing-spaces' }, null);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders nothing when the article has no title or slug yet', () => {
        renderButton({}, { agentId: 'agent-1', agentName: 'Help Bot', agentSlug: 'help-bot' });

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('labels the button with the configured agent name', () => {
        renderButton(
            { title: 'Managing spaces', slug: 'managing-spaces' },
            { agentId: 'agent-1', agentName: 'Help Bot', agentSlug: 'help-bot' },
        );

        expect(screen.getByRole('button', { name: /Ask in Help Bot/ })).toBeInTheDocument();
    });

    it('navigates to the agent by id, not the (renameable) slug, with a pre-filled unsent prompt', async () => {
        renderButton(
            { title: 'Managing spaces', slug: 'managing-spaces' },
            { agentId: 'agent-1', agentName: 'Help Bot', agentSlug: 'help-bot' },
        );

        await userEvent.click(screen.getByRole('button', { name: /Ask in Help Bot/ }));

        expect(
            await screen.findByText(/Agent home for agent-1 with: I'm reading the help article "Managing spaces"/),
        ).toBeInTheDocument();
        expect(screen.getByText(/showHome=true/)).toBeInTheDocument();
    });

    it('navigates by id even when no slug is stored', async () => {
        renderButton(
            { title: 'Managing spaces', slug: 'managing-spaces' },
            { agentId: 'agent-1', agentName: 'Help Bot', agentSlug: '' },
        );

        await userEvent.click(screen.getByRole('button', { name: /Ask in Help Bot/ }));

        expect(await screen.findByText(/Agent home for agent-1/)).toBeInTheDocument();
    });
});
