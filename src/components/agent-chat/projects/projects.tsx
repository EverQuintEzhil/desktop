import {
    ArrowDownUpIcon,
    CheckIcon,
    ChevronsUpDownIcon,
    FileTextIcon,
    FolderOpenIcon,
    InfoIcon,
    LockIcon,
    MessageSquareIcon,
    PaperclipIcon,
    PinIcon,
    PlusIcon,
} from 'lucide-react';
import { type MouseEvent, useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import SearchInput from '@/components/search-input';
import Avatar from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import useInfiniteScroll from '@/hooks/use-infinite-scroll';
import { getFilesDownloadUrl } from '@/lib/axios';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import type { ProjectScope, ProjectType } from '@/types/project';
import { showErrorToast, showSuccessToast } from '@/utils';

import AgentTitlePrefix from '../agent-title-prefix';
import { useProjects } from '../hooks/use-projects';
import useStickyHeader from '../hooks/use-sticky-header';

import CreateSpaceDialog from './create-space-dialog';
import SpacesInfoDialog from './spaces-info-dialog';

const EMPTY_STATE_ACTIONS = [
    { label: 'Chats', Icon: MessageSquareIcon },
    { label: 'Instructions', Icon: FileTextIcon },
    { label: 'Files', Icon: PaperclipIcon },
] as const;

type SortValue = 'updated' | 'created' | 'name' | 'pinned';

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
    { value: 'updated', label: 'Last updated' },
    { value: 'created', label: 'Date created' },
    { value: 'name', label: 'Name' },
    { value: 'pinned', label: 'Pinned chats' },
];

// `field:direction` sent as the backend `sortBy` param. Dates default to newest
// first (desc); name is alphabetical (asc). Flip any direction here if needed.
const SORT_PARAM: Record<SortValue, string> = {
    updated: 'updatedAt:desc',
    created: 'createdAt:desc',
    name: 'name:asc',
    pinned: 'pinnedAt:desc',
};

const SCOPE_TABS: { value: ProjectScope; label: string }[] = [
    { value: 'mine', label: 'Your spaces' },
    { value: 'shared', label: 'Shared with you' },
];

const formatShortDate = (iso: string): string => {
    if (!iso) return '';
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

interface Props {
    agent: ChatAgentType;
}

const Projects = (props: Props) => {
    const { agent } = props;
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [scope, setScope] = useState<ProjectScope>('mine');
    const [sort, setSort] = useState<SortValue>('updated');
    const activeSortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Sort';

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const isSticky = useStickyHeader(containerRef, { enterAt: 8, exitAt: 4 });

    const { projects, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage, pinProject } = useProjects({
        agentId: agent._id,
        searchQuery,
        scope,
        sortBy: SORT_PARAM[sort],
    });

    const [pinningIds, setPinningIds] = useState<ReadonlySet<string>>(new Set());

    const handlePin = useCallback(
        async (event: MouseEvent, project: ProjectType) => {
            event.preventDefault();
            event.stopPropagation();

            if (pinningIds.has(project._id)) return;

            setPinningIds((prev) => new Set(prev).add(project._id));
            const wasPinned = Boolean(project.pinnedAt);

            try {
                await pinProject(project._id);
                showSuccessToast(wasPinned ? 'Space unpinned' : 'Space pinned');
            } catch {
                showErrorToast(wasPinned ? 'Failed to unpin space' : 'Failed to pin space');
            } finally {
                setPinningIds((prev) => {
                    const next = new Set(prev);

                    next.delete(project._id);

                    return next;
                });
            }
        },
        [pinProject, pinningIds],
    );

    const onLoadMore = useCallback(() => {
        if (hasNextPage) fetchNextPage();
    }, [hasNextPage, fetchNextPage]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: hasNextPage,
        itemsLength: projects.length,
        onLoadMore,
    });

    const renderCard = (project: ProjectType) => {
        const creator = project.creator ?? project.members.find((member) => member.role === 'owner');
        const creatorAvatar = creator?.avatar ? getFilesDownloadUrl(creator.avatar) : undefined;
        const isPinned = Boolean(project.pinnedAt);
        const isPinning = pinningIds.has(project._id);

        return (
            <div key={project._id} className="spaces-card-wrap group relative h-full">
                <Link to={`/agent/${agent.slug}/spaces/${project._id}`} className="block h-full no-underline">
                    <Card className="spaces-card h-full cursor-pointer gap-2 p-4 shadow-none transition-all hover:bg-(--surface-hover) hover:shadow-(--shadow-surface)">
                        <CardHeader className="spaces-card-header gap-0 px-0">
                            <CardTitle className="flex items-center gap-2 pr-9 text-base">
                                <span className="line-clamp-1 min-w-0 font-medium">{project.name}</span>
                                {project.isPrivate ? (
                                    <LockIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                ) : null}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="spaces-card-content flex grow flex-col gap-2 px-0">
                            <p className="line-clamp-2 text-sm text-text-secondary">
                                {project.description || 'No description'}
                            </p>
                            {scope === 'shared' && creator ? (
                                <div className="spaces-card-content-shared-with-you mt-auto flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Avatar size="sm" className="size-6" alt={creator.name} src={creatorAvatar} />
                                        <span className="line-clamp-1 text-xs font-medium text-foreground">
                                            {creator.name}
                                        </span>
                                    </div>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        Updated {formatShortDate(project.updatedAt)}
                                    </span>
                                </div>
                            ) : (
                                <span className="mt-auto text-xs text-muted-foreground">
                                    Updated {formatShortDate(project.updatedAt)}
                                </span>
                            )}
                        </CardContent>
                    </Card>
                </Link>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={isPinning}
                            onClick={(event) => handlePin(event, project)}
                            aria-label={isPinned ? 'Unpin space' : 'Pin space'}
                            aria-pressed={isPinned}
                            className={cn(
                                'absolute top-3 right-3 shrink-0 rounded-full',
                                isPinning || isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                            )}
                        >
                            <PinIcon className={cn(isPinned && 'fill-current text-primary')} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{isPinned ? 'Unpin space' : 'Pin space'}</TooltipContent>
                </Tooltip>
            </div>
        );
    };

    const isSearching = Boolean(searchQuery.trim());

    const renderEmptyTitle = () => {
        if (isSearching) return 'No spaces found';
        if (scope === 'shared') return 'Nothing shared with you yet';

        return 'No spaces yet';
    };

    const renderEmptyDescription = () => {
        if (isSearching) return 'Try a broader search or clear it to see more spaces.';
        if (scope === 'shared') return 'Spaces shared by teammates will show up here when they are available.';

        return 'Create a space to group chats, instructions, and files.';
    };

    const renderEmpty = () => (
        <div className="relative min-h-[48svh] overflow-hidden rounded-3xl border border-border-secondary bg-card px-4 py-8 text-center sm:p-10">
            <div className="relative mx-auto flex min-h-[36svh] max-w-xl flex-col items-center justify-center gap-6">
                <div className="relative">
                    <span className="absolute top-8 -left-10 hidden size-12 rotate-[-10deg] items-center justify-center rounded-2xl bg-primary/8 text-primary sm:flex">
                        <MessageSquareIcon className="size-5" />
                    </span>
                    <span className="absolute top-8 -right-10 hidden size-12 rotate-10 items-center justify-center rounded-2xl bg-primary/8 text-primary sm:flex">
                        <FileTextIcon className="size-5" />
                    </span>
                    <span className="flex size-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-[0_16px_40px] shadow-primary/22">
                        <FolderOpenIcon className="size-7" />
                    </span>
                </div>

                <div className="flex max-w-md flex-col items-center gap-2">
                    <span className="text-lg font-semibold text-foreground">{renderEmptyTitle()}</span>
                    <span className="text-sm leading-6 text-text-secondary">{renderEmptyDescription()}</span>
                </div>

                {isSearching ? (
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setSearchQuery('')}>
                        Clear search
                    </Button>
                ) : (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {EMPTY_STATE_ACTIONS.map(({ label, Icon }) => (
                            <span
                                key={label}
                                className="flex items-center gap-2 rounded-full border border-border-secondary bg-background px-3 py-1.5 text-xs font-medium text-text-secondary"
                            >
                                <Icon className="size-3.5 text-primary" />
                                {label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                    {[...Array(6)].map((_, index) => (
                        <Card key={`project-skeleton-${index}`} className="spaces-card h-full gap-2 p-4 shadow-none">
                            <CardHeader className="spaces-card-header gap-0 px-0">
                                <Skeleton className="h-5 w-1/2" />
                            </CardHeader>
                            <CardContent className="spaces-card-content flex grow flex-col gap-2 px-0">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="mt-auto h-3 w-1/4" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            );
        }
        if (isError) {
            return (
                <div className="flex min-h-[40svh] items-center justify-center">
                    <span className="text-sm text-text-secondary">Failed to load spaces</span>
                </div>
            );
        }
        if (projects.length === 0) {
            return renderEmpty();
        }

        return (
            <>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                    {projects.map(renderCard)}
                </div>
                <InfiniteScrollTrigger loadMoreRef={loadMoreRef} isLoading={isFetchingNextPage} hasMore={hasNextPage} />
            </>
        );
    };

    return (
        <div
            className="projects-container flex h-full w-full flex-col bg-background max-lg:pt-[50px]"
            ref={containerRef}
        >
            <div
                className={cn('projects-header sticky top-0 z-1 mx-auto w-full bg-background py-4 max-sm:gap-3', {
                    'shadow-[0_8px_10px_#00000008]': isSticky,
                })}
            >
                <div className="inner-container mx-auto flex w-full max-w-[928px] flex-col gap-4 px-4">
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                        <div className="projects-header-title flex min-w-0 items-center gap-1.5">
                            <AgentTitlePrefix agent={agent} />
                            <h2 className="shrink-0 text-xl font-bold">Spaces</h2>
                            <SimpleTooltip content="Info" side="bottom">
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="shrink-0 rounded-full"
                                    aria-label="What are Spaces?"
                                    onClick={() => setIsInfoOpen(true)}
                                >
                                    <InfoIcon className="size-4 text-primary" />
                                </Button>
                            </SimpleTooltip>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <DropdownMenuRoot>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="secondary" size="sm" className="h-8 gap-1.5 rounded-full">
                                        <ArrowDownUpIcon className="size-3.5 text-text-secondary" />
                                        <span className="text-sm">{activeSortLabel}</span>
                                        <ChevronsUpDownIcon className="size-3.5 text-text-secondary" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                    {SORT_OPTIONS.map(({ value, label }) => (
                                        <DropdownMenuItem
                                            key={value}
                                            className="cursor-pointer justify-between gap-2"
                                            onSelect={() => setSort(value)}
                                        >
                                            <span>{label}</span>
                                            <CheckIcon
                                                className={cn(
                                                    'size-4 text-primary',
                                                    value === sort ? 'opacity-100' : 'opacity-0',
                                                )}
                                            />
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenuRoot>
                            <Button size="sm" className="rounded-full" onClick={() => setIsCreateOpen(true)}>
                                <PlusIcon />
                                New space
                            </Button>
                        </div>
                    </div>

                    <SearchInput
                        search={searchQuery}
                        autoFocus={false}
                        searchOnChange
                        onChange={setSearchQuery}
                        placeholder="Search spaces..."
                        className="max-w-full"
                        inputClassName="rounded-3xl border-0 shadow-surface text-base h-[45px]"
                    />

                    <Tabs value={scope} onValueChange={(value) => setScope(value as ProjectScope)} className="gap-0">
                        <TabsList
                            variant="line"
                            className="h-9 w-full justify-start gap-4 border-b border-border-secondary p-0"
                        >
                            {SCOPE_TABS.map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className={cn(
                                        'h-9 flex-none rounded-none px-0 text-sm font-medium text-text-secondary',
                                        'after:bg-primary group-data-[orientation=horizontal]/tabs:after:-bottom-px!',
                                        'group-data-[orientation=horizontal]/tabs:after:h-px! hover:text-primary data-[state=active]:text-primary',
                                    )}
                                >
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div className="projects-list-block pt-2 pb-6">
                <div className="mx-auto flex w-full max-w-[928px] flex-col gap-4 px-4">{renderContent()}</div>
            </div>

            <CreateSpaceDialog
                agentId={agent._id}
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onCreated={(project) => navigate(`/agent/${agent.slug}/spaces/${project._id}`)}
            />
            <SpacesInfoDialog open={isInfoOpen} onOpenChange={setIsInfoOpen} />
        </div>
    );
};

export default Projects;
