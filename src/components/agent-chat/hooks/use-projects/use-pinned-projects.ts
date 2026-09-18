import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { appProjectsApi, type ProjectMemberRoleInput, type UpdateProjectPayload } from '@/lib/api/app/projects';
import { mapProject } from '@/types/project';

import { PINNED_PAGE_SIZE } from './constants';
import { projectsKeys } from './query-keys';
import type { ProjectsListPage } from './types';

export const usePinnedProjects = (agentId: string, enabled = true) => {
    const queryClient = useQueryClient();
    const pinnedKey = projectsKeys.pinned(agentId);

    const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery<
        ProjectsListPage,
        Error,
        { pages: ProjectsListPage[] },
        ReturnType<typeof projectsKeys.pinned>,
        number
    >({
        queryKey: pinnedKey,
        enabled: Boolean(agentId) && enabled,
        initialPageParam: 0,
        queryFn: async ({ pageParam, signal }) => {
            const raw = await appProjectsApi.listProjects<unknown>(
                {
                    agentId,
                    pinned: true,
                    sortBy: 'pinnedAt:desc',
                    page: pageParam,
                    size: PINNED_PAGE_SIZE,
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

    const pinnedProjects = useMemo(() => (data?.pages ?? []).flatMap((page) => page.projects), [data]);

    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['projects', agentId] });
    }, [agentId, queryClient]);

    const removeFromPinnedCache = useCallback(
        (projectId: string) => {
            queryClient.setQueryData<InfiniteData<ProjectsListPage, number>>(pinnedKey, (current) => {
                if (!current?.pages) return current;

                return {
                    ...current,
                    pages: current.pages.map((page) => ({
                        ...page,
                        projects: page.projects.filter((project) => project._id !== projectId),
                    })),
                };
            });
        },
        [pinnedKey, queryClient],
    );

    const unpinProject = useCallback(
        async (projectId: string) => {
            removeFromPinnedCache(projectId);
            try {
                await appProjectsApi.pinProject(projectId);
            } finally {
                invalidate();
            }
        },
        [removeFromPinnedCache, invalidate],
    );

    const deleteProject = useCallback(
        async (projectId: string) => {
            await appProjectsApi.deleteProject(projectId);
            invalidate();
        },
        [invalidate],
    );

    const updateProject = useCallback(
        async (projectId: string, patch: UpdateProjectPayload) => {
            await appProjectsApi.updateProject(projectId, patch);
            invalidate();
            // The detail cache feeds the edit-dialog seed, the space name, and the
            // local-tools folder gating (status chip). A lists-only invalidation
            // left them on pre-save data indefinitely — a mounted query never
            // refetches merely by going stale (observed: folderPath saved in the
            // DB while the dialog showed empty and the chip said "off").
            queryClient.invalidateQueries({ queryKey: projectsKeys.detail(projectId) });
        },
        [invalidate, queryClient],
    );

    const addMember = useCallback(
        async (projectId: string, userId: string, role: ProjectMemberRoleInput) => {
            await appProjectsApi.addMember(projectId, { userId, role });
            invalidate();
        },
        [invalidate],
    );

    const changeMemberRole = useCallback(
        async (projectId: string, userId: string, role: ProjectMemberRoleInput) => {
            await appProjectsApi.changeMemberRole(projectId, userId, { role });
            invalidate();
        },
        [invalidate],
    );

    const removeMember = useCallback(
        async (projectId: string, userId: string) => {
            await appProjectsApi.removeMember(projectId, userId);
            invalidate();
        },
        [invalidate],
    );

    return {
        pinnedProjects,
        isPinnedProjectsLoading: isLoading,
        hasNextPinnedProjectsPage: Boolean(hasNextPage),
        isFetchingNextPinnedProjectsPage: isFetchingNextPage,
        fetchNextPinnedProjects: fetchNextPage,
        pinnedActions: {
            unpinProject,
            deleteProject,
            updateProject,
            addMember,
            changeMemberRole,
            removeMember,
        },
    };
};
