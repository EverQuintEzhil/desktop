import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CheckIcon, PlusIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useCreateSpaceDialog } from '@/components/agent-chat/projects/create-space-dialog-context';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import Spinner from '@/components/ui/spinner';
import { useInfiniteScroll } from '@/hooks';
import { appProjectsApi } from '@/lib/api/app/projects';
import { mapProject, type ProjectType } from '@/types/project';

interface Props {
    agentId: string;
    selectedProjectId?: string;
    onSelect: (projectId: string | null, project?: ProjectType) => void;
}

function SearchInput({ search, setSearch }: { search: string; setSearch: (val: string) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (inputRef.current) inputRef.current.focus();
        }, 50);

        return () => clearTimeout(timer);
    }, []);

    return (
        <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search spaces"
            className="w-full bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
    );
}

const SpacePickerList = ({ agentId, selectedProjectId, onSelect }: Props) => {
    const [search, setSearch] = useState('');
    const createSpaceDialog = useCreateSpaceDialog();

    const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['projects-picker', agentId, search.trim()],
        queryFn: async ({ pageParam, signal }) => {
            const raw = await appProjectsApi.listProjects<unknown>(
                {
                    agentId,
                    search: search.trim(),
                    page: pageParam,
                    size: 20,
                },
                { signal },
            );

            return {
                projects: raw.values.map((value) => mapProject(value as never)),
                page: raw.pageInfo.page,
                totalPages: raw.pageInfo.totalPages,
            };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined),
    });

    const { data: selectedProject } = useQuery({
        queryKey: ['project', selectedProjectId],
        enabled: Boolean(selectedProjectId),
        queryFn: async ({ signal }) => {
            const raw = await appProjectsApi.getProject<unknown>(selectedProjectId!, { signal });

            return mapProject(raw as never);
        },
    });

    let projectsList = (data?.pages ?? []).flatMap((page) => page.projects);

    if (
        selectedProject &&
        !projectsList.some((p) => p._id === selectedProject._id) &&
        (!search.trim() || selectedProject.name.toLowerCase().includes(search.trim().toLowerCase()))
    ) {
        projectsList = [selectedProject, ...projectsList];
    }

    const projects = projectsList.sort((a, b) => {
        if (a._id === selectedProjectId) return -1;
        if (b._id === selectedProjectId) return 1;

        return 0;
    });

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: Boolean(hasNextPage),
        itemsLength: projects.length,
        onLoadMore: () => {
            if (hasNextPage) fetchNextPage();
        },
    });

    const renderRows = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center py-3">
                    <Spinner />
                </div>
            );
        }

        if (projects.length === 0) {
            return <div className="px-3 py-3 text-center text-sm text-text-secondary">No spaces</div>;
        }

        return (
            <>
                {projects.map((project) => (
                    <DropdownMenuItem
                        key={project._id}
                        className="flex cursor-pointer items-center justify-between gap-2"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (project._id === selectedProjectId) return;
                            onSelect(project._id, project);
                        }}
                    >
                        <span className="min-w-0 truncate">{project.name}</span>
                        <div className="flex shrink-0 items-center gap-2">
                            {!project.isPrivate ? <span className="text-xs text-text-secondary">Shared</span> : null}
                            {project._id === selectedProjectId && (
                                <CheckIcon className="size-3.5 shrink-0 text-primary" />
                            )}
                        </div>
                    </DropdownMenuItem>
                ))}
                <InfiniteScrollTrigger
                    loadMoreRef={loadMoreRef}
                    isLoading={isFetchingNextPage}
                    hasMore={Boolean(hasNextPage)}
                    renderLoader={() => (
                        <div className="flex justify-center py-2">
                            <Spinner />
                        </div>
                    )}
                />
            </>
        );
    };

    const renderCreateRow = () => {
        if (!createSpaceDialog) return null;

        return (
            <>
                <DropdownMenuSeparator className="my-0" />
                <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        createSpaceDialog.openCreateSpace({
                            agentId,
                            onCreated: (project) => onSelect(project._id, project),
                        });
                    }}
                >
                    <PlusIcon className="size-3.5" />
                    Start a new space
                </DropdownMenuItem>
            </>
        );
    };

    return (
        <>
            <div className="space-picker-list-search border-b border-border p-2">
                <SearchInput search={search} setSearch={setSearch} />
            </div>
            <div className="space-picker-list-rows scrollbar-vertical scrollbar-controller max-h-[min(240px,calc(var(--radix-dropdown-menu-content-available-height,100vh)-8rem))] py-1">
                {renderRows()}
            </div>
            {renderCreateRow()}
        </>
    );
};

export default SpacePickerList;
