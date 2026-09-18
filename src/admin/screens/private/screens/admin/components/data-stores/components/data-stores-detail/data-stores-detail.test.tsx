import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { useDataStoreByIdQuery, useWizardEmbeddingJobRunsQuery } from '@/lib/api/admin/data-stores';
import { authenticatedUser } from '@/test/fixtures/auth';
import { buildDataStore } from '@/test/fixtures/data-stores';
import { renderWithProviders } from '@/test/test-utils';

import DataStoresDetail from './data-stores-detail';

vi.mock('@/lib/api/admin/data-stores', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api/admin/data-stores')>();

    return {
        ...actual,
        useDataStoreByIdQuery: vi.fn(),
        useWizardEmbeddingJobRunsQuery: vi.fn(),
    };
});

const renderDetail = (path: string, options: Parameters<typeof renderWithProviders>[1] = {}) =>
    renderWithProviders(
        <Routes>
            <Route path="/admin/data-stores/:dataStoreId/*" element={<DataStoresDetail />} />
        </Routes>,
        { route: path, ...options },
    );

describe('DataStoresDetail OKF tab registration', () => {
    it('renders an OKF tab link alongside the other tabs', async () => {
        vi.mocked(useDataStoreByIdQuery).mockReturnValue({
            data: buildDataStore({ okf: null, okfStatus: null }),
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useDataStoreByIdQuery>);

        renderDetail('/admin/data-stores/ds-1/okf');

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'OKF' })).toBeInTheDocument();
        });
    });

    it('renders the DataStoresOkf content when navigating to the okf route', async () => {
        vi.mocked(useDataStoreByIdQuery).mockReturnValue({
            data: buildDataStore({ okf: null, okfStatus: null }),
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useDataStoreByIdQuery>);

        renderDetail('/admin/data-stores/ds-1/okf');

        await waitFor(() => {
            expect(screen.getByText('Not generated yet')).toBeInTheDocument();
        });
    });

    it('shows the OKF tab even for a viewer without edit permission, unlike the gated tabs', async () => {
        vi.mocked(useDataStoreByIdQuery).mockReturnValue({
            data: buildDataStore({ okf: null, okfStatus: null }),
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useDataStoreByIdQuery>);

        renderDetail('/admin/data-stores/ds-1/okf');

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'OKF' })).toBeInTheDocument();
        });

        // Default test user role ('user') has no dataStores 'put' permission, so canUserEdit
        // is false — the Info/Connections/Tools tabs are gated off while OKF stays visible.
        expect(screen.queryByRole('link', { name: 'Info' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Tools' })).not.toBeInTheDocument();
    });
});

describe('DataStoresDetail weblinks tab gating', () => {
    const adminState = { preloadedState: { user: { ...authenticatedUser, role: 'admin' as const } } };

    const mockStore = (provider: string) => {
        vi.mocked(useDataStoreByIdQuery).mockReturnValue({
            data: buildDataStore({ provider } as Parameters<typeof buildDataStore>[0]),
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useDataStoreByIdQuery>);
        vi.mocked(useWizardEmbeddingJobRunsQuery).mockReturnValue({
            data: { values: [], page_info: { total_count: 0 } },
            isLoading: false,
            isError: false,
            isFetching: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useWizardEmbeddingJobRunsQuery>);
    };

    it('shows Crawler and Data Explorer and hides Embeddings Index for weblinks stores', async () => {
        mockStore('weblinks');

        renderDetail('/admin/data-stores/ds-1/crawler', adminState);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'Crawler' })).toBeInTheDocument();
        });
        expect(screen.getByRole('link', { name: 'Data Explorer' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Web Links' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Embeddings Index' })).not.toBeInTheDocument();
    });

    it('renders the Crawler tab content on the crawler route', async () => {
        mockStore('weblinks');

        renderDetail('/admin/data-stores/ds-1/crawler', adminState);

        await waitFor(() => {
            expect(screen.getByText('Crawl Schedule')).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /Crawl Now/ })).toBeInTheDocument();
    });

    it('keeps Embeddings Index and hides Crawler for other providers', async () => {
        mockStore('mongodb');

        renderDetail('/admin/data-stores/ds-1/embeddings-index', adminState);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'Embeddings Index' })).toBeInTheDocument();
        });
        expect(screen.queryByRole('link', { name: 'Crawler' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Data Explorer' })).toBeInTheDocument();
    });
});

describe('DataStoresDetail OKF provider gating', () => {
    const adminState = { preloadedState: { user: { ...authenticatedUser, role: 'admin' as const } } };

    const mockStore = (provider: string) => {
        vi.mocked(useDataStoreByIdQuery).mockReturnValue({
            data: buildDataStore({ provider } as Parameters<typeof buildDataStore>[0]),
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useDataStoreByIdQuery>);
    };

    it('hides the OKF tab for file stores (okf does not apply)', async () => {
        mockStore('files');

        renderDetail('/admin/data-stores/ds-1', adminState);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'Info' })).toBeInTheDocument();
        });
        expect(screen.queryByRole('link', { name: 'OKF' })).not.toBeInTheDocument();
    });

    it('hides the OKF tab for blob-storage stores', async () => {
        mockStore('s3');

        renderDetail('/admin/data-stores/ds-1', adminState);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'Info' })).toBeInTheDocument();
        });
        expect(screen.queryByRole('link', { name: 'OKF' })).not.toBeInTheDocument();
    });

    it('keeps the OKF tab for introspectable providers', async () => {
        mockStore('mongodb');

        renderDetail('/admin/data-stores/ds-1', adminState);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'OKF' })).toBeInTheDocument();
        });
    });
});
