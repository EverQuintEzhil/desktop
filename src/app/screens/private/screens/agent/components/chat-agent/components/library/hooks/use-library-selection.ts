import { useEffect, useState } from 'react';

import type { LibraryFilters, LibraryItem, LibraryScope } from '@/components/agent-chat/hooks/use-media-library';

interface UseLibrarySelectionParams {
    items: LibraryItem[];
    enableSelection: boolean;
    scope: LibraryScope;
    searchQuery: string;
    filters: LibraryFilters;
    onStartChat?: (items: LibraryItem[]) => void;
    downloadFiles: (items: LibraryItem[]) => void;
    deleteItem: (itemId: string) => Promise<void>;
}

const useLibrarySelection = (params: UseLibrarySelectionParams) => {
    const { items, enableSelection, scope, searchQuery, filters, onStartChat, downloadFiles, deleteItem } = params;

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const clearSelection = () => setSelectedIds(new Set());

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    };

    useEffect(() => {
        setSelectedIds(new Set());
    }, [scope, searchQuery, filters]);

    const selectionActive = enableSelection && selectedIds.size > 0;
    const selectedItems = items.filter((item) => selectedIds.has(item._id));
    const ownedSelectedItems = selectedItems.filter((item) => item.isMyItem);
    const allSelected =
        items.length > 0 && selectedIds.size >= items.length && items.every((item) => selectedIds.has(item._id));

    const toggleSelectAll = () => {
        setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item._id)));
    };

    const onStartChatClick = () => {
        if (!onStartChat || selectedItems.length === 0) return;
        onStartChat(selectedItems);
        clearSelection();
    };

    const onBulkDownload = () => {
        downloadFiles(selectedItems);
    };

    const onConfirmBulkDelete = async () => {
        if (ownedSelectedItems.length === 0) return;
        setIsBulkDeleting(true);
        try {
            for (const item of ownedSelectedItems) {
                await deleteItem(item._id);
            }
            setIsBulkDeleteOpen(false);
            clearSelection();
        } catch (error) {
            console.error(error);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    return {
        selectedIds,
        selectionActive,
        selectedItems,
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
    };
};

export default useLibrarySelection;
