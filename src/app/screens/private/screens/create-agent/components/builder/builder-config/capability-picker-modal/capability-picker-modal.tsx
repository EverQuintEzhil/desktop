import { useQueryClient } from '@tanstack/react-query';
import { Loader2Icon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { AddConnectorPanel } from '@/app/components/add-connector-panel';
import { PickerListEmpty } from '@/app/components/picker/picker-list-empty';
import { pickerDialogCls, type PickerItem, type PickerItemKind } from '@/app/components/picker/picker-shared';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useInfiniteScroll } from '@/hooks';
import { useAgentBySlugOrIdQuery } from '@/lib/api/admin/agents';
import { MCPS_QUERY_KEY, useDeleteMcpMutation, useMcpByIdQuery } from '@/lib/api/admin/mcps';
import { useToolByIdQuery } from '@/lib/api/admin/tools';
import { invalidateConnectorSurfaces } from '@/lib/api/common/mcp-servers';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';

import CapabilityGenericDetail from './components/capability-generic-detail';
import CapabilityListGroup from './components/capability-list-group';
import { KIND_GROUP_LABEL, KIND_PLURAL_LOWER, rowActive, rowBase } from './constants';
import { McpDetailPanel } from './mcp-detail-panel';
import { MemoryDetailPanel } from './memory-detail-panel';
import { type PickerGroup, SEARCH_DEBOUNCE_MS, usePickerItemsQuery } from './utils/picker-items-query';

export type { PickerItem, PickerItemKind } from '@/app/components/picker/picker-shared';

interface CapabilityPickerModalProps {
    open: boolean;
    agentId: string;
    onClose: () => void;
    selectedIds: Set<string>;
    selectedItems?: { _id: string; name: string; isRecommended?: boolean }[];
    onToggle: (item: { _id: string; name: string }, kind: PickerItemKind) => void;
    onUpdate?: (item: { _id: string; name: string; isRecommended?: boolean }, kind: PickerItemKind) => void;
    kind?: PickerItemKind;
    initialItemId?: string;
    initialItemName?: string;
    initialCreating?: boolean;
}

export const CapabilityPickerModal = ({
    open,
    agentId,
    onClose,
    selectedIds,
    selectedItems,
    onToggle,
    onUpdate,
    kind,
    initialItemId,
    initialItemName,
    initialCreating,
}: CapabilityPickerModalProps) => {
    const currentUser = useSelector(selectUser);
    const queryClient = useQueryClient();
    const deleteMutation = useDeleteMcpMutation();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedItem, setSelectedItem] = useState<PickerItem | null>(null);
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState(false);
    const [recentlyAdded, setRecentlyAdded] = useState<PickerItem | null>(null);
    const [showDelete, setShowDelete] = useState(false);

    useLayoutEffect(() => {
        if (!open) return;

        setSelectedItem(
            initialItemId && initialItemName && kind ? { _id: initialItemId, name: initialItemName, kind } : null,
        );
        setSearch('');
        setDebouncedSearch('');
        setCreating(!!initialCreating && kind === 'mcp');
        setEditing(false);
        setRecentlyAdded(null);
    }, [open, kind, initialItemId, initialItemName, initialCreating]);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(handler);
    }, [search]);

    const { data, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage } = usePickerItemsQuery(
        kind,
        debouncedSearch,
        agentId,
        open,
    );

    const mcpDetailQuery = useMcpByIdQuery(selectedItem?.kind === 'mcp' ? selectedItem._id : undefined);
    const toolDetailQuery = useToolByIdQuery(selectedItem?.kind === 'tool' ? selectedItem._id : undefined);
    const agentDetailQuery = useAgentBySlugOrIdQuery(selectedItem?.kind === 'agent' ? selectedItem._id : undefined);

    const detailLoading =
        (selectedItem?.kind === 'tool' && toolDetailQuery.isLoading) ||
        (selectedItem?.kind === 'agent' && agentDetailQuery.isLoading);

    const fetchedItems: PickerItem[] = data?.pages.flatMap((p) => p.values) ?? [];

    useEffect(() => {
        if (selectedItem && !selectedItem.description) {
            const fetched = fetchedItems.find((it) => it._id === selectedItem._id);

            if (fetched?.description) {
                setSelectedItem(fetched);
            }
        }
    }, [fetchedItems, selectedItem]);

    const baseItems: PickerItem[] =
        kind === 'mcp' && recentlyAdded && !fetchedItems.some((it) => it._id === recentlyAdded._id)
            ? [recentlyAdded, ...fetchedItems]
            : fetchedItems;

    const searchLower = debouncedSearch.toLowerCase();

    const selectedPickerItems: PickerItem[] = !kind
        ? []
        : (selectedItems ?? [])
              .map((si) => {
                  if (recentlyAdded?._id === si._id) return recentlyAdded;
                  const fetched = fetchedItems.find((fi) => fi._id === si._id);

                  return fetched || { _id: si._id, name: si.name, kind };
              })
              .filter((si) => !searchLower || si.name.toLowerCase().includes(searchLower));

    const availablePickerItems: PickerItem[] = baseItems.filter((bi) => !selectedIds.has(bi._id));

    const groups: PickerGroup[] = [];

    if (selectedPickerItems.length > 0) {
        groups.push({ label: 'Selected', items: selectedPickerItems });
    }
    if (availablePickerItems.length > 0) {
        groups.push({ label: kind ? KIND_GROUP_LABEL[kind] : 'Available', items: availablePickerItems });
    }

    const totalItems = selectedPickerItems.length + availablePickerItems.length;
    const searchPlaceholder = kind ? `Search ${KIND_PLURAL_LOWER[kind]}` : 'Search capabilities';
    const isEnabled = selectedItem ? selectedIds.has(selectedItem._id) : false;
    const selectTitle = kind ? KIND_GROUP_LABEL[kind] : 'Capabilities';

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: !!hasNextPage,
        itemsLength: totalItems,
        onLoadMore: () => {
            void fetchNextPage();
        },
    });

    const handleConfirmDelete = async () => {
        if (!selectedItem) return;

        await deleteMutation.mutateAsync(selectedItem._id);
        if (selectedIds.has(selectedItem._id)) {
            onToggle({ _id: selectedItem._id, name: selectedItem.name }, 'mcp');
        }
        await queryClient.invalidateQueries({ queryKey: ['create-agent', 'picker-items'] });
        await queryClient.invalidateQueries({ queryKey: ['create-agent', 'picker-groups'] });
        // Drop this connector's own caches first: the broad invalidation below prefix-matches
        // them, and refetching a deleted id just fires 404s (the tools call proxies to the
        // live MCP server) before the detail panel clears.
        queryClient.removeQueries({ queryKey: ['connectors', 'detail', selectedItem._id] });
        queryClient.removeQueries({ queryKey: ['connectors', 'tools', selectedItem._id] });
        queryClient.removeQueries({ queryKey: ['connectors', 'tool-preferences', selectedItem._id] });
        invalidateConnectorSurfaces(queryClient);
        setRecentlyAdded((prev) => (prev?._id === selectedItem._id ? null : prev));
        setShowDelete(false);
        setSelectedItem(null);
    };

    const handleSelectItem = (item: PickerItem) => {
        setCreating(false);
        setEditing(false);
        setSelectedItem(item);
    };

    const renderList = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2">
                            <div className="h-[42px] w-[42px] shrink-0 rounded-[14px] bg-foreground/10" />
                            <div
                                className="h-3 flex-1 rounded bg-foreground/10"
                                style={{ width: `${55 + (i % 3) * 15}%` }}
                            />
                        </div>
                    ))}
                </div>
            );
        }

        if (isError) {
            const message = error instanceof Error ? error.message : 'Failed to load.';

            return (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--danger)' }}>
                    {message}
                </p>
            );
        }

        if (totalItems === 0) {
            return (
                <PickerListEmpty
                    label={kind ? KIND_PLURAL_LOWER[kind] : 'capabilities'}
                    search={debouncedSearch}
                    onClearSearch={() => setSearch('')}
                />
            );
        }

        return (
            <>
                {groups.map((g) => (
                    <CapabilityListGroup
                        key={g.label}
                        group={g}
                        selectedIds={selectedIds}
                        selectedItem={selectedItem}
                        currentUserId={currentUser._id}
                        onSelect={handleSelectItem}
                    />
                ))}
                <div ref={loadMoreRef} />
                {isFetchingNextPage ? (
                    <div className="flex justify-center py-3">
                        <Loader2Icon size={16} className="animate-spin text-text-secondary" aria-hidden="true" />
                    </div>
                ) : null}
            </>
        );
    };

    const renderRightPane = () => {
        if (creating || (!selectedItem && kind === 'mcp')) {
            return (
                <AddConnectorPanel
                    onBack={() => setCreating(false)}
                    onClose={onClose}
                    onSuccess={(connector) => {
                        const item: PickerItem = {
                            _id: connector._id,
                            name: connector.name,
                            description: connector.description,
                            kind: 'mcp',
                        };

                        setRecentlyAdded(item);
                        onToggle({ _id: connector._id, name: connector.name }, 'mcp');
                        setCreating(false);
                        setSelectedItem(item);
                        void queryClient.invalidateQueries({ queryKey: ['create-agent', 'picker-items'] });
                        invalidateConnectorSurfaces(queryClient);
                    }}
                />
            );
        }

        if (editing && selectedItem?.kind === 'mcp' && mcpDetailQuery.data) {
            return (
                <AddConnectorPanel
                    server={mcpDetailQuery.data}
                    onBack={() => setEditing(false)}
                    onClose={onClose}
                    onSuccess={(connector) => {
                        const item: PickerItem = {
                            _id: connector._id,
                            name: connector.name,
                            description: connector.description,
                            creatorId: currentUser._id ?? undefined,
                            kind: 'mcp',
                        };

                        setEditing(false);
                        setRecentlyAdded((prev) => (prev?._id === item._id ? item : prev));
                        setSelectedItem(item);
                        void queryClient.invalidateQueries({ queryKey: ['create-agent', 'picker-items'] });
                        void queryClient.invalidateQueries({ queryKey: [...MCPS_QUERY_KEY, 'detail', item._id] });
                        invalidateConnectorSurfaces(queryClient);
                    }}
                />
            );
        }

        if (selectedItem?.kind === 'mcp') {
            return (
                <McpDetailPanel
                    item={selectedItem}
                    isEnabled={isEnabled}
                    isRecommended={!!selectedItems?.find((it) => it._id === selectedItem._id)?.isRecommended}
                    onUpdate={
                        onUpdate
                            ? (isRecommended) =>
                                  onUpdate(
                                      { _id: selectedItem._id, name: selectedItem.name, isRecommended },
                                      selectedItem.kind,
                                  )
                            : undefined
                    }
                    onToggle={() => onToggle({ _id: selectedItem._id, name: selectedItem.name }, selectedItem.kind)}
                    onBack={() => setSelectedItem(null)}
                    onClose={onClose}
                    onEdit={() => setEditing(true)}
                    onDelete={() => setShowDelete(true)}
                />
            );
        }

        if (selectedItem?.kind === 'memory') {
            return (
                <MemoryDetailPanel
                    item={selectedItem}
                    isEnabled={isEnabled}
                    onToggle={() => onToggle({ _id: selectedItem._id, name: selectedItem.name }, selectedItem.kind)}
                    onBack={() => setSelectedItem(null)}
                    onClose={onClose}
                />
            );
        }

        let genericDescription = selectedItem?.description;

        if (selectedItem?.kind === 'tool' && toolDetailQuery.data)
            genericDescription = toolDetailQuery.data.description;
        if (selectedItem?.kind === 'agent' && agentDetailQuery.data)
            genericDescription = agentDetailQuery.data.description;

        return (
            <CapabilityGenericDetail
                selectedItem={selectedItem}
                selectTitle={selectTitle}
                description={genericDescription}
                detailLoading={!!detailLoading}
                isEnabled={isEnabled}
                onToggle={() =>
                    selectedItem && onToggle({ _id: selectedItem._id, name: selectedItem.name }, selectedItem.kind)
                }
                onBack={() => setSelectedItem(null)}
                onClose={onClose}
            />
        );
    };

    return (
        <>
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
                            selectedItem || creating ? 'hidden sm:flex' : 'flex',
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
                                placeholder={searchPlaceholder}
                                aria-label={searchPlaceholder}
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
                            {kind === 'mcp' && (
                                <button
                                    className={cn(rowBase, (creating || !selectedItem) && rowActive)}
                                    onClick={() => {
                                        setSelectedItem(null);
                                        setCreating(true);
                                    }}
                                >
                                    <span
                                        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[13px] font-bold text-white"
                                        style={{ background: 'var(--primary)' }}
                                    >
                                        <PlusIcon size={14} aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1 overflow-hidden font-medium text-ellipsis whitespace-nowrap">
                                        Create Connector
                                    </span>
                                </button>
                            )}
                            {renderList()}
                        </div>
                    </div>

                    <div
                        className={cn(
                            'capability-detail-pane scrollbar-controller scrollbar-vertical flex-1 flex-col bg-card',
                            selectedItem || creating ? 'flex' : 'hidden sm:flex',
                        )}
                    >
                        {renderRightPane()}
                    </div>
                </DialogContent>
            </Dialog>
            <ConfirmationModal
                isOpen={showDelete}
                title="Delete connector"
                message={`Delete ${selectedItem?.name ?? 'this connector'}? This permanently removes the connector for everyone. This can't be undone.`}
                confirmButtonText="Delete"
                isButtonLoading={deleteMutation.isPending}
                onConfirm={handleConfirmDelete}
                onClose={() => setShowDelete(false)}
            />
        </>
    );
};
