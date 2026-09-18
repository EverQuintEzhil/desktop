import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appAgentApi } from '@/lib/api/app/agent';
import { agentWithoutUi, apiAgent, chatAgent, galleryAgent } from '@/test/fixtures/agents';
import { renderWithProviders } from '@/test/test-utils';

import Agent from './agent';

vi.mock('@/lib/api/app/agent', () => ({
    appAgentApi: {
        getAgent: vi.fn(),
    },
}));

vi.mock('@/app/hooks/use-announcements', () => ({
    useAnnouncements: () => ({
        announcementsState: {
            loading: false,
            announcements: [],
            isModalOpen: false,
        },
        fetchAnnouncements: vi.fn(),
        closeAnnouncementsModal: vi.fn(),
        markAnnouncementsAsRead: vi.fn(),
    }),
}));

vi.mock('./components/chat-agent', () => ({
    default: () => <div>Chat agent shell</div>,
}));

vi.mock('./components/api-agent', () => ({
    default: () => <div>API agent shell</div>,
}));

vi.mock('./components/gallery-agent', () => ({
    default: () => <div>Gallery agent shell</div>,
}));

const renderAgentRoute = (agentId = 'agent-1') =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/:agentId/*" element={<Agent />} />
        </Routes>,
        { route: `/agent/${agentId}` },
    );

describe('Agent shell', () => {
    beforeEach(() => {
        vi.mocked(appAgentApi.getAgent).mockReset();
    });

    it('shows loading while the agent is fetched', () => {
        vi.mocked(appAgentApi.getAgent).mockReturnValue(new Promise(() => undefined) as never);

        renderAgentRoute();

        expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('renders unavailable UI when the agent has no supported uiConfig', async () => {
        vi.mocked(appAgentApi.getAgent).mockResolvedValue(agentWithoutUi);

        renderAgentRoute();

        await waitFor(() => {
            expect(screen.getByText('Agent UI configuration is unavailable')).toBeInTheDocument();
        });
    });

    it('renders the chat agent shell for chat uiConfig', async () => {
        vi.mocked(appAgentApi.getAgent).mockResolvedValue(chatAgent);

        renderAgentRoute();

        await waitFor(() => {
            expect(screen.getByText('Chat agent shell')).toBeInTheDocument();
        });
    });

    it('renders the gallery agent shell for gallery uiConfig', async () => {
        vi.mocked(appAgentApi.getAgent).mockResolvedValue(galleryAgent);

        renderAgentRoute('gallery-agent-1');

        await waitFor(() => {
            expect(screen.getByText('Gallery agent shell')).toBeInTheDocument();
        });
    });

    it('renders the api agent shell for api uiConfig', async () => {
        vi.mocked(appAgentApi.getAgent).mockResolvedValue(apiAgent);

        renderAgentRoute('api-agent-1');

        await waitFor(() => {
            expect(screen.getByText('API agent shell')).toBeInTheDocument();
        });
    });
});
