import { useMemo, useRef, useState } from 'react';

import { useStickyHeader } from '@/app/hooks';
import type { AgentRef } from '@/components/agent-chat/agent-name-link';
import useArtifactLibrary from '@/components/agent-chat/hooks/use-artifact-library';
import useMediaLibrary, {
    type LibraryFilters,
    type LibraryItem,
    type LibraryScope,
} from '@/components/agent-chat/hooks/use-media-library';
import DeleteConfirmationModal from '@/components/agent-chat/view/delete-confirmation-modal';
import type { ArtifactHead, ArtifactType } from '@/lib/api/app/artifact';
import { cn } from '@/lib/utils';

import LibraryArtifactLightbox from './components/library-artifact-lightbox';
import LibraryEmptyState from './components/library-empty-state';
import LibraryHeader from './components/library-header';
import LibraryPreviewPanel from './components/library-preview-panel';
import LibrarySkeletons from './components/library-skeletons';
import { useLibraryDownload } from './file-preview';
import useLibraryArtifactActions from './hooks/use-library-artifact-actions';
import useLibraryPreview from './hooks/use-library-preview';
import useLibrarySelection from './hooks/use-library-selection';
import LibraryVirtualizedGrid from './library-virtualized-grid';
import LibraryVirtualizedList from './library-virtualized-list';
import type { PreviewIntent } from './types';
import useLibraryFilterOptions from './use-library-filter-options';
import { buildLibraryEntries } from './utils/library-entries';

interface LibraryContentProps {
    agentId?: string;
    userId: string;
    title: string;
    agent?: AgentRef | null;
    searchPlaceholder?: string;
    scope: LibraryScope;
    onScopeChange: (scope: LibraryScope) => void;
    // Controlled preview: the id of the open file, or null. Omit both to keep preview state local.
    previewId?: string | null;
    onPreviewChange?: (id: string | null, intent: PreviewIntent) => void;
    onOpenChat?: (item: LibraryItem) => void;
    onTitleInfoClick?: () => void;
    containerClassName?: string;
    enableSelection?: boolean;
    onStartChat?: (items: LibraryItem[]) => void;
    showEntityFilters?: boolean;
    showArtifacts?: boolean;
    originTypes?: string[];
    // 'window' (default): content grows and the page/window scrolls.
    // 'container': the content region owns its scroll (bounded-height layouts).
    scrollMode?: 'window' | 'container';
}

type ViewMode = 'grid' | 'list';

const DEFAULT_CONTAINER_CLASS_NAME = 'flex flex-col min-h-svh w-full relative bg-background max-lg:pt-[50px]';

const LibraryContent = (props: LibraryContentProps) => {
    const {
        agentId,
        userId,
        title,
        agent,
        searchPlaceholder = 'Search library',
        scope,
        onScopeChange,
        previewId,
        onPreviewChange,
        onOpenChat,
        onTitleInfoClick,
        containerClassName = DEFAULT_CONTAINER_CLASS_NAME,
        enableSelection = false,
        onStartChat,
        showEntityFilters = false,
        showArtifacts = false,
        originTypes,
        scrollMode = 'window',
    } = props;

    const isContainerScroll = scrollMode === 'container';

    const [searchQuery, setSearchQuery] = useState('');
    const [view, setView] = useState<ViewMode>('grid');
    const [filters, setFilters] = useState<LibraryFilters>({ sort: 'newest' });
    const [agentSearch, setAgentSearch] = useState('');
    const [projectSearch, setProjectSearch] = useState('');
    const [itemToDelete, setItemToDelete] = useState<LibraryItem | null>(null);
    const [artifactType, setArtifactType] = useState<ArtifactType | undefined>(undefined);
    const [openArtifact, setOpenArtifact] = useState<ArtifactHead | null>(null);
    const [artifactToDelete, setArtifactToDelete] = useState<ArtifactHead | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const isSticky = useStickyHeader(containerRef, isContainerScroll ? { scrollRef } : undefined);

    const {
        state,
        fetchNextPage,
        hasNextPage,
        updateLikeItem,
        deleteItem,
        isDeleteSubmitting,
        setItemVisibility,
        visibilityUpdatingId,
    } = useMediaLibrary({
        agentId,
        userId,
        scope,
        searchQuery,
        filters: { ...filters, originTypes },
    });

    const { agentOptions, projectOptions, isLoadingAgents, isLoadingProjects } = useLibraryFilterOptions({
        agentId: filters.agentId,
        agentSearch,
        projectSearch,
        enabled: showEntityFilters,
    });

    const { downloadFile, downloadFiles, downloadingId, isBulkDownloading } = useLibraryDownload();

    const items = state.history;

    const fileOnlyFiltersActive = Boolean(
        filters.source || filters.fileType || filters.liked || filters.deleted || filters.projectId,
    );

    const {
        artifacts,
        isLoading: isLoadingArtifacts,
        error: artifactsError,
    } = useArtifactLibrary({
        agentId,
        enabled: showArtifacts && scope !== 'shared' && !fileOnlyFiltersActive,
    });

    const entries = useMemo(
        () => buildLibraryEntries({ files: items, artifacts, searchQuery, sort: filters.sort, artifactType }),
        [items, artifacts, searchQuery, filters.sort, artifactType],
    );

    const { activePreviewItem, previewIndex, openPreview, closePreview, leavePreview, goToPreviewSibling } =
        useLibraryPreview({
            items,
            controlledPreviewId: previewId,
            onPreviewChange,
            hasNextPage,
            isShowMoreLoading: state.showMoreLoading,
            fetchNextPage,
        });

    const {
        selectedIds,
        selectionActive,
        ownedSelectedItems,
        allSelected,
        isBulkDeleteOpen,
        isBulkDeleting,
        clearSelection,
        toggleSelect,
        toggleSelectAll,
        onStartChatClick,
        onBulkDownload,
        onConfirmBulkDelete,
        setIsBulkDeleteOpen,
    } = useLibrarySelection({
        items,
        enableSelection,
        scope,
        searchQuery,
        filters,
        onStartChat,
        downloadFiles,
        deleteItem,
    });

    const { downloadArtifactItem, downloadingArtifactId, deleteArtifactItem, isArtifactDeleteSubmitting } =
        useLibraryArtifactActions({ agentId });

    const onLike = (item: LibraryItem) => {
        updateLikeItem(item);
    };

    const changeArtifactType = (next?: ArtifactType) => {
        setArtifactType(next);
        clearSelection();
    };

    const onConfirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteItem(itemToDelete._id);
            setItemToDelete(null);
        } catch (error) {
            console.error(error);
        }
    };

    const onConfirmArtifactDelete = async () => {
        if (!artifactToDelete) return;
        const deleted = await deleteArtifactItem(artifactToDelete);

        if (deleted) setArtifactToDelete(null);
    };

    const hasActiveFilters = Boolean(
        searchQuery ||
        filters.source ||
        filters.fileType ||
        filters.liked ||
        filters.deleted ||
        filters.agentId ||
        filters.projectId ||
        artifactType,
    );

    const clearFilters = () => {
        setSearchQuery('');
        setFilters({ sort: 'newest' });
        setArtifactType(undefined);
    };

    const renderGrid = () => (
        <LibraryVirtualizedGrid
            entries={entries}
            onOpenLightbox={openPreview}
            onOpenArtifact={setOpenArtifact}
            onDownloadArtifact={downloadArtifactItem}
            onDeleteArtifact={setArtifactToDelete}
            downloadingArtifactId={downloadingArtifactId}
            agentSlug={agent?.slug}
            currentUserId={userId}
            onOpenChat={onOpenChat}
            onLike={onLike}
            onDelete={setItemToDelete}
            onDownload={downloadFile}
            downloadingId={downloadingId}
            selectable={enableSelection}
            selectedIds={selectedIds}
            selectionActive={selectionActive}
            onToggleSelect={toggleSelect}
            hasNextPage={Boolean(hasNextPage)}
            isFetchingMore={state.showMoreLoading}
            onLoadMore={fetchNextPage}
            scrollRef={isContainerScroll ? scrollRef : undefined}
            showAgentLink={!agentId}
        />
    );

    const renderList = () => (
        <LibraryVirtualizedList
            entries={entries}
            onOpenLightbox={openPreview}
            onOpenArtifact={setOpenArtifact}
            onDownloadArtifact={downloadArtifactItem}
            onDeleteArtifact={setArtifactToDelete}
            downloadingArtifactId={downloadingArtifactId}
            agentSlug={agent?.slug}
            currentUserId={userId}
            onOpenChat={onOpenChat}
            onLike={onLike}
            onDelete={setItemToDelete}
            onDownload={downloadFile}
            downloadingId={downloadingId}
            selectable={enableSelection}
            selectedIds={selectedIds}
            selectionActive={selectionActive}
            onToggleSelect={toggleSelect}
            hasNextPage={Boolean(hasNextPage)}
            isFetchingMore={state.showMoreLoading}
            onLoadMore={fetchNextPage}
            scrollRef={isContainerScroll ? scrollRef : undefined}
            sort={filters.sort}
            onSortChange={(next) => setFilters((prev) => ({ ...prev, sort: next }))}
            allSelected={allSelected}
            onToggleSelectAll={toggleSelectAll}
            showAgentLink={!agentId}
        />
    );

    const renderNotice = (message: string | null) => {
        if (!message) return null;

        return <div className="rounded-xl bg-card px-3 py-2 text-sm text-text-secondary">{message}</div>;
    };

    const renderEntries = () => {
        if (entries.length === 0) {
            return (
                <LibraryEmptyState
                    scope={scope}
                    agentId={agentId}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearFilters}
                />
            );
        }

        return view === 'grid' ? renderGrid() : renderList();
    };

    const renderBody = () => {
        if (state.loading || isLoadingArtifacts) return <LibrarySkeletons view={view} />;
        if (state.error && entries.length === 0) {
            return (
                <div className="flex min-h-[40svh] items-center justify-center text-sm text-text-secondary">
                    {state.error}
                </div>
            );
        }

        return (
            <>
                {renderNotice(state.error)}
                {renderNotice(artifactsError)}
                {renderEntries()}
            </>
        );
    };

    return (
        <div className={cn(containerClassName, 'library-container')} ref={containerRef}>
            <LibraryHeader
                title={title}
                agent={agent}
                onTitleInfoClick={onTitleInfoClick}
                isSticky={isSticky}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                searchPlaceholder={searchPlaceholder}
                scope={scope}
                onScopeChange={onScopeChange}
                view={view}
                onViewChange={setView}
                filters={filters}
                onFiltersChange={setFilters}
                onSortChange={(next) => setFilters((prev) => ({ ...prev, sort: next }))}
                artifactType={artifactType}
                onArtifactTypeChange={showArtifacts && agentId ? changeArtifactType : undefined}
                showEntityFilters={showEntityFilters}
                agentOptions={agentOptions}
                projectOptions={projectOptions}
                isLoadingAgents={isLoadingAgents}
                isLoadingProjects={isLoadingProjects}
                agentSearch={agentSearch}
                onAgentSearchChange={setAgentSearch}
                projectSearch={projectSearch}
                onProjectSearchChange={setProjectSearch}
                onAgentIdChange={(next) => setFilters((prev) => ({ ...prev, agentId: next, projectId: undefined }))}
                onProjectIdChange={(next) => setFilters((prev) => ({ ...prev, projectId: next }))}
                enableSelection={enableSelection}
                selectionActive={selectionActive}
                selectedCount={selectedIds.size}
                itemsCount={items.length}
                allSelected={allSelected}
                onToggleSelectAll={toggleSelectAll}
                onBulkDownload={onBulkDownload}
                isBulkDownloading={isBulkDownloading}
                ownedSelectedCount={ownedSelectedItems.length}
                onOpenBulkDelete={() => setIsBulkDeleteOpen(true)}
                onClearSelection={clearSelection}
                onStartChat={onStartChat}
                onStartChatClick={onStartChatClick}
            />

            <div
                ref={isContainerScroll ? scrollRef : undefined}
                className={cn(
                    'library-content pt-2 pb-6',
                    isContainerScroll && 'scrollbar-controller scrollbar-vertical relative min-h-0 flex-1',
                )}
            >
                <div className="mx-auto flex w-full max-w-[928px] flex-col gap-4 px-4">{renderBody()}</div>
            </div>

            <DeleteConfirmationModal
                isOpen={Boolean(itemToDelete)}
                onClose={() => setItemToDelete(null)}
                onConfirm={onConfirmDelete}
                title="Delete file"
                isLoading={isDeleteSubmitting}
            />

            <DeleteConfirmationModal
                isOpen={Boolean(artifactToDelete)}
                onClose={() => setArtifactToDelete(null)}
                onConfirm={onConfirmArtifactDelete}
                title="Delete artifact"
                isLoading={isArtifactDeleteSubmitting}
            />

            <DeleteConfirmationModal
                isOpen={isBulkDeleteOpen}
                onClose={() => setIsBulkDeleteOpen(false)}
                onConfirm={onConfirmBulkDelete}
                title={`Delete ${ownedSelectedItems.length} file${ownedSelectedItems.length === 1 ? '' : 's'}`}
                isLoading={isBulkDeleting}
            />

            {openArtifact && agentId ? (
                <LibraryArtifactLightbox
                    artifact={openArtifact}
                    agentId={agentId}
                    agentSlug={agent?.slug}
                    currentUserId={userId}
                    onDelete={setArtifactToDelete}
                    onClose={() => setOpenArtifact(null)}
                />
            ) : null}

            {activePreviewItem ? (
                <LibraryPreviewPanel
                    item={activePreviewItem}
                    agentId={agentId}
                    previewIndex={previewIndex}
                    itemsLength={items.length}
                    hasNextPage={Boolean(hasNextPage)}
                    isShowMoreLoading={state.showMoreLoading}
                    downloadingId={downloadingId}
                    visibilityUpdatingId={visibilityUpdatingId}
                    onOpenChat={onOpenChat}
                    onLike={onLike}
                    onDownload={downloadFile}
                    onSetVisibility={setItemVisibility}
                    onDelete={setItemToDelete}
                    onClose={closePreview}
                    onLeave={leavePreview}
                    onPrev={() => goToPreviewSibling(-1)}
                    onNext={() => goToPreviewSibling(1)}
                />
            ) : null}
        </div>
    );
};

export type { LibraryContentProps, PreviewIntent };
export default LibraryContent;
