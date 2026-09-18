import { ArrowLeftIcon, BotIcon, BrainCircuitIcon, XIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { isLearnedHintHiddenFrom, LearnedHintDocsNotice } from '@/app/components/memory/learned-hint-visibility';
import { PickerDetailSkeleton } from '@/app/components/picker/picker-detail-skeleton';
import {
    actionBase,
    actionRemove,
    getItemAbbr,
    getItemColor,
    panelBtnCls,
    pickerFormWrapCls,
    type PickerItem,
} from '@/app/components/picker/picker-shared';
import { useMemoryDocsInfiniteQuery } from '@/app/screens/private/screens/memories/hooks/use-memories-queries';
import MemoryDocsTable from '@/app/screens/private/screens/memories/memory-docs-table';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import useInfiniteScroll from '@/hooks/use-infinite-scroll';
import { useMemoryByIdQuery } from '@/lib/api/admin/memories';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';

interface MemoryDetailPanelProps {
    item: PickerItem;
    isEnabled: boolean;
    onToggle: () => void;
    onBack: () => void;
    onClose: () => void;
}

const formatKind = (kind?: string): string => {
    if (!kind) return 'memory';

    return kind.replaceAll('_', ' ');
};

export const MemoryDetailPanel = ({ item, isEnabled, onToggle, onBack, onClose }: MemoryDetailPanelProps) => {
    const user = useSelector(selectUser);
    const { data: memory, isLoading: isDetailLoading } = useMemoryByIdQuery(item._id);
    const userId = user._id ?? undefined;

    const hidesLearnedHint = isLearnedHintHiddenFrom(memory?.kind, user.role);
    // The kind is only known once the detail lands, so the docs request waits for it —
    // an admin-only learned hint must never be fetched speculatively.
    const needsDocs = !!memory && !hidesLearnedHint && memory.kind !== 'conversation';

    const {
        data: docsData,
        isPending: isDocsPending,
        isError: isDocsError,
        hasNextPage: hasMoreDocs,
        isFetchingNextPage: isFetchingMoreDocs,
        fetchNextPage: fetchMoreDocs,
    } = useMemoryDocsInfiniteQuery(item._id, userId, needsDocs);

    const isDocsLoading = !userId || isDocsPending;
    const docs = docsData?.pages.flatMap((page) => page.values) ?? [];

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

    const abbr = getItemAbbr(item.name);
    const color = getItemColor(item._id);
    const description = memory?.description ?? item.description;
    const kindLabel = formatKind(memory?.kind);
    const agents = memory?.agents ?? [];

    const renderConversationDocs = () => (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <span
                className={cn(
                    'flex size-11 items-center justify-center rounded-[14px] text-primary',
                    'bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))]',
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

    const renderDocsBody = () => {
        if (isDocsLoading) {
            return (
                <div className="flex flex-col gap-3 py-2">
                    {Array.from({ length: 3 }, (_, index) => (
                        <Skeleton key={`memory-doc-skeleton-${index}`} className="h-4 w-full" />
                    ))}
                </div>
            );
        }

        if (isDocsError) {
            return (
                <span className="block py-2 text-xs text-text-secondary">
                    Couldn&apos;t load what we know about you. Try again later.
                </span>
            );
        }

        if (docs.length === 0) {
            return (
                <div className="flex flex-col gap-1 py-2">
                    <span className="text-sm font-medium text-foreground">No memories stored yet</span>
                    <span className="text-xs leading-normal text-text-secondary">
                        Anything worth remembering from your conversations will show up here.
                    </span>
                </div>
            );
        }

        return (
            <>
                <MemoryDocsTable key={item._id} docs={docs} />
                <InfiniteScrollTrigger
                    loadMoreRef={loadMoreRef}
                    isLoading={isFetchingMoreDocs}
                    hasMore={!!hasMoreDocs}
                />
            </>
        );
    };

    const agentChipCls = cn(
        'inline-flex h-7 max-w-full items-center gap-1.5 rounded-full pr-3 pl-2 text-sm whitespace-nowrap text-(--text-primary)',
        'border border-[color-mix(in_srgb,var(--border)_86%,var(--primary))] bg-[color-mix(in_srgb,var(--primary)_4%,var(--surface))]',
        'transition-[border-color] duration-140 hover:border-[color-mix(in_srgb,var(--primary)_32%,var(--border))]',
    );

    const renderLinkedAgents = () => (
        <div className="mt-5 flex flex-col gap-3">
            <h4 className="text-sm font-semibold">Linked Agents</h4>
            {agents.length === 0 ? (
                <span className="text-center text-sm text-muted-foreground">No agents linked</span>
            ) : (
                <div className="flex flex-wrap items-center justify-start gap-2">
                    {agents.map((agent) => {
                        const chip = (
                            <>
                                <BotIcon className="size-3 shrink-0 text-primary" aria-hidden="true" />
                                <span className="max-w-[160px] truncate">{agent.name}</span>
                            </>
                        );

                        if (agent.slug) {
                            return (
                                <Link
                                    key={agent._id}
                                    to={`/agent/${agent.slug}`}
                                    className={cn(
                                        agentChipCls,
                                        'focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                                    )}
                                >
                                    {chip}
                                </Link>
                            );
                        }

                        return (
                            <span key={agent._id} className={agentChipCls}>
                                {chip}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderDocsSection = () => {
        // The detail has settled by now, so a missing memory means it failed — without this
        // the docs query stays disabled and the skeleton would never resolve.
        if (!memory) {
            return (
                <div className="mt-5 flex flex-col gap-1">
                    <h4 className="text-sm font-semibold">Here is what we know about you</h4>
                    <span className="block py-2 text-xs text-text-secondary">
                        Couldn&apos;t load this memory. Try again later.
                    </span>
                </div>
            );
        }

        if (memory.kind === 'conversation') {
            return (
                <div className="mt-5 flex flex-col gap-3">
                    <h4 className="text-sm font-semibold">How this memory works</h4>
                    {renderConversationDocs()}
                </div>
            );
        }

        if (hidesLearnedHint) {
            return (
                <div className="mt-5 flex flex-col gap-3">
                    <h4 className="text-sm font-semibold">How this memory works</h4>
                    <LearnedHintDocsNotice className="py-8" />
                </div>
            );
        }

        return (
            <div className="mt-5 flex flex-col gap-1">
                <h4 className="text-sm font-semibold">Here is what we know about you</h4>
                {renderDocsBody()}
            </div>
        );
    };

    const renderContent = () => {
        if (isDetailLoading) {
            return <PickerDetailSkeleton hasServerUrl={false} />;
        }

        return (
            <>
                <p className="m-0 text-sm leading-[1.6] text-text-secondary">
                    {description ||
                        'No description has been provided for this item yet. You can still add it and configure how your agent uses it.'}
                </p>
                {renderLinkedAgents()}
                {renderDocsSection()}
            </>
        );
    };

    return (
        <>
            <div className="modal-agent-header sticky top-0 z-2 flex h-[80px] items-center gap-3 border-b border-border bg-card px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('sm:hidden', panelBtnCls)}
                    aria-label="Back"
                    onClick={onBack}
                >
                    <ArrowLeftIcon size={17} aria-hidden="true" />
                </Button>
                <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-h4 font-bold text-white"
                    style={{ background: color }}
                >
                    {abbr}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <h3 className="truncate text-lg font-medium tracking-[-0.02em]">{item.name}</h3>
                    <span className="text-sm text-text-secondary capitalize">{kindLabel}</span>
                </div>
                <Button variant="ghost" size="icon" className={panelBtnCls} aria-label="Close" onClick={onClose}>
                    <XIcon size={17} aria-hidden="true" />
                </Button>
            </div>
            <div className={cn('modal-agent-content w-full px-4 py-6', pickerFormWrapCls)}>{renderContent()}</div>
            <div className="modal-agent-footer sticky bottom-0 z-1 mt-auto border-t border-border bg-card p-4">
                <div className={pickerFormWrapCls}>
                    <button className={cn(actionBase, isEnabled && actionRemove)} onClick={onToggle}>
                        {isEnabled ? 'Remove' : 'Enable'}
                    </button>
                </div>
            </div>
        </>
    );
};
