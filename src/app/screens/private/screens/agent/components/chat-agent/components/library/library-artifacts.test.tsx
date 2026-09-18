import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LibraryScope } from '@/components/agent-chat/hooks/use-media-library';
import { installPointerCaptureShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { apiUrl, envelope, httpError, pagedEnvelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import LibraryContent from './library-content';
import type { LibraryContentProps } from './library-content';

installPointerCaptureShims();
installScrollIntoViewShim();

const USER_ID = 'user-1';
const AGENT_ID = 'agent-1';

const rawFile = (overrides: Record<string, unknown> = {}) => ({
    _id: 'file-1',
    agent_id: AGENT_ID,
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
    embedding_status: 'indexed',
    created_at: 1772000000000,
    updated_at: 1772000000000,
    ...overrides,
});

const rawArtifactHead = (overrides: Record<string, unknown> = {}) => ({
    artifact_id: 'conv-1:sales-report',
    agent_id: AGENT_ID,
    conversation_id: 'conv-1',
    slug: 'sales-report',
    title: 'Sales report',
    artifact_type: 'html',
    latest_version: 3,
    creator_id: USER_ID,
    last_author_kind: 'model',
    created_at: '2026-09-01T12:00:00.000Z',
    updated_at: '2026-09-08T12:00:00.000Z',
    ...overrides,
});

const rawArtifactVersion = (overrides: Record<string, unknown> = {}) => ({
    artifact_id: 'conv-1:sales-report',
    version_number: 3,
    title: 'Sales report',
    artifact_type: 'html',
    content: '<p>Quarterly revenue</p>',
    content_bytes: 24,
    author_kind: 'model',
    author_id: 'model-1',
    created_at: '2026-09-08T12:00:00.000Z',
    ...overrides,
});

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

const stubArtifacts = (heads: Record<string, unknown>[]) => {
    const requests: URL[] = [];

    server.use(
        http.get(apiUrl('/ai/artifacts'), ({ request }) => {
            requests.push(new URL(request.url));

            return envelope({ total: heads.length, items: heads });
        }),
    );

    return requests;
};

const stubArtifactVersions = (metas: Record<string, unknown>[]) => {
    server.use(http.get(apiUrl('/ai/artifacts/:artifactId/versions'), () => envelope(metas)));
};

const stubArtifactVersion = (version: Record<string, unknown> = rawArtifactVersion()) => {
    stubArtifactVersions([]);
    server.use(
        http.get(apiUrl('/ai/artifacts/:artifactId/versions/:versionNumber'), ({ params }) =>
            envelope({ ...version, version_number: Number(params.versionNumber) }),
        ),
    );
};

const rawArtifactVersionMeta = (versionNumber: number, overrides: Record<string, unknown> = {}) => ({
    artifact_id: 'conv-1:sales-report',
    version_number: versionNumber,
    title: 'Sales report',
    artifact_type: 'html',
    content_bytes: 24,
    author_kind: 'model',
    author_id: 'model-1',
    author_name: null,
    restored_from_version: null,
    created_at: '2026-09-08T12:00:00.000Z',
    ...overrides,
});

const rawArtifactFile = (overrides: Record<string, unknown> = {}) => ({
    _id: 'conv-1:sales-report',
    name: 'sales-report',
    extension: '.artifact',
    origin: 'artifact',
    creator_id: USER_ID,
    creator_name: null,
    is_public: false,
    likes: [],
    likes_count: 0,
    artifact_versions: [],
    ...overrides,
});

const stubArtifactFile = (overrides: Record<string, unknown> = {}) => {
    server.use(http.get(apiUrl('/files/:fileId'), () => envelope(rawArtifactFile(overrides))));
};

const openArtifact = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Open Sales report' }));

    return screen.findByRole('dialog');
};

const Harness = (props: Partial<LibraryContentProps>) => {
    const [scope, setScope] = useState<LibraryScope>('yours');

    return (
        <LibraryContent
            agentId={AGENT_ID}
            userId={USER_ID}
            title="Library"
            scope={scope}
            onScopeChange={setScope}
            showArtifacts
            agent={{ name: 'Test Agent', slug: 'test-agent' }}
            {...props}
        />
    );
};

const renderLibrary = (props: Partial<LibraryContentProps> = {}) =>
    renderWithProviders(<Harness {...props} />, { route: '/agent/test-agent/library' });

const openFilterMenu = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getAllByRole('button', { name: 'Filter library' })[0]);
};

describe('LibraryContent artifacts', () => {
    beforeEach(() => {
        stubArtifactFile();
    });

    it('lists an artifact with its title and type, and no version', async () => {
        stubFiles([]);
        const requests = stubArtifacts([rawArtifactHead()]);

        renderLibrary();

        expect(await screen.findByText('Sales report')).toBeInTheDocument();
        expect(screen.getByText(/^Web page · Sep \d+, 2026$/)).toBeInTheDocument();
        expect(screen.queryByText(/v3/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open Sales report' })).toBeInTheDocument();

        await waitFor(() => expect(requests).toHaveLength(1));
        expect(requests[0].searchParams.get('agentId')).toBe(AGENT_ID);
    });

    it('opens the artifact in a full-viewport lightbox without loosening the iframe sandbox', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();

        renderLibrary();

        const lightbox = await openArtifact(user);
        const frame = await waitFor(() => within(lightbox).getByTitle('Sales report'));

        expect(lightbox.className).toContain('fixed inset-0');
        expect(lightbox.className).toContain('bg-card');
        expect(lightbox.className).not.toContain('max-w-');
        expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
        expect(frame.getAttribute('srcdoc')).toContain('Quarterly revenue');
        expect(within(lightbox).getByRole('heading', { level: 4 })).toHaveTextContent('Sales report');
        expect(within(lightbox).getByText('sales-report.html')).toBeInTheDocument();
    });

    it('keeps the identity block on the left and every action on the right of the header', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();

        renderLibrary();

        const lightbox = await openArtifact(user);

        await waitFor(() => within(lightbox).getByTitle('Sales report'));

        const header = lightbox.firstElementChild as HTMLElement;

        expect(header.className).toContain('flex min-h-12 items-center justify-between gap-3');

        const [heading, actions] = [...header.children] as HTMLElement[];

        expect(within(heading).getByRole('heading', { level: 4 })).toHaveTextContent('Sales report');
        expect(within(heading).queryByRole('button')).not.toBeInTheDocument();
        expect(within(actions).getByRole('button', { name: 'Preview' })).toBeInTheDocument();
        expect(within(actions).getByRole('button', { name: 'Source' })).toBeInTheDocument();
        expect(within(actions).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
        expect(actions.lastElementChild).toHaveAttribute('aria-label', 'Close');
    });

    it('names the author, the file, the date and how it was authored under the title', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();
        stubArtifactVersions([rawArtifactVersionMeta(3, { author_name: 'Ada Lovelace' })]);

        renderLibrary();

        const lightbox = await openArtifact(user);
        const details = await waitFor(() => {
            const node = lightbox.querySelector('.library-artifact-lightbox-details');

            expect(node).not.toBeNull();

            return node as HTMLElement;
        });

        await waitFor(() => expect(details).toHaveTextContent('Ada Lovelace'));
        expect(details.textContent).toBe('Ada Lovelace·sales-report.html·Sep 8, 2026·Generated·Private');
        expect(within(details).queryByText('Web page')).not.toBeInTheDocument();
    });

    it('calls a user-authored artifact Edited', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead({ last_author_kind: 'user' })]);
        stubArtifactVersion();

        renderLibrary();

        const lightbox = await openArtifact(user);

        expect(await within(lightbox).findByText('Edited')).toBeInTheDocument();
    });

    it('leaves no dangling separator when the version carries no author', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();
        stubArtifactVersions([rawArtifactVersionMeta(3)]);

        renderLibrary();

        const lightbox = await openArtifact(user);
        const details = await waitFor(() => {
            const node = lightbox.querySelector('.library-artifact-lightbox-details');

            expect(node).not.toBeNull();

            return node as HTMLElement;
        });

        await waitFor(() => expect(details).toHaveTextContent('Private'));
        expect(details.textContent).toBe('sales-report.html·Sep 8, 2026·Generated·Private');
    });

    it('links Open chat from the lightbox at the conversation, and offers no visibility switch', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();

        renderLibrary();

        const lightbox = await openArtifact(user);

        expect(within(lightbox).getByRole('link', { name: 'Open chat' })).toHaveAttribute(
            'href',
            '/agent/test-agent/chat/conv-1?artifact=sales-report',
        );
        expect(within(lightbox).queryByRole('radiogroup')).not.toBeInTheDocument();
        expect(within(lightbox).queryByRole('button', { name: 'Public' })).not.toBeInTheDocument();
        expect(within(lightbox).queryByRole('switch')).not.toBeInTheDocument();
    });

    it('shows the Public chip when the artifact document is public', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();
        stubArtifactFile({ is_public: true });

        renderLibrary();

        const lightbox = await openArtifact(user);

        expect(await within(lightbox).findByText('Public')).toBeInTheDocument();
        expect(within(lightbox).queryByText('Private')).not.toBeInTheDocument();
    });

    it('shows the like control with the stored count and liked state', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();
        stubArtifactFile({ likes: [USER_ID], likes_count: 4 });

        renderLibrary();

        const lightbox = await openArtifact(user);
        const like = await within(lightbox).findByRole('button', { name: 'Unlike' });

        expect(like).toHaveAttribute('aria-pressed', 'true');
        expect(like).toHaveTextContent('4');
    });

    it('hides the like control for a non-creator on a private artifact', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead({ creator_id: 'user-2' })]);
        stubArtifactVersion();
        stubArtifactFile({ creator_id: 'user-2' });

        renderLibrary();

        const lightbox = await openArtifact(user);

        await within(lightbox).findByText('Private');

        expect(within(lightbox).queryByRole('button', { name: /^(Like|Unlike)$/ })).not.toBeInTheDocument();
    });

    it('still renders the artifact, without either decoration, when the file document cannot be read', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();
        server.use(http.get(apiUrl('/files/:fileId'), () => httpError(404, 'Not found')));

        renderLibrary();

        const lightbox = await openArtifact(user);

        await waitFor(() => within(lightbox).getByTitle('Sales report'));

        expect(within(lightbox).queryByText('Private')).not.toBeInTheDocument();
        expect(within(lightbox).queryByText('Public')).not.toBeInTheDocument();
        expect(within(lightbox).queryByRole('button', { name: /^(Like|Unlike)$/ })).not.toBeInTheDocument();
    });

    it('deletes from the lightbox, closing it before the confirmation', async () => {
        const user = userEvent.setup();
        const deleted: string[] = [];

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();
        server.use(
            http.delete(apiUrl('/ai/artifacts/:artifactId'), ({ params }) => {
                deleted.push(String(params.artifactId));

                return envelope(null);
            }),
        );

        renderLibrary();

        const lightbox = await openArtifact(user);

        await user.click(within(lightbox).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(document.querySelector('.library-artifact-lightbox')).toBeNull();
        });

        await user.click(await screen.findByRole('button', { name: 'Confirm' }));

        await waitFor(() => expect(deleted).toEqual(['conv-1:sales-report']));
    });

    it('offers no lightbox delete on an artifact someone else created', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead({ creator_id: 'user-2' })]);
        stubArtifactVersion();

        renderLibrary();

        const lightbox = await openArtifact(user);

        expect(within(lightbox).getByRole('button', { name: 'Close' })).toBeInTheDocument();
        expect(within(lightbox).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('switches the library preview between the rendered page and its source', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();

        renderLibrary();

        const lightbox = await openArtifact(user);

        await user.click(await within(lightbox).findByRole('button', { name: 'Source' }));

        expect(await within(lightbox).findByTestId('artifact-code')).toHaveTextContent('Quarterly revenue');
        expect(within(lightbox).queryByTitle('Sales report')).not.toBeInTheDocument();

        await user.click(within(lightbox).getByRole('button', { name: 'Preview' }));

        expect(await waitFor(() => within(lightbox).getByTitle('Sales report'))).toBeInTheDocument();
    });

    it('lists the versions behind the head, marking the newest Latest, and shows the one picked', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();
        stubArtifactVersions([rawArtifactVersionMeta(1), rawArtifactVersionMeta(3), rawArtifactVersionMeta(2)]);

        renderLibrary();

        const lightbox = await openArtifact(user);

        await user.click(await within(lightbox).findByRole('button', { name: /^Latest/ }));

        const items = await screen.findAllByRole('menuitem');

        expect(items).toHaveLength(3);
        expect(items[0]).toHaveTextContent('v3');
        expect(items[0]).toHaveTextContent('Latest');
        expect(items[0]).toHaveTextContent('Current');
        expect(items[2]).toHaveTextContent('v1');

        fireEvent.click(items[2]);

        expect(await within(lightbox).findByRole('button', { name: /^v1/ })).toBeInTheDocument();
    });

    it('offers the download beside Copy, named for the artifact type', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();

        renderLibrary();

        const lightbox = await openArtifact(user);

        await user.click(await within(lightbox).findByRole('button', { name: 'Copy options' }));

        const items = await screen.findAllByRole('menuitem');

        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent('Copy link');
        expect(items[1]).toHaveTextContent('Download as .html');
    });

    it('reads a failed version load out loud instead of leaving a blank panel', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersions([]);
        server.use(
            http.get(apiUrl('/ai/artifacts/:artifactId/versions/:versionNumber'), () =>
                httpError(500, 'The artifact store is unavailable'),
            ),
        );

        renderLibrary();

        const lightbox = await openArtifact(user);

        expect(await within(lightbox).findByRole('alert')).toHaveTextContent('The artifact store is unavailable');
    });

    it('closes the lightbox on Escape', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        stubArtifacts([rawArtifactHead()]);
        stubArtifactVersion();

        renderLibrary();

        await openArtifact(user);

        await user.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('reports a failed artifact fetch and still lists the files', async () => {
        stubFiles([rawFile()]);
        server.use(http.get(apiUrl('/ai/artifacts'), () => httpError(500, 'Artifacts are unavailable')));

        renderLibrary();

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
        expect(await screen.findByText('Artifacts are unavailable')).toBeInTheDocument();
    });

    it('still lists the artifacts when the file fetch fails', async () => {
        server.use(http.get(apiUrl('/files'), () => httpError(502, 'Files are unavailable')));
        stubArtifacts([rawArtifactHead()]);

        renderLibrary();

        expect(await screen.findByText('Sales report')).toBeInTheDocument();
        expect(await screen.findByText('Failed to fetch library. Please try again.')).toBeInTheDocument();
    });

    it('renders the file library untouched when the agent has no artifacts', async () => {
        stubFiles([rawFile()]);
        stubArtifacts([]);

        renderLibrary();

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
        expect(screen.queryByText('Your library is ready')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Open Sales report$/ })).not.toBeInTheDocument();
    });

    it('shows the empty state when neither files nor artifacts exist', async () => {
        stubFiles([]);
        stubArtifacts([]);

        renderLibrary();

        expect(await screen.findByText('Your library is ready')).toBeInTheDocument();
    });

    it('keeps the file-type filter working and drops artifacts while it narrows files', async () => {
        const user = userEvent.setup();
        const fileRequests = stubFiles([rawFile()]);

        stubArtifacts([rawArtifactHead()]);

        renderLibrary();

        expect(await screen.findByText('Sales report')).toBeInTheDocument();

        await openFilterMenu(user);
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Documents' }));

        await waitFor(() => {
            expect(fileRequests[fileRequests.length - 1].searchParams.get('type')).toBe('document');
        });
        await waitFor(() => expect(screen.queryByText('Sales report')).not.toBeInTheDocument());
        expect(screen.getByText('brief.pdf')).toBeInTheDocument();
    });

    it('filters down to one artifact type and hides the files', async () => {
        const user = userEvent.setup();

        stubFiles([rawFile()]);
        stubArtifacts([
            rawArtifactHead(),
            rawArtifactHead({
                artifact_id: 'conv-1:flow',
                slug: 'flow',
                title: 'Order flow',
                artifact_type: 'mermaid',
                latest_version: 1,
            }),
        ]);

        renderLibrary();

        expect(await screen.findByText('Order flow')).toBeInTheDocument();

        await openFilterMenu(user);
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Diagram' }));

        await waitFor(() => expect(screen.queryByText('brief.pdf')).not.toBeInTheDocument());
        expect(screen.getByText('Order flow')).toBeInTheDocument();
        expect(screen.queryByText('Sales report')).not.toBeInTheDocument();
    });

    it('searches artifact titles alongside the file search', async () => {
        const user = userEvent.setup();

        stubFiles([rawFile()]);
        stubArtifacts([rawArtifactHead()]);

        renderLibrary();

        expect(await screen.findByText('Sales report')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('Search library'), 'order');

        await waitFor(() => expect(screen.queryByText('Sales report')).not.toBeInTheDocument(), { timeout: 3000 });
    });

    it('lists artifacts in the list view with their type and updated date, and no version', async () => {
        const user = userEvent.setup();

        stubFiles([rawFile()]);
        stubArtifacts([rawArtifactHead()]);

        const { container } = renderLibrary();

        expect(await screen.findByText('Sales report')).toBeInTheDocument();

        await user.click(screen.getAllByRole('radio', { name: 'List view' })[0]);

        const row = await waitFor(() => {
            const node = container.querySelector('.library-artifact-row');

            expect(node).not.toBeNull();

            return node as HTMLElement;
        });

        expect(within(row).getByText('Web page')).toBeInTheDocument();
        expect(within(row).queryByText(/v3/)).not.toBeInTheDocument();
        expect(within(row).getByText(/Sep \d+, 2026/)).toBeInTheDocument();
        expect(container.querySelector('.library-file-row')).not.toBeNull();
    });

    it('asks for no artifacts on a library that does not enable them', async () => {
        stubFiles([rawFile()]);

        renderLibrary({ showArtifacts: false });

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Diagram' })).not.toBeInTheDocument();
    });

    it('leaves artifacts out of the shared scope', async () => {
        stubFiles([rawFile()]);

        renderLibrary({ scope: 'shared', onScopeChange: () => {} });

        expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
        expect(screen.queryByText('Sales report')).not.toBeInTheDocument();
    });

    describe('card actions', () => {
        let clickSpy: ReturnType<typeof vi.spyOn>;
        let downloads: { href: string; download: string }[];

        beforeEach(() => {
            downloads = [];
            clickSpy = vi
                .spyOn(HTMLAnchorElement.prototype, 'click')
                .mockImplementation(function click(this: HTMLAnchorElement) {
                    downloads.push({ href: this.href, download: this.download });
                });

            Object.defineProperty(window.URL, 'createObjectURL', {
                configurable: true,
                writable: true,
                value: () => 'blob:mock',
            });
            Object.defineProperty(window.URL, 'revokeObjectURL', {
                configurable: true,
                writable: true,
                value: () => {},
            });
        });

        afterEach(() => {
            clickSpy.mockRestore();
        });

        it('links Open chat straight at the conversation with the artifact pane open', async () => {
            stubFiles([]);
            stubArtifacts([rawArtifactHead()]);

            renderLibrary();

            const link = await screen.findByRole('link', { name: 'Open chat for Sales report' });

            expect(link).toHaveAttribute('href', '/agent/test-agent/chat/conv-1?artifact=sales-report');
        });

        it('downloads the latest version through the artifact version endpoint', async () => {
            const user = userEvent.setup();
            const versionRequests: URL[] = [];

            stubFiles([]);
            stubArtifacts([rawArtifactHead()]);
            server.use(
                http.get(apiUrl('/ai/artifacts/:artifactId/versions/:versionNumber'), ({ request, params }) => {
                    versionRequests.push(new URL(request.url));

                    return envelope({ ...rawArtifactVersion(), version_number: Number(params.versionNumber) });
                }),
            );

            renderLibrary();

            await user.click(await screen.findByRole('button', { name: 'Download Sales report' }));

            await waitFor(() => expect(downloads).toHaveLength(1));
            expect(downloads[0]).toEqual({ href: 'blob:mock', download: 'sales-report.html' });
            await waitFor(() => expect(versionRequests).toHaveLength(1));
            expect(versionRequests[0].pathname).toContain('/versions/3');
        });

        it('deletes an artifact you own and refetches the list', async () => {
            const user = userEvent.setup();
            const deleted: string[] = [];

            stubFiles([]);
            const requests = stubArtifacts([rawArtifactHead()]);

            server.use(
                http.delete(apiUrl('/ai/artifacts/:artifactId'), ({ params }) => {
                    deleted.push(String(params.artifactId));

                    return envelope(null);
                }),
            );

            renderLibrary();

            await user.click(await screen.findByRole('button', { name: 'Delete Sales report' }));
            await user.click(await screen.findByRole('button', { name: 'Confirm' }));

            await waitFor(() => expect(deleted).toEqual(['conv-1:sales-report']));
            await waitFor(() => expect(requests.length).toBeGreaterThan(1));
        });

        it('offers no delete on an artifact someone else created', async () => {
            stubFiles([]);
            stubArtifacts([rawArtifactHead({ creator_id: 'user-2' })]);

            renderLibrary();

            expect(await screen.findByRole('button', { name: 'Download Sales report' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Delete Sales report' })).not.toBeInTheDocument();
        });

        it('offers the same actions from the list row menu', async () => {
            const user = userEvent.setup();

            stubFiles([]);
            stubArtifacts([rawArtifactHead()]);

            renderLibrary();

            expect(await screen.findByText('Sales report')).toBeInTheDocument();

            await user.click(screen.getAllByRole('radio', { name: 'List view' })[0]);
            await user.click(await screen.findByRole('button', { name: 'Actions for Sales report' }));

            expect(await screen.findByRole('menuitem', { name: 'Open chat' })).toHaveAttribute(
                'href',
                '/agent/test-agent/chat/conv-1?artifact=sales-report',
            );
            expect(screen.getByRole('menuitem', { name: 'Download' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
        });

        it('offers no like and no selection tick, which artifacts cannot serve', async () => {
            stubFiles([]);
            stubArtifacts([rawArtifactHead()]);

            renderLibrary({ enableSelection: true });

            expect(await screen.findByText('Sales report')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Select Sales report' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Like Sales report/ })).not.toBeInTheDocument();
        });
    });
});
