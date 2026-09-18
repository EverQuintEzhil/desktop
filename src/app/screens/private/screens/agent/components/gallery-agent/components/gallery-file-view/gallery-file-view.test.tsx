import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { UploadFilesProvider } from '@/context';
import { installGalleryDomShims } from '@/test/dom-shims';
import { galleryImageAgent, galleryVideoAgent } from '@/test/fixtures/agents';
import { makeGalleryFile } from '@/test/fixtures/gallery';
import { apiUrl, envelope, failureEnvelope, getJson, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { GalleryAgentType } from '@/types/admin';

import GalleryFileView from './gallery-file-view';

installGalleryDomShims();

const imageAgent = galleryImageAgent as unknown as GalleryAgentType;
const videoAgent = galleryVideoAgent as unknown as GalleryAgentType;

interface RenderOptions {
    agent?: GalleryAgentType;
    isVideo?: boolean;
    route?: string;
}

const renderGalleryFileView = (options: RenderOptions = {}) => {
    const { agent = imageAgent, isVideo = false, route = '/agent/gallery-agent/file-1' } = options;

    return renderWithProviders(
        <Routes>
            <Route path="/agent/gallery-agent" element={<div>Gallery home</div>} />
            <Route
                path="/agent/:agentId/:fileId"
                element={
                    <UploadFilesProvider>
                        <GalleryFileView agent={agent} isVideo={isVideo} />
                    </UploadFilesProvider>
                }
            />
        </Routes>,
        { route },
    );
};

const getRemixComposer = (): HTMLElement => {
    const composer = document.querySelector('p[data-placeholder="Enter your remix prompt..."]');

    if (!composer) throw new Error('remix composer not found');

    return composer as HTMLElement;
};

describe('GalleryFileView', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('shows the lightbox loading state while the file is being fetched', async () => {
        server.use(
            respond('get', '/files/file-1', async () => {
                await delay('infinite');

                return envelope(null);
            }),
        );
        renderGalleryFileView();

        expect(await screen.findByText('Loading...')).toBeInTheDocument();
    });

    it('renders the fetched file title and the agent header', async () => {
        server.use(getJson('/files/file-1', makeGalleryFile({ _id: 'file-1', title: 'Canal house' })));
        renderGalleryFileView();

        expect(await screen.findByText('Canal house')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Gallery Agent' })).toBeInTheDocument();
    });

    it('renders the not-found state when the file is soft deleted', async () => {
        server.use(getJson('/files/file-1', makeGalleryFile({ _id: 'file-1', title: 'Canal house', isDeleted: true })));
        renderGalleryFileView();

        expect(await screen.findByText('Image not found')).toBeInTheDocument();
        expect(screen.queryByText('Canal house')).not.toBeInTheDocument();
    });

    it('renders the not-found state when the file request fails with an HTTP error', async () => {
        server.use(respond('get', '/files/file-1', () => httpError(404)));
        renderGalleryFileView();

        expect(await screen.findByText('Image not found')).toBeInTheDocument();
    });

    it('renders the not-found state when the file request returns success: false', async () => {
        server.use(respond('get', '/files/file-1', () => failureEnvelope('Not allowed')));
        renderGalleryFileView();

        expect(await screen.findByText('Image not found')).toBeInTheDocument();
    });

    it('uses the video wording for the not-found state on video agents', async () => {
        server.use(respond('get', '/files/file-1', () => httpError(404)));
        renderGalleryFileView({ agent: videoAgent, isVideo: true });

        expect(await screen.findByText('Video not found')).toBeInTheDocument();
    });

    it('fetches the file named by the route param', async () => {
        const requestedUrls: string[] = [];

        server.use(
            http.get(apiUrl('/files/:fileId'), ({ request }) => {
                requestedUrls.push(request.url);

                return envelope(makeGalleryFile({ _id: 'file-9', title: 'Bridge study' }));
            }),
        );
        renderGalleryFileView({ route: '/agent/gallery-agent/file-9' });

        await screen.findByText('Bridge study');
        expect(new URL(requestedUrls[0]).pathname).toBe('/files/file-9');
    });

    it('navigates back to the agent gallery from the header back button', async () => {
        server.use(getJson('/files/file-1', makeGalleryFile({ _id: 'file-1', title: 'Canal house' })));
        renderGalleryFileView();

        await screen.findByText('Canal house');

        const backButton = document.querySelector('button.back-button');

        expect(backButton).toBeTruthy();
        await userEvent.click(backButton as HTMLElement);

        expect(await screen.findByText('Gallery home')).toBeInTheDocument();
    });

    it('submits a remix prompt for the open file and returns to the gallery', async () => {
        let body: Record<string, unknown> | null = null;

        server.use(
            getJson('/files/file-1', makeGalleryFile({ _id: 'file-1', title: 'Canal house' })),
            http.post(apiUrl('/ai/image'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope({ jobId: 'job-1' });
            }),
        );
        renderGalleryFileView();

        await screen.findByText('Canal house');
        await userEvent.click(screen.getByRole('button', { name: /Remix/ }));

        const remixInput = getRemixComposer();

        await userEvent.click(remixInput);
        await userEvent.type(remixInput, 'make it snowy{Enter}');

        await waitFor(() => {
            expect(body).not.toBeNull();
        });
        expect(body).toMatchObject({
            agentIdOrIdentifier: 'gallery-agent-1',
            modelId: 'model-1',
            fileIds: ['file-1'],
            arguments: { prompt: 'make it snowy' },
            options: { public: false, queue: true },
        });
        expect(await screen.findByText('Gallery home')).toBeInTheDocument();
    });

    it('still sends the remix and leaves the file view when generation fails', async () => {
        let attempted = false;

        server.use(
            getJson('/files/file-1', makeGalleryFile({ _id: 'file-1', title: 'Canal house' })),
            respond('post', '/ai/image', () => {
                attempted = true;

                return httpError(500, 'Model unavailable');
            }),
        );
        renderGalleryFileView();

        await screen.findByText('Canal house');
        await userEvent.click(screen.getByRole('button', { name: /Remix/ }));

        const remixInput = getRemixComposer();

        await userEvent.click(remixInput);
        await userEvent.type(remixInput, 'make it snowy{Enter}');

        await waitFor(() => {
            expect(attempted).toBe(true);
        });
        expect(await screen.findByText('Gallery home')).toBeInTheDocument();
    });

    it('does not offer remix on video agents', async () => {
        server.use(
            getJson('/files/file-1', makeGalleryFile({ _id: 'file-1', title: 'Canal house', extension: 'mp4' })),
        );
        renderGalleryFileView({ agent: videoAgent, isVideo: true });

        await screen.findByText('Canal house');
        expect(screen.queryByRole('button', { name: /Remix/ })).not.toBeInTheDocument();
    });
});
