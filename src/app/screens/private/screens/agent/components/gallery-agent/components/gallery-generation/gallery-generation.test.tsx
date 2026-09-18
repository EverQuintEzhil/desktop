import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { UploadFilesProvider } from '@/context';
import { installGalleryDomShims } from '@/test/dom-shims';
import { galleryImageAgent } from '@/test/fixtures/agents';
import { makeGalleryFile } from '@/test/fixtures/gallery';
import { apiUrl, envelope, failureEnvelope, getPaged, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { GalleryAgentType } from '@/types/admin';

import GalleryGeneration from './gallery-generation';

installGalleryDomShims();

const agent = galleryImageAgent as unknown as GalleryAgentType;

const noJobs = () => getPaged('/jobs', []);

// The gallery surfaces the backend's own message; these are what the MSW
// helpers put in the body. The generic string is only the fallback.
const HTTP_ERROR_MESSAGE = 'Request failed';
const ENVELOPE_ERROR_MESSAGE = 'Not allowed';

const renderGalleryGeneration = (route = '/agent/gallery-agent') =>
    renderWithProviders(
        <Routes>
            <Route path="/" element={<div>Agents home</div>} />
            <Route
                path="/agent/:agentId/*"
                element={
                    <UploadFilesProvider>
                        <GalleryGeneration agent={agent} />
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

describe('GalleryGeneration', () => {
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
        renderGalleryGeneration();

        await waitFor(() => {
            expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
        });
        expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
    });

    it('requests the first page scoped to the agent and the current user', async () => {
        const requestedUrls: string[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requestedUrls.push(request.url);

                return pagedEnvelope([]);
            }),
            noJobs(),
        );
        renderGalleryGeneration();

        await screen.findByText('Nothing here yet');

        const url = new URL(requestedUrls[0]);

        expect(url.searchParams.get('agentId')).toBe('gallery-agent-1');
        expect(url.searchParams.get('page')).toBe('0');
        expect(url.searchParams.get('size')).toBe('20');
        expect(url.searchParams.get('mineOnly')).toBe('true');
        expect(url.searchParams.get('aiGenerated')).toBe('true');
    });

    it('renders the configured quote when the gallery is empty', async () => {
        server.use(getPaged('/files', []), noJobs());
        renderGalleryGeneration();

        expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
    });

    it('renders every returned file as a gallery tile', async () => {
        server.use(
            getPaged('/files', [
                makeGalleryFile({ _id: 'file-1', title: 'Red house' }),
                makeGalleryFile({ _id: 'file-2', title: 'Blue tower' }),
            ]),
            noJobs(),
        );
        renderGalleryGeneration();

        expect(await screen.findByAltText('Red house')).toBeInTheDocument();
        expect(screen.getByAltText('Blue tower')).toBeInTheDocument();
    });

    it('shows the error state, not the empty state, when the files request fails with an HTTP error', async () => {
        server.use(
            respond('get', '/files', () => httpError(500)),
            noJobs(),
        );
        renderGalleryGeneration();

        expect(await screen.findByText(HTTP_ERROR_MESSAGE)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
        expect(screen.queryByAltText('Red house')).not.toBeInTheDocument();
    });

    it('shows the error state when the files request returns success: false', async () => {
        server.use(
            respond('get', '/files', () => failureEnvelope('Not allowed')),
            noJobs(),
        );
        renderGalleryGeneration();

        expect(await screen.findByText(ENVELOPE_ERROR_MESSAGE)).toBeInTheDocument();
        expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
        expect(screen.queryByAltText('Red house')).not.toBeInTheDocument();
    });

    it('refetches and renders the gallery when Retry is clicked after a failure', async () => {
        let shouldFail = true;

        server.use(
            respond('get', '/files', () =>
                shouldFail ? httpError(500) : pagedEnvelope([makeGalleryFile({ _id: 'file-1', title: 'Red house' })]),
            ),
            noJobs(),
        );
        renderGalleryGeneration();

        await screen.findByText(HTTP_ERROR_MESSAGE);
        shouldFail = false;
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(await screen.findByAltText('Red house')).toBeInTheDocument();
    });

    it('submits the typed prompt to the image generation endpoint and clears the composer', async () => {
        let body: Record<string, unknown> | null = null;

        server.use(
            getPaged('/files', []),
            noJobs(),
            http.post(apiUrl('/ai/image'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope({ jobId: 'job-1' });
            }),
        );
        renderGalleryGeneration();

        await screen.findByText('Nothing here yet');

        const composer = getComposer();

        await userEvent.click(composer);
        await userEvent.type(composer, 'a glass pavilion{Enter}');

        await waitFor(() => {
            expect(body).not.toBeNull();
        });
        expect(body).toMatchObject({
            agentIdOrIdentifier: 'gallery-agent-1',
            modelId: 'model-1',
            arguments: { prompt: 'a glass pavilion' },
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
            respond('post', '/ai/image', () => httpError(500, 'Model unavailable')),
        );
        renderGalleryGeneration();

        await screen.findByText('Nothing here yet');

        const composer = getComposer();

        await userEvent.click(composer);
        await userEvent.type(composer, 'a glass pavilion{Enter}');

        await waitFor(() => {
            expect(composer).toHaveTextContent('a glass pavilion');
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
        renderGalleryGeneration();

        await screen.findByText('Nothing here yet');
        await userEvent.click(screen.getByRole('radio', { name: 'Firmwide' }));

        await waitFor(() => {
            expect(requestedUrls.length).toBeGreaterThan(1);
        });

        const latest = new URL(requestedUrls[requestedUrls.length - 1]);

        expect(latest.searchParams.get('mineOnly')).toBe('false');
        expect(latest.searchParams.has('liked')).toBe(false);
    });

    it('refetches with the liked filter when the Fav tab is selected', async () => {
        const requestedUrls: string[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requestedUrls.push(request.url);

                return pagedEnvelope([]);
            }),
            noJobs(),
        );
        renderGalleryGeneration();

        await screen.findByText('Nothing here yet');
        await userEvent.click(screen.getByRole('radio', { name: 'Fav' }));

        await waitFor(() => {
            const latest = new URL(requestedUrls[requestedUrls.length - 1]);

            expect(latest.searchParams.get('liked')).toBe('true');
        });
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
        renderGalleryGeneration();

        await screen.findByText('Nothing here yet');
        await userEvent.type(screen.getByPlaceholderText('Search media library'), 'tower');

        await waitFor(
            () => {
                const latest = new URL(requestedUrls[requestedUrls.length - 1]);

                expect(latest.searchParams.get('search')).toBe('tower');
            },
            { timeout: 3000 },
        );
    });

    it('opens the lightbox with the item prompt when a tile is clicked', async () => {
        server.use(
            getPaged('/files', [makeGalleryFile({ _id: 'file-1', title: 'Red house', prompt: 'a red brick house' })]),
            noJobs(),
        );
        renderGalleryGeneration();

        await userEvent.click(await screen.findByAltText('Red house'));

        await waitFor(() => {
            expect(document.querySelector('.lightbox-overlay')).toBeTruthy();
        });
        expect(screen.getAllByText('a red brick house').length).toBeGreaterThan(0);
    });

    it('navigates back to the agents home from the back button', async () => {
        server.use(getPaged('/files', []), noJobs());
        renderGalleryGeneration();

        await screen.findByText('Nothing here yet');

        const backButton = document.querySelector('button.back-button');

        expect(backButton).toBeTruthy();
        await userEvent.click(backButton as HTMLElement);

        expect(await screen.findByText('Agents home')).toBeInTheDocument();
    });
});
