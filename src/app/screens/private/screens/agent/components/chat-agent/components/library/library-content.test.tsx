import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LibraryItem, LibraryScope } from '@/components/agent-chat/hooks/use-media-library';
import { installPointerCaptureShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { apiUrl, envelope, filesUrl, pagedEnvelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import LibraryContent from './library-content';
import type { LibraryContentProps, PreviewIntent } from './library-content';

// The entity-filter selects are Radix popovers wrapping cmdk lists.
installPointerCaptureShims();
installScrollIntoViewShim();

const USER_ID = 'user-1';

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
    creator_id: USER_ID,
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

const secondFile = (overrides: Record<string, unknown> = {}) =>
    rawFile({
        _id: 'file-2',
        name: 'mockup.png',
        extension: 'png',
        type: 'image',
        ...overrides,
    });

/** `totalPages` stays 1: jsdom reports offsetWidth 0, so the virtualizer would auto-fetch page 2. */
const stubFiles = (files: Record<string, unknown>[]) => {
    const requests: URL[] = [];

    server.use(
        http.get(apiUrl('/files'), ({ request }) => {
            requests.push(new URL(request.url));

            return pagedEnvelope(files, { page: 0, totalPages: 1, totalCount: files.length });
        }),
    );

    return requests;
};

/** Both catalogs the entity filters read. */
const stubEntityCatalogs = () => {
    const requests: URL[] = [];

    server.use(
        http.get(apiUrl('/agents'), ({ request }) => {
            requests.push(new URL(request.url));

            return pagedEnvelope([{ _id: 'agent-2', name: 'Research agent' }]);
        }),
        http.get(apiUrl('/projects'), ({ request }) => {
            requests.push(new URL(request.url));

            return pagedEnvelope([{ _id: 'project-1', name: 'Marketing space' }]);
        }),
    );

    return requests;
};

/** Drives `scope` from state so the tab click actually switches the list. */
const Harness = (props: Partial<LibraryContentProps>) => {
    const [scope, setScope] = useState<LibraryScope>('all');

    return <LibraryContent userId={USER_ID} title="Library" scope={scope} onScopeChange={setScope} {...props} />;
};

/** Stands in for a URL-backed consumer that owns the open file id. */
const ControlledHarness = (props: Partial<LibraryContentProps>) => (
    <LibraryContent userId={USER_ID} title="Library" scope="all" onScopeChange={() => {}} {...props} />
);

const renderContent = (props: Partial<LibraryContentProps> = {}) =>
    renderWithProviders(
        <>
            <Routes>
                <Route path="/agent/:agentSlug/library" element={<Harness {...props} />} />
            </Routes>
            <Toaster />
        </>,
        { route: '/agent/test-agent/library' },
    );

/**
 * Once a selection is active the whole card also answers to `Select <name>`, so the
 * checkbox affordance is the first match — it is rendered above the open button.
 */
const select = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click((await screen.findAllByRole('button', { name: `Select ${name}` }))[0]);
};

/** `LibraryPreviewContent` streams the file itself; jsdom has no object-url support. */
const stubPreviewFetch = () => {
    server.use(
        http.get(filesUrl('/download/:name'), () =>
            HttpResponse.arrayBuffer(new ArrayBuffer(8), { headers: { 'Content-Type': 'application/pdf' } }),
        ),
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
};

/**
 * ARIA prohibits name-from-content for `role="combobox"`, so each entity trigger carries an
 * explicit `aria-label` — the filter name on its own, or `"<filter>: <selection>"` once one
 * is chosen. Matching on the prefix covers both.
 */
const entitySelectTriggers = (label: string) =>
    screen.queryAllByRole('combobox', { name: new RegExp(`^${label}(:|$)`) });

/** The header actions render twice — once for the desktop bar, once for the mobile one. */
const firstHeaderControl = (role: string, name: string) => screen.getAllByRole(role, { name })[0];

describe('LibraryContent', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('offers no selection bar when selection is disabled', async () => {
        stubFiles([rawFile()]);

        renderContent();

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Select brief.pdf' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
    });

    it('counts the selection, selects all, and clears it again', async () => {
        const user = userEvent.setup();

        stubFiles([rawFile(), secondFile()]);
        renderContent({ enableSelection: true });

        await select(user, 'brief.pdf');

        // The selection bar renders twice — once for the desktop header, once for mobile.
        expect(await screen.findAllByText('( 1 selected )')).toHaveLength(2);

        await user.click(screen.getAllByRole('checkbox', { name: 'Select all files' })[0]);

        expect(await screen.findAllByText('( 2 selected )')).toHaveLength(2);

        await user.click(screen.getAllByRole('button', { name: 'Clear selection' })[0]);

        await waitFor(() => expect(screen.queryByText('( 2 selected )')).not.toBeInTheDocument());
        expect(screen.getAllByRole('button', { name: 'Select brief.pdf' })).toHaveLength(1);
    });

    it('drops the selection when the search term changes', async () => {
        const user = userEvent.setup();

        stubFiles([rawFile()]);
        renderContent({ enableSelection: true });

        await select(user, 'brief.pdf');
        expect(await screen.findAllByText('( 1 selected )')).toHaveLength(2);

        await user.type(screen.getByPlaceholderText('Search library'), 'brief');

        await waitFor(() => expect(screen.queryByText('( 1 selected )')).not.toBeInTheDocument(), { timeout: 3000 });
    });

    it('zips a multi-file selection through the bulk download endpoint', async () => {
        const user = userEvent.setup();
        let downloadUrl = '';

        stubFiles([rawFile(), secondFile()]);
        server.use(
            http.get(filesUrl('/download/multiple'), ({ request }) => {
                downloadUrl = request.url;

                return HttpResponse.arrayBuffer(new ArrayBuffer(8), { headers: { 'Content-Type': 'application/zip' } });
            }),
        );

        renderContent({ enableSelection: true });

        await select(user, 'brief.pdf');
        await select(user, 'mockup.png');
        await user.click(screen.getAllByRole('button', { name: 'Download selected files' })[0]);

        expect(await screen.findByText('Downloaded 2 files')).toBeInTheDocument();
        expect(new URL(downloadUrl).searchParams.get('fileIds')).toBe('file-1,file-2');
    });

    it('deletes every owned file in the selection after one confirmation', async () => {
        const user = userEvent.setup();
        const deleted: string[] = [];

        stubFiles([rawFile(), secondFile()]);
        server.use(
            http.delete(apiUrl('/files/:id'), ({ params }) => {
                deleted.push(params.id as string);

                return envelope(null);
            }),
        );

        renderContent({ enableSelection: true });

        await select(user, 'brief.pdf');
        await select(user, 'mockup.png');
        await user.click(screen.getAllByRole('button', { name: 'Delete selected files' })[0]);

        const dialog = await screen.findByRole('alertdialog');

        expect(within(dialog).getByText('Delete 2 files')).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await waitFor(() => expect(deleted).toEqual(['file-1', 'file-2']));
        expect(await screen.findByText('No files in this library yet')).toBeInTheDocument();
    });

    it('refuses a bulk delete that contains only files somebody else owns', async () => {
        const user = userEvent.setup();
        const deleted: string[] = [];

        // Only `brief.pdf` belongs to somebody else; `mockup.png` is owned and stays deletable.
        stubFiles([rawFile({ creator_id: 'user-2', creator_name: 'Ada' }), secondFile()]);
        server.use(
            http.delete(apiUrl('/files/:id'), ({ params }) => {
                deleted.push(params.id as string);

                return envelope(null);
            }),
        );

        renderContent({ enableSelection: true });

        await select(user, 'brief.pdf');

        const deleteButton = (await screen.findAllByRole('button', { name: 'Delete selected files' }))[0];

        expect(deleteButton).toBeDisabled();

        // A deliberate write against the same recorder, so the list below means "not called for file-1".
        await user.click(screen.getAllByRole('button', { name: 'Clear selection' })[0]);
        await user.click(await screen.findByRole('button', { name: 'Delete mockup.png' }));
        await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));

        await waitFor(() => expect(deleted).toEqual(['file-2']));
    });

    it('hands the selected items to the start-chat callback and clears the selection', async () => {
        const user = userEvent.setup();
        const started: LibraryItem[][] = [];

        stubFiles([rawFile()]);
        renderContent({ enableSelection: true, onStartChat: (items) => started.push(items) });

        await select(user, 'brief.pdf');
        await user.click((await screen.findAllByRole('button', { name: 'Start chat' }))[0]);

        await waitFor(() => expect(started).toHaveLength(1));
        expect(started[0].map((item) => item._id)).toEqual(['file-1']);
        expect(screen.queryByText('( 1 selected )')).not.toBeInTheDocument();
    });

    it('switches to the list view and back', async () => {
        const user = userEvent.setup();

        stubFiles([rawFile()]);

        const { container } = renderContent();

        await screen.findByText('brief.pdf');
        expect(container.querySelector('.library-file-row')).toBeNull();

        // The view toggle is a Radix ToggleGroup, so its items are radios, not buttons.
        await user.click(firstHeaderControl('radio', 'List view'));

        await waitFor(() => expect(container.querySelector('.library-file-row')).not.toBeNull());

        await user.click(firstHeaderControl('radio', 'Grid view'));

        await waitFor(() => expect(container.querySelector('.library-file-row')).toBeNull());
    });

    it('opens the preview with the file details and a private badge', async () => {
        const user = userEvent.setup();

        stubFiles([rawFile()]);
        stubPreviewFetch();
        renderContent();

        await user.click(await screen.findByRole('button', { name: 'Open brief.pdf' }));

        const dialog = await screen.findByRole('dialog');

        expect(within(dialog).getByText('PDF')).toBeInTheDocument();
        expect(within(dialog).getByText('2.0 KB')).toBeInTheDocument();
        expect(within(dialog).getByText('Uploaded')).toBeInTheDocument();

        // 'Private' also labels the visibility toggle, so pin the badge to the details chip.
        const privateBadge = within(dialog)
            .getAllByText('Private')
            .filter((node) => !node.closest('[role="radio"]'));

        expect(privateBadge).toHaveLength(1);
        expect(within(dialog).getByRole('radio', { name: 'Private' })).toHaveAttribute('data-state', 'on');
        expect(within(dialog).getByRole('button', { name: 'Open in new tab' })).toBeInTheDocument();
    });

    it('names the generating model in the preview of a generated file', async () => {
        const user = userEvent.setup();

        stubFiles([rawFile({ ai: { generated: true, model_name: 'Imagen 4' } })]);
        stubPreviewFetch();
        renderContent();

        await user.click(await screen.findByRole('button', { name: 'Open brief.pdf' }));

        expect(await screen.findByText('Generated · Imagen 4')).toBeInTheDocument();
    });

    it('opens the file in a new tab from the preview', async () => {
        const user = userEvent.setup();
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);

        stubFiles([rawFile()]);
        stubPreviewFetch();
        renderContent();

        await user.click(await screen.findByRole('button', { name: 'Open brief.pdf' }));
        await user.click(await screen.findByRole('button', { name: 'Open in new tab' }));

        expect(open).toHaveBeenCalledWith('https://files.localhost/download/brief.pdf', '_blank', 'noopener');
    });

    it('flips the file to public from the preview switch', async () => {
        const user = userEvent.setup();
        const bodies: unknown[] = [];

        stubFiles([rawFile()]);
        server.use(
            http.put(apiUrl('/files/file-1'), async ({ request }) => {
                bodies.push(await request.json());

                return envelope({ _id: 'file-1' });
            }),
        );
        stubPreviewFetch();

        renderContent();

        await user.click(await screen.findByRole('button', { name: 'Open brief.pdf' }));

        const dialog = await screen.findByRole('dialog');

        await user.click(within(dialog).getByRole('radio', { name: 'Public' }));

        await waitFor(() => expect(bodies).toEqual([{ isPublic: true }]));
        await waitFor(() =>
            expect(within(dialog).getByRole('radio', { name: 'Public' })).toHaveAttribute('data-state', 'on'),
        );

        // The details chip flips too, and it is the only 'Public' outside the toggle.
        expect(
            within(dialog)
                .getAllByText('Public')
                .filter((node) => !node.closest('[role="radio"]')),
        ).toHaveLength(1);
    });

    it('closes the preview and opens the delete confirmation from its trash action', async () => {
        const user = userEvent.setup();
        let deleteCalls = 0;

        stubFiles([rawFile()]);
        server.use(
            http.delete(apiUrl('/files/file-1'), () => {
                deleteCalls += 1;

                return envelope(null);
            }),
        );
        stubPreviewFetch();

        renderContent();

        await user.click(await screen.findByRole('button', { name: 'Open brief.pdf' }));
        await user.click(await screen.findByRole('button', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog');

        expect(within(dialog).getByText('Delete file')).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await waitFor(() => expect(deleteCalls).toBe(1));
        expect(await screen.findByText('No files in this library yet')).toBeInTheDocument();
    });

    /**
     * A file still being embedded is re-fetched every 10s through the single-file endpoint, which
     * resolves less than the list does. Merging that payload used to blank `agentSlug`/`agentName`,
     * so the agent link vanished from the card mid-session.
     */
    it('keeps the agent link when the embedding poll re-fetches a file', async () => {
        const polled: URL[] = [];

        stubFiles([rawFile({ embedding_status: 'processing' })]);

        // Answer the poll without the agent fields, the way the single-file endpoint does.
        server.use(
            http.get(apiUrl('/files/file-1'), ({ request }) => {
                polled.push(new URL(request.url));

                const withoutAgent: Record<string, unknown> = {
                    ...rawFile({ embedding_status: 'processing', name: 'brief-renamed.pdf' }),
                };

                delete withoutAgent.agent_name;
                delete withoutAgent.agent_slug;

                return envelope(withoutAgent);
            }),
        );

        renderContent();

        expect(await screen.findByRole('link', { name: /Test Agent/ })).toBeInTheDocument();

        await waitFor(() => expect(polled.length).toBeGreaterThan(0));
        expect(polled[0].searchParams.get('resolveAgent')).toBe('true');

        // The renamed file proves the poll result was merged in; the agent link must have survived it.
        await waitFor(() => expect(screen.getByText('brief-renamed.pdf')).toBeInTheDocument());
        expect(screen.getByRole('link', { name: /Test Agent/ })).toBeInTheDocument();
    });

    /**
     * With Radix's default automatic activation, focus alone selects a tab — so arrow keys and
     * the focus that follows a click each fired a scope change, and each one cost a history entry.
     */
    it('does not switch scope when a tab merely takes focus', async () => {
        stubFiles([rawFile()]);
        renderContent();

        // The harness starts on 'All files', so focus one of the other tabs.
        const shared = await screen.findByRole('tab', { name: 'Shared with me' });

        fireEvent.focus(shared);
        fireEvent.keyDown(shared, { key: 'ArrowLeft' });

        await waitFor(() =>
            expect(screen.getByRole('tab', { name: 'All files' })).toHaveAttribute('aria-selected', 'true'),
        );
        expect(shared).toHaveAttribute('aria-selected', 'false');
    });

    it('follows a controlled preview id, including one that arrives from the URL', async () => {
        const user = userEvent.setup();
        const changes: Array<[string | null, PreviewIntent]> = [];

        stubFiles([rawFile()]);
        stubPreviewFetch();

        const { rerender } = renderWithProviders(
            <ControlledHarness previewId={null} onPreviewChange={(id, intent) => changes.push([id, intent])} />,
            { route: '/settings/library?tab=all' },
        );

        await user.click(await screen.findByRole('button', { name: 'Open brief.pdf' }));

        // A controlled consumer owns the id, so nothing opens until it comes back as a prop.
        expect(changes).toEqual([['file-1', 'open']]);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        rerender(<ControlledHarness previewId="file-1" onPreviewChange={() => {}} />);
        expect(await screen.findByRole('dialog')).toBeInTheDocument();

        // A Back that drops the id closes the preview.
        rerender(<ControlledHarness previewId={null} onPreviewChange={() => {}} />);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    // The file name renders twice in the dialog (sr-only DialogTitle + visible header span).
    const previewTitle = (dialog: HTMLElement, name: string) => within(dialog).getByText(name, { selector: 'span' });

    it('steps between the filtered files with the preview arrows and arrow keys', async () => {
        const user = userEvent.setup();

        stubFiles([rawFile(), secondFile()]);
        stubPreviewFetch();
        renderContent();

        await user.click(await screen.findByRole('button', { name: 'Open brief.pdf' }));

        const dialog = await screen.findByRole('dialog');

        expect(previewTitle(dialog, 'brief.pdf')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Previous file' })).toBeDisabled();

        await user.click(within(dialog).getByRole('button', { name: 'Next file' }));
        expect(previewTitle(dialog, 'mockup.png')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Next file' })).toBeDisabled();

        await user.keyboard('{ArrowLeft}');
        expect(previewTitle(dialog, 'brief.pdf')).toBeInTheDocument();
    });

    it('continues past the last loaded file into the next page', async () => {
        const user = userEvent.setup();
        const pageTwoFile = rawFile({ _id: 'file-3', name: 'roadmap.pdf' });

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                const page = Number(new URL(request.url).searchParams.get('page') ?? 0);

                return pagedEnvelope(page === 0 ? [rawFile()] : [pageTwoFile], { page, totalPages: 2, totalCount: 2 });
            }),
        );
        stubPreviewFetch();
        renderContent();

        await user.click(await screen.findByRole('button', { name: 'Open brief.pdf' }));

        const dialog = await screen.findByRole('dialog');

        await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Next file' })).toBeEnabled());
        await user.click(within(dialog).getByRole('button', { name: 'Next file' }));

        await waitFor(() => expect(previewTitle(dialog, 'roadmap.pdf')).toBeInTheDocument());
    });

    it('drops a pending page-boundary advance when the user navigates away first', async () => {
        const user = userEvent.setup();
        const pageTwoFile = rawFile({ _id: 'file-3', name: 'roadmap.pdf' });
        let releasePageTwo = () => {};
        const pageTwoGate = new Promise<void>((resolve) => {
            releasePageTwo = resolve;
        });

        server.use(
            http.get(apiUrl('/files'), async ({ request }) => {
                const page = Number(new URL(request.url).searchParams.get('page') ?? 0);

                if (page === 0) {
                    return pagedEnvelope([rawFile(), secondFile()], { page, totalPages: 2, totalCount: 3 });
                }
                await pageTwoGate;

                return pagedEnvelope([pageTwoFile], { page, totalPages: 2, totalCount: 3 });
            }),
        );
        stubPreviewFetch();
        renderContent();

        await user.click(await screen.findByRole('button', { name: 'Open mockup.png' }));

        const dialog = await screen.findByRole('dialog');

        await user.click(within(dialog).getByRole('button', { name: 'Next file' }));
        await user.keyboard('{ArrowLeft}');
        expect(previewTitle(dialog, 'brief.pdf')).toBeInTheDocument();

        releasePageTwo();
        // The grid is aria-hidden behind the Radix dialog, so the landed card needs hidden: true.
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Open roadmap.pdf', hidden: true })).toBeInTheDocument(),
        );

        // The late page must not yank the preview off the file the user backed up to.
        expect(previewTitle(dialog, 'brief.pdf')).toBeInTheDocument();
    });

    it('offers Open chat in the preview only for an owned file that has a conversation', async () => {
        const user = userEvent.setup();
        const opened: string[] = [];

        stubFiles([
            rawFile({ origin: { conversation_id: 'conv-1' } }),
            secondFile({ creator_id: 'user-2', origin: { conversation_id: 'conv-2' } }),
        ]);
        stubPreviewFetch();
        renderContent({ onOpenChat: (item) => opened.push(item._id) });

        await user.click(await screen.findByRole('button', { name: 'Open mockup.png' }));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Open chat' })).not.toBeInTheDocument();

        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        await user.click(await screen.findByRole('button', { name: 'Open brief.pdf' }));
        await user.click(await screen.findByRole('button', { name: 'Open chat' }));

        expect(opened).toEqual(['file-1']);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('reads both entity catalogs and puts the chosen agent on the files request', async () => {
        const user = userEvent.setup();
        const fileRequests = stubFiles([]);
        const catalogRequests = stubEntityCatalogs();

        renderContent({ showEntityFilters: true });

        await screen.findByText('No files in this library yet');
        await waitFor(() => expect(catalogRequests).toHaveLength(1));
        expect(catalogRequests[0].pathname).toBe('/agents');
        expect(catalogRequests[0].searchParams.get('mineOnly')).toBe('true');
        expect(catalogRequests[0].searchParams.get('size')).toBe('100');

        // The spaces select only appears once an agent narrows the list.
        expect(entitySelectTriggers('All Spaces')).toHaveLength(0);

        await user.click(entitySelectTriggers('All Agents')[0]);
        await user.click(await screen.findByRole('option', { name: 'Research agent' }));

        await waitFor(() => {
            expect(fileRequests[fileRequests.length - 1].searchParams.get('agentId')).toBe('agent-2');
        });
        await waitFor(() => expect(catalogRequests.some((url) => url.pathname === '/projects')).toBe(true));
        await waitFor(() => expect(entitySelectTriggers('All Spaces').length).toBeGreaterThan(0));

        // The chosen agent has to reach the accessible name, not just the visible text.
        expect(screen.getAllByRole('combobox', { name: 'All Agents: Research agent' }).length).toBeGreaterThan(0);
    });

    it('hides the entity filters when the screen does not ask for them', async () => {
        stubFiles([]);

        renderContent();

        await screen.findByText('No files in this library yet');
        expect(entitySelectTriggers('All Agents')).toHaveLength(0);
    });

    it('re-sorts the list through the sort menu', async () => {
        const user = userEvent.setup();
        const requests = stubFiles([rawFile()]);

        renderContent();

        await screen.findByText('brief.pdf');

        // The trigger is labelled with the active sort, not the word 'Sort'.
        await user.click(firstHeaderControl('button', 'Most recent'));
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Oldest' }));

        await waitFor(() => {
            expect(requests[requests.length - 1].searchParams.get('sortBy')).toBe('updated_at:asc');
        });
    });

    it('exposes the title info action only when the screen supplies a handler', async () => {
        const user = userEvent.setup();
        const clicks: number[] = [];

        stubFiles([]);
        renderContent({ onTitleInfoClick: () => clicks.push(1) });

        await user.click(await screen.findByRole('button', { name: 'Open library details' }));

        expect(clicks).toEqual([1]);
    });

    it('scopes the request to the agent and its origin types when both are supplied', async () => {
        const requests = stubFiles([]);

        renderContent({ agentId: 'agent-9', originTypes: ['chat', 'space'] });

        await screen.findByText('No files in this library yet');

        expect(requests).toHaveLength(1);
        expect(requests[0].searchParams.get('agentId')).toBe('agent-9');
        expect(requests[0].searchParams.getAll('originTypes')).toEqual(['chat', 'space']);
        expect(requests[0].searchParams.get('resolveAgent')).toBe('true');
        expect(requests[0].searchParams.get('size')).toBe('20');
    });

    it('surfaces the fetch error and recovers on a scope change', async () => {
        const user = userEvent.setup();
        let calls = 0;

        server.use(
            http.get(apiUrl('/files'), () => {
                calls += 1;

                return calls === 1
                    ? HttpResponse.json({ success: false, message: 'nope', value: null }, { status: 500 })
                    : pagedEnvelope([rawFile()], { page: 0, totalPages: 1, totalCount: 1 });
            }),
        );

        renderContent();

        expect(await screen.findByText('Failed to fetch library. Please try again.')).toBeInTheDocument();

        await user.click(screen.getByRole('tab', { name: 'My files' }));

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
    });

    /**
     * Deliberately empty: in container mode the grid virtualizes against the scroll element,
     * whose clientHeight is always 0 under jsdom, so no rows would ever render.
     */
    it('lets the content region own its scroll in container mode', async () => {
        stubFiles([]);

        const { container } = renderContent({ scrollMode: 'container' });

        await screen.findByText('No files in this library yet');
        expect(container.querySelector('.library-content')).toHaveClass('scrollbar-vertical');
    });

    it('leaves the scroll to the window in the default mode', async () => {
        stubFiles([]);

        const { container } = renderContent();

        await screen.findByText('No files in this library yet');
        expect(container.querySelector('.library-content')).not.toHaveClass('scrollbar-vertical');
    });
});
