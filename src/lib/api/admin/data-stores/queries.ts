import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { DataStoreType } from '@/types/admin';
import { shouldPollEmbeddingStatus } from '@/utils';

import { adminDataStoresApi } from './api';
import { DATA_STORES_LIST_QUERY_KEY, DATA_STORES_QUERY_KEY, type DataStoresQueryParams } from './query-keys';

export function useDataStoresQuery(params: DataStoresQueryParams) {
    return useQuery({
        queryKey: [...DATA_STORES_LIST_QUERY_KEY, params],
        queryFn: () =>
            adminDataStoresApi.list({
                page: params.pageIndex,
                size: params.pageSize,
                search: params.search,
                sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                provider: params.provider,
            }),
        placeholderData: keepPreviousData,
    });
}

const OKF_POLL_INTERVAL_MS = 10000;

/** True while OKF generation is in flight — polls the detail query, embedding-jobs precedent. */
export function shouldPollOkfStatus(status: DataStoreType['okfStatus']): boolean {
    return status === 'pending' || status === 'generating';
}

export function useDataStoreByIdQuery(id: string | undefined) {
    return useQuery({
        queryKey: [...DATA_STORES_QUERY_KEY, 'detail', id],
        queryFn: () => adminDataStoresApi.getById(id!),
        enabled: !!id,
        refetchInterval: (query) => (shouldPollOkfStatus(query.state.data?.okfStatus) ? OKF_POLL_INTERVAL_MS : false),
    });
}

export function useWizardFieldsQuery(dataStoreId: string | undefined) {
    return useQuery({
        queryKey: [...DATA_STORES_QUERY_KEY, 'detail', dataStoreId, 'wizard', 'fields'],
        queryFn: () => adminDataStoresApi.wizardGetFields(dataStoreId!),
        enabled: !!dataStoreId,
    });
}

export function useWizardTemplatesQuery(dataStoreId: string | undefined) {
    return useQuery({
        queryKey: [...DATA_STORES_QUERY_KEY, 'detail', dataStoreId, 'wizard', 'templates'],
        queryFn: () => adminDataStoresApi.wizardGetTemplates(dataStoreId!),
        enabled: !!dataStoreId,
    });
}

export function useWizardConnectionQuery(dataStoreId: string | undefined) {
    return useQuery({
        queryKey: [...DATA_STORES_QUERY_KEY, 'detail', dataStoreId, 'wizard', 'connection'],
        queryFn: () => adminDataStoresApi.wizardGetConnection(dataStoreId!),
        enabled: !!dataStoreId,
    });
}

export function useWizardToolsQuery(dataStoreId: string | undefined) {
    return useQuery({
        queryKey: [...DATA_STORES_QUERY_KEY, 'detail', dataStoreId, 'wizard', 'tools'],
        queryFn: () => adminDataStoresApi.wizardGetTools(dataStoreId!),
        enabled: !!dataStoreId,
    });
}

export function useWizardEmbeddingJobQuery(dataStoreId: string | undefined) {
    return useQuery({
        queryKey: [...DATA_STORES_QUERY_KEY, 'detail', dataStoreId, 'wizard', 'embedding-job'],
        queryFn: () => adminDataStoresApi.wizardGetEmbeddingJob(dataStoreId!),
        enabled: !!dataStoreId,
    });
}

export function useWizardExploreInitialQuery(dataStoreId: string | undefined) {
    return useQuery({
        queryKey: [...DATA_STORES_QUERY_KEY, 'detail', dataStoreId, 'wizard', 'explore'],
        queryFn: () => adminDataStoresApi.wizardGetExplore(dataStoreId!),
        enabled: !!dataStoreId,
    });
}

const EMBEDDING_POLL_INTERVAL_MS = 10000;

export function useWizardEmbeddingJobRunsQuery(
    dataStoreId: string | undefined,
    params?: { page?: number; size?: number; sortBy?: string[] },
    options?: { poll?: boolean },
) {
    return useQuery({
        queryKey: [...DATA_STORES_QUERY_KEY, 'detail', dataStoreId, 'wizard', 'embedding-job', 'runs', params],
        queryFn: ({ signal }) => adminDataStoresApi.wizardGetEmbeddingJobRuns(dataStoreId!, params, { signal }),
        enabled: !!dataStoreId,
        refetchInterval: (query) => {
            if (!options?.poll) return false;
            const hasRunning = (query.state.data?.values ?? []).some(
                (run) => (run as { status?: string }).status === 'running',
            );

            return hasRunning ? EMBEDDING_POLL_INTERVAL_MS : false;
        },
    });
}

export function useWizardFilesQuery(dataStoreId: string | undefined, pageIndex: number, pageSize: number) {
    return useQuery({
        queryKey: [...DATA_STORES_QUERY_KEY, 'detail', dataStoreId, 'wizard', 'files', pageIndex, pageSize],
        queryFn: () => adminDataStoresApi.wizardListFiles(dataStoreId!, { page: pageIndex, size: pageSize }),
        enabled: !!dataStoreId,
        placeholderData: keepPreviousData,
        refetchInterval: (query) => {
            const hasPending = (query.state.data?.values ?? []).some(
                (file) => file.embedding_status && shouldPollEmbeddingStatus(file.embedding_status),
            );

            return hasPending ? EMBEDDING_POLL_INTERVAL_MS : false;
        },
        refetchOnWindowFocus: false,
    });
}
