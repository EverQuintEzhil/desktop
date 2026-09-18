import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { galleryAgent } from '@/test/fixtures/agents';
import { renderWithProviders } from '@/test/test-utils';
import type { GalleryAgentType } from '@/types/admin';

import GalleryAgent from './gallery-agent';

vi.mock('./components', () => ({
    GalleryGeneration: () => <div>Gallery generation view</div>,
    VideoGeneration: () => <div>Video generation view</div>,
}));

vi.mock('./components/gallery-file-view', () => ({
    GalleryFileView: () => <div>Gallery file view</div>,
}));

vi.mock('./components/user-gallery-view', () => ({
    UserGalleryView: () => <div>User gallery view</div>,
}));

const imageAgent = galleryAgent as unknown as GalleryAgentType;
const videoAgent = {
    ...galleryAgent,
    uiConfig: { ...galleryAgent.uiConfig, type: 'video' },
} as unknown as GalleryAgentType;

const renderGalleryAgent = (agent: GalleryAgentType, route = '/agent/gallery-agent-1') =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/:agentId/*" element={<GalleryAgent agent={agent} />} />
        </Routes>,
        { route },
    );

describe('GalleryAgent', () => {
    it('renders the gallery generation view for image agents on the base route', async () => {
        renderGalleryAgent(imageAgent);

        await waitFor(() => {
            expect(screen.getByText('Gallery generation view')).toBeInTheDocument();
        });
    });

    it('renders the video generation view for video agents on the base route', async () => {
        renderGalleryAgent(videoAgent);

        await waitFor(() => {
            expect(screen.getByText('Video generation view')).toBeInTheDocument();
        });
    });

    it('renders the user gallery view for the user/:userId route', async () => {
        renderGalleryAgent(imageAgent, '/agent/gallery-agent-1/user/user-1');

        await waitFor(() => {
            expect(screen.getByText('User gallery view')).toBeInTheDocument();
        });
    });

    it('renders the gallery file view for the :fileId route', async () => {
        renderGalleryAgent(imageAgent, '/agent/gallery-agent-1/file-1');

        await waitFor(() => {
            expect(screen.getByText('Gallery file view')).toBeInTheDocument();
        });
    });
});
