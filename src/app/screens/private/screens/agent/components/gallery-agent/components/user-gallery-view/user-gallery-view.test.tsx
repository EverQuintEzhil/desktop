import { screen, waitFor, within } from '@testing-library/react';
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

import UserGalleryView from './user-gallery-view';

installGalleryDomShims();

const agent = galleryImageAgent as unknown as GalleryAgentType;

const noJobs = () => getPaged('/jobs', []);

// The gallery surfaces the backend's own message; these are what the MSW
// helpers put in the body. The generic string is only the fallback.
const HTTP_ERROR_MESSAGE = 'Request failed';
const ENVELOPE_ERROR_MESSAGE = 'Not allowed';

const otherUserFile = (id: string, title: string) =>
    makeGalleryFile({
        _id: id,
        title,
        creatorId: 'user-2',
        creatorName: 'Ada Lovelace',
    });

const renderUserGalleryView = (route = '/agent/gallery-agent/user/user-2') =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/gallery-agent" element={<div>Gallery home</div>} />
            <Route
                path="/agent/:agentId/user/:userId"
                element={
                    <UploadFilesProvider>
                        <UserGalleryView agent={agent} />
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

describe('UserGalleryView', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('scopes the files request to the profile user rather than the signed-in user', async () => {
        const requestedUrls: string[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requestedUrls.push(request.url);

                return pagedEnvelope([]);
            }),
            noJobs(),
        );
        renderUserGalleryView();

        await screen.findByText('Nothing here yet');

        const url = new URL(requestedUrls[0]);

        expect(url.searchParams.get('creatorId')).toBe('user-2');
        expect(url.searchParams.get('agentId')).toBe('gallery-agent-1');
        expect(url.searchParams.has('mineOnly')).toBe(false);
        expect(url.searchParams.has('liked')).toBe(false);
    });

    it('shows skeleton placeholders while the first page of files is in flight', async () => {
        server.use(
            respond('get', '/files', async () => {
                await delay('infinite');

                return envelope(null);
            }),
            noJobs(),
        );
        renderUserGalleryView();

        await waitFor(() => {
            expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
        });
    });

    it('renders the configured quote when the profile user has no media', async () => {
        server.use(getPaged('/files', []), noJobs());
        renderUserGalleryView();

        expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
    });

    it('renders the profile user media and their name once the first page resolves', async () => {
        server.use(
            getPaged('/files', [otherUserFile('file-1', 'Canal house'), otherUserFile('file-2', 'Bridge study')]),
            noJobs(),
        );
        renderUserGalleryView();

        expect(await screen.findByAltText('Canal house')).toBeInTheDocument();
        expect(screen.getByAltText('Bridge study')).toBeInTheDocument();

        const header = document.querySelector('.search-and-filters');

        expect(header).toBeTruthy();
        expect(within(header as HTMLElement).getByText('Ada Lovelace')).toBeInTheDocument();
    });

    it('labels the search box with the profile user name once it is known', async () => {
        server.use(getPaged('/files', [otherUserFile('file-1', 'Canal house')]), noJobs());
        renderUserGalleryView();

        expect(await screen.findByPlaceholderText('Search Ada Lovelace media')).toBeInTheDocument();
    });

    it('falls back to a generic search label while no media identifies the user', async () => {
        server.use(getPaged('/files', []), noJobs());
        renderUserGalleryView();

        await screen.findByText('Nothing here yet');
        expect(screen.getByPlaceholderText('Search user media')).toBeInTheDocument();
    });

    it('shows the error state, not the empty state, when the files request fails with an HTTP error', async () => {
        server.use(
            respond('get', '/files', () => httpError(500)),
            noJobs(),
        );
        renderUserGalleryView();

        expect(await screen.findByText(HTTP_ERROR_MESSAGE)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
        expect(screen.queryByAltText('Canal house')).not.toBeInTheDocument();
    });

    it('shows the error state when the files request returns success: false', async () => {
        server.use(
            respond('get', '/files', () => failureEnvelope('Not allowed')),
            noJobs(),
        );
        renderUserGalleryView();

        expect(await screen.findByText(ENVELOPE_ERROR_MESSAGE)).toBeInTheDocument();
        expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
        expect(screen.queryByAltText('Canal house')).not.toBeInTheDocument();
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
        renderUserGalleryView();

        await screen.findByText('Nothing here yet');
        await userEvent.type(screen.getByPlaceholderText('Search user media'), 'canal');

        await waitFor(
            () => {
                const latest = new URL(requestedUrls[requestedUrls.length - 1]);

                expect(latest.searchParams.get('search')).toBe('canal');
            },
            { timeout: 3000 },
        );
    });

    it('submits the typed prompt to the image generation endpoint', async () => {
        let body: Record<string, unknown> | null = null;

        server.use(
            getPaged('/files', []),
            noJobs(),
            http.post(apiUrl('/ai/image'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope({ jobId: 'job-1' });
            }),
        );
        renderUserGalleryView();

        await screen.findByText('Nothing here yet');

        const composer = getComposer();

        await userEvent.click(composer);
        await userEvent.type(composer, 'a canal house at dusk{Enter}');

        await waitFor(() => {
            expect(body).not.toBeNull();
        });
        expect(body).toMatchObject({
            agentIdOrIdentifier: 'gallery-agent-1',
            modelId: 'model-1',
            arguments: { prompt: 'a canal house at dusk' },
            options: { public: false, queue: true },
        });
    });

    it('keeps the typed prompt in the composer when generation fails', async () => {
        server.use(
            getPaged('/files', []),
            noJobs(),
            respond('post', '/ai/image', () => httpError(500, 'Model unavailable')),
        );
        renderUserGalleryView();

        await screen.findByText('Nothing here yet');

        const composer = getComposer();

        await userEvent.click(composer);
        await userEvent.type(composer, 'a canal house at dusk{Enter}');

        await waitFor(() => {
            expect(composer).toHaveTextContent('a canal house at dusk');
        });
    });

    it('navigates back to the agent gallery from the back button', async () => {
        server.use(getPaged('/files', []), noJobs());
        renderUserGalleryView();

        await screen.findByText('Nothing here yet');

        const backButton = document.querySelector('button.back-button');

        expect(backButton).toBeTruthy();
        await userEvent.click(backButton as HTMLElement);

        expect(await screen.findByText('Gallery home')).toBeInTheDocument();
    });

    it('opens the lightbox with the item prompt when a tile is clicked', async () => {
        server.use(
            getPaged('/files', [
                makeGalleryFile({
                    _id: 'file-1',
                    title: 'Canal house',
                    prompt: 'a canal house in amsterdam',
                    creatorId: 'user-2',
                    creatorName: 'Ada Lovelace',
                }),
            ]),
            noJobs(),
        );
        renderUserGalleryView();

        await userEvent.click(await screen.findByAltText('Canal house'));

        await waitFor(() => {
            expect(document.querySelector('.lightbox-overlay')).toBeTruthy();
        });
        expect(screen.getAllByText('a canal house in amsterdam').length).toBeGreaterThan(0);
    });
});
