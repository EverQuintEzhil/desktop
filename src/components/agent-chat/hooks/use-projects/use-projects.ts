import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { appProjectsApi } from '@/lib/api/app/projects';
import { mapProject } from '@/types/project';

import { LIST_PAGE_SIZE } from './constants';
import { projectsKeys } from './query-keys';
import type { ProjectsListPage, UseProjectsOptions } from './types';

export const useProjects = ({ agentId, searchQuery, scope, sortBy }: UseProjectsOptions) => {
    const queryClient = useQueryClient();
    const search = searchQuery.trim();
    // "Your projects" → mineOnly true; "Shared with you" → mineOnly false.
    const mineOnly = scope === 'mine';

    const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery<
        ProjectsListPage,
        Error,
        { pages: ProjectsListPage[] },
        ReturnType<typeof projectsKeys.list>,
        number
    >({
        queryKey: projectsKeys.list(agentId, scope, sortBy, search),
        enabled: Boolean(agentId),
        initialPageParam: 0,
        queryFn: async ({ pageParam, signal }) => {
            const raw = await appProjectsApi.listProjects<unknown>(
                {
                    agentId,
                    search,
                    mineOnly,
                    sortBy,
                    page: pageParam,
                    size: LIST_PAGE_SIZE,
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

    const projects = useMemo(() => (data?.pages ?? []).flatMap((page) => page.projects), [data]);

    const createProject = useCallback(
        async (input: { name: string; description: string; instructions?: string }) => {
            const created = await appProjectsApi.createProject<unknown>({
                name: input.name,
                agentId,
                description: input.description,
                instructions: input.instructions ?? '',
            });

            await queryClient.invalidateQueries({ queryKey: ['projects', agentId] });

            return mapProject(created as never);
        },
        [agentId, queryClient],
    );

    const pinProject = useCallback(
        async (projectId: string) => {
            const listKey = ['projects', agentId] as const;

            queryClient.setQueriesData<{ pages: ProjectsListPage[] }>({ queryKey: listKey }, (current) => {
                if (!current?.pages) return current;

                return {
                    ...current,
                    pages: current.pages.map((page) => ({
                        ...page,
                        projects: page.projects.map((project) =>
                            project._id === projectId
                                ? { ...project, pinnedAt: project.pinnedAt ? null : new Date().toISOString() }
                                : project,
                        ),
                    })),
                };
            });

            try {
                await appProjectsApi.pinProject(projectId);
            } finally {
                await queryClient.invalidateQueries({ queryKey: listKey });
            }
        },
        [agentId, queryClient],
    );

    return {
        projects,
        isLoading,
        isError,
        hasNextPage: Boolean(hasNextPage),
        isFetchingNextPage,
        fetchNextPage,
        createProject,
        pinProject,
    };
};
