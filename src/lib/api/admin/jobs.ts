import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationOptions,
} from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import qs from 'qs';

import type { JobType } from '@/types/admin';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

import { downloadCsvExport, getCsvExportErrorMessage } from './csv-export';

export { getCsvExportErrorMessage as getJobsExportErrorMessage };

interface JobsListParams {
    mineOnly?: boolean;
    page?: number;
    size?: number;
    search?: string;
    creatorIds?: string[];
    sortBy?: string[];
    agentIds?: string[];
    modelIds?: string[];
    statuses?: string[];
    createdStartDate?: string;
    createdEndDate?: string;
    updatedStartDate?: string;
    updatedEndDate?: string;
}

type JobsExportParams = Omit<JobsListParams, 'page' | 'size'>;

export const adminJobsApi = {
    async list(params: JobsListParams = {}, config?: ApiRequestConfig): Promise<PagedList<JobType>> {
        const raw = await apiClient.get<RawPagedList<JobType>>('/jobs', {
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
            ...config,
        });

        return mapPagedList(raw);
    },

    async kill(id: string, config?: ApiRequestConfig): Promise<JobType> {
        return apiClient.post<JobType>(`/jobs/${id}/kill`, undefined, config);
    },

    async requeue(id: string, config?: ApiRequestConfig): Promise<JobType> {
        return apiClient.post<JobType>('/ai/job/requeue', { jobIds: [id] }, config);
    },

    /** Requests the CSV from `/jobs/export` and triggers a browser download. */
    async export(params: JobsExportParams = {}): Promise<void> {
        return downloadCsvExport('/jobs/export', params, 'jobs.csv');
    },
};

export const JOBS_QUERY_KEY = ['admin', 'jobs'] as const;
export const JOBS_LIST_QUERY_KEY = [...JOBS_QUERY_KEY, 'list'] as const;

export interface JobsQueryParams {
    pageIndex: number;
    pageSize: number;
    search?: string;
    sort: SortingState;
    mineOnly?: boolean;
    creatorIds?: string[];
    agentIds?: string[];
    modelIds?: string[];
    statuses?: string[];
    createdStartDate?: string;
    createdEndDate?: string;
    updatedStartDate?: string;
    updatedEndDate?: string;
}

const toJobsFilterParams = (params: JobsQueryParams): JobsExportParams => ({
    search: params.search,
    sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
    mineOnly: params.mineOnly,
    creatorIds: params.creatorIds,
    agentIds: params.agentIds,
    modelIds: params.modelIds,
    statuses: params.statuses,
    createdStartDate: params.createdStartDate,
    createdEndDate: params.createdEndDate,
    updatedStartDate: params.updatedStartDate,
    updatedEndDate: params.updatedEndDate,
});

const toJobsListParams = (params: JobsQueryParams): JobsListParams => ({
    ...toJobsFilterParams(params),
    page: params.pageIndex,
    size: params.pageSize,
});

export function useJobsQuery(params: JobsQueryParams) {
    return useQuery({
        queryKey: [...JOBS_LIST_QUERY_KEY, params],
        queryFn: () => adminJobsApi.list(toJobsListParams(params)),
        placeholderData: keepPreviousData,
    });
}

export function useExportJobsMutation(
    options?: Omit<UseMutationOptions<void, unknown, JobsQueryParams>, 'mutationFn'>,
) {
    return useMutation({
        ...options,
        mutationFn: (params: JobsQueryParams) => adminJobsApi.export(toJobsFilterParams(params)),
    });
}

export function useKillJobMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminJobsApi.kill(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY }),
    });
}

export function useRequeueJobMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminJobsApi.requeue(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY }),
    });
}
