import { useVirtualizer, useWindowVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import type { LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import { Spinner } from '@/components/ui/spinner';
import type { ArtifactHead } from '@/lib/api/app/artifact';

import LibraryArtifactCard from './library-artifact-card';
import LibraryFileCard from './library-file-card';
import type { LibraryEntry } from './types';

interface LibraryVirtualizedGridProps {
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
    showAgentLink: boolean;
    // When provided, virtualize against this scroll element instead of the window.
    scrollRef?: RefObject<HTMLDivElement | null>;
}

const GAP = 16;
const MIN_COL = 260;
const ESTIMATED_ROW = 272;
const OVERSCAN = 4;

type GridVirtualizer = Virtualizer<Window | HTMLDivElement, Element>;

// Track the rendered width of the grid root to derive the column count.
const useColumns = (parentRef: RefObject<HTMLDivElement | null>) => {
    const [width, setWidth] = useState(0);

    useLayoutEffect(() => {
        const node = parentRef.current;

        if (!node) return;
        setWidth(node.offsetWidth);

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];

            if (entry) setWidth(entry.contentRect.width);
        });

        observer.observe(node);

        return () => observer.disconnect();
    }, [parentRef]);

    return width > 0 ? Math.max(1, Math.floor((width + GAP) / (MIN_COL + GAP))) : 1;
};

interface GridRowsProps extends LibraryVirtualizedGridProps {
    virtualizer: GridVirtualizer;
    parentRef: RefObject<HTMLDivElement | null>;
    columns: number;
    rowCount: number;
}

const GridRows = (props: GridRowsProps) => {
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
        showAgentLink,
        virtualizer,
        parentRef,
        columns,
        rowCount,
    } = props;

    const virtualItems = virtualizer.getVirtualItems();

    useEffect(() => {
        const last = virtualItems[virtualItems.length - 1];

        if (!last) return;
        if (last.index >= rowCount - 1 && hasNextPage && !isFetchingMore) {
            onLoadMore();
        }
    }, [virtualItems, rowCount, hasNextPage, isFetchingMore, onLoadMore]);

    const renderLoader = () => {
        if (!isFetchingMore) return null;

        return (
            <div className="flex items-center justify-center py-4">
                <Spinner />
            </div>
        );
    };

    const renderEntry = (entry: LibraryEntry) => {
        if (entry.kind === 'artifact') {
            return (
                <LibraryArtifactCard
                    key={entry.id}
                    artifact={entry.artifact}
                    onOpen={onOpenArtifact}
                    onDownload={onDownloadArtifact}
                    onDelete={onDeleteArtifact}
                    downloadingId={downloadingArtifactId}
                    agentSlug={agentSlug}
                    currentUserId={currentUserId}
                />
            );
        }

        return (
            <LibraryFileCard
                key={entry.id}
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
                showAgentLink={showAgentLink}
            />
        );
    };

    return (
        <>
            <div ref={parentRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                {virtualItems.map((virtualItem) => {
                    const rowEntries = entries.slice(
                        virtualItem.index * columns,
                        virtualItem.index * columns + columns,
                    );

                    return (
                        <div
                            key={virtualItem.key}
                            data-index={virtualItem.index}
                            ref={virtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
                                paddingBottom: GAP,
                            }}
                        >
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                    gap: GAP,
                                }}
                            >
                                {rowEntries.map(renderEntry)}
                            </div>
                        </div>
                    );
                })}
            </div>
            {renderLoader()}
        </>
    );
};

const WindowGrid = (props: LibraryVirtualizedGridProps) => {
    const parentRef = useRef<HTMLDivElement | null>(null);
    const columns = useColumns(parentRef);
    const rowCount = Math.ceil(props.entries.length / columns);

    const virtualizer = useWindowVirtualizer({
        count: rowCount,
        estimateSize: () => ESTIMATED_ROW,
        overscan: OVERSCAN,
        scrollMargin: parentRef.current?.offsetTop ?? 0,
    });

    useEffect(() => {
        virtualizer.measure();
    }, [columns, virtualizer]);

    return (
        <GridRows
            {...props}
            virtualizer={virtualizer as GridVirtualizer}
            parentRef={parentRef}
            columns={columns}
            rowCount={rowCount}
        />
    );
};

const ElementGrid = (props: LibraryVirtualizedGridProps & { scrollRef: RefObject<HTMLDivElement | null> }) => {
    const parentRef = useRef<HTMLDivElement | null>(null);
    const columns = useColumns(parentRef);
    const rowCount = Math.ceil(props.entries.length / columns);

    const virtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => props.scrollRef.current,
        estimateSize: () => ESTIMATED_ROW,
        overscan: OVERSCAN,
        scrollMargin: parentRef.current?.offsetTop ?? 0,
    });

    useEffect(() => {
        virtualizer.measure();
    }, [columns, virtualizer]);

    return (
        <GridRows
            {...props}
            virtualizer={virtualizer as GridVirtualizer}
            parentRef={parentRef}
            columns={columns}
            rowCount={rowCount}
        />
    );
};

const LibraryVirtualizedGrid = (props: LibraryVirtualizedGridProps) =>
    props.scrollRef ? <ElementGrid {...props} scrollRef={props.scrollRef} /> : <WindowGrid {...props} />;

export default LibraryVirtualizedGrid;
