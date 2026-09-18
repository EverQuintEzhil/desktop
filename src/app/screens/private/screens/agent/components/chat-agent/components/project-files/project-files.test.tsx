import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetDeletedProjectFileIdsForTests } from '@/components/agent-chat/hooks/use-projects';
import { ChatHostProvider, createFluentMindConversationAdapter } from '@/components/chat-host';
import type { ChatHost } from '@/components/chat-host';
import { appConversationApi } from '@/lib/api/app/conversation';
import { filesApi } from '@/lib/api/files-client';
import { apiUrl, envelope, failureEnvelope, filesUrl, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import ProjectFiles from './project-files';

const agent = {
    _id: 'agent-1',
    slug: 'test-agent',
    name: 'Test Agent',
    uiConfig: { componentType: 'chat', spaces: { enabled: true } },
} as unknown as ChatAgentType;

const chatHost = {
    session: { user: { id: 'user-1' }, tenant: { id: 'tenant-1' } },
    transport: {
        endpoint: '/chat',
        baseUrl: 'https://api.localhost',
        filesBaseUrl: 'https://files.localhost',
        fetch: globalThis.fetch,
    },
    navigation: { setConversationId: () => {}, startNewConversation: () => {} },
    conversations: createFluentMindConversationAdapter(appConversationApi, { agentId: 'agent-1' }),
} as unknown as ChatHost;

const rawProject = (overrides: Record<string, unknown> = {}) => ({
    _id: 'project-1',
    name: 'Marketing space',
    description: 'Campaign planning',
    instructions: '',
    members: [],
    creator: { _id: 'user-1', name: { first: 'Test', last: 'User' }, email: 'test@example.com' },
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-04T10:00:00.000Z',
    ...overrides,
});

const rawFile = (overrides: Record<string, unknown> = {}) => ({
    _id: 'file-1',
    name: 'brief.pdf',
    extension: 'pdf',
    mimeType: 'application/pdf',
    size: 2048,
    url: 'https://files.localhost/download/brief.pdf',
    embedding_status: 'indexed',
    created_at: '2026-03-02T10:00:00.000Z',
    ...overrides,
});

/** Everything `useProject` fans out to; individual tests override what they assert on. */
const stubProjectDetail = (project = rawProject(), files: Record<string, unknown>[] = []) => {
    server.use(
        respond('get', '/projects/project-1', () => envelope(project)),
        respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
        respond('get', '/conversations', () => pagedEnvelope([])),
        respond('get', '/files', () => pagedEnvelope(files)),
    );
};

const withHost = (children: ReactNode) => <ChatHostProvider value={chatHost}>{children}</ChatHostProvider>;

const renderProjectFiles = () =>
    renderWithProviders(
        withHost(
            <Routes>
                <Route path="/agent/:agentSlug/spaces/:projectId/files" element={<ProjectFiles agent={agent} />} />
                <Route path="/agent/:agentSlug/spaces" element={<div>Spaces list screen</div>} />
            </Routes>,
        ),
        { route: '/agent/test-agent/spaces/project-1/files' },
    );

describe('Space files page', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        resetDeletedProjectFileIdsForTests();
    });

    it('renders an empty shell while the space is still loading', async () => {
        server.use(
            respond('get', '/projects/project-1', async () => {
                await delay('infinite');

                return envelope(rawProject());
            }),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/conversations', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
        );

        const { container } = renderProjectFiles();

        expect(container.firstElementChild).toHaveClass('min-h-[60svh]');
        expect(container.firstElementChild).toBeEmptyDOMElement();
        expect(screen.queryByText('No knowledge yet')).not.toBeInTheDocument();
    });

    it('shows the empty state and the add-file affordance for an editor', async () => {
        stubProjectDetail();

        renderProjectFiles();

        expect(await screen.findByText('No knowledge yet')).toBeInTheDocument();
        expect(
            screen.getByText('Add PDFs, images, documents, or spreadsheets as references for this space.'),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add reference/ })).toBeInTheDocument();
    });

    it('lists the space files with their metadata', async () => {
        stubProjectDetail(rawProject(), [rawFile(), rawFile({ _id: 'file-2', name: 'photo.png', extension: 'png' })]);

        renderProjectFiles();

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
        expect(screen.getByText('photo.png')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Actions for brief.pdf' })).toBeInTheDocument();
    });

    it('pins the search bar under the tabs bar so it survives scrolling the list', async () => {
        stubProjectDetail(rawProject(), [rawFile()]);

        const { container } = renderProjectFiles();

        await screen.findByText('brief.pdf');

        const searchBar = container.querySelector('.project-files-search');

        expect(searchBar).toHaveClass('sticky');
        // Falls back to 0px on this standalone route, where no tabs bar publishes the offset.
        expect(searchBar).toHaveClass('top-[var(--space-tabs-h,0px)]');
    });

    it('shows who uploaded each reference, since search matches the creator name', async () => {
        stubProjectDetail(rawProject(), [rawFile({ creator_name: 'Ada Lovelace' })]);

        renderProjectFiles();

        await screen.findByText('brief.pdf');

        // Creator comes last, after type/size/date, with no trailing separator.
        expect(screen.getByText(/^PDF · 2\.0 KB · .+ · Ada Lovelace$/)).toBeInTheDocument();
    });

    it('leaves the creator out of the meta line when the API omits it', async () => {
        stubProjectDetail(rawProject(), [rawFile()]);

        renderProjectFiles();

        await screen.findByText('brief.pdf');

        // Type/size/date only — no empty segment or dangling separator.
        const meta = screen.getByText(/^PDF · 2\.0 KB · /);

        expect(meta.textContent?.split(' · ')).toHaveLength(3);
    });

    it('requests only the first page of files', async () => {
        const requests: URL[] = [];

        server.use(
            respond('get', '/projects/project-1', () => envelope(rawProject())),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/conversations', () => pagedEnvelope([])),
            http.get(apiUrl('/files'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([rawFile()], { page: 0, totalPages: 3, totalCount: 30 });
            }),
        );

        renderProjectFiles();

        await screen.findByText('brief.pdf');

        expect(requests).toHaveLength(1);
        expect(requests[0].searchParams.get('projectId')).toBe('project-1');
        expect(requests[0].searchParams.get('page')).toBe('0');
    });

    it('hides the knowledge search bar until the space has files to search', async () => {
        stubProjectDetail();

        renderProjectFiles();

        await screen.findByText('No knowledge yet');

        expect(screen.queryByPlaceholderText('Search knowledge')).not.toBeInTheDocument();
    });

    it('shows the knowledge search bar once the space has files', async () => {
        stubProjectDetail(rawProject(), [rawFile()]);

        renderProjectFiles();

        await screen.findByText('brief.pdf');

        expect(screen.getByPlaceholderText('Search knowledge')).toBeInTheDocument();
    });

    it('sends the typed search term to the files request', async () => {
        const user = userEvent.setup();
        const requests: URL[] = [];

        server.use(
            respond('get', '/projects/project-1', () => envelope(rawProject())),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/conversations', () => pagedEnvelope([])),
            http.get(apiUrl('/files'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([rawFile()]);
            }),
        );

        renderProjectFiles();

        await screen.findByText('brief.pdf');
        await user.type(screen.getByPlaceholderText('Search knowledge'), 'brief');

        await waitFor(
            () => {
                expect(requests.at(-1)?.searchParams.get('search')).toBe('brief');
            },
            { timeout: 3000 },
        );
        expect(requests.at(-1)?.searchParams.get('projectId')).toBe('project-1');
    });

    it('shows skeleton rows instead of the empty state while a search loads', async () => {
        const user = userEvent.setup();
        let requestCount = 0;

        server.use(
            respond('get', '/projects/project-1', () => envelope(rawProject())),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/conversations', () => pagedEnvelope([])),
            respond('get', '/files', async () => {
                requestCount += 1;
                // Hold the search response open; the first (unfiltered) load resolves normally.
                if (requestCount > 1) await delay('infinite');

                return pagedEnvelope([rawFile()]);
            }),
        );

        const { container } = renderProjectFiles();

        await screen.findByText('brief.pdf');
        await user.type(screen.getByPlaceholderText('Search knowledge'), 'brief');

        await waitFor(
            () => {
                expect(container.querySelector('.file-rows-skeleton')).toBeInTheDocument();
            },
            { timeout: 3000 },
        );
        expect(screen.queryByText('No matching files')).not.toBeInTheDocument();
        expect(screen.queryByText('No knowledge yet')).not.toBeInTheDocument();
    });

    it('refetches the search-filtered list after an upload so the new file is not stranded', async () => {
        const user = userEvent.setup();
        const searchRequests: URL[] = [];
        const uploaded = rawFile({ _id: 'file-uploaded-1', name: 'brief.pdf' });

        stubProjectDetail();
        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                const url = new URL(request.url);

                if (!url.searchParams.get('search')) return pagedEnvelope([rawFile()]);
                searchRequests.push(url);

                // The filtered list only picks the file up once the server has indexed it.
                return pagedEnvelope(searchRequests.length > 1 ? [uploaded] : []);
            }),
            respond('get', '/files/file-uploaded-1', () => envelope(uploaded)),
        );

        vi.spyOn(filesApi, 'upload').mockResolvedValue({
            data: {
                success: true,
                value: {
                    values: [
                        {
                            _id: uploaded._id,
                            name: uploaded.name,
                            url: uploaded.url,
                            size: uploaded.size,
                            mimeType: uploaded.mimeType,
                        },
                    ],
                },
            },
        } as never);

        const { container } = renderProjectFiles();

        await screen.findByText('brief.pdf');
        await user.type(screen.getByPlaceholderText('Search knowledge'), 'brief');
        await screen.findByText('No matching files');

        await user.upload(
            container.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement,
            new File(['%PDF-1.4'], 'brief.pdf', { type: 'application/pdf' }),
        );

        // The optimistic row lands on the unfiltered list only; the filtered one must refetch.
        await waitFor(
            () => {
                expect(searchRequests.length).toBeGreaterThan(1);
            },
            { timeout: 6000 },
        );
        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
        expect(screen.queryByText('No matching files')).not.toBeInTheDocument();
    }, 15000);

    it('keeps staged upload rows visible while a new search term loads', async () => {
        const user = userEvent.setup();
        let searchRequests = 0;

        server.use(
            respond('get', '/projects/project-1', () => envelope(rawProject())),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/conversations', () => pagedEnvelope([])),
            http.get(apiUrl('/files'), async ({ request }) => {
                if (new URL(request.url).searchParams.get('search')) {
                    searchRequests += 1;
                    await delay('infinite');
                }

                return pagedEnvelope([]);
            }),
        );

        // Left in flight on purpose: jsdom XHR + FormData carrying a File never completes under MSW.
        server.use(
            http.post(filesUrl('/upload'), async () => {
                await delay('infinite');

                return envelope({});
            }),
        );

        const { container } = renderProjectFiles();

        await screen.findByText('No knowledge yet');
        await user.upload(
            container.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement,
            new File(['%PDF-1.4'], 'brief.pdf', { type: 'application/pdf' }),
        );
        await screen.findByText('Uploading');

        await user.type(screen.getByPlaceholderText('Search knowledge'), 'brief');

        await waitFor(
            () => {
                expect(searchRequests).toBe(1);
            },
            { timeout: 3000 },
        );
        // The skeleton must not swallow the in-flight upload.
        expect(screen.getByText('brief.pdf')).toBeInTheDocument();
        expect(screen.getByText('Uploading')).toBeInTheDocument();
        expect(container.querySelector('.file-rows-skeleton')).not.toBeInTheDocument();
    });

    it('hides the editing affordances from a viewer', async () => {
        const user = userEvent.setup();

        stubProjectDetail(
            rawProject({
                members: [
                    {
                        _id: 'user-1',
                        name: { first: 'Test', last: 'User' },
                        email: 'test@example.com',
                        role: 'viewer',
                    },
                ],
            }),
            [rawFile()],
        );

        renderProjectFiles();

        await screen.findByText('brief.pdf');
        expect(screen.queryByRole('button', { name: /Add reference/ })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Actions for brief.pdf' }));

        expect(await screen.findByRole('menuitem', { name: 'Download' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('deletes a file through the row menu', async () => {
        const user = userEvent.setup();
        let deleteCalls = 0;

        stubProjectDetail(rawProject(), [rawFile()]);
        server.use(
            http.delete(apiUrl('/files/file-1'), () => {
                deleteCalls += 1;

                return envelope(null);
            }),
        );

        renderProjectFiles();

        await screen.findByText('brief.pdf');
        await user.click(screen.getByRole('button', { name: 'Actions for brief.pdf' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        await waitFor(() => {
            expect(deleteCalls).toBe(1);
        });
        await waitFor(() => {
            expect(screen.queryByText('brief.pdf')).not.toBeInTheDocument();
            expect(screen.getByText('No knowledge yet')).toBeInTheDocument();
        });
    });

    it('keeps a deleted file gone when the delayed upload merge still omits it from the list API', async () => {
        const user = userEvent.setup();
        const uploaded = rawFile({
            _id: 'file-uploaded-1',
            name: 'brief.pdf',
            embedding_status: 'document-converting',
        });

        stubProjectDetail();
        // List stays empty (indexing lag). Delete must still clear the optimistic row, and the
        // delayed merge must not resurrect it as localOnly.
        server.use(
            respond('get', '/files', () => pagedEnvelope([])),
            respond('get', '/files/file-uploaded-1', () => envelope(uploaded)),
            http.delete(apiUrl('/files/file-uploaded-1'), () => envelope(null)),
        );

        vi.spyOn(filesApi, 'upload').mockResolvedValue({
            data: {
                success: true,
                value: {
                    values: [
                        {
                            _id: uploaded._id,
                            name: uploaded.name,
                            url: uploaded.url,
                            size: uploaded.size,
                            mimeType: uploaded.mimeType,
                        },
                    ],
                },
            },
        } as never);

        const { container } = renderProjectFiles();

        await screen.findByText('No knowledge yet');

        const input = container.querySelector<HTMLInputElement>('input[type="file"]');

        await user.upload(input as HTMLInputElement, new File(['%PDF-1.4'], 'brief.pdf', { type: 'application/pdf' }));

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Actions for brief.pdf' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        await waitFor(() => {
            expect(screen.queryByText('brief.pdf')).not.toBeInTheDocument();
            expect(screen.getByText('No knowledge yet')).toBeInTheDocument();
        });

        // Drain the delayed upload merge (FILES_REFETCH_DELAY_MS).
        await new Promise((resolve) => {
            setTimeout(resolve, 3100);
        });
        expect(screen.queryByText('brief.pdf')).not.toBeInTheDocument();
        expect(screen.getByText('No knowledge yet')).toBeInTheDocument();
    }, 10000);

    it('stages a selected file with a cancel affordance', async () => {
        const user = userEvent.setup();

        stubProjectDetail();

        // The upload is deliberately left in flight: this asserts the staged row,
        // and jsdom XHR + FormData carrying a File never completes under MSW.
        server.use(
            http.post(filesUrl('/upload'), async () => {
                await delay('infinite');

                return envelope({});
            }),
        );

        const { container } = renderProjectFiles();

        await screen.findByText('No knowledge yet');

        const input = container.querySelector<HTMLInputElement>('input[type="file"]');

        await user.upload(input as HTMLInputElement, new File(['%PDF-1.4'], 'brief.pdf', { type: 'application/pdf' }));

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
        expect(screen.getByText('Uploading')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel upload for brief.pdf' })).toBeInTheDocument();
    });

    it('keeps the first uploaded file visible when the list API still returns empty', async () => {
        const user = userEvent.setup();
        const uploaded = rawFile({
            _id: 'file-uploaded-1',
            name: 'brief.pdf',
            embedding_status: 'document-converting',
        });

        stubProjectDetail();
        // Simulate indexing lag after upload: list stays empty even after invalidate.
        // Detail fetch covers embedding-status polling seeded from the upload response.
        server.use(
            respond('get', '/files', () => pagedEnvelope([])),
            respond('get', '/files/file-uploaded-1', () => envelope(uploaded)),
        );

        vi.spyOn(filesApi, 'upload').mockResolvedValue({
            data: {
                success: true,
                value: {
                    values: [
                        {
                            _id: uploaded._id,
                            name: uploaded.name,
                            url: uploaded.url,
                            size: uploaded.size,
                            mimeType: uploaded.mimeType,
                        },
                    ],
                },
            },
        } as never);

        const { container } = renderProjectFiles();

        await screen.findByText('No knowledge yet');

        const input = container.querySelector<HTMLInputElement>('input[type="file"]');

        await user.upload(input as HTMLInputElement, new File(['%PDF-1.4'], 'brief.pdf', { type: 'application/pdf' }));

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.queryByText('Uploading')).not.toBeInTheDocument();
            expect(screen.queryByText('No knowledge yet')).not.toBeInTheDocument();
        });
        expect(screen.getByText('brief.pdf')).toBeInTheDocument();

        // Drain the delayed list reconcile (FILES_REFETCH_DELAY_MS) so it cannot leak.
        await new Promise((resolve) => {
            setTimeout(resolve, 3100);
        });
        expect(screen.getByText('brief.pdf')).toBeInTheDocument();
        expect(screen.queryByText('No knowledge yet')).not.toBeInTheDocument();
    }, 10000);

    it('offers a retry when the space cannot be loaded', async () => {
        server.use(
            respond('get', '/projects/project-1', () => httpError(500)),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/conversations', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
        );

        renderProjectFiles();

        expect(await screen.findByText("Couldn't load this space")).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('treats a success:false envelope as a load failure', async () => {
        server.use(
            respond('get', '/projects/project-1', () => failureEnvelope('There is no such project with id project-1')),
            respond('get', '/projects/project-1/activities', () => pagedEnvelope([])),
            respond('get', '/conversations', () => pagedEnvelope([])),
            respond('get', '/files', () => pagedEnvelope([])),
        );

        renderProjectFiles();

        expect(await screen.findByText("Couldn't load this space")).toBeInTheDocument();
    });
});
