import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, filesUrl, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import ProjectOriginFiles from './project-origin-files';

const rawOriginFile = (overrides: Record<string, unknown> = {}) => ({
    _id: 'file-1',
    name: 'brief.pdf',
    title: 'brief.pdf',
    extension: 'pdf',
    type: 'document',
    url: 'https://files.localhost/download/brief.pdf',
    meta: { size: 2048 },
    embedding_status: 'indexed',
    created_at: '2026-03-02T10:00:00.000Z',
    origin: { type: 'chat', project_id: 'project-1' },
    ...overrides,
});

const renderOriginFiles = () => renderWithProviders(<ProjectOriginFiles projectId="project-1" agentId="agent-1" />);

describe('Space origin files tab', () => {
    it('lists the files that originated in this space', async () => {
        server.use(
            respond('get', '/files', () =>
                pagedEnvelope([
                    rawOriginFile(),
                    rawOriginFile({
                        _id: 'file-2',
                        name: 'photo.png',
                        title: 'photo.png',
                        extension: 'png',
                    }),
                ]),
            ),
        );

        renderOriginFiles();

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
        expect(screen.getByText('photo.png')).toBeInTheDocument();
    });

    it('shows who uploaded each file, since search matches the creator name', async () => {
        server.use(respond('get', '/files', () => pagedEnvelope([rawOriginFile({ creator_name: 'Ada Lovelace' })])));

        renderOriginFiles();

        await screen.findByText('brief.pdf');

        expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    });

    it('keeps the creator visible in the preview the row opens', async () => {
        const user = userEvent.setup();

        server.use(
            respond('get', '/files', () => pagedEnvelope([rawOriginFile({ creator_name: 'Ada Lovelace' })])),
            // The preview streams the file itself; the bytes are irrelevant to this assertion.
            http.get(
                filesUrl('/download/brief.pdf'),
                () =>
                    new Response('%PDF-1.4', {
                        headers: { 'Content-Type': 'application/pdf' },
                    }),
            ),
        );

        renderOriginFiles();

        await user.click(await screen.findByRole('button', { name: /brief\.pdf/ }));

        // Row meta plus the preview chip — the lightbox must not drop what the row showed.
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getAllByText(/Ada Lovelace/)).toHaveLength(2);
    });

    it('filters the request by the space chats', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([rawOriginFile()]);
            }),
        );

        renderOriginFiles();

        await screen.findByText('brief.pdf');

        expect(requests).toHaveLength(1);
        expect(requests[0].searchParams.get('projectChatId')).toBe('project-1');
        expect(requests[0].searchParams.get('agentId')).toBe('agent-1');
        expect(requests[0].searchParams.get('projectId')).toBeNull();
        expect(requests[0].searchParams.get('originProjectId')).toBeNull();
        expect(requests[0].searchParams.getAll('originTypes')).toEqual([
            'chat',
            'gallery',
            'skill',
            'app',
            'user',
            'datastore',
        ]);
        expect(requests[0].searchParams.getAll('originTypes')).not.toContain('project');
        expect(requests[0].searchParams.get('page')).toBe('0');
    });

    it('shows the empty state when nothing originated here', async () => {
        server.use(respond('get', '/files', () => pagedEnvelope([])));

        renderOriginFiles();

        expect(await screen.findByText('No files yet')).toBeInTheDocument();
        expect(
            screen.getByText(
                'Files uploaded or generated in this space appear here, including the ones from its chats.',
            ),
        ).toBeInTheDocument();
    });

    it('hides the search bar until there are files to search', async () => {
        server.use(respond('get', '/files', () => pagedEnvelope([])));

        renderOriginFiles();

        await screen.findByText('No files yet');

        expect(screen.queryByPlaceholderText('Search files')).not.toBeInTheDocument();
    });

    it('shows the search bar once files exist', async () => {
        server.use(respond('get', '/files', () => pagedEnvelope([rawOriginFile()])));

        renderOriginFiles();

        await screen.findByText('brief.pdf');

        expect(screen.getByPlaceholderText('Search files')).toBeInTheDocument();
    });

    it('sends the typed search term to the files request', async () => {
        const user = userEvent.setup();
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([rawOriginFile()]);
            }),
        );

        renderOriginFiles();

        await screen.findByText('brief.pdf');
        await user.type(screen.getByPlaceholderText('Search files'), 'brief');

        await waitFor(
            () => {
                expect(requests.at(-1)?.searchParams.get('search')).toBe('brief');
            },
            { timeout: 3000 },
        );
        expect(requests.at(-1)?.searchParams.get('projectChatId')).toBe('project-1');
    });

    it('keeps the search box and explains the miss when nothing matches', async () => {
        const user = userEvent.setup();
        let requestCount = 0;

        server.use(
            http.get(apiUrl('/files'), () => {
                requestCount += 1;

                return pagedEnvelope(requestCount === 1 ? [rawOriginFile()] : []);
            }),
        );

        renderOriginFiles();

        await screen.findByText('brief.pdf');
        await user.type(screen.getByPlaceholderText('Search files'), 'nope');

        expect(await screen.findByText('No matching files')).toBeInTheDocument();
        expect(screen.getByText('No files in this space match "nope".')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search files')).toBeInTheDocument();
    });

    it('pins the search bar under the tabs bar so it survives scrolling the list', async () => {
        server.use(respond('get', '/files', () => pagedEnvelope([rawOriginFile()])));

        const { container } = renderOriginFiles();

        await screen.findByText('brief.pdf');

        const searchBar = container.querySelector('.project-origin-files-search');

        expect(searchBar).toHaveClass('sticky');
        expect(searchBar).toHaveClass('top-[var(--space-tabs-h,0px)]');
    });

    it('renders skeleton rows while the files load', async () => {
        server.use(
            respond('get', '/files', async () => {
                await delay('infinite');

                return pagedEnvelope([]);
            }),
        );

        const { container } = renderOriginFiles();

        expect(container.querySelectorAll('li')).toHaveLength(4);
        expect(screen.queryByText('No files yet')).not.toBeInTheDocument();
    });
});
