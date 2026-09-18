import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import {
    getConversationAllQueryKey,
    getConversationFavoritesQueryKey,
    getConversationHistoryQueryKey,
} from '@/components/agent-chat/hooks/use-conversation-history';
import { useEmbeddingStatusPoll } from '@/components/agent-chat/hooks/use-embedding-status-poll';
import { useChatHost } from '@/components/chat-host';
import { appMediaApi } from '@/lib/api/app/media';
import { appProjectsApi, type ProjectMemberRoleInput, type UpdateProjectPayload } from '@/lib/api/app/projects';
// App/flagged-feature only (projects): cookie + app files host. Not reached by the external widget.
import { filesApi } from '@/lib/api/files-client';
import type { PagedList } from '@/types/api-types';
import {
    mapProject,
    mapProjectActivity,
    mapProjectChat,
    mapProjectFile,
    type ProjectChatType,
    type ProjectFileType,
    type ProjectType,
} from '@/types/project';
import { definedFieldsOf } from '@/utils';

import { CHATS_STATUS_POLL_INTERVAL_MS, DETAIL_PAGE_SIZE, delay, FILES_REFETCH_DELAY_MS } from './constants';
import { isSearchFilteredFilesKey, projectsKeys } from './query-keys';
import type { ProjectFilesData } from './types';
import { deletedFileIdsFor } from './utils/deleted-file-ids';
import {
    mapUploadResultToProjectFile,
    prependProjectFiles,
    removeProjectFileFromCache,
} from './utils/project-files-cache';

// A chat row leaves 'generating' only server-side — nothing in this screen is told when the
// turn ends — so the list refreshes itself while one is running and stands still otherwise.
const hasGeneratingChat = (pages?: { chats: ProjectChatType[] }[]): boolean =>
    (pages ?? []).some((page) => page.chats.some((chat) => chat.status === 'generating'));

export const useProject = (
    agentId: string,
    projectId: string | undefined,
    options?: {
        sharedChatsEnabled?: boolean;
        filesSearch?: string;
        chatsSearch?: string;
        sharedChatsSearch?: string;
    },
) => {
    const queryClient = useQueryClient();
    const { conversations } = useChatHost();
    const conversationsRef = useRef(conversations);

    conversationsRef.current = conversations;
    const enabled = Boolean(projectId);
    const sharedChatsEnabled = enabled && Boolean(agentId) && Boolean(options?.sharedChatsEnabled);
    // Server-side name match on /files. Empty keeps the unfiltered query key untouched.
    const filesSearch = (options?.filesSearch ?? '').trim();
    // Server-side title match on /conversations. The two chat tabs are separate lists, so each
    // carries its own term rather than sharing one.
    const chatsSearch = (options?.chatsSearch ?? '').trim();
    const sharedChatsSearch = (options?.sharedChatsSearch ?? '').trim();

    const projectQuery = useQuery<ProjectType>({
        queryKey: projectsKeys.detail(projectId ?? ''),
        enabled,
        queryFn: async ({ signal }) => {
            const raw = await appProjectsApi.getProject<unknown>(projectId!, { signal });

            return mapProject(raw as never);
        },
    });

    const filesQuery = useInfiniteQuery({
        queryKey: projectsKeys.files(projectId ?? '', filesSearch),
        enabled,
        queryFn: async ({ pageParam, signal }) => {
            const raw = await appMediaApi.listFiles<unknown>(
                {
                    projectId,
                    ...(filesSearch ? { search: filesSearch } : {}),
                    page: pageParam,
                    size: DETAIL_PAGE_SIZE,
                },
                { signal },
            );
            const deletedIds = projectId ? deletedFileIdsFor(projectId) : null;

            return {
                files: raw.values
                    .map((value) => mapProjectFile(value as never))
                    .filter((file) => !deletedIds?.has(file._id)),
                page: raw.pageInfo.page,
                totalPages: raw.pageInfo.totalPages,
            };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined),
    });

    const files = useMemo(() => (filesQuery.data?.pages ?? []).flatMap((page) => page.files), [filesQuery.data]);

    const chatsQuery = useInfiniteQuery({
        queryKey: projectsKeys.conversations(agentId, projectId ?? '', chatsSearch),
        enabled: enabled && Boolean(agentId),
        queryFn: async ({ pageParam, signal }) => {
            const raw = (await conversationsRef.current.list(
                {
                    projectId,
                    ...(chatsSearch ? { search: chatsSearch } : {}),
                    page: pageParam,
                    size: DETAIL_PAGE_SIZE,
                },
                signal,
            )) as PagedList<unknown>;

            return {
                chats: raw.values.map((value) => mapProjectChat(value as never)),
                page: raw.pageInfo.page,
                totalPages: raw.pageInfo.totalPages,
            };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined),
        refetchInterval: (query) =>
            hasGeneratingChat(query.state.data?.pages) ? CHATS_STATUS_POLL_INTERVAL_MS : false,
    });

    const sharedChatsQuery = useInfiniteQuery({
        queryKey: projectsKeys.sharedConversations(agentId, projectId ?? '', sharedChatsSearch),
        enabled: sharedChatsEnabled,
        queryFn: async ({ pageParam, signal }) => {
            const raw = (await conversationsRef.current.list(
                {
                    projectId,
                    shared: true,
                    ...(sharedChatsSearch ? { search: sharedChatsSearch } : {}),
                    page: pageParam,
                    size: DETAIL_PAGE_SIZE,
                },
                signal,
            )) as PagedList<unknown>;

            return {
                chats: raw.values.map((value) => mapProjectChat(value as never)),
                page: raw.pageInfo.page,
                totalPages: raw.pageInfo.totalPages,
            };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined),
    });

    const activitiesQuery = useInfiniteQuery({
        queryKey: projectsKeys.activities(projectId ?? ''),
        enabled,
        queryFn: async ({ pageParam, signal }) => {
            const raw = await appProjectsApi.listActivities<unknown>(
                projectId!,
                {
                    page: pageParam,
                    size: DETAIL_PAGE_SIZE,
                },
                { signal },
            );

            return {
                activities: raw.values.map((value) => mapProjectActivity(value as never)),
                page: raw.pageInfo.page,
                totalPages: raw.pageInfo.totalPages,
            };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined),
    });

    const invalidateDetail = useCallback(() => {
        if (!projectId) return;
        queryClient.invalidateQueries({ queryKey: projectsKeys.detail(projectId) });
        queryClient.invalidateQueries({ queryKey: ['projects', agentId] });
        // Instruction/file/member changes emit activities — refresh the Activity tab.
        queryClient.invalidateQueries({ queryKey: projectsKeys.activities(projectId) });
    }, [agentId, projectId, queryClient]);

    const updateProject = useCallback(
        async (patch: UpdateProjectPayload) => {
            if (!projectId) return;
            await appProjectsApi.updateProject(projectId, patch);
            invalidateDetail();
        },
        [projectId, invalidateDetail],
    );

    const deleteProject = useCallback(async () => {
        if (!projectId) return;
        await appProjectsApi.deleteProject(projectId);
        queryClient.invalidateQueries({ queryKey: ['projects', agentId] });
    }, [projectId, agentId, queryClient]);

    const pinProject = useCallback(async () => {
        if (!projectId) return;

        queryClient.setQueryData<ProjectType>(projectsKeys.detail(projectId), (current) =>
            current ? { ...current, pinnedAt: current.pinnedAt ? null : new Date().toISOString() } : current,
        );

        try {
            await appProjectsApi.pinProject(projectId);
        } finally {
            invalidateDetail();
        }
    }, [projectId, queryClient, invalidateDetail]);

    const setInstructions = useCallback((instructions: string) => updateProject({ instructions }), [updateProject]);

    const uploadFiles = useCallback(
        async (
            fileList: File[],
            options?: {
                onProgress?: (file: File, progress: number) => void;
                onError?: (file: File) => void;
                onSuccess?: (file: File) => void;
                getSignal?: (file: File) => AbortSignal | undefined;
            },
        ): Promise<string[]> => {
            if (!projectId || fileList.length === 0) return [];

            const uploadedFiles: ProjectFileType[] = [];

            const promises = fileList.map(async (file) => {
                const form = new FormData();

                form.append('files', file);
                form.append('agent_id', agentId);
                form.append('project_id', projectId);
                form.append('origin.type', 'project');
                form.append('origin.agent_id', agentId);
                form.append('origin.project_id', projectId);

                try {
                    const response = await filesApi.upload(form, {
                        onUploadProgress: (progressEvent) => {
                            if (progressEvent.total) {
                                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);

                                options?.onProgress?.(file, percent);
                            }
                        },
                        signal: options?.getSignal?.(file),
                    });

                    for (const result of response.data?.value?.values ?? []) {
                        if (!result?._id) continue;
                        uploadedFiles.push(mapUploadResultToProjectFile(result, file));
                    }

                    options?.onSuccess?.(file);

                    return 'SUCCESS';
                } catch (e) {
                    if (e instanceof Error && e.name === 'CanceledError') return 'CANCELED';
                    options?.onError?.(file);
                    throw e;
                }
            });

            const results = await Promise.all(promises);
            const successCount = results.filter((r) => r === 'SUCCESS').length;

            if (uploadedFiles.length > 0) {
                // Show the file immediately from the upload response. A delayed list refetch alone
                // can still return empty on a new space (indexing lag) and wipe the Sources list.
                prependProjectFiles(queryClient, projectId, uploadedFiles);
                invalidateDetail();

                const snapshot = uploadedFiles;

                // Merge-refetch (do not invalidate): invalidate would briefly replace the cache with an
                // empty page and flash the empty state before we could re-prepend.
                void delay(FILES_REFETCH_DELAY_MS)
                    .then(async () => {
                        const raw = await appMediaApi.listFiles<unknown>({
                            projectId,
                            page: 0,
                            size: DETAIL_PAGE_SIZE,
                        });
                        const deletedIds = deletedFileIdsFor(projectId);
                        const serverFiles = raw.values
                            .map((value) => mapProjectFile(value as never))
                            .filter((file) => !deletedIds.has(file._id));
                        const serverIds = new Set(serverFiles.map((file) => file._id));

                        queryClient.setQueryData<ProjectFilesData>(projectsKeys.files(projectId), (current) => {
                            const cachedFiles = (current?.pages ?? []).flatMap((page) => page.files);
                            // Keep any rows the list API still omits (this upload + earlier lagging ones).
                            // Never resurrect ids the user already deleted (any useProject instance).
                            const localOnly: ProjectFileType[] = [];
                            const seen = new Set<string>();

                            for (const file of [...snapshot, ...cachedFiles]) {
                                if (deletedIds.has(file._id) || serverIds.has(file._id) || seen.has(file._id)) {
                                    continue;
                                }
                                localOnly.push(file);
                                seen.add(file._id);
                            }

                            return {
                                pages: [
                                    {
                                        files: [...localOnly, ...serverFiles],
                                        page: raw.pageInfo.page,
                                        totalPages: Math.max(
                                            raw.pageInfo.totalPages,
                                            localOnly.length > 0 || serverFiles.length > 0 ? 1 : 0,
                                        ),
                                    },
                                ],
                                pageParams: [0],
                            };
                        });

                        // A search-filtered list is whatever the server matched, so the optimistic
                        // row above cannot be prepended into it — a file that does not match the
                        // term would show under it. Refetch instead, now that indexing has caught up.
                        void queryClient.invalidateQueries({
                            queryKey: projectsKeys.files(projectId),
                            predicate: (query) => isSearchFilteredFilesKey(query.queryKey),
                        });
                    })
                    .catch(() => {
                        // Best-effort reconcile; optimistic rows already cover the UI.
                    });
            } else if (successCount > 0) {
                // Upload succeeded but the response body had no file ids — fall back to a delayed refetch.
                await delay(FILES_REFETCH_DELAY_MS);
                await queryClient.invalidateQueries({ queryKey: projectsKeys.files(projectId) });
                invalidateDetail();
            }

            return results;
        },
        [projectId, agentId, queryClient, invalidateDetail],
    );

    const removeFile = useCallback(
        async (fileId: string) => {
            if (!projectId) return;
            await appMediaApi.deleteFile(fileId);
            // Drop from the UI immediately. Suppress the id so a delayed upload merge (possibly
            // from another useProject instance on this page) or a stale list response cannot
            // put the row back.
            deletedFileIdsFor(projectId).add(fileId);
            removeProjectFileFromCache(queryClient, projectId, fileId);
            invalidateDetail();
            void queryClient.invalidateQueries({ queryKey: projectsKeys.files(projectId) });
        },
        [projectId, queryClient, invalidateDetail],
    );

    const updateFile = useCallback(
        (file: ProjectFileType) => {
            if (!file._id || !projectId) return;

            // setQueriesData, not setQueryData: the key prefix also covers the search-filtered
            // lists, which show the same rows and the same embedding badge.
            queryClient.setQueriesData<ProjectFilesData>({ queryKey: projectsKeys.files(projectId) }, (current) => {
                if (!current) return current;

                return {
                    ...current,
                    pages: current.pages.map((page) => ({
                        ...page,
                        files: page.files.map((existing) =>
                            existing._id === file._id ? { ...existing, ...definedFieldsOf(file) } : existing,
                        ),
                    })),
                };
            });
        },
        [queryClient, projectId],
    );

    const invalidateConversations = useCallback(() => {
        if (projectId) {
            queryClient.invalidateQueries({ queryKey: projectsKeys.conversations(agentId, projectId) });
        }
        // Keep the sidebar history lists in sync (same caches the sidebar mutates).
        queryClient.invalidateQueries({ queryKey: getConversationHistoryQueryKey(agentId) });
        queryClient.invalidateQueries({ queryKey: getConversationAllQueryKey(agentId) });
        queryClient.invalidateQueries({ queryKey: getConversationFavoritesQueryKey(agentId) });
    }, [agentId, projectId, queryClient]);

    const renameChat = useCallback(
        async (conversationId: string, title: string) => {
            await conversationsRef.current.rename(conversationId, title);
            invalidateConversations();
        },
        [invalidateConversations],
    );

    const deleteChat = useCallback(
        async (conversationId: string) => {
            await conversationsRef.current.delete(conversationId);
            invalidateConversations();
        },
        [invalidateConversations],
    );

    const removeChatFromProject = useCallback(
        async (conversationId: string) => {
            await conversationsRef.current.moveToProject(conversationId, null);
            invalidateConversations();
        },
        [invalidateConversations],
    );

    const moveChatToProject = useCallback(
        async (conversationId: string, targetProjectId: string) => {
            await conversationsRef.current.moveToProject(conversationId, targetProjectId);
            invalidateConversations();
        },
        [invalidateConversations],
    );

    const addMember = useCallback(
        async (userId: string, role: ProjectMemberRoleInput) => {
            if (!projectId) return;
            await appProjectsApi.addMember(projectId, { userId, role });
            invalidateDetail();
        },
        [projectId, invalidateDetail],
    );

    const changeMemberRole = useCallback(
        async (userId: string, role: ProjectMemberRoleInput) => {
            if (!projectId) return;
            await appProjectsApi.changeMemberRole(projectId, userId, { role });
            invalidateDetail();
        },
        [projectId, invalidateDetail],
    );

    const removeMember = useCallback(
        async (userId: string) => {
            if (!projectId) return;
            await appProjectsApi.removeMember(projectId, userId);
            invalidateDetail();
        },
        [projectId, invalidateDetail],
    );

    useEmbeddingStatusPoll<ProjectFileType>({
        items: files,
        getId: (file) => file._id,
        getStatus: (file) => file.embedding_status,
        fetchFile: async (id, signal) => mapProjectFile((await appMediaApi.getFile(id, { signal })) as never),
        onUpdate: updateFile,
    });

    return {
        project: projectQuery.data ?? null,
        isError: projectQuery.isError,
        error: projectQuery.error,
        files,
        isFilesLoading: filesQuery.isLoading,
        hasNextFilesPage: filesQuery.hasNextPage,
        isFetchingNextFilesPage: filesQuery.isFetchingNextPage,
        fetchNextFilesPage: filesQuery.fetchNextPage,
        chats: (chatsQuery.data?.pages ?? []).flatMap((p) => p.chats),
        isChatsLoading: chatsQuery.isLoading,
        hasNextChatsPage: chatsQuery.hasNextPage,
        isFetchingNextChatsPage: chatsQuery.isFetchingNextPage,
        fetchNextChatsPage: chatsQuery.fetchNextPage,
        sharedChats: (sharedChatsQuery.data?.pages ?? []).flatMap((p) => p.chats),
        isSharedChatsLoading: sharedChatsQuery.isLoading,
        hasNextSharedChatsPage: sharedChatsQuery.hasNextPage,
        isFetchingNextSharedChatsPage: sharedChatsQuery.isFetchingNextPage,
        fetchNextSharedChatsPage: sharedChatsQuery.fetchNextPage,
        activities: (activitiesQuery.data?.pages ?? []).flatMap((p) => p.activities),
        isActivitiesLoading: activitiesQuery.isLoading,
        hasNextActivitiesPage: activitiesQuery.hasNextPage,
        isFetchingNextActivitiesPage: activitiesQuery.isFetchingNextPage,
        fetchNextActivitiesPage: activitiesQuery.fetchNextPage,
        actions: {
            updateProject,
            deleteProject,
            pinProject,
            setInstructions,
            uploadFiles,
            removeFile,
            renameChat,
            deleteChat,
            removeChatFromProject,
            moveChatToProject,
            addMember,
            changeMemberRole,
            removeMember,
        },
    };
};
