import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { UploadFilesProvider } from '@/context';
import { installGalleryDomShims } from '@/test/dom-shims';
import { galleryVideoAgent } from '@/test/fixtures/agents';
import { makeGalleryFile } from '@/test/fixtures/gallery';
import {
    apiUrl,
    envelope,
    failureEnvelope,
    getJson,
    getPaged,
    httpError,
    pagedEnvelope,
    respond,
    server,
} from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { GalleryAgentType } from '@/types/admin';

import VideoGeneration from './video-generation';

installGalleryDomShims();

const agent = galleryVideoAgent as unknown as GalleryAgentType;

const noJobs = () => getPaged('/jobs', []);

// The gallery surfaces the backend's own message; these are what the MSW
// helpers put in the body. The generic string is only the fallback.
const HTTP_ERROR_MESSAGE = 'Request failed';
const ENVELOPE_ERROR_MESSAGE = 'Not allowed';

const makeVideoFile = (id: string, title: string) => makeGalleryFile({ _id: id, title, extension: 'mp4' });

const renderVideoGeneration = (route = '/agent/video-gallery-agent') =>
    renderWithProviders(
        <Routes>
            <Route path="/" element={<div>Agents home</div>} />
            <Route
                path="/agent/:agentId/*"
                element={
                    <UploadFilesProvider>
                        <VideoGeneration agent={agent} />
                    </UploadFilesProvider>
                }
            />
        </Routes>,
        { route },
    );

const getComposer = (): HTMLElement => {
    const composer = document.querySelector('.gallery-prompt-input-box p.textarea');

    if (!composer) throw new Error('gallery composer not found');

    return composer as HTMLElement;
};

describe('VideoGeneration', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('shows skeleton placeholders while the first page of files is in flight', async () => {
        server.use(
            respond('get', '/files', async () => {
                await delay('infinite');

                return envelope(null);
            }),
            noJobs(),
        );
        renderVideoGeneration();

        await waitFor(() => {
            expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
        });
        expect(screen.queryByText('No videos yet')).not.toBeInTheDocument();
    });

    it('renders the configured quote when the gallery is empty', async () => {
        server.use(getPaged('/files', []), noJobs());
        renderVideoGeneration();

        expect(await screen.findByText('No videos yet')).toBeInTheDocument();
    });

    it('renders every returned file as a video tile', async () => {
        server.use(
            getPaged('/files', [makeVideoFile('file-1', 'Drone flyover'), makeVideoFile('file-2', 'Timelapse')]),
            noJobs(),
        );
        renderVideoGeneration();

        expect(await screen.findByAltText('Drone flyover')).toBeInTheDocument();
        expect(screen.getByAltText('Timelapse')).toBeInTheDocument();
    });

    it('shows the error state, not the empty state, when the files request fails with an HTTP error', async () => {
        server.use(
            respond('get', '/files', () => httpError(500)),
            noJobs(),
        );
        renderVideoGeneration();

        expect(await screen.findByText(HTTP_ERROR_MESSAGE)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(screen.queryByText('No videos yet')).not.toBeInTheDocument();
        expect(screen.queryByAltText('Drone flyover')).not.toBeInTheDocument();
    });

    it('shows the error state when the files request returns success: false', async () => {
        server.use(
            respond('get', '/files', () => failureEnvelope('Not allowed')),
            noJobs(),
        );
        renderVideoGeneration();

        expect(await screen.findByText(ENVELOPE_ERROR_MESSAGE)).toBeInTheDocument();
        expect(screen.queryByText('No videos yet')).not.toBeInTheDocument();
        expect(screen.queryByAltText('Drone flyover')).not.toBeInTheDocument();
    });

    it('submits the typed prompt to the video generation endpoint and clears the composer', async () => {
        let body: Record<string, unknown> | null = null;

        server.use(
            getPaged('/files', []),
            noJobs(),
            http.post(apiUrl('/ai/video'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope({ jobId: 'job-1' });
            }),
        );
        renderVideoGeneration();

        await screen.findByText('No videos yet');

        const composer = getComposer();

        await userEvent.click(composer);
        await userEvent.type(composer, 'a drone shot of a canyon{Enter}');

        await waitFor(() => {
            expect(body).not.toBeNull();
        });
        expect(body).toMatchObject({
            agentIdOrIdentifier: 'gallery-video-agent-1',
            modelId: 'video-model-1',
            arguments: { prompt: 'a drone shot of a canyon' },
            options: { public: false, queue: true },
        });
        await waitFor(() => {
            expect(composer.textContent).toBe('');
        });
    });

    it('keeps the typed prompt in the composer when generation fails', async () => {
        server.use(
            getPaged('/files', []),
            noJobs(),
            respond('post', '/ai/video', () => httpError(500, 'Model unavailable')),
        );
        renderVideoGeneration();

        await screen.findByText('No videos yet');

        const composer = getComposer();

        await userEvent.click(composer);
        await userEvent.type(composer, 'a drone shot of a canyon{Enter}');

        await waitFor(() => {
            expect(composer).toHaveTextContent('a drone shot of a canyon');
        });
    });

    it('refetches without the mine-only filter when the Firmwide tab is selected', async () => {
        const requestedUrls: string[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requestedUrls.push(request.url);

                return pagedEnvelope([]);
            }),
            noJobs(),
        );
        renderVideoGeneration();

        await screen.findByText('No videos yet');
        await userEvent.click(screen.getByRole('radio', { name: 'Firmwide' }));

        await waitFor(() => {
            expect(requestedUrls.length).toBeGreaterThan(1);
        });

        const latest = new URL(requestedUrls[requestedUrls.length - 1]);

        expect(latest.searchParams.get('mineOnly')).toBe('false');
    });

    it('passes the debounced search term to the files request', async () => {
        const requestedUrls: string[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requestedUrls.push(request.url);

                return pagedEnvelope([]);
            }),
            noJobs(),
        );
        renderVideoGeneration();

        await screen.findByText('No videos yet');
        await userEvent.type(screen.getByPlaceholderText('Search media library'), 'canyon');

        await waitFor(
            () => {
                const latest = new URL(requestedUrls[requestedUrls.length - 1]);

                expect(latest.searchParams.get('search')).toBe('canyon');
            },
            { timeout: 3000 },
        );
    });

    it('preloads the file referenced by the fileId query param into the composer', async () => {
        server.use(
            getPaged('/files', []),
            noJobs(),
            getJson('/files/source-1', {
                _id: 'source-1',
                title: 'Source clip',
                url: 'https://files.localhost/download/source-1',
            }),
        );
        renderVideoGeneration('/agent/video-gallery-agent?fileId=source-1');

        expect(await screen.findByAltText('Source clip')).toBeInTheDocument();
    });

    it('still attaches a fallback file when the referenced fileId cannot be fetched', async () => {
        server.use(
            getPaged('/files', []),
            noJobs(),
            respond('get', '/files/source-1', () => httpError(404)),
        );
        renderVideoGeneration('/agent/video-gallery-agent?fileId=source-1');

        expect(await screen.findByText('video')).toBeInTheDocument();
    });

    it('navigates back to the agents home from the back button', async () => {
        server.use(getPaged('/files', []), noJobs());
        renderVideoGeneration();

        await screen.findByText('No videos yet');

        const backButton = document.querySelector('button.back-button');

        expect(backButton).toBeTruthy();
        await userEvent.click(backButton as HTMLElement);

        expect(await screen.findByText('Agents home')).toBeInTheDocument();
    });
});
