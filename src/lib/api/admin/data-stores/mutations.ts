import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { DataStoreType } from '@/types/admin';

import { TOOLS_LIST_QUERY_KEY } from '../tools';

import { adminDataStoresApi } from './api';
import { DATA_STORES_LIST_QUERY_KEY, DATA_STORES_QUERY_KEY, invalidateDataStoresQueries } from './query-keys';
import type { WeblinkSpec } from './types';

function setDataStoreDetailCache(queryClient: QueryClient, id: string, data: DataStoreType) {
    queryClient.setQueryData<DataStoreType>([...DATA_STORES_QUERY_KEY, 'detail', id], data);
}

export function useCreateDataStoreMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminDataStoresApi.create(data),
        onSuccess: () => invalidateDataStoresQueries(queryClient),
    });
}

export function useWizardCreateDataStoreMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminDataStoresApi.wizardCreate(data),
        onSuccess: (created) => {
            setDataStoreDetailCache(queryClient, created._id, created);
        },
    });
}

export function useUpdateDataStoreMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (vars: { id: string; data: object; refreshList?: boolean }) =>
            adminDataStoresApi.update(vars.id, vars.data),
        onSuccess: (updated, variables) => {
            setDataStoreDetailCache(queryClient, variables.id, updated);
            if (variables.refreshList !== false) {
                void queryClient.invalidateQueries({ queryKey: DATA_STORES_LIST_QUERY_KEY });
            }
        },
    });
}

export function useDeleteDataStoreMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminDataStoresApi.delete(id),
        onSuccess: (_data, deletedId) => {
            queryClient.removeQueries({ queryKey: [...DATA_STORES_QUERY_KEY, 'detail', deletedId] });
            invalidateDataStoresQueries(queryClient);
        },
    });
}

export function useWizardSaveFieldsMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminDataStoresApi.wizardSaveFields(id, data),
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({
                queryKey: [...DATA_STORES_QUERY_KEY, 'detail', variables.id, 'wizard', 'fields'],
                exact: true,
            });
            void queryClient.invalidateQueries({
                queryKey: [...DATA_STORES_QUERY_KEY, 'detail', variables.id],
                exact: true,
            });
        },
    });
}

export function useWizardSaveConnectionMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminDataStoresApi.wizardSaveConnection(id, data),
        onSuccess: (data, variables) => {
            setDataStoreDetailCache(queryClient, variables.id, data);
            void queryClient.invalidateQueries({
                queryKey: [...DATA_STORES_QUERY_KEY, 'detail', variables.id, 'wizard', 'connection'],
                exact: true,
            });
        },
    });
}

export function useWizardSendConnectionSecretOtpMutation() {
    return useMutation({
        mutationFn: (id: string) => adminDataStoresApi.wizardSendConnectionSecretOtp(id),
    });
}

export function useWizardVerifyConnectionSecretOtpMutation() {
    return useMutation({
        mutationFn: ({ id, otp }: { id: string; otp: string }) =>
            adminDataStoresApi.wizardVerifyConnectionSecretOtp(id, otp),
    });
}

export function useWizardGetConnectionSecretMutation() {
    return useMutation({
        mutationFn: (id: string) => adminDataStoresApi.wizardGetConnectionSecret(id),
    });
}

export function useWizardSaveTemplatesMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminDataStoresApi.wizardSaveTemplates(id, data),
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({
                queryKey: [...DATA_STORES_QUERY_KEY, 'detail', variables.id, 'wizard', 'templates'],
                exact: true,
            });
            void queryClient.invalidateQueries({
                queryKey: [...DATA_STORES_QUERY_KEY, 'detail', variables.id],
                exact: true,
            });
        },
    });
}

export function useWizardSaveToolsMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminDataStoresApi.wizardSaveTools(id, data),
        onSuccess: (data, variables) => {
            setDataStoreDetailCache(queryClient, variables.id, data);
            void queryClient.invalidateQueries({
                queryKey: [...DATA_STORES_QUERY_KEY, 'detail', variables.id, 'wizard', 'tools'],
                exact: true,
            });
        },
    });
}

export function useWizardSaveEmbeddingConfigMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) =>
            adminDataStoresApi.wizardSaveEmbeddingConfig(id, data),
        onSuccess: (data, variables) => {
            setDataStoreDetailCache(queryClient, variables.id, data);
            void queryClient.invalidateQueries({
                queryKey: [...DATA_STORES_QUERY_KEY, 'detail', variables.id, 'wizard', 'embedding-job'],
            });
        },
    });
}

export function useWizardSaveCronMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminDataStoresApi.wizardSaveCron(id, data),
        onSuccess: (data, variables) => {
            setDataStoreDetailCache(queryClient, variables.id, data);
        },
    });
}

export function useWizardSaveWeblinksMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { links: WeblinkSpec[] } }) =>
            adminDataStoresApi.wizardSaveWeblinks(id, data),
        onSuccess: (data, variables) => {
            setDataStoreDetailCache(queryClient, variables.id, data);
        },
    });
}

/** Regenerate returns only { success }, so invalidate the detail query rather than set it — the workflow writes the row asynchronously. */
export function useRegenerateOkfMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminDataStoresApi.regenerateOkf(id),
        onSuccess: (_data, id) => {
            void queryClient.invalidateQueries({
                queryKey: [...DATA_STORES_QUERY_KEY, 'detail', id],
                exact: true,
            });
        },
    });
}

/** POST /explore is a payload-shaped "read"; do not invalidate datastore queries on success or the explorer will refetch in a loop with any parent/detail query subscribers. */
export function useWizardExploreMutation() {
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) => adminDataStoresApi.wizardExplore(id, data),
        retry: 3,
    });
}

export function useWizardDeleteEmbeddingJobMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminDataStoresApi.wizardDeleteEmbeddingJob(id),
        onSuccess: (_data, id) => {
            void queryClient.invalidateQueries({
                queryKey: [...DATA_STORES_QUERY_KEY, 'detail', id, 'wizard', 'embedding-job'],
            });
        },
    });
}

export function useWizardStartEmbeddingJobMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => adminDataStoresApi.wizardStartEmbeddingJob(id),
        onSuccess: (_data, id) => {
            void queryClient.invalidateQueries({
                queryKey: [...DATA_STORES_QUERY_KEY, 'detail', id, 'wizard', 'embedding-job'],
            });
        },
    });
}

export function useWizardUploadFileMutation() {
    return useMutation({
        mutationFn: ({
            formData,
            onUploadProgress,
            signal,
        }: {
            formData: FormData;
            onUploadProgress?: (progress: number) => void;
            signal?: AbortSignal;
        }) =>
            adminDataStoresApi.wizardUploadAllFiles(formData, {
                onUploadProgress: onUploadProgress
                    ? (e) => {
                          const pct = Math.round((e.loaded / (e.total ?? e.loaded)) * 100);

                          onUploadProgress(pct);
                      }
                    : undefined,
                signal,
            }),
    });
}

/** Invalidation is intentionally omitted — callers delay and trigger refetch themselves after a 3-second wait. */
export function useWizardAddFileIdsMutation(dataStoreId: string) {
    return useMutation({
        mutationFn: (fileIds: string[]) => adminDataStoresApi.wizardAddFileIds(dataStoreId, fileIds),
    });
}

/** Invalidation is intentionally omitted — callers delay and trigger refetch themselves after a 3-second wait. */
export function useWizardDeleteFilesMutation(dataStoreId: string) {
    return useMutation({
        mutationFn: (fileIds: string[]) => adminDataStoresApi.wizardDeleteFiles(dataStoreId, fileIds),
    });
}

/** Invalidation is intentionally omitted — callers delay and trigger refetch themselves after a 3-second wait. */
export function useWizardRemoveFilesMutation(dataStoreId: string) {
    return useMutation({
        mutationFn: (fileIds: string[]) => adminDataStoresApi.wizardRemoveFiles(dataStoreId, fileIds),
    });
}

/** Callers use the response directly; do not invalidate here (avoids refetch storms / duplicate collection fetches; same idea as useWizardExploreMutation). */
export function useWizardListCollectionsMutation() {
    return useMutation({
        mutationFn: ({
            wizardId,
            params,
            connection,
        }: {
            wizardId: string;
            params: { page?: number; size?: number; search?: string };
            connection: object;
        }) => adminDataStoresApi.wizardListCollections(wizardId, params, connection),
    });
}

export function useListCollectionsMutation() {
    return useMutation({
        mutationFn: ({
            params,
            data,
        }: {
            params: { page?: number; size?: number; search?: string };
            data: { provider: string; connection: object };
        }) => adminDataStoresApi.listCollections(params, data),
    });
}

export function useCreateDatastoreToolMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: object) => adminDataStoresApi.createTool(data),
        onSuccess: (_tool, variables) => {
            void queryClient.invalidateQueries({ queryKey: TOOLS_LIST_QUERY_KEY });

            const dataStoreIds = (variables as { dataStoreIds?: string[] }).dataStoreIds;
            const dataStoreId = dataStoreIds?.[0];

            if (dataStoreId) {
                void queryClient.invalidateQueries({
                    queryKey: [...DATA_STORES_QUERY_KEY, 'detail', dataStoreId, 'wizard', 'tools'],
                    exact: true,
                });
            }
        },
    });
}
