import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { projectsKeys, type ProjectsListPage } from '@/components/agent-chat/hooks/use-projects';
import { appProjectsApi } from '@/lib/api/app/projects';
import { mapProject } from '@/types/project';

const UNPINNED_PAGE_SIZE = 30;

export const useUnpinnedProjects = (agentId: string, enabled = true) => {
    const queryClient = useQueryClient();
    const unpinnedKey = projectsKeys.unpinned(agentId);

    const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery<
        ProjectsListPage,
        Error,
        { pages: ProjectsListPage[] },
        ReturnType<typeof projectsKeys.unpinned>,
        number
    >({
        queryKey: unpinnedKey,
        enabled: Boolean(agentId) && enabled,
        initialPageParam: 0,
        queryFn: async ({ pageParam, signal }) => {
            const raw = await appProjectsApi.listProjects<unknown>(
                {
                    agentId,
                    pinned: false,
                    sortBy: 'updatedAt:desc',
                    page: pageParam,
                    size: UNPINNED_PAGE_SIZE,
                },
                { signal },
            );

            return {
                projects: raw.values.map((value) => mapProject(value as never)),
                page: raw.pageInfo.page,
                totalPages: raw.pageInfo.totalPages,
            };
        },
        getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined),
    });

    const unpinnedProjects = useMemo(() => (data?.pages ?? []).flatMap((page) => page.projects), [data]);

    const pinProject = useCallback(
        async (projectId: string) => {
            queryClient.setQueryData<InfiniteData<ProjectsListPage, number>>(
                projectsKeys.unpinned(agentId),
                (current) => {
                    if (!current?.pages) return current;

                    return {
                        ...current,
                        pages: current.pages.map((page) => ({
                            ...page,
                            projects: page.projects.filter((project) => project._id !== projectId),
                        })),
                    };
                },
            );

            try {
                await appProjectsApi.pinProject(projectId);
            } finally {
                await queryClient.invalidateQueries({ queryKey: ['projects', agentId] });
            }
        },
        [agentId, queryClient],
    );

    return {
        unpinnedProjects,
        isUnpinnedProjectsLoading: isLoading,
        isUnpinnedProjectsError: isError,
        hasNextUnpinnedProjectsPage: Boolean(hasNextPage),
        isFetchingNextUnpinnedProjectsPage: isFetchingNextPage,
        fetchNextUnpinnedProjects: fetchNextPage,
        pinProject,
    };
};

export type UnpinnedProjectsState = ReturnType<typeof useUnpinnedProjects>;
