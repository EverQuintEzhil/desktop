import { useVirtualizer, useWindowVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';

import type { LibraryItem, LibrarySort } from '@/components/agent-chat/hooks/use-media-library';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import type { ArtifactHead } from '@/lib/api/app/artifact';
import { cn } from '@/lib/utils';

import LibraryArtifactRow from './library-artifact-row';
import LibraryFileRow, { getLibraryListGridCols } from './library-file-row';
import type { LibraryEntry } from './types';
import { countFileEntries } from './utils/library-entries';

interface LibraryVirtualizedListProps {
    entries: LibraryEntry[];
    onOpenLightbox: (item: LibraryItem) => void;
    onOpenArtifact: (artifact: ArtifactHead) => void;
    onDownloadArtifact: (artifact: ArtifactHead) => void;
    onDeleteArtifact: (artifact: ArtifactHead) => void;
    downloadingArtifactId: string | null;
    agentSlug?: string;
    currentUserId?: string;
    onOpenChat?: (item: LibraryItem) => void;
    onLike: (item: LibraryItem) => void;
    onDelete: (item: LibraryItem) => void;
    onDownload: (item: LibraryItem) => void;
    downloadingId: string | null;
    selectable: boolean;
    selectedIds: Set<string>;
    selectionActive: boolean;
    onToggleSelect: (id: string) => void;
    hasNextPage: boolean;
    isFetchingMore: boolean;
    onLoadMore: () => void;
    scrollRef?: RefObject<HTMLDivElement | null>;
    sort: LibrarySort;
    onSortChange: (sort: LibrarySort) => void;
    allSelected: boolean;
    onToggleSelectAll: () => void;
    showAgentLink: boolean;
}

type ListVirtualizer = Virtualizer<Window | HTMLDivElement, Element>;

interface ListRowsProps extends LibraryVirtualizedListProps {
    virtualizer: ListVirtualizer;
    parentRef: RefObject<HTMLDivElement | null>;
}

const ESTIMATED_ROW = 56;
const OVERSCAN = 6;

const ListRows = (props: ListRowsProps) => {
    const {
        entries,
        onOpenLightbox,
        onOpenArtifact,
        onDownloadArtifact,
        onDeleteArtifact,
        downloadingArtifactId,
        agentSlug,
        currentUserId,
        onOpenChat,
        onLike,
        onDelete,
        onDownload,
        downloadingId,
        selectable,
        selectedIds,
        selectionActive,
        onToggleSelect,
        hasNextPage,
        isFetchingMore,
        onLoadMore,
        virtualizer,
        parentRef,
        sort,
        onSortChange,
        allSelected,
        onToggleSelectAll,
        showAgentLink,
    } = props;

    const virtualItems = virtualizer.getVirtualItems();
    const someSelected = selectedIds.size > 0;
    const fileCount = countFileEntries(entries);

    useEffect(() => {
        const last = virtualItems[virtualItems.length - 1];

        if (!last) return;
        if (last.index >= entries.length - 1 && hasNextPage && !isFetchingMore) {
            onLoadMore();
        }
    }, [virtualItems, entries.length, hasNextPage, isFetchingMore, onLoadMore]);

    const renderLoader = () => {
        if (!isFetchingMore) return null;

        return (
            <div className="flex items-center justify-center py-4">
                <Spinner />
            </div>
        );
    };

    const renderColumnHeader = () => (
        <div
            className={cn(
                'grid items-center gap-3 border-b border-border-secondary px-3 py-2',
                getLibraryListGridCols(selectable),
            )}
        >
            {selectable ? (
                <span className="flex items-center justify-center">
                    <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected && !allSelected}
                        onChange={onToggleSelectAll}
                        disabled={fileCount === 0}
                        aria-label="Select all files"
                    />
                </span>
            ) : null}
            <span className="text-xs font-medium text-text-secondary">Name</span>
            <button
                type="button"
                onClick={() => onSortChange(sort === 'newest' ? 'oldest' : 'newest')}
                className="hidden items-center gap-1 text-xs font-medium text-text-secondary transition-colors hover:text-foreground sm:flex"
            >
                Modified
                {sort === 'newest' ? <ArrowDownIcon className="size-3.5" /> : null}
                {sort === 'oldest' ? <ArrowUpIcon className="size-3.5" /> : null}
            </button>
            <button
                type="button"
                onClick={() => onSortChange(sort === 'largest' ? 'smallest' : 'largest')}
                className="hidden items-center gap-1 text-xs font-medium text-text-secondary transition-colors hover:text-foreground sm:flex"
            >
                Size
                {sort === 'largest' ? <ArrowDownIcon className="size-3.5" /> : null}
                {sort === 'smallest' ? <ArrowUpIcon className="size-3.5" /> : null}
            </button>
            <span aria-hidden />
        </div>
    );

    const renderEntry = (entry: LibraryEntry, index: number) => {
        if (entry.kind === 'artifact') {
            return (
                <LibraryArtifactRow
                    artifact={entry.artifact}
                    onOpen={onOpenArtifact}
                    onDownload={onDownloadArtifact}
                    onDelete={onDeleteArtifact}
                    downloadingId={downloadingArtifactId}
                    agentSlug={agentSlug}
                    currentUserId={currentUserId}
                    selectable={selectable}
                    allSelected={allSelected}
                    isFirst={index === 0}
                    isLast={index === entries.length - 1}
                />
            );
        }

        return (
            <LibraryFileRow
                item={entry.file}
                onOpenLightbox={onOpenLightbox}
                onOpenChat={onOpenChat}
                onLike={onLike}
                onDelete={onDelete}
                onDownload={onDownload}
                downloadingId={downloadingId}
                selectable={selectable}
                selected={selectedIds.has(entry.file._id)}
                selectionActive={selectionActive}
                onToggleSelect={() => onToggleSelect(entry.file._id)}
                allSelected={allSelected}
                isFirst={index === 0}
                isLast={index === entries.length - 1}
                showAgentLink={showAgentLink}
            />
        );
    };

    return (
        <div className="w-full">
            {renderColumnHeader()}
            <div role="list" ref={parentRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {virtualItems.map((virtualItem) => {
                    const entry = entries[virtualItem.index];

                    return (
                        <div
                            key={entry.id}
                            role="listitem"
                            data-index={virtualItem.index}
                            ref={virtualizer.measureElement}
                            className="border-b border-border-secondary/60"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
                            }}
                        >
                            {renderEntry(entry, virtualItem.index)}
                        </div>
                    );
                })}
            </div>
            {renderLoader()}
        </div>
    );
};

const WindowList = (props: LibraryVirtualizedListProps) => {
    const parentRef = useRef<HTMLDivElement | null>(null);

    const virtualizer = useWindowVirtualizer({
        count: props.entries.length,
        estimateSize: () => ESTIMATED_ROW,
        overscan: OVERSCAN,
        scrollMargin: parentRef.current?.offsetTop ?? 0,
    });

    return <ListRows {...props} virtualizer={virtualizer as ListVirtualizer} parentRef={parentRef} />;
};

const ElementList = (props: LibraryVirtualizedListProps & { scrollRef: RefObject<HTMLDivElement | null> }) => {
    const parentRef = useRef<HTMLDivElement | null>(null);

    const virtualizer = useVirtualizer({
        count: props.entries.length,
        getScrollElement: () => props.scrollRef.current,
        estimateSize: () => ESTIMATED_ROW,
        overscan: OVERSCAN,
        scrollMargin: parentRef.current?.offsetTop ?? 0,
    });

    return <ListRows {...props} virtualizer={virtualizer as ListVirtualizer} parentRef={parentRef} />;
};

const LibraryVirtualizedList = (props: LibraryVirtualizedListProps) =>
    props.scrollRef ? <ElementList {...props} scrollRef={props.scrollRef} /> : <WindowList {...props} />;

export default LibraryVirtualizedList;
