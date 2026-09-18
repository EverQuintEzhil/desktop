import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import Library from './library';

const agent = {
    _id: 'agent-1',
    slug: 'test-agent',
    name: 'Test Agent',
    launcher: { name: 'Test Agent Library' },
    uiConfig: {},
} as unknown as ChatAgentType;

const rawFile = (overrides: Record<string, unknown> = {}) => ({
    _id: 'file-1',
    agent_id: 'agent-1',
    agent_name: 'Test Agent',
    agent_slug: 'test-agent',
    name: 'brief.pdf',
    title: 'Brief',
    extension: 'pdf',
    type: 'document',
    url: 'https://files.localhost/download/brief.pdf',
    thumbnail_url: '',
    creator_id: 'user-1',
    creator_name: 'Test User',
    is_public: false,
    likes: [],
    likes_count: 0,
    meta: { size: 2048 },
    // 'indexed' is the only non-failed terminal status; anything else opens a 10s embedding poll.
    embedding_status: 'indexed',
    created_at: 1772000000000,
    updated_at: 1772000000000,
    ...overrides,
});

const LocationProbe = () => {
    const location = useLocation();

    return <div>{`at ${location.pathname}${location.search}`}</div>;
};

const renderLibrary = (route = '/agent/test-agent/library') =>
    renderWithProviders(
        <>
            <LocationProbe />
            <Routes>
                <Route path="/agent/:agentSlug/library" element={<Library agent={agent} />} />
                <Route path="/agent/:agentSlug" element={<div>Chat home screen</div>} />
            </Routes>
        </>,
        { route },
    );

describe('Library', () => {
    beforeEach(() => {
        server.use(http.get(apiUrl('/ai/artifacts'), () => envelope({ total: 0, items: [] })));
    });

    it('shows the library title, its agent and skeletons while the first page is in flight', async () => {
        server.use(
            respond('get', '/files', async () => {
                await delay('infinite');

                return pagedEnvelope([]);
            }),
        );

        const { container } = renderLibrary();

        expect(await screen.findByRole('heading', { name: 'Library' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Agent: Test Agent Library' })).toHaveAttribute(
            'href',
            '/agent/test-agent',
        );

        // The grid skeleton is 8 cards of 5 blocks each.
        await waitFor(() => {
            expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(40);
        });
        expect(screen.queryByText('Your library is ready')).not.toBeInTheDocument();
    });

    it('shows the default My files empty state and scopes the request to the agent', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([]);
            }),
        );

        renderLibrary();

        expect(await screen.findByText('Your library is ready')).toBeInTheDocument();
        expect(
            screen.getByText('Uploads and generated assets you create with this agent will appear here.'),
        ).toBeInTheDocument();

        expect(requests).toHaveLength(1);
        expect(requests[0].searchParams.get('agentId')).toBe('agent-1');
        expect(requests[0].searchParams.get('scope')).toBe('mine');
        expect(requests[0].searchParams.get('sortBy')).toBe('updated_at:desc');
        expect(requests[0].searchParams.get('page')).toBe('0');
    });

    it('shows the all-files empty state when opened on the all tab', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([]);
            }),
        );

        renderLibrary('/agent/test-agent/library?tab=all');

        expect(await screen.findByText('No files in this library yet')).toBeInTheDocument();
        expect(
            screen.getByText('Uploads, generated assets, and shared files will appear here as the library grows.'),
        ).toBeInTheDocument();

        expect(requests[0].searchParams.get('scope')).toBe('all');
    });

    it('lists the first page of files with their metadata', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requests.push(new URL(request.url));

                // totalPages must stay 1: jsdom reports offsetWidth 0, so the grid falls back to a
                // single column, every row is "in view", and the virtualizer would auto-fetch page 2.
                return pagedEnvelope([rawFile(), rawFile({ _id: 'file-2', name: 'mockup.png', extension: 'png' })], {
                    page: 0,
                    totalPages: 1,
                    totalCount: 2,
                });
            }),
        );

        renderLibrary();

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
        expect(screen.getByText('mockup.png')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Download brief.pdf' })).toBeInTheDocument();
        expect(requests).toHaveLength(1);
    });

    it('shows the error message when the files request fails with a 500', async () => {
        server.use(respond('get', '/files', () => httpError(500)));

        renderLibrary();

        expect(await screen.findByText('Failed to fetch library. Please try again.')).toBeInTheDocument();
    });

    it('shows the error message when the API answers success:false', async () => {
        server.use(respond('get', '/files', () => failureEnvelope('Library unavailable')));

        renderLibrary();

        expect(await screen.findByText('Failed to fetch library. Please try again.')).toBeInTheDocument();
    });

    it('maps the scope tabs to the API scope and reflects them in the URL', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([]);
            }),
        );

        renderLibrary();

        await screen.findByText('Your library is ready');
        await userEvent.click(screen.getByRole('tab', { name: 'All files' }));

        expect(await screen.findByText('at /agent/test-agent/library?tab=all')).toBeInTheDocument();

        await waitFor(() => {
            expect(requests[requests.length - 1].searchParams.get('scope')).toBe('all');
        });
        expect(await screen.findByText('No files in this library yet')).toBeInTheDocument();

        // My files is the default scope, so selecting it drops the query param rather than adding tab=yours.
        await userEvent.click(screen.getByRole('tab', { name: 'My files' }));

        expect(await screen.findByText('at /agent/test-agent/library')).toBeInTheDocument();

        await waitFor(() => {
            expect(requests[requests.length - 1].searchParams.get('scope')).toBe('mine');
        });
        expect(await screen.findByText('Your library is ready')).toBeInTheDocument();
    });

    it('shows the shared empty state when opened on the shared tab', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([]);
            }),
        );

        renderLibrary('/agent/test-agent/library?tab=shared');

        expect(await screen.findByText('Nothing shared yet')).toBeInTheDocument();
        expect(requests[0].searchParams.get('scope')).toBe('shared');
    });

    it('sends the debounced search term and offers a reset from the filtered empty state', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([]);
            }),
        );

        renderLibrary();

        await screen.findByText('Your library is ready');
        await userEvent.type(screen.getByPlaceholderText('Search library'), 'brief');

        await waitFor(
            () => {
                expect(requests[requests.length - 1].searchParams.get('search')).toBe('brief');
            },
            { timeout: 3000 },
        );

        expect(await screen.findByText('No matching files')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }));

        expect(await screen.findByText('Your library is ready')).toBeInTheDocument();
    });

    it('deletes an owned file after confirmation', async () => {
        let deleteCalls = 0;

        server.use(
            respond('get', '/files', () => pagedEnvelope([rawFile()])),
            http.delete(apiUrl('/files/file-1'), () => {
                deleteCalls += 1;

                return envelope(null);
            }),
        );

        renderLibrary();

        await userEvent.click(await screen.findByRole('button', { name: 'Delete brief.pdf' }));

        const dialog = await screen.findByRole('alertdialog');

        expect(within(dialog).getByText('Delete file')).toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await waitFor(() => {
            expect(deleteCalls).toBe(1);
        });
        expect(await screen.findByText('Your library is ready')).toBeInTheDocument();
    });

    it('starts a chat with the selected files attached', async () => {
        server.use(respond('get', '/files', () => pagedEnvelope([rawFile()])));

        renderLibrary();

        await userEvent.click(await screen.findByRole('button', { name: 'Select brief.pdf' }));

        // The selection bar is rendered twice — once for the desktop header, once for mobile.
        expect(await screen.findAllByText('( 1 selected )')).toHaveLength(2);

        await userEvent.click(screen.getAllByRole('button', { name: 'Start chat' })[0]);

        expect(await screen.findByText('Chat home screen')).toBeInTheDocument();
    });
});
