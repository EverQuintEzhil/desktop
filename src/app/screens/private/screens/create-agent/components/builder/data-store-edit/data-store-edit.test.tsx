import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';
import { apiUrl, envelope, failureEnvelope, httpError, rawPaged, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { DataStoreType } from '@/types/admin';

import { DataStoreEdit } from './data-store-edit';

installPointerCaptureShims();

/**
 * The three provider bodies (`DataStoreFiles` 793 lines, `DataStoresWebLinks`,
 * `DataExplorerStep`) are admin-console components with their own endpoints and
 * their own tests. None of them is a `src/lib/api/` module, so stubbing them
 * keeps the MSW-only network rule intact while leaving everything this shell
 * actually owns — the detail fetch, the header, the permission gates and the
 * delete flow — running for real. The stubs capture their props so the
 * `canUserEdit` gate and the store they receive stay assertable.
 */
const childProps = vi.hoisted(() => ({
    files: null as Record<string, unknown> | null,
    weblinks: null as Record<string, unknown> | null,
    explorer: null as Record<string, unknown> | null,
}));

vi.mock(
    '@/admin/screens/private/screens/admin/components/data-stores/components/data-stores-detail/components/data-stores-files/data-store-files',
    () => ({
        default: (props: Record<string, unknown>) => {
            childProps.files = props;
            const renderLibraryImport = props.renderLibraryImport as
                | ((slot: { onImportFiles: (files: File[]) => void }) => React.ReactNode)
                | undefined;

            return (
                <div data-testid="data-store-files-stub">
                    files body
                    {renderLibraryImport?.({ onImportFiles: () => {} })}
                </div>
            );
        },
    }),
);

vi.mock(
    '@/admin/screens/private/screens/admin/components/data-stores/components/data-stores-detail/components/data-stores-web-links',
    () => ({
        default: (props: Record<string, unknown>) => {
            childProps.weblinks = props;

            return <div data-testid="web-links-stub">web links body</div>;
        },
    }),
);

vi.mock(
    '@/admin/screens/private/screens/admin/components/data-stores/components/wizard-pages/data-explorer-step',
    () => ({
        DataExplorerStep: (props: Record<string, unknown>) => {
            childProps.explorer = props;

            return <div data-testid="data-explorer-stub">explorer body</div>;
        },
    }),
);

/**
 * `okfStatus` is deliberately terminal: `useDataStoreByIdQuery` sets a
 * `refetchInterval` while the status is `pending`/`generating`, and a polling
 * query outlives its own test and gets blamed on the next one.
 */
const store = (overrides: Partial<DataStoreType> = {}): DataStoreType =>
    ({
        _id: 'ds-1',
        name: 'Product Docs',
        provider: 'files',
        refName: 'product_docs',
        okfStatus: 'completed',
        creator: {
            _id: 'user-1',
            name: { first: 'Test', last: 'User' },
        },
        ...overrides,
    }) as unknown as DataStoreType;

const stubStore = (value: DataStoreType = store()) => {
    server.use(respond('get', '/datastores/ds-1', () => envelope(value)));
};

const renderEdit = (
    props: Partial<Parameters<typeof DataStoreEdit>[0]> = {},
    preloadedState?: Record<string, unknown>,
) => {
    const onBack = vi.fn();
    const onDeleted = vi.fn();
    const onUpdated = vi.fn();

    const view = renderWithProviders(
        <>
            <DataStoreEdit
                dataStoreId="ds-1"
                onBack={onBack}
                onDeleted={onDeleted}
                onUpdated={onUpdated}
                agentName="Research Bot"
                {...props}
            />
            <Toaster />
        </>,
        preloadedState ? { preloadedState } : undefined,
    );

    return {
        ...view,
        onBack,
        onDeleted,
        onUpdated,
    };
};

const openActionsMenu = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Data store actions' }));
};

const openDeleteDialog = async (user: ReturnType<typeof userEvent.setup>) => {
    await openActionsMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: /Delete data store/ }));

    return screen.findByRole('alertdialog');
};

const openMenuItemDialog = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
    await openActionsMenu(user);
    await user.click(await screen.findByRole('menuitem', { name }));

    return screen.findByRole('dialog');
};

describe('DataStoreEdit', () => {
    // The files body's library-import slot mounts `LibraryImportModal`, which
    // primes its file list up front even while the dialog is shut.
    beforeEach(() => {
        server.use(respond('get', '/files', () => envelope(rawPaged([]))));
    });

    it('renders the loading skeleton until the store arrives', async () => {
        stubStore();
        renderEdit();

        expect(screen.getByLabelText('Loading data store')).toBeInTheDocument();

        expect(await screen.findAllByText('Product Docs')).not.toHaveLength(0);
    });

    it('renders the metabar, title and category breadcrumb for a loaded store', async () => {
        stubStore();
        renderEdit();

        expect(await screen.findAllByText('Product Docs')).not.toHaveLength(0);
        expect(screen.getByText('Files')).toBeInTheDocument();
        expect(screen.getByText('product_docs')).toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('Files Stores')).toBeInTheDocument();
        expect(screen.getByText('Research Bot')).toBeInTheDocument();
    });

    it('falls back to a generic title and drops the creator when the payload is minimal', async () => {
        server.use(
            respond('get', '/datastores/ds-1', () => envelope({ _id: 'ds-1', provider: 'files', refName: 'bare' })),
        );
        renderEdit();

        expect(await screen.findByText('Data store')).toBeInTheDocument();
        expect(screen.queryByText('Test User')).not.toBeInTheDocument();
    });

    it('renders the error branch on an HTTP 500', async () => {
        server.use(respond('get', '/datastores/ds-1', () => httpError(500)));
        renderEdit();

        expect(await screen.findByText("Couldn't load data store")).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
    });

    it('renders the error branch on a success:false envelope', async () => {
        server.use(respond('get', '/datastores/ds-1', () => failureEnvelope('Data store service unavailable')));
        renderEdit();

        expect(await screen.findByText("Couldn't load data store")).toBeInTheDocument();
    });

    it('goes back from the error state', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/datastores/ds-1', () => httpError(500)));
        const { onBack } = renderEdit();

        await user.click(await screen.findByRole('button', { name: 'Go back' }));

        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('recovers when Try again refetches successfully', async () => {
        const user = userEvent.setup();
        let attempt = 0;

        server.use(
            respond('get', '/datastores/ds-1', () => {
                attempt += 1;

                return attempt === 1 ? httpError(500) : envelope(store());
            }),
        );
        renderEdit();

        await user.click(await screen.findByRole('button', { name: /Try again/ }));

        expect(await screen.findAllByText('Product Docs')).not.toHaveLength(0);
    });

    it('requests the store by id', async () => {
        let requestUrl: URL | null = null;

        server.use(
            http.get(apiUrl('/datastores/ds-1'), ({ request }) => {
                requestUrl = new URL(request.url);

                return envelope(store());
            }),
        );
        renderEdit();

        await screen.findAllByText('Product Docs');

        expect((requestUrl as unknown as URL).pathname).toBe('/datastores/ds-1');
    });

    it('renders the files body for a files-backed store and locks editing to the creator', async () => {
        stubStore();
        renderEdit();

        expect(await screen.findByTestId('data-store-files-stub')).toBeInTheDocument();
        expect(childProps.files?.canUserEdit).toBe(true);
        expect((childProps.files?.dataStore as DataStoreType)._id).toBe('ds-1');
    });

    it('supplies the library-import affordance to the files body', async () => {
        stubStore();
        renderEdit();

        await screen.findByTestId('data-store-files-stub');

        expect(screen.getByRole('button', { name: /Import from library/ })).toBeInTheDocument();
    });

    it('denies editing to a non-creator', async () => {
        stubStore(
            store({
                creator: { _id: 'someone-else', name: { first: 'Ada', last: 'Lovelace' } },
            } as Partial<DataStoreType>),
        );
        renderEdit();

        await screen.findByTestId('data-store-files-stub');

        expect(childProps.files?.canUserEdit).toBe(false);
    });

    it('renders the web-links tabs for a weblinks store and switches to the explorer', async () => {
        const user = userEvent.setup();

        stubStore(store({ provider: 'weblinks', name: 'Docs Crawl' } as Partial<DataStoreType>));
        renderEdit();

        expect(await screen.findByTestId('web-links-stub')).toBeInTheDocument();
        expect(screen.getByText('Web Links Stores')).toBeInTheDocument();

        await user.click(screen.getByRole('tab', { name: 'Data Explorer' }));

        expect(await screen.findByTestId('data-explorer-stub')).toBeInTheDocument();
    });

    it('renders the explorer directly for a database-backed store', async () => {
        stubStore(store({ provider: 'postgresql', name: 'Sales DB' } as Partial<DataStoreType>));
        renderEdit();

        expect(await screen.findByTestId('data-explorer-stub')).toBeInTheDocument();
        expect(screen.getByText('DB Stores')).toBeInTheDocument();
        expect(screen.queryByTestId('data-store-files-stub')).not.toBeInTheDocument();
    });

    it('labels an api-backed store as an API store', async () => {
        stubStore(store({ provider: 'api', name: 'Weather API' } as Partial<DataStoreType>));
        renderEdit();

        expect(await screen.findByText('API Stores')).toBeInTheDocument();
    });

    it('returns to the builder from the header back button', async () => {
        const user = userEvent.setup();

        stubStore();
        const { onBack } = renderEdit();

        await screen.findAllByText('Product Docs');
        await user.click(screen.getByRole('button', { name: 'Back to builder' }));

        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('hides the actions menu from an admin who did not create the store', async () => {
        stubStore(
            store({
                creator: { _id: 'someone-else', name: { first: 'Ada', last: 'Lovelace' } },
            } as Partial<DataStoreType>),
        );
        renderEdit({}, { user: { _id: 'user-1', role: 'admin' } });

        await screen.findByTestId('data-store-files-stub');

        expect(screen.queryByRole('button', { name: 'Data store actions' })).not.toBeInTheDocument();
    });

    it('offers the actions menu to the creator', async () => {
        stubStore();
        renderEdit();

        expect(await screen.findByRole('button', { name: 'Data store actions' })).toBeInTheDocument();
    });

    it('hides the actions menu from a plain user who did not create the store', async () => {
        stubStore(
            store({
                creator: { _id: 'someone-else', name: { first: 'Ada', last: 'Lovelace' } },
            } as Partial<DataStoreType>),
        );
        renderEdit();

        await screen.findByTestId('data-store-files-stub');

        expect(screen.queryByRole('button', { name: 'Data store actions' })).not.toBeInTheDocument();
    });

    it('deletes the store and reports the deleted id back', async () => {
        const user = userEvent.setup();
        const writes: string[] = [];

        stubStore();
        server.use(
            http.delete(apiUrl('/datastores/ds-1'), ({ request }) => {
                writes.push(`DELETE ${new URL(request.url).pathname}`);

                return envelope({ deleted: true });
            }),
        );

        const { onDeleted, onBack } = renderEdit();

        await screen.findAllByText('Product Docs');

        const dialog = await openDeleteDialog(user);

        expect(within(dialog).getByText(/Product Docs/)).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(onDeleted).toHaveBeenCalledWith('ds-1');
        });

        expect(onBack).not.toHaveBeenCalled();
        expect(writes).toEqual(['DELETE /datastores/ds-1']);
        expect(await screen.findByText('Data store deleted successfully.')).toBeInTheDocument();
    });

    it('falls back to onBack when no onDeleted handler is supplied', async () => {
        const user = userEvent.setup();

        stubStore();
        server.use(respond('delete', '/datastores/ds-1', () => envelope({ deleted: true })));

        const { onBack } = renderEdit({ onDeleted: undefined });

        await screen.findAllByText('Product Docs');

        const dialog = await openDeleteDialog(user);

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(onBack).toHaveBeenCalledTimes(1);
        });
    });

    it('stops refetching the detail while a delete is in flight, then resumes on a later mount', async () => {
        const user = userEvent.setup();
        const detailRequests: string[] = [];
        const deleteGate: { release: (() => void) | null } = { release: null };

        server.use(
            http.get(apiUrl('/datastores/ds-1'), () => {
                detailRequests.push('GET /datastores/ds-1');

                return envelope(store());
            }),
        );
        server.use(
            http.delete(apiUrl('/datastores/ds-1'), async () => {
                await new Promise<void>((resolve) => {
                    deleteGate.release = resolve;
                });

                return HttpResponse.json({ success: true, value: { deleted: true } });
            }),
        );

        const { queryClient, onDeleted } = renderEdit();

        await screen.findAllByText('Product Docs');
        expect(detailRequests).toHaveLength(1);

        const dialog = await openDeleteDialog(user);

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        // The detail query is disabled while `isDeleting`, so invalidating it is a no-op…
        await waitFor(() => {
            expect(screen.getByLabelText('Loading data store')).toBeInTheDocument();
        });
        await queryClient.invalidateQueries({ queryKey: ['admin', 'data-stores'] });
        expect(detailRequests).toHaveLength(1);

        deleteGate.release?.();
        await waitFor(() => {
            expect(onDeleted).toHaveBeenCalledWith('ds-1');
        });

        // …and the same recorder does reach the endpoint again for a fresh consumer,
        // so the count above means "suppressed", not "never wired up".
        await queryClient.fetchQuery({
            queryKey: ['admin', 'data-stores', 'detail', 'ds-1', 'probe'],
            queryFn: async () => {
                const response = await fetch(apiUrl('/datastores/ds-1'));

                return response.json();
            },
        });
        expect(detailRequests).toHaveLength(2);
    });

    it('surfaces the backend message and restores the page when the delete fails', async () => {
        const user = userEvent.setup();

        stubStore();
        server.use(
            http.delete(apiUrl('/datastores/ds-1'), () =>
                HttpResponse.json({ success: false, message: 'Data store is in use', value: null }, { status: 409 }),
            ),
        );

        const { onDeleted } = renderEdit();

        await screen.findAllByText('Product Docs');

        const dialog = await openDeleteDialog(user);

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('Data store is in use')).toBeInTheDocument();
        expect(onDeleted).not.toHaveBeenCalled();
        expect(await screen.findByTestId('data-store-files-stub')).toBeInTheDocument();
    });

    it('closes the confirmation without deleting when Cancel is used', async () => {
        const user = userEvent.setup();
        const writes: string[] = [];

        stubStore();
        server.use(
            http.delete(apiUrl('/datastores/ds-1'), () => {
                writes.push('DELETE /datastores/ds-1');

                return envelope({ deleted: true });
            }),
        );

        renderEdit();

        await screen.findAllByText('Product Docs');

        const dialog = await openDeleteDialog(user);

        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

        await waitFor(() => {
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        });

        // The cancel wrote nothing; the deliberate delete that follows uses the same
        // recorder, so the single entry proves the cancel really was a no-op.
        await user.click(
            await openDeleteDialog(user).then((next) => within(next).getByRole('button', { name: 'Delete' })),
        );

        await waitFor(() => {
            expect(writes).toEqual(['DELETE /datastores/ds-1']);
        });
    });

    describe('edit affordances', () => {
        const dbStore = () =>
            store({ provider: 'postgresql', name: 'Sales DB', refName: 'sales_db' } as Partial<DataStoreType>);

        it('offers the store edit but no connection edit for a files store', async () => {
            const user = userEvent.setup();

            stubStore();
            renderEdit();

            await screen.findAllByText('Product Docs');
            await openActionsMenu(user);

            expect(await screen.findByRole('menuitem', { name: /Edit data store/ })).toBeInTheDocument();
            expect(screen.queryByRole('menuitem', { name: /Edit connection/ })).not.toBeInTheDocument();
        });

        it('offers the store edit but no connection edit for a weblinks store', async () => {
            const user = userEvent.setup();

            stubStore(store({ provider: 'weblinks', name: 'Docs Crawl' } as Partial<DataStoreType>));
            renderEdit();

            await screen.findByTestId('web-links-stub');
            await openActionsMenu(user);

            expect(await screen.findByRole('menuitem', { name: /Edit data store/ })).toBeInTheDocument();
            expect(screen.queryByRole('menuitem', { name: /Edit connection/ })).not.toBeInTheDocument();
        });

        it('offers both edits for a database-backed store', async () => {
            const user = userEvent.setup();

            stubStore(dbStore());
            renderEdit();

            await screen.findAllByText('Sales DB');
            await openActionsMenu(user);

            expect(await screen.findByRole('menuitem', { name: /Edit data store/ })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: /Edit connection/ })).toBeInTheDocument();
        });

        it('keeps every action away from an admin who did not create the store', async () => {
            stubStore(
                store({
                    provider: 'postgresql',
                    name: 'Sales DB',
                    creator: { _id: 'someone-else', name: { first: 'Ada', last: 'Lovelace' } },
                } as Partial<DataStoreType>),
            );
            renderEdit({}, { user: { _id: 'user-1', role: 'admin' } });

            await screen.findAllByText('Sales DB');

            expect(screen.queryByRole('button', { name: 'Data store actions' })).not.toBeInTheDocument();
        });

        it('offers the delete alongside the edits for the creator', async () => {
            const user = userEvent.setup();

            stubStore(dbStore());
            renderEdit();

            await screen.findAllByText('Sales DB');
            await openActionsMenu(user);

            expect(await screen.findByRole('menuitem', { name: /Delete data store/ })).toBeInTheDocument();
        });

        it('puts the edited name, description and ref name, and reports the rename back', async () => {
            const user = userEvent.setup();
            let body: Record<string, unknown> = {};

            stubStore(dbStore());
            server.use(
                http.put(apiUrl('/datastores/ds-1'), async ({ request }) => {
                    body = (await request.json()) as Record<string, unknown>;

                    return envelope({ ...dbStore(), name: 'Sales Warehouse' });
                }),
            );

            const { onUpdated } = renderEdit();

            await screen.findAllByText('Sales DB');

            const dialog = await openMenuItemDialog(user, /Edit data store/);

            await user.clear(within(dialog).getByLabelText('Name *'));
            await user.type(within(dialog).getByLabelText('Name *'), 'Sales Warehouse');
            await user.type(within(dialog).getByPlaceholderText(/Briefly describe/), 'Nightly sales rollup');
            await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

            expect(await screen.findByText('Data store updated successfully.')).toBeInTheDocument();
            expect(body).toEqual({
                name: 'Sales Warehouse',
                refName: 'sales_warehouse',
                description: 'Nightly sales rollup',
            });
            expect(onUpdated).toHaveBeenCalledWith({ _id: 'ds-1', name: 'Sales Warehouse' });
            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
        });

        it('does not report a rename when the update fails', async () => {
            const user = userEvent.setup();

            stubStore(dbStore());
            server.use(
                http.put(apiUrl('/datastores/ds-1'), () =>
                    HttpResponse.json(
                        { success: false, message: 'Ref name already taken', value: null },
                        { status: 409 },
                    ),
                ),
            );

            const { onUpdated } = renderEdit();

            await screen.findAllByText('Sales DB');

            const dialog = await openMenuItemDialog(user, /Edit data store/);

            await user.type(within(dialog).getByLabelText('Name *'), ' v2');
            await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

            await within(dialog).findByText('Ref name already taken');
            expect(onUpdated).not.toHaveBeenCalled();
        });

        it('keeps a hand-edited ref name when the name changes afterwards', async () => {
            const user = userEvent.setup();

            stubStore(dbStore());
            renderEdit();

            await screen.findAllByText('Sales DB');

            const dialog = await openMenuItemDialog(user, /Edit data store/);

            await user.clear(within(dialog).getByLabelText('Ref name *'));
            await user.type(within(dialog).getByLabelText('Ref name *'), 'warehouse');
            await user.clear(within(dialog).getByLabelText('Name *'));
            await user.type(within(dialog).getByLabelText('Name *'), 'Sales Warehouse');

            expect(within(dialog).getByLabelText('Ref name *')).toHaveValue('warehouse');
        });

        it('leaves a stored ref name alone when it was never derived from the name', async () => {
            const user = userEvent.setup();

            stubStore(
                store({
                    provider: 'postgresql',
                    name: 'Sales DB',
                    refName: 'legacy_sales_pipeline',
                } as Partial<DataStoreType>),
            );
            renderEdit();

            await screen.findAllByText('Sales DB');

            const dialog = await openMenuItemDialog(user, /Edit data store/);

            await user.type(within(dialog).getByLabelText('Name *'), ' v2');

            expect(within(dialog).getByLabelText('Ref name *')).toHaveValue('legacy_sales_pipeline');
        });

        it('keeps deriving the ref name while it still mirrors the stored name', async () => {
            const user = userEvent.setup();

            stubStore(dbStore());
            renderEdit();

            await screen.findAllByText('Sales DB');

            const dialog = await openMenuItemDialog(user, /Edit data store/);

            await user.type(within(dialog).getByLabelText('Name *'), ' Reporting');

            expect(within(dialog).getByLabelText('Ref name *')).toHaveValue('sales_db_reporting');
        });

        it('omits the description from the payload for a files store', async () => {
            const user = userEvent.setup();
            let body: Record<string, unknown> = {};

            stubStore();
            server.use(
                http.put(apiUrl('/datastores/ds-1'), async ({ request }) => {
                    body = (await request.json()) as Record<string, unknown>;

                    return envelope(store({ name: 'Product Docs v2' } as Partial<DataStoreType>));
                }),
            );

            renderEdit();

            await screen.findAllByText('Product Docs');

            const dialog = await openMenuItemDialog(user, /Edit data store/);

            await user.type(within(dialog).getByLabelText('Name *'), ' v2');
            await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

            expect(await screen.findByText('Data store updated successfully.')).toBeInTheDocument();
            expect(body).toEqual({ name: 'Product Docs v2', refName: 'product_docs_v2' });
            expect(body).not.toHaveProperty('description');
        });

        it('omits the description field for a files store', async () => {
            const user = userEvent.setup();

            stubStore();
            renderEdit();

            await screen.findAllByText('Product Docs');

            const dialog = await openMenuItemDialog(user, /Edit data store/);

            expect(within(dialog).getByLabelText('Name *')).toHaveValue('Product Docs');
            expect(within(dialog).queryByPlaceholderText(/Briefly describe/)).not.toBeInTheDocument();
        });

        it('rejects an invalid ref name before submitting', async () => {
            const user = userEvent.setup();

            stubStore(dbStore());
            renderEdit();

            await screen.findAllByText('Sales DB');

            const dialog = await openMenuItemDialog(user, /Edit data store/);

            await user.clear(within(dialog).getByLabelText('Ref name *'));
            await user.type(within(dialog).getByLabelText('Ref name *'), 'Sales DB');

            expect(await within(dialog).findByText('Spaces are not allowed in the ref name.')).toBeInTheDocument();
            expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeDisabled();
        });

        it('surfaces the backend message when the update fails', async () => {
            const user = userEvent.setup();

            stubStore(dbStore());
            server.use(
                http.put(apiUrl('/datastores/ds-1'), () =>
                    HttpResponse.json(
                        { success: false, message: 'Ref name already taken', value: null },
                        { status: 409 },
                    ),
                ),
            );

            renderEdit();

            await screen.findAllByText('Sales DB');

            const dialog = await openMenuItemDialog(user, /Edit data store/);

            await user.type(within(dialog).getByLabelText('Name *'), ' v2');
            await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

            expect(await within(dialog).findByText('Ref name already taken')).toBeInTheDocument();
        });

        it('saves the connection from its own modal', async () => {
            const user = userEvent.setup();
            let body: Record<string, unknown> = {};

            stubStore(dbStore());
            server.use(
                respond('post', '/datastores/wizard/ds-1/collections', () => envelope(rawPaged(['public.orders']))),
            );
            server.use(
                http.put(apiUrl('/datastores/wizard/ds-1/connection'), async ({ request }) => {
                    body = (await request.json()) as Record<string, unknown>;

                    return envelope(dbStore());
                }),
            );

            renderEdit();

            await screen.findAllByText('Sales DB');

            const dialog = await openMenuItemDialog(user, /Edit connection/);

            expect(within(dialog).queryByRole('button', { name: 'View Connection Secrets' })).not.toBeInTheDocument();

            await user.type(within(dialog).getByRole('textbox'), 'postgres://db.internal/sales');
            await user.click(within(dialog).getByRole('combobox'));
            await user.click(await screen.findByRole('option', { name: 'public.orders' }));
            await user.click(within(dialog).getByRole('button', { name: 'Save' }));

            expect(await screen.findByText('Connection saved successfully.')).toBeInTheDocument();
            expect(body).toEqual({
                connection: { uri: 'postgres://db.internal/sales', table: 'public.orders' },
            });
        });
    });
});
