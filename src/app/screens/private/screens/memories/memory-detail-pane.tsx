import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    BotIcon,
    BrainCircuitIcon,
    ChevronLeftIcon,
    CircleAlertIcon,
    InfoIcon,
    RefreshCwIcon,
    ToggleRightIcon,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { isLearnedHintHiddenFrom, LearnedHintDocsNotice } from '@/app/components/memory/learned-hint-visibility';
import { LearnMoreLink } from '@/components';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleSwitch as Switch } from '@/components/ui/toggle-switch';
import useInfiniteScroll from '@/hooks/use-infinite-scroll';
import { useAppSelector } from '@/hooks/use-typed-redux';
import { adminMemoriesApi } from '@/lib/api/admin/memories';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import { YOUTUBE_VIDEO_EMBED_KEYS, type MemoryType } from '@/types/admin';

import { useMemoryDetailQuery, useMemoryDocsInfiniteQuery, type MemoryDocsSort } from './hooks/use-memories-queries';
import MemoryDocsTable from './memory-docs-table';

const SECTION_CARD = 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4';
const DOCS_STATE = 'flex flex-col items-center gap-3 px-4 py-10 text-center';
const DOCS_STATE_ICON = 'flex size-11 items-center justify-center rounded-[14px]';

interface MemoryDetailPaneProps {
    memoryId?: string;
    className?: string;
}

const MemoryDetailPane = ({ memoryId, className }: MemoryDetailPaneProps) => {
    const navigate = useNavigate();

    const queryClient = useQueryClient();

    const user = useAppSelector(selectUser);

    const { data: memory, isLoading: isDetailLoading, isError: isDetailError } = useMemoryDetailQuery(memoryId);

    const userId = user._id ?? undefined;

    const hidesLearnedHint = isLearnedHintHiddenFrom(memory?.kind, user.role);
    // Conversation memories and hidden learned hints explain themselves instead of listing
    // docs, so neither fetches. The kind is only known once the detail lands, so the docs
    // request waits for it — an admin-only hint must never be fetched speculatively.
    const needsDocs = !!memory && !hidesLearnedHint && memory.kind !== 'conversation';

    const [docsSort, setDocsSort] = useState<MemoryDocsSort>('updatedAt:desc');

    const {
        data: docsData,
        isPending: isDocsPending,
        isError: isDocsError,
        hasNextPage: hasMoreDocs,
        isFetchingNextPage: isFetchingMoreDocs,
        isFetching: isDocsFetching,
        fetchNextPage: fetchMoreDocs,
        refetch: refetchDocs,
    } = useMemoryDocsInfiniteQuery(memoryId, userId, needsDocs, docsSort);

    // A query disabled for a missing user id also reports `isPending`, so both cases
    // show the skeleton — an unanswered request must never read as "nothing stored".
    const isDocsLoading = !userId || isDocsPending;
    const docs = docsData?.pages.flatMap((page) => page.values) ?? [];
    const docsTotal = docsData?.pages[0]?.pageInfo.totalCount ?? 0;

    const onLoadMoreDocs = useCallback(() => {
        if (hasMoreDocs) fetchMoreDocs();
    }, [hasMoreDocs, fetchMoreDocs]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: isDocsLoading,
        showMoreLoading: isFetchingMoreDocs,
        hasMore: !!hasMoreDocs,
        itemsLength: docs.length,
        onLoadMore: onLoadMoreDocs,
    });

    const isRemembering = memory ? !memory.preference?.disabled : true;

    const toggleMutation = useMutation({
        mutationFn: (disabled: boolean) => adminMemoriesApi.setPreference(memoryId!, { disabled }),
        onMutate: async (disabled) => {
            if (!memoryId) return;
            await queryClient.cancelQueries({ queryKey: ['memories', 'detail', memoryId] });
            const previous = queryClient.getQueryData<MemoryType>(['memories', 'detail', memoryId]);

            queryClient.setQueryData(['memories', 'detail', memoryId], (old: MemoryType | undefined) => {
                if (!old) return old;

                return {
                    ...old,
                    preference: { ...old.preference, disabled },
                };
            });

            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous && memoryId) {
                queryClient.setQueryData(['memories', 'detail', memoryId], context.previous);
            }
        },
        onSuccess: (response) => {
            if (memoryId && response) {
                queryClient.setQueryData(['memories', 'detail', memoryId], (old: MemoryType | undefined) => {
                    if (!old) return old;

                    return {
                        ...old,
                        preference: { ...old.preference, disabled: response.disabled },
                    };
                });
                queryClient.invalidateQueries({ queryKey: ['memories', 'catalog'] });
            }
        },
    });

    const toggle = () => toggleMutation.mutate(isRemembering);
    const isToggling = toggleMutation.isPending;

    const renderConversationDocsEmpty = () => (
        <div className={DOCS_STATE}>
            <span
                className={cn(
                    DOCS_STATE_ICON,
                    'bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] text-primary',
                    'border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]',
                )}
            >
                <BrainCircuitIcon size={18} aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-(--text-primary)">Your chats are the memory</span>
                <span className="max-w-[300px] text-xs leading-normal text-text-secondary">
                    Open a linked agent and look at your conversation list — those chats are what we know and use to
                    help next time.
                </span>
            </div>
        </div>
    );

    const renderDocsContent = (kind?: string) => {
        if (kind === 'conversation') {
            return renderConversationDocsEmpty();
        }

        if (hidesLearnedHint) {
            return <LearnedHintDocsNotice />;
        }

        if (isDocsLoading) {
            return (
                <div className="flex flex-col">
                    {[...Array(3)].map((_, index) => (
                        <div
                            key={`memory-doc-skeleton-${index}`}
                            className="flex items-center gap-5 border-b border-border px-4 py-3 last:border-b-0"
                        >
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    ))}
                </div>
            );
        }

        if (isDocsError) {
            return (
                <div className={DOCS_STATE}>
                    <span
                        className={cn(
                            DOCS_STATE_ICON,
                            'bg-[color-mix(in_srgb,var(--destructive)_8%,var(--surface))] text-destructive',
                            'border border-[color-mix(in_srgb,var(--destructive)_14%,var(--border))]',
                        )}
                    >
                        <CircleAlertIcon size={18} aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-(--text-primary)">Failed to load memories</span>
                        <span className="max-w-[260px] text-xs leading-normal text-text-secondary">
                            Check your connection and try again.
                        </span>
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-[10px]"
                        disabled={isDocsFetching}
                        onClick={() => void refetchDocs()}
                    >
                        <RefreshCwIcon className={cn('size-4', isDocsFetching && 'animate-spin')} aria-hidden="true" />
                        Retry
                    </Button>
                </div>
            );
        }

        if (docs.length === 0) {
            return (
                <div className={DOCS_STATE}>
                    <span
                        className={cn(
                            DOCS_STATE_ICON,
                            'bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] text-primary',
                            'border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]',
                        )}
                    >
                        <BrainCircuitIcon size={18} aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-(--text-primary)">No memories stored yet</span>
                        <span className="max-w-[260px] text-xs leading-normal text-text-secondary">
                            Anything worth remembering from your conversations will show up here.
                        </span>
                    </div>
                </div>
            );
        }

        return (
            <>
                <MemoryDocsTable key={memoryId} docs={docs} sort={docsSort} onSortChange={setDocsSort} />
                <InfiniteScrollTrigger
                    loadMoreRef={loadMoreRef}
                    isLoading={isFetchingMoreDocs}
                    hasMore={!!hasMoreDocs}
                />
            </>
        );
    };

    const renderBackButton = () => (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 w-fit lg:hidden"
            onClick={() => navigate('/settings/memories')}
        >
            <ChevronLeftIcon className="size-4" />
            Memories
        </Button>
    );

    if (!memoryId) {
        return (
            <div className={cn('flex items-center justify-center bg-background p-6', className)}>
                <Card className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-2xl border border-border-secondary p-8 text-center shadow-none">
                    <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                        <BrainCircuitIcon size={34} />
                    </div>

                    <div className="mx-auto flex max-w-md flex-col gap-2">
                        <Badge
                            variant="secondary"
                            className="mx-auto w-fit border-transparent bg-primary/10 text-primary"
                        >
                            Memories
                        </Badge>
                        <h2 className="text-2xl font-semibold tracking-tight">Select a memory to get started</h2>
                        <p className="text-sm leading-6 text-muted-foreground">
                            Choose a memory from the list to view its details, manage its status, and explore linked
                            agents.
                        </p>
                    </div>

                    <div className="grid w-full grid-cols-3 gap-4">
                        {[
                            { icon: ChevronLeftIcon, label: 'Pick a memory' },
                            { icon: InfoIcon, label: 'View details' },
                            { icon: ToggleRightIcon, label: 'Toggle status' },
                        ].map(({ icon: Icon, label }) => (
                            <div key={label} className="flex flex-col items-center gap-3 rounded-xl bg-muted/40 p-4">
                                <Icon size={20} className="text-primary" />
                                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                            </div>
                        ))}
                    </div>
                    <LearnMoreLink embedKey={YOUTUBE_VIDEO_EMBED_KEYS.memory} label="Learn more about memories" />
                </Card>
            </div>
        );
    }

    if (isDetailLoading) {
        return (
            <div className={cn('memory-detail-pane flex h-full min-h-0 flex-col bg-background', className)}>
                <div className="memory-detail-pane-header shrink-0 border-b border-border py-4 lg:px-4 lg:py-5">
                    <div className="memory-detail-inner mx-auto flex w-full max-w-4xl flex-col gap-2">
                        {renderBackButton()}
                        <div className="flex items-start gap-3 lg:gap-4">
                            <Skeleton className="size-13 shrink-0 rounded-xl" />
                            <div className="flex flex-1 flex-col gap-2 pt-1">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-6 w-48" />
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                </div>
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                            <div className="ml-auto flex shrink-0 items-center gap-3">
                                <Skeleton className="h-5 w-14" />
                                <Skeleton className="h-5 w-9 rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="memory-detail-pane-body scrollbar-controller scrollbar-vertical min-h-0 flex-1 py-4 lg:px-4">
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                        <div className={SECTION_CARD}>
                            <Skeleton className="h-5 w-16" />
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                <Skeleton className="h-10" />
                                <Skeleton className="h-10" />
                            </div>
                        </div>
                        <div className={SECTION_CARD}>
                            <Skeleton className="h-5 w-24" />
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Skeleton className="h-14 rounded-lg" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isDetailError || !memory) {
        return (
            <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
                {renderBackButton()}
                <p className="text-sm text-destructive">Failed to load memory details</p>
            </div>
        );
    }

    const renderStatusLabel = () => {
        if (isToggling) return 'Updating...';
        if (isRemembering) return 'Enabled';

        return 'Disabled';
    };

    const renderDetails = () => {
        const items = [
            { label: 'Kind', value: memory.kind, raw: false },
            { label: 'Scope', value: memory.scope, raw: false },
        ].filter((item) => item.value !== undefined && item.value !== null && item.value !== '');

        if (items.length === 0) return null;

        return (
            <div className={SECTION_CARD}>
                <h4 className="text-sm font-semibold">Details</h4>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                    {items.map((item) => (
                        <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
                            <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
                            <dd
                                className={cn(
                                    'min-w-0 text-sm font-medium break-all',
                                    item.raw ? 'font-mono' : 'capitalize',
                                )}
                            >
                                {item.raw ? String(item.value) : String(item.value).replaceAll('_', ' ')}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>
        );
    };

    const renderLinkedAgents = () => {
        const agents = memory.agents ?? [];

        return (
            <div className={cn('memory-detail-pane-agents', SECTION_CARD)}>
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                    Linked Agents
                    {agents.length > 0 && (
                        <Badge className="h-5 min-w-5 justify-center rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                            {agents.length}
                        </Badge>
                    )}
                </h4>
                {agents.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No agents linked</span>
                ) : (
                    <div className="memory-detail-pane-agents-list grid grid-cols-1 gap-3 md:grid-cols-2">
                        {agents.map((agent) => {
                            const content = (
                                <>
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                                        <BotIcon className="size-4" aria-hidden="true" />
                                    </span>
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate font-mono text-sm font-medium text-foreground">
                                            {agent.name}
                                        </span>
                                        {agent.slug && (
                                            <span className="truncate text-[10px] tracking-wider text-muted-foreground uppercase">
                                                {agent.slug}
                                            </span>
                                        )}
                                    </div>
                                </>
                            );

                            if (agent.slug) {
                                return (
                                    <Link
                                        key={agent._id}
                                        to={`/agent/${agent.slug}`}
                                        className={cn(
                                            'flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5',
                                            'transition-colors hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                                        )}
                                    >
                                        {content}
                                    </Link>
                                );
                            }

                            return (
                                <div
                                    key={agent._id}
                                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                                >
                                    {content}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={cn('memory-detail-pane flex h-full min-h-0 flex-col bg-background', className)}>
            <div className="memory-detail-pane-header shrink-0 border-b border-border py-4 lg:px-4 lg:py-5">
                <div className="memory-detail-inner mx-auto flex w-full max-w-4xl flex-col gap-2">
                    {renderBackButton()}
                    <div className="memory-detail-pane-header-content flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3 lg:gap-4">
                            <div className="flex size-13 shrink-0 items-center justify-center rounded-xl border border-border bg-card p-1">
                                <BrainCircuitIcon className="size-6 text-primary" aria-hidden="true" />
                            </div>
                            <div className="memory-detail-pane-header-content-details flex min-w-0 flex-1 flex-col gap-1">
                                <div className="memory-detail-pane-header-content-right-badges flex min-w-0 flex-wrap items-center gap-1">
                                    <h2
                                        title={memory.name}
                                        className="max-w-full min-w-0 truncate font-mono text-lg font-semibold tracking-tight"
                                    >
                                        {memory.name}
                                    </h2>
                                    <Badge
                                        variant="secondary"
                                        className="w-fit rounded-full border-transparent bg-primary/10 px-2.5 font-normal text-primary capitalize"
                                    >
                                        {memory.kind.replaceAll('_', ' ')}
                                    </Badge>
                                </div>
                                <span
                                    title={memory.refName}
                                    className="min-w-0 truncate font-mono text-sm text-muted-foreground"
                                >
                                    {memory.refName}
                                </span>
                                {memory.description && (
                                    <span className="line-clamp-2 text-sm text-muted-foreground">
                                        {memory.description}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-3">
                            <span className="text-sm font-medium">{renderStatusLabel()}</span>
                            <Switch
                                aria-label="Toggle memory"
                                checked={isRemembering}
                                onCheckedChange={toggle}
                                disabled={isToggling}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="memory-detail-pane-body scrollbar-controller scrollbar-vertical min-h-0 flex-1 py-4 lg:px-4">
                <div className="memory-detail-pane-content mx-auto flex w-full max-w-4xl flex-col gap-4">
                    {renderDetails()}
                    {renderLinkedAgents()}

                    <div className="memory-detail-pane-docs flex flex-col overflow-hidden rounded-xl border border-border bg-card">
                        <div className="border-b border-border px-4 py-3.5">
                            <h4 className="flex items-center gap-2 text-sm font-semibold">
                                {memory.kind === 'conversation' || hidesLearnedHint
                                    ? 'How this memory works'
                                    : 'Here is what we know about you'}
                                {memory.kind !== 'conversation' && !hidesLearnedHint && docsTotal > 0 && (
                                    <Badge className="h-5 min-w-5 justify-center rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                                        {docsTotal}
                                    </Badge>
                                )}
                            </h4>
                        </div>
                        {renderDocsContent(memory.kind)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MemoryDetailPane;
