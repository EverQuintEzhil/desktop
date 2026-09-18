import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CheckIcon, FolderIcon, PlusIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import {
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import Spinner from '@/components/ui/spinner';
import { useInfiniteScroll } from '@/hooks';
import { appProjectsApi } from '@/lib/api/app/projects';
import { mapProject } from '@/types/project';

import { useCreateSpaceDialog } from '../../projects/create-space-dialog-context';

export interface SpacesSubmenuProps {
    agentId: string;
    selectedProjectId?: string;
    label?: string;
    align?: 'start' | 'end';
    /** Receives the picked space, or `null` when the current selection is toggled off. */
    onSelect: (space: { _id: string; name: string } | null) => void;
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
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search spaces"
            className="w-full bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
    );
}

const SpacesSubmenu = ({
    agentId,
    selectedProjectId,
    label = 'Add to space',
    align = 'start',
    onSelect,
}: SpacesSubmenuProps) => {
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

    const renderCreateRow = () => {
        if (!createSpaceDialog) return null;

        return (
            <>
                <DropdownMenuSeparator className="my-0" />
                <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() =>
                        createSpaceDialog.openCreateSpace({
                            agentId,
                            onCreated: (project) => onSelect({ _id: project._id, name: project.name }),
                        })
                    }
                >
                    <PlusIcon className="size-4" />
                    Start a new space
                </DropdownMenuItem>
            </>
        );
    };

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
                <FolderIcon className="size-4" />
                {label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent align={align} className="w-[240px] p-0">
                <div className="border-b border-border p-2">
                    <SearchInput search={search} setSearch={setSearch} />
                </div>
                <div className="scrollbar-vertical scrollbar-controller max-h-[240px] py-1">
                    {(() => {
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
                                            // Re-selecting the current space is a no-op; just let the menu close.
                                            if (project._id === selectedProjectId) return;
                                            onSelect({ _id: project._id, name: project.name });
                                        }}
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            {project._id === selectedProjectId && (
                                                <CheckIcon className="size-3.5 shrink-0 text-primary" />
                                            )}
                                            <span className="truncate">{project.name}</span>
                                        </div>
                                        {!project.isPrivate ? (
                                            <span className="shrink-0 text-xs text-text-secondary">Shared</span>
                                        ) : null}
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
                    })()}
                </div>
                {renderCreateRow()}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
};

export default SpacesSubmenu;
