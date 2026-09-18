import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import type { DataStoreProviderFilter } from '@/lib/api/admin/data-stores';
import { buildDataStore } from '@/test/fixtures/data-stores';
import { apiUrl, envelope, httpError, rawPaged, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { UserType } from '@/types/admin';
import { showSuccessToast } from '@/utils';

import { FilesPickerModal } from './files-picker-modal';

// Sonner renders into a Toaster this suite never mounts, so the toast copy is only
// readable through the helper itself.
vi.mock('@/utils', async (importActual) => ({
    ...(await importActual<typeof import('@/utils')>()),
    showSuccessToast: vi.fn(),
}));

const listPath = '/datastores';

const store = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
    _id: id,
    name,
    description: `${name} description`,
    provider: 'mongodb',
    creator: { _id: 'user-1', name: { first: 'Test', last: 'User' } },
    ...overrides,
});

const stubList = (values: unknown[] = [store('ds-1', 'Orders DB')]) => {
    server.use(respond('get', listPath, () => envelope(rawPaged(values))));
};

interface RenderOptions {
    selectedFiles?: { _id: string; name: string; provider?: string }[];
    initialViewDataStoreId?: string | null;
    open?: boolean;
    providerFilter?: DataStoreProviderFilter;
    preloadedState?: Record<string, unknown>;
}

const renderModal = ({
    selectedFiles = [],
    initialViewDataStoreId = null,
    open = true,
    providerFilter = 'db',
    preloadedState,
}: RenderOptions = {}) => {
    const onClose = vi.fn();
    const onToggle = vi.fn();
    const onCreated = vi.fn();

    const view = renderWithProviders(
        <FilesPickerModal
            open={open}
            onClose={onClose}
            selectedFiles={selectedFiles}
            onToggle={onToggle}
            initialViewDataStoreId={initialViewDataStoreId}
            providerFilter={providerFilter}
            onCreated={onCreated}
        />,
        preloadedState ? { preloadedState } : undefined,
    );

    return {
        ...view,
        onClose,
        onToggle,
        onCreated,
    };
};

describe('FilesPickerModal', () => {
    it('renders nothing while closed', () => {
        stubList();
        renderModal({ open: false });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('lists the data stores returned for the provider grouping', async () => {
        stubList([store('ds-1', 'Orders DB'), store('ds-2', 'Users DB')]);
        renderModal();

        expect(await screen.findByRole('button', { name: /Orders DB/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Users DB/ })).toBeInTheDocument();
        expect(screen.getByText('Create a DB store')).toBeInTheDocument();
    });

    it('asks the API for the current provider grouping and page size', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl(listPath), ({ request }) => {
                requestUrl = request.url;

                return envelope(rawPaged([store('ds-1', 'Orders DB')]));
            }),
        );

        renderModal();

        await screen.findByRole('button', { name: /Orders DB/ });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('provider')).toBe('db');
        expect(params.get('size')).toBe('50');
        expect(params.get('page')).toBe('0');
        expect(params.has('search')).toBe(false);
    });

    it('shows an empty state when there are no data stores', async () => {
        stubList([]);
        renderModal();

        expect(await screen.findByText('No db stores found')).toBeInTheDocument();
        expect(screen.getByText("You don't have any db stores yet.")).toBeInTheDocument();
    });

    it('surfaces a server error in the list pane', async () => {
        server.use(respond('get', listPath, () => httpError(500)));
        renderModal();

        expect(await screen.findByText(/Request failed with status code 500/)).toBeInTheDocument();
    });

    it('surfaces a success:false envelope as the API message', async () => {
        server.use(
            respond('get', listPath, () =>
                Response.json({
                    success: false,
                    message: 'Data store service unavailable',
                    value: null,
                }),
            ),
        );
        renderModal();

        expect(await screen.findByText('Data store service unavailable')).toBeInTheDocument();
    });

    it('debounces the search box and sends the trimmed term', async () => {
        const user = userEvent.setup();
        const searches: (string | null)[] = [];

        server.use(
            http.get(apiUrl(listPath), ({ request }) => {
                searches.push(new URL(request.url).searchParams.get('search'));

                return envelope(rawPaged([store('ds-1', 'Orders DB')]));
            }),
        );

        renderModal();

        await screen.findByRole('button', { name: /Orders DB/ });
        await user.type(screen.getByLabelText('Search DB Stores'), '  orders  ');

        await waitFor(() => {
            expect(searches).toContain('orders');
        });
        expect(searches.filter((term) => term === 'orders')).toHaveLength(1);
    });

    it('clears the search box from the inline button', async () => {
        const user = userEvent.setup();

        stubList();
        renderModal();

        const input = await screen.findByLabelText('Search DB Stores');

        await user.type(input, 'orders');
        await user.click(screen.getByRole('button', { name: 'Clear search' }));

        expect(input).toHaveValue('');
    });

    it('separates already-selected stores under a Selected heading', async () => {
        stubList([store('ds-1', 'Orders DB'), store('ds-2', 'Users DB')]);
        renderModal({ selectedFiles: [{ _id: 'ds-1', name: 'Orders DB', provider: 'mongodb' }] });

        expect(await screen.findByText('Selected')).toBeInTheDocument();
        expect(screen.getByText('Available')).toBeInTheDocument();
    });

    it('opens the detail pane for a data store and fetches its details', async () => {
        const user = userEvent.setup();

        stubList();
        server.use(
            respond('get', '/datastores/ds-1', () =>
                envelope(
                    buildDataStore({
                        _id: 'ds-1',
                        name: 'Orders DB',
                        description: 'All the orders',
                        provider: 'mongodb',
                    }),
                ),
            ),
        );

        renderModal();

        await user.click(await screen.findByRole('button', { name: /Orders DB/ }));

        expect(await screen.findByText('All the orders')).toBeInTheDocument();
        expect(screen.getByText('MongoDB')).toBeInTheDocument();
        expect(screen.getByText('No tools')).toBeInTheDocument();
    });

    it('shows a detail error without losing the header', async () => {
        const user = userEvent.setup();

        stubList();
        server.use(respond('get', '/datastores/ds-1', () => httpError(500)));

        renderModal();

        await user.click(await screen.findByRole('button', { name: /Orders DB/ }));

        expect(await screen.findByText('Error loading details.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Orders DB' })).toBeInTheDocument();
    });

    it('opens straight into a detail pane when an initial data store is supplied', async () => {
        stubList();
        server.use(
            respond('get', '/datastores/ds-1', () =>
                envelope(
                    buildDataStore({
                        _id: 'ds-1',
                        name: 'Orders DB',
                        description: 'All the orders',
                    }),
                ),
            ),
        );

        renderModal({ initialViewDataStoreId: 'ds-1' });

        expect(await screen.findByRole('heading', { name: 'Orders DB' })).toBeInTheDocument();
    });

    it('enables an unselected store from the detail footer', async () => {
        const user = userEvent.setup();

        stubList();
        server.use(
            respond('get', '/datastores/ds-1', () =>
                envelope(
                    buildDataStore({
                        _id: 'ds-1',
                        name: 'Orders DB',
                        provider: 'mongodb',
                    }),
                ),
            ),
        );

        const { onToggle } = renderModal();

        await user.click(await screen.findByRole('button', { name: /Orders DB/ }));
        await user.click(await screen.findByRole('button', { name: 'Enable' }));

        expect(onToggle).toHaveBeenCalledWith({ _id: 'ds-1', name: 'Orders DB', provider: 'mongodb' });
    });

    it('offers Remove instead of Enable for an already selected store', async () => {
        const user = userEvent.setup();

        stubList();
        server.use(
            respond('get', '/datastores/ds-1', () => envelope(buildDataStore({ _id: 'ds-1', name: 'Orders DB' }))),
        );

        renderModal({ selectedFiles: [{ _id: 'ds-1', name: 'Orders DB' }] });

        await user.click((await screen.findAllByRole('button', { name: /Orders DB/ }))[0]);

        expect(await screen.findByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('deletes a data store the current user created and clears the detail pane', async () => {
        const user = userEvent.setup();
        let deleted = '';

        stubList();
        server.use(
            respond('get', '/datastores/ds-1', () => envelope(buildDataStore({ _id: 'ds-1', name: 'Orders DB' }))),
        );
        server.use(
            http.delete(apiUrl('/datastores/ds-1'), () => {
                deleted = 'ds-1';

                return envelope(null);
            }),
        );

        renderModal();

        await user.click(await screen.findByRole('button', { name: /Orders DB/ }));

        expect(await screen.findByRole('heading', { name: 'Orders DB' })).toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Data store actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Delete data store/ }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(deleted).toBe('ds-1');
        });
        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: 'Orders DB' })).not.toBeInTheDocument();
        });
        expect(await screen.findByText('Create a DB store')).toBeInTheDocument();
    });

    it('leaves the confirmation open and the store selected when the delete fails', async () => {
        const user = userEvent.setup();
        let attempts = 0;

        stubList();
        server.use(
            respond('get', '/datastores/ds-1', () => envelope(buildDataStore({ _id: 'ds-1', name: 'Orders DB' }))),
        );
        server.use(
            respond('delete', '/datastores/ds-1', () => {
                attempts += 1;

                return httpError(500);
            }),
        );

        const { onToggle } = renderModal();

        await user.click(await screen.findByRole('button', { name: /Orders DB/ }));
        await user.click(await screen.findByRole('button', { name: 'Data store actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Delete data store/ }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(attempts).toBe(1);
        });
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('hides the delete action for a store the user does not own', async () => {
        const user = userEvent.setup();

        stubList([store('ds-9', 'Shared DB', { creator: { _id: 'someone-else' } })]);
        server.use(
            respond('get', '/datastores/ds-9', () =>
                envelope(
                    buildDataStore({
                        _id: 'ds-9',
                        name: 'Shared DB',
                        creator: { _id: 'someone-else', name: { first: 'Other', last: 'Person' } } as UserType,
                    }),
                ),
            ),
        );

        renderModal();

        await user.click(await screen.findByRole('button', { name: /Shared DB/ }));

        await screen.findByRole('heading', { name: 'Shared DB' });
        expect(screen.queryByRole('button', { name: 'Data store actions' })).not.toBeInTheDocument();
    });

    it('hides the delete action from an admin who does not own the store', async () => {
        const user = userEvent.setup();

        stubList([store('ds-9', 'Shared DB', { creator: { _id: 'someone-else' } })]);
        server.use(
            respond('get', '/datastores/ds-9', () =>
                envelope(
                    buildDataStore({
                        _id: 'ds-9',
                        name: 'Shared DB',
                        creator: { _id: 'someone-else', name: { first: 'Other', last: 'Person' } } as UserType,
                    }),
                ),
            ),
        );

        renderModal({ preloadedState: { user: { _id: 'user-1', role: 'admin' } } });

        await user.click(await screen.findByRole('button', { name: /Shared DB/ }));

        await screen.findByRole('heading', { name: 'Shared DB' });
        expect(screen.queryByRole('button', { name: 'Data store actions' })).not.toBeInTheDocument();
    });

    it('opens the create panel from the sidebar action', async () => {
        const user = userEvent.setup();

        stubList();
        renderModal();

        await user.click(await screen.findByRole('button', { name: 'DB store' }));

        expect(await screen.findByText('Create a DB store')).toBeInTheDocument();
    });

    it('returns from a store detail pane to the create panel via Back', async () => {
        const user = userEvent.setup();

        stubList();
        server.use(
            respond('get', '/datastores/ds-1', () => envelope(buildDataStore({ _id: 'ds-1', name: 'Orders DB' }))),
        );

        renderModal();

        await user.click(await screen.findByRole('button', { name: /Orders DB/ }));

        expect(await screen.findByRole('heading', { name: 'Orders DB' })).toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Back' }));

        expect(await screen.findByText('Create a DB store')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Orders DB' })).not.toBeInTheDocument();
    });

    describe('create panel', () => {
        const openCreatePanel = async (
            user: ReturnType<typeof userEvent.setup>,
            options: RenderOptions & { addLabel: string },
        ) => {
            const { addLabel, ...renderOptions } = options;

            stubList();
            const view = renderModal(renderOptions);

            await user.click(await screen.findByRole('button', { name: addLabel }));

            return view;
        };

        const stubCreate = (build: () => Response) => {
            const bodies: unknown[] = [];

            server.use(
                http.post(apiUrl(listPath), async ({ request }) => {
                    bodies.push(await request.json());

                    return build();
                }),
            );

            return bodies;
        };

        it('derives the ref name from the typed name and creates a files store', async () => {
            const user = userEvent.setup();
            const bodies = stubCreate(() => envelope({ _id: 'ds-new', name: 'Product Docs' }));

            const { onCreated } = await openCreatePanel(user, {
                providerFilter: 'blob-storage',
                addLabel: 'Files store',
            });

            await user.type(screen.getByPlaceholderText('Product documentation'), 'Product Docs');

            expect(screen.getByPlaceholderText('product_documentation')).toHaveValue('product_docs');
            expect(screen.getByRole('heading', { name: 'Product Docs' })).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Create Files store' }));

            await waitFor(() => {
                expect(bodies).toEqual([{ provider: 'files', name: 'Product Docs', refName: 'product_docs' }]);
            });
            expect(onCreated).toHaveBeenCalledWith({
                _id: 'ds-new',
                name: 'Product Docs',
                description: undefined,
                provider: 'files',
            });
            expect(showSuccessToast).toHaveBeenCalledWith('Files store created successfully.');
        });

        it('stops deriving the ref name once the user edits it', async () => {
            const user = userEvent.setup();

            await openCreatePanel(user, { providerFilter: 'blob-storage', addLabel: 'Files store' });

            const refInput = screen.getByPlaceholderText('product_documentation');

            await user.type(refInput, 'custom_ref');
            await user.type(screen.getByPlaceholderText('Product documentation'), 'Product Docs');

            expect(refInput).toHaveValue('custom_ref');
        });

        it.each([
            ['has spaces', 'two words', 'Spaces are not allowed in the ref name.'],
            ['has uppercase', 'Docs', 'Ref name should not contain uppercase letters.'],
            ['has punctuation', 'docs-1', 'Ref name should not contain special characters except underscores.'],
            ['starts with a digit', '1docs', 'Ref name should not start with a number.'],
        ])('rejects a ref name that %s', async (_case, value, message) => {
            const user = userEvent.setup();

            await openCreatePanel(user, { providerFilter: 'blob-storage', addLabel: 'Files store' });

            await user.type(screen.getByPlaceholderText('product_documentation'), value);

            expect(await screen.findByText(message)).toBeInTheDocument();
        });

        it('shows the server message when the create fails, and clears it on the next edit', async () => {
            const user = userEvent.setup();

            stubCreate(() =>
                Response.json({ success: false, message: 'Ref name already taken', value: null }, { status: 409 }),
            );

            await openCreatePanel(user, { providerFilter: 'blob-storage', addLabel: 'Files store' });

            await user.type(screen.getByPlaceholderText('Product documentation'), 'Product Docs');
            await user.click(screen.getByRole('button', { name: 'Create Files store' }));

            expect(await screen.findByText('Ref name already taken')).toBeInTheDocument();

            await user.type(screen.getByPlaceholderText('Product documentation'), '!');

            await waitFor(() => {
                expect(screen.queryByText('Ref name already taken')).not.toBeInTheDocument();
            });
        });

        it('replaces a 500 with the generic internal-server copy', async () => {
            const user = userEvent.setup();

            stubCreate(() => httpError(500));

            await openCreatePanel(user, { providerFilter: 'blob-storage', addLabel: 'Files store' });

            await user.type(screen.getByPlaceholderText('Product documentation'), 'Product Docs');
            await user.click(screen.getByRole('button', { name: 'Create Files store' }));

            expect(await screen.findByText('Internal server error, Please try again.')).toBeInTheDocument();
        });

        it('blocks a web-links store until a link is filled in', async () => {
            const user = userEvent.setup();
            const bodies = stubCreate(() => envelope({ _id: 'ds-new', name: 'Docs site' }));

            await openCreatePanel(user, { providerFilter: 'weblinks', addLabel: 'Web Links store' });

            await user.type(screen.getByPlaceholderText('Product documentation'), 'Docs site');
            await user.click(screen.getByRole('button', { name: 'Create Web Links store' }));

            expect(await screen.findByText('Fix the highlighted link fields before continuing.')).toBeInTheDocument();

            await user.type(screen.getByPlaceholderText('https://example.com'), 'https://docs.example.com');
            await user.click(screen.getByRole('button', { name: 'Create Web Links store' }));

            await waitFor(() => expect(bodies).toHaveLength(1));
            expect(bodies[0]).toMatchObject({
                provider: 'weblinks',
                name: 'Docs site',
                refName: 'docs_site',
                specification: {
                    links: [{ url: 'https://docs.example.com', type: 'crawl', auth: 'none' }],
                },
            });
            expect(showSuccessToast).toHaveBeenCalledWith('Web Links store created successfully.');
        });

        it('adds and removes web-link rows', async () => {
            const user = userEvent.setup();

            await openCreatePanel(user, { providerFilter: 'weblinks', addLabel: 'Web Links store' });

            expect(screen.getAllByPlaceholderText('https://example.com')).toHaveLength(1);

            await user.click(screen.getByRole('button', { name: /Add link/ }));
            expect(screen.getAllByPlaceholderText('https://example.com')).toHaveLength(2);

            await user.click(screen.getAllByRole('button', { name: 'Remove link' })[0]);
            expect(screen.getAllByPlaceholderText('https://example.com')).toHaveLength(1);

            await user.click(screen.getByRole('button', { name: 'Remove link' }));
            expect(await screen.findByText('No links added yet.')).toBeInTheDocument();
        });

        it('rejects two web links that normalise to the same url', async () => {
            // Every keystroke re-renders and re-validates the whole link list, so the two URLs go in
            // via paste and with no inter-keystroke delay — typed character by character this test
            // exceeds the 5s timeout under a loaded suite.
            const user = userEvent.setup({ delay: null });

            await openCreatePanel(user, { providerFilter: 'weblinks', addLabel: 'Web Links store' });

            await user.type(screen.getByPlaceholderText('Product documentation'), 'Docs site');
            await user.click(screen.getAllByPlaceholderText('https://example.com')[0]);
            await user.paste('https://docs.example.com');
            await user.click(screen.getByRole('button', { name: /Add link/ }));
            await user.click(screen.getAllByPlaceholderText('https://example.com')[1]);
            await user.paste('https://docs.example.com/');

            await user.click(screen.getByRole('button', { name: 'Create Web Links store' }));

            expect(await screen.findByText('Each URL must be unique within this data store.')).toBeInTheDocument();
        });
    });

    it('closes from the header close button', async () => {
        const user = userEvent.setup();

        stubList();
        const { onClose } = renderModal();

        await user.click(await screen.findByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalled();
    });
});
