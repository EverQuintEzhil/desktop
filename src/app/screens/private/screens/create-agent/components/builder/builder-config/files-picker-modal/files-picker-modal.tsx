import { Loader2Icon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { pickerDialogCls } from '@/app/components/picker/picker-shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useInfiniteScroll } from '@/hooks';
import { useDataStoreByIdQuery, type DataStoreProviderFilter } from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import { PROVIDER_OPTIONS } from '@/types/admin';

import AddDataStorePanel from './components/add-data-store-panel';
import DataStoreDetailPanel from './components/data-store-detail-panel';
import DataStoreList from './components/data-store-list';
import { CATEGORY_ADD_LABELS, CATEGORY_LABELS, rowActive, rowBase, SEARCH_DEBOUNCE_MS } from './constants';
import { useDataStoresQuery } from './hooks';
import type { ActivePanel, DataStoreItem } from './types';

export interface FilesPickerModalProps {
    open: boolean;
    onClose: () => void;
    selectedFiles: { _id: string; name: string; provider?: string }[];
    onToggle: (file: { _id: string; name: string; provider?: string }) => void;
    initialViewDataStoreId?: string | null;
    providerFilter: DataStoreProviderFilter;
    onCreated: (dataStore: { _id: string; name: string; provider?: string }) => void;
}

export const FilesPickerModal = ({
    open,
    onClose,
    selectedFiles,
    onToggle,
    initialViewDataStoreId,
    providerFilter,
    onCreated,
}: FilesPickerModalProps) => {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activePanel, setActivePanel] = useState<ActivePanel>(initialViewDataStoreId ?? null);
    // Set right before the delete call in DataStoreDetailPanel so the detail query below skips
    // refetching a data store that is mid-delete.
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const currentUser = useSelector(selectUser);

    useEffect(() => {
        if (open) {
            setActivePanel(initialViewDataStoreId ?? null);
        } else {
            setActivePanel(null);
            setSearch('');
        }
    }, [open, initialViewDataStoreId]);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(handler);
    }, [search]);

    const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useDataStoresQuery(
        debouncedSearch,
        open,
        providerFilter,
    );

    const dataStores: DataStoreItem[] = data?.pages.flatMap((p) => p.values) ?? [];

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: !!hasNextPage,
        itemsLength: dataStores.length,
        onLoadMore: () => {
            void fetchNextPage();
        },
    });

    const activeDataStoreProp =
        activePanel !== null && activePanel !== 'add-ds'
            ? dataStores.find((ds) => ds._id === activePanel) || selectedFiles.find((f) => f._id === activePanel)
            : undefined;
    const isEnabled = activePanel ? selectedFiles.some((f) => f._id === activePanel) : false;

    const {
        data: detailData,
        isLoading: detailLoading,
        isError: detailError,
    } = useDataStoreByIdQuery(
        activePanel && activePanel !== 'add-ds' && activePanel !== deletingId ? activePanel : undefined,
    );

    const renderRightPanel = () => {
        if (activePanel === null || activePanel === 'add-ds') {
            return (
                <AddDataStorePanel
                    category={providerFilter}
                    onBack={() => setActivePanel(null)}
                    onClose={onClose}
                    onSuccess={onCreated}
                />
            );
        }

        if (!activeDataStoreProp && !detailData) {
            return null;
        }

        let name = activeDataStoreProp?.name ?? '';
        let description = (activeDataStoreProp as DataStoreItem | undefined)?.description;
        let provider = activeDataStoreProp?.provider;

        if (detailData) {
            name = detailData.name;
            description = detailData.description;
            provider = detailData.provider;
        }

        const providerLabel = PROVIDER_OPTIONS.find((p) => p.value === provider)?.label ?? '';
        const tools = detailData?.tools ?? [];
        const creatorId = detailData?.creator?._id ?? (activeDataStoreProp as DataStoreItem | undefined)?.creator?._id;
        const canManage = !!creatorId && creatorId === currentUser._id;

        return (
            <DataStoreDetailPanel
                activePanel={activePanel}
                name={name}
                description={description}
                provider={provider}
                providerLabel={providerLabel}
                tools={tools}
                canManage={canManage}
                isEnabled={isEnabled}
                detailLoading={detailLoading}
                detailError={detailError}
                detailData={detailData}
                onClose={onClose}
                onBack={() => setActivePanel(null)}
                onToggle={onToggle}
                setDeletingId={setDeletingId}
            />
        );
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose();
            }}
        >
            <DialogContent overlayClassName="bg-(--grey-alpha-6)!" className={pickerDialogCls}>
                <div
                    className={cn(
                        'scrollbar-controller scrollbar-vertical shrink-0 scrollbar-gutter-stable flex-col border-r border-border',
                        'w-full sm:w-xs',
                        activePanel !== null ? 'hidden sm:flex' : 'flex',
                    )}
                >
                    <div
                        className={
                            'sticky top-0 flex h-[80px] shrink-0 items-center gap-2 border-b bg-card p-4 text-text-secondary'
                        }
                    >
                        <SearchIcon size={20} aria-hidden="true" />
                        <input
                            className="flex-1 border-0 bg-transparent text-[13px] text-(--text-primary) outline-none placeholder:text-text-secondary"
                            placeholder={`Search ${CATEGORY_LABELS[providerFilter]}`}
                            aria-label={`Search ${CATEGORY_LABELS[providerFilter]}`}
                            value={search}
                            autoFocus
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search ? (
                            <Button
                                type="button"
                                variant="secondary"
                                size="icon-sm"
                                className="rounded-md"
                                aria-label="Clear search"
                                onClick={() => setSearch('')}
                            >
                                <XIcon aria-hidden="true" />
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex-1 p-3">
                        <button
                            className={cn(rowBase, (activePanel === null || activePanel === 'add-ds') && rowActive)}
                            onClick={() => setActivePanel('add-ds')}
                        >
                            <span
                                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[13px] font-bold text-white"
                                style={{ background: 'var(--primary)' }}
                            >
                                <PlusIcon size={14} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1 overflow-hidden font-medium text-ellipsis whitespace-nowrap">
                                {CATEGORY_ADD_LABELS[providerFilter]}
                            </span>
                        </button>

                        <DataStoreList
                            isLoading={isLoading}
                            isError={isError}
                            error={error}
                            providerFilter={providerFilter}
                            debouncedSearch={debouncedSearch}
                            onClearSearch={() => setSearch('')}
                            dataStores={dataStores}
                            selectedFiles={selectedFiles}
                            activePanel={activePanel}
                            onSelect={setActivePanel}
                        />
                        <div ref={loadMoreRef} />
                        {isFetchingNextPage ? (
                            <div className="flex justify-center py-3">
                                <Loader2Icon
                                    size={16}
                                    className="animate-spin text-text-secondary"
                                    aria-hidden="true"
                                />
                            </div>
                        ) : null}
                    </div>
                </div>

                <div
                    className={cn(
                        'file-picker-detail-pane scrollbar-controller scrollbar-vertical flex-1 flex-col bg-card',
                        activePanel !== null ? 'flex' : 'hidden sm:flex',
                    )}
                >
                    {renderRightPanel()}
                </div>
            </DialogContent>
        </Dialog>
    );
};
