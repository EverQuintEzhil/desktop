import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import LegacyRedirect from './legacy-redirect';

const LocationProbe = () => {
    const location = useLocation();

    return <div data-testid="location">{location.pathname}</div>;
};

/**
 * Mirrors the real nesting: `AgentDetail` renders its own `Routes`, so the splat the redirect
 * reads is the segment after `builder-conversations`, not the whole agent path.
 */
const renderAt = (route: string) =>
    renderWithProviders(
        <Routes>
            <Route
                path="/admin/agents/:agentId/*"
                element={
                    <Routes>
                        <Route path="builder-conversations/*" element={<LegacyRedirect agentSlug="my-agent" />} />
                    </Routes>
                }
            />
            <Route path="/admin/builder-conversations/*" element={<LocationProbe />} />
        </Routes>,
        { route },
    );

describe('BuilderConversations LegacyRedirect', () => {
    it('sends the retired tab URL to the top-level screen', async () => {
        renderAt('/admin/agents/my-agent/builder-conversations');

        expect(await screen.findByTestId('location')).toHaveTextContent('/admin/builder-conversations/my-agent');
    });

    /** Bookmarks of a specific conversation shipped on v2.2 — they must land on that conversation. */
    it('carries the conversation id across', async () => {
        renderAt('/admin/agents/my-agent/builder-conversations/conversation-1');

        expect(await screen.findByTestId('location')).toHaveTextContent(
            '/admin/builder-conversations/my-agent/conversation-1',
        );
    });

    it('does not leave a trailing slash when there is no conversation', async () => {
        renderAt('/admin/agents/my-agent/builder-conversations/');

        expect(await screen.findByTestId('location')).toHaveTextContent(/\/admin\/builder-conversations\/my-agent$/);
    });
});
