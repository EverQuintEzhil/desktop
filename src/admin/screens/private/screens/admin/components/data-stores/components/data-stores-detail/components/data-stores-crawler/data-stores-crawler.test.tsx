import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    useWizardDeleteEmbeddingJobMutation,
    useWizardEmbeddingJobRunsQuery,
    useWizardSaveCronMutation,
    useWizardStartEmbeddingJobMutation,
} from '@/lib/api/admin/data-stores';
import { buildDataStore } from '@/test/fixtures/data-stores';
import { renderWithProviders } from '@/test/test-utils';
import { showErrorToast } from '@/utils';

import type { WebCrawlRunType } from './crawl-run-types';
import DataStoresCrawler from './data-stores-crawler';

vi.mock('@/lib/api/admin/data-stores', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api/admin/data-stores')>();

    return {
        ...actual,
        useWizardDeleteEmbeddingJobMutation: vi.fn(),
        useWizardEmbeddingJobRunsQuery: vi.fn(),
        useWizardSaveCronMutation: vi.fn(),
        useWizardStartEmbeddingJobMutation: vi.fn(),
    };
});

vi.mock('@/utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/utils')>();

    return {
        ...actual,
        showErrorToast: vi.fn(),
        showSuccessToast: vi.fn(),
    };
});

const RUNS: WebCrawlRunType[] = [
    {
        _id: 'run-2',
        workflowId: 'weblinks-refresh-ds-1',
        trigger: 'manual',
        status: 'running',
        stats: null,
        error: null,
        startedAt: '2026-07-27T10:00:00.000Z',
        finishedAt: null,
    },
    {
        _id: 'run-1',
        workflowId: 'weblinks-refresh-ds-1',
        trigger: 'schedule',
        status: 'completed',
        stats: {
            discovered: 12,
            fetched: 4,
            unchanged: 8,
            added: 3,
            updated: 1,
            deleted: 2,
            failed: 0,
        },
        error: null,
        startedAt: '2026-07-26T10:00:00.000Z',
        finishedAt: '2026-07-26T10:04:00.000Z',
    },
];

const mockMutation = (overrides: Partial<{ mutateAsync: ReturnType<typeof vi.fn> }> = {}) => ({
    mutateAsync: overrides.mutateAsync ?? vi.fn().mockResolvedValue({}),
    isPending: false,
});

interface MockSetup {
    runs?: WebCrawlRunType[];
    start?: ReturnType<typeof mockMutation>;
    stop?: ReturnType<typeof mockMutation>;
    saveCron?: ReturnType<typeof mockMutation>;
}

const setupMocks = ({
    runs = RUNS,
    start = mockMutation(),
    stop = mockMutation(),
    saveCron = mockMutation(),
}: MockSetup = {}) => {
    vi.mocked(useWizardEmbeddingJobRunsQuery).mockReturnValue({
        data: { values: runs, page_info: { total_count: runs.length } },
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWizardEmbeddingJobRunsQuery>);
    vi.mocked(useWizardStartEmbeddingJobMutation).mockReturnValue(
        start as unknown as ReturnType<typeof useWizardStartEmbeddingJobMutation>,
    );
    vi.mocked(useWizardDeleteEmbeddingJobMutation).mockReturnValue(
        stop as unknown as ReturnType<typeof useWizardDeleteEmbeddingJobMutation>,
    );
    vi.mocked(useWizardSaveCronMutation).mockReturnValue(
        saveCron as unknown as ReturnType<typeof useWizardSaveCronMutation>,
    );

    return {
        start,
        stop,
        saveCron,
    };
};

const weblinksStore = (cron: string | null = '0 3 * * *') =>
    buildDataStore({
        provider: 'weblinks',
        embeddingConfig: { embeddingFields: [], metadataFields: [], cron },
    } as unknown as Parameters<typeof buildDataStore>[0]);

const renderCrawler = (dataStore = weblinksStore()) =>
    renderWithProviders(<DataStoresCrawler dataStore={dataStore} canUserEdit onSubmit={vi.fn()} />);

describe('DataStoresCrawler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders runs with a page-stats summary and failed runs kept out of it', () => {
        setupMocks();
        renderCrawler();

        expect(screen.getByText('12 discovered · 3 added · 1 updated · 2 deleted')).toBeInTheDocument();
        expect(screen.getByText('Running')).toBeInTheDocument();
        expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('shows the stop button only on running runs', () => {
        setupMocks();
        renderCrawler();

        // one running row -> exactly one stop button
        expect(screen.getAllByRole('button', { name: 'Stop crawl' })).toHaveLength(1);
    });

    it('stops the crawl for the data store when the stop button is clicked', async () => {
        const stop = mockMutation();

        setupMocks({ stop });
        renderCrawler();

        await userEvent.click(screen.getByRole('button', { name: 'Stop crawl' }));

        await waitFor(() => {
            expect(stop.mutateAsync).toHaveBeenCalledWith('ds-1');
        });
    });

    it('triggers a crawl from the Crawl Now button', async () => {
        const start = mockMutation();

        setupMocks({ start });
        renderCrawler();

        await userEvent.click(screen.getByRole('button', { name: /Crawl Now/ }));

        await waitFor(() => {
            expect(start.mutateAsync).toHaveBeenCalledWith('ds-1');
        });
    });

    it('surfaces the server message when a crawl is already running (409)', async () => {
        const start = mockMutation({
            mutateAsync: vi.fn().mockRejectedValue({
                response: {
                    status: 409,
                    data: { message: 'A web links refresh is already running for this data store.' },
                },
            }),
        });

        setupMocks({ start });
        renderCrawler();

        await userEvent.click(screen.getByRole('button', { name: /Crawl Now/ }));

        await waitFor(() => {
            expect(showErrorToast).toHaveBeenCalledWith('A web links refresh is already running for this data store.');
        });
    });

    it('removes the schedule with cron null after confirmation', async () => {
        const saveCron = mockMutation();

        setupMocks({ saveCron });
        renderCrawler();

        await userEvent.click(screen.getByRole('button', { name: 'Remove schedule' }));
        await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

        await waitFor(() => {
            expect(saveCron.mutateAsync).toHaveBeenCalledWith({ id: 'ds-1', data: { cron: null } });
        });
    });

    it('hides the remove-schedule button when no cron is set', () => {
        setupMocks();
        renderCrawler(weblinksStore(null));

        expect(screen.queryByRole('button', { name: 'Remove schedule' })).not.toBeInTheDocument();
        expect(screen.getByText('No schedule set. Crawls must be triggered manually.')).toBeInTheDocument();
    });
});
