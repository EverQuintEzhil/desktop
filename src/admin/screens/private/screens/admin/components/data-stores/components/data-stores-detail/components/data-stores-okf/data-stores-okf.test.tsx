import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildDataStore } from '@/test/fixtures/data-stores';
import { renderWithProviders } from '@/test/test-utils';

import DataStoresOkf from './data-stores-okf';

const mutateAsync = vi.fn();
let isPending = false;

vi.mock('@/lib/api/admin/data-stores', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api/admin/data-stores')>();

    return {
        ...actual,
        useRegenerateOkfMutation: () => ({
            mutateAsync,
            isPending,
        }),
    };
});

describe('DataStoresOkf', () => {
    afterEach(() => {
        mutateAsync.mockReset();
        isPending = false;
    });

    it('shows the empty state when okf has never been generated', () => {
        const dataStore = buildDataStore({ okf: null, okfStatus: null });

        renderWithProviders(<DataStoresOkf dataStore={dataStore} canUserEdit={false} onSubmit={vi.fn()} />);

        expect(screen.getByText('Not generated yet')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /regenerate/i })).not.toBeInTheDocument();
    });

    it('shows a Regenerate button for editors even with no bundle yet', () => {
        const dataStore = buildDataStore({ okf: null, okfStatus: null });

        renderWithProviders(<DataStoresOkf dataStore={dataStore} canUserEdit onSubmit={vi.fn()} />);

        expect(screen.getByRole('button', { name: /regenerate/i })).toBeEnabled();
    });

    it('shows a Generating status pill and disables Regenerate while generation is in flight', () => {
        const dataStore = buildDataStore({ okf: null, okfStatus: 'generating' });

        renderWithProviders(<DataStoresOkf dataStore={dataStore} canUserEdit onSubmit={vi.fn()} />);

        expect(screen.getByText('Generating')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /regenerate/i })).toBeDisabled();
    });

    it('renders the failure banner with the stored error', () => {
        const dataStore = buildDataStore({
            okf: null,
            okfStatus: 'failed',
            okfError: 'Connection to the datastore timed out.',
        });

        renderWithProviders(<DataStoresOkf dataStore={dataStore} canUserEdit={false} onSubmit={vi.fn()} />);

        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText('Connection to the datastore timed out.')).toBeInTheDocument();
    });

    it('renders the completed bundle files and lets the user switch between them', () => {
        const dataStore = buildDataStore({
            okfStatus: 'completed',
            okfGeneratedAt: '2026-07-27T12:00:00.000Z',
            okf: {
                version: '0.2',
                files: [
                    { path: 'store.md', content: '# Store overview\n\nThis store tracks todos.' },
                    { path: 'collections/todos.md', content: '# todos\n\nOne document per task.' },
                ],
            },
        });

        renderWithProviders(<DataStoresOkf dataStore={dataStore} canUserEdit={false} onSubmit={vi.fn()} />);

        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.getByText('Store overview')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /regenerate/i })).not.toBeInTheDocument();

        // Nested paths render as an explorer tree: a `collections` folder holding `todos.md`.
        expect(screen.getByText('collections')).toBeInTheDocument();

        fireEvent.click(screen.getByText('todos.md'));

        expect(screen.getByText('One document per task.')).toBeInTheDocument();
    });

    it('fires the regenerate mutation when clicked', async () => {
        mutateAsync.mockResolvedValue({ success: true });
        const dataStore = buildDataStore({ okf: null, okfStatus: null });

        renderWithProviders(<DataStoresOkf dataStore={dataStore} canUserEdit onSubmit={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith('ds-1'));
    });
});
