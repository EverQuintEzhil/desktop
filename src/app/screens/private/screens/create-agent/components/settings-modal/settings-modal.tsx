import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, CheckIcon, CpuIcon, Loader2Icon, SearchIcon, StarIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PickerDetailSkeleton } from '@/app/components/picker/picker-detail-skeleton';
import { pickerDialogCls } from '@/app/components/picker/picker-shared';
import { DescriptionHoverCard } from '@/components/description-hover-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useInfiniteScroll } from '@/hooks';
import { adminModelsApi, useModelByIdQuery } from '@/lib/api/admin/models';
import { cn } from '@/lib/utils';
import { modelDisplayName } from '@/types/admin';
import type { PagedList } from '@/types/api-types';

import type { AgentConfigItem } from '../../types';

interface Model {
    _id: string;
    name: string;
    provider: string;
    description: string;
    model: string;
}

const MODEL_PAGE_SIZE = 100;
const TEXT_GENERATION_CAPABILITY = 'text-generation';

const MODEL_COLOR_PALETTE = ['#4285F4', '#0F9D58', '#EA4335', '#4A154B', '#24292e', '#6264A7', '#0078D4', '#7048ff'];

const getModelAbbr = (name: string): string => {
    const words = name.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
        const initials = words[0][0] + words[1][0];

        return initials
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .slice(0, 2);
    }

    const alphanum = name.replace(/[^a-zA-Z0-9]/g, '');

    return alphanum.toUpperCase().slice(0, 2) || '??';
};

const getModelColor = (id: string): string => {
    let hash = 0;

    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }

    return MODEL_COLOR_PALETTE[hash % MODEL_COLOR_PALETTE.length];
};

const rowBase =
    'flex items-center gap-3 min-h-[54px] px-3 py-[10px] rounded-2xl' +
    ' bg-transparent border border-transparent cursor-pointer text-h6' +
    ' text-left w-full text-(--text-primary) transition-[background,border-color,color] duration-140' +
    ' hover:bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]' +
    ' hover:border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]' +
    ' disabled:opacity-50 disabled:cursor-not-allowed';
const rowActive =
    'bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]' +
    ' border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] text-primary';

const actionBase =
    'h-11 w-full border-0 rounded-[14px] text-h6 font-semibold cursor-pointer' +
    ' bg-primary text-primary-foreground transition-[background,opacity,transform] duration-140' +
    ' mt-auto shrink-0 hover:opacity-[0.92] hover:-translate-y-px' +
    ' disabled:opacity-[0.38] disabled:cursor-not-allowed';
const actionRemove =
    'bg-(--surface) text-(--danger)' + ' border border-[color-mix(in_srgb,var(--danger)_22%,var(--border))]';

const btnCls =
    'rounded-xl text-text-secondary hover:text-primary hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]';

const toModelName = (model: { model?: string; label?: string | null }): string => modelDisplayName(model) || 'Model';

const getStatusLabel = (isDefault: boolean, selected: boolean): string => {
    if (isDefault) {
        return 'Default';
    }

    if (selected) {
        return 'Selected';
    }

    return 'Available';
};

const SEARCH_DEBOUNCE_MS = 300;

const fetchModels = async (search: string, page: number): Promise<PagedList<Model>> => {
    const result = await adminModelsApi.list({
        page,
        size: MODEL_PAGE_SIZE,
        capability: [TEXT_GENERATION_CAPABILITY],
        ...(search ? { search } : {}),
    });

    return {
        values: result.values.map((m) => ({
            _id: m._id,
            name: toModelName(m),
            provider: m.provider,
            description: m.description,
            model: m.model,
        })),
        pageInfo: result.pageInfo,
    };
};

const useModelsQuery = (open: boolean, search: string) =>
    useInfiniteQuery({
        queryKey: ['create-agent', 'models', TEXT_GENERATION_CAPABILITY, search],
        queryFn: ({ pageParam }) => fetchModels(search, pageParam),
        enabled: open,
        initialPageParam: 0,
        placeholderData: keepPreviousData,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });

interface SettingsModalProps {
    open: boolean;
    onClose: () => void;
    models?: AgentConfigItem[];
    onChange: (models: AgentConfigItem[]) => void;
}

export const SettingsModal = ({ open, onClose, models: modelsProp, onChange }: SettingsModalProps) => {
    const [selectedItems, setSelectedItems] = useState<AgentConfigItem[]>(modelsProp ?? []);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [focusedId, setFocusedId] = useState<string | null>(null);

    useEffect(() => {
        setSelectedItems(modelsProp ?? []);
    }, [open, (modelsProp ?? []).map((item) => item._id).join(',')]);

    useEffect(() => {
        if (!open) {
            setSearch('');
            setFocusedId(null);
        }
    }, [open]);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(handler);
    }, [search]);

    const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useModelsQuery(
        open,
        debouncedSearch,
    );

    const models: Model[] = data?.pages.flatMap((p) => p.values) ?? [];

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: !!hasNextPage,
        itemsLength: models.length,
        onLoadMore: () => {
            void fetchNextPage();
        },
    });

    const focusedModel = focusedId
        ? (models.find((m) => m._id === focusedId) ?? selectedItems.find((m) => m._id === focusedId) ?? null)
        : null;
    const defaultId = selectedItems[0]?._id;

    const selectedListItems = debouncedSearch
        ? selectedItems.filter((item) => item.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
        : selectedItems;
    const availableListItems = models.filter((m) => !selectedItems.some((s) => s._id === m._id));

    const isSelected = (id: string): boolean => selectedItems.some((item) => item._id === id);

    const applyChange = (next: AgentConfigItem[]) => {
        setSelectedItems(next);
        onChange(next);
    };

    const handleAdd = (model: Model) => {
        if (isSelected(model._id)) return;

        applyChange([...selectedItems, { _id: model._id, name: model.name, provider: model.provider }]);
        onClose();
    };

    const handleRemove = (id: string) => {
        applyChange(selectedItems.filter((item) => item._id !== id));
    };

    const handleSetDefault = (id: string) => {
        const target = selectedItems.find((item) => item._id === id);

        if (!target) return;

        applyChange([target, ...selectedItems.filter((item) => item._id !== id)]);
        onClose();
    };

    const renderRow = (model: { _id: string; name: string; provider?: string; description?: string }) => {
        const selected = isSelected(model._id);
        const abbr = getModelAbbr(model.name);
        const color = getModelColor(model._id);

        return (
            <button
                key={model._id}
                className={cn(rowBase, focusedId === model._id && rowActive)}
                onClick={() => setFocusedId(model._id)}
            >
                <span
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[13px] font-bold text-white"
                    style={{ background: color }}
                >
                    {abbr}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="overflow-hidden font-medium text-ellipsis whitespace-nowrap">{model.name}</span>
                    <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-text-secondary">
                        {model.provider}
                    </span>
                    {model.description && (
                        <DescriptionHoverCard name={model.name} description={model.description}>
                            <span className="line-clamp-2 text-xs text-text-secondary">{model.description}</span>
                        </DescriptionHoverCard>
                    )}
                </span>
                {defaultId === model._id && (
                    <Badge variant="secondary" className="shrink-0 text-[10px] tracking-[0.06em] uppercase">
                        Default
                    </Badge>
                )}
                {selected && (
                    <CheckIcon size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} aria-hidden="true" />
                )}
            </button>
        );
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
            const message = error instanceof Error ? error.message : 'Failed to load models.';

            return (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--danger)' }}>
                    {message}
                </p>
            );
        }

        const totalItems = selectedListItems.length + availableListItems.length;

        if (totalItems === 0) {
            return (
                <p className="px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    No models found
                </p>
            );
        }

        return (
            <>
                {selectedListItems.length > 0 && (
                    <>
                        <div className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-[0.07em] text-text-secondary uppercase">
                            Selected
                        </div>
                        {selectedListItems.map((item) => renderRow(item))}
                        <div className="px-2 pt-3 pb-1 text-[10px] font-bold tracking-[0.07em] text-text-secondary uppercase">
                            Available
                        </div>
                    </>
                )}
                {availableListItems.map(renderRow)}
            </>
        );
    };

    const renderEmptyDetail = () => (
        <>
            <div className="modal-agent-header sticky top-0 z-1 flex h-[80px] items-center gap-1 border-b border-border bg-card p-3">
                <div className="flex-1" />
                <Button variant="ghost" size="icon" className={btnCls} aria-label="Close" onClick={onClose}>
                    <XIcon size={17} aria-hidden="true" />
                </Button>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-text-secondary">
                <span
                    className={cn(
                        'flex h-16 w-16 items-center justify-center rounded-[18px]',
                        'bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] text-primary',
                        'border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]',
                    )}
                >
                    <CpuIcon size={24} aria-hidden="true" />
                </span>
                <h3 className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em] text-(--text-primary)">
                    Select a model
                </h3>
                <p className="max-w-[300px] text-h6 leading-[1.6] text-text-secondary">
                    Choose a model from the list to preview details and add it to this agent.
                </p>
            </div>
        </>
    );

    const renderDetailFooter = (model: Model) => {
        const selected = isSelected(model._id);
        const isDefault = defaultId === model._id;

        if (!selected) {
            return (
                <button className={actionBase} onClick={() => handleAdd(model)}>
                    Add model
                </button>
            );
        }

        if (isDefault) {
            return (
                <div className="flex flex-col gap-2">
                    <div
                        className={cn(
                            actionBase,
                            'flex cursor-default items-center justify-center gap-2 opacity-100 hover:translate-y-0 hover:opacity-100',
                        )}
                    >
                        <StarIcon size={15} fill="currentColor" aria-hidden="true" />
                        Default model
                    </div>
                    <button className={cn(actionBase, actionRemove)} onClick={() => handleRemove(model._id)}>
                        Remove model
                    </button>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-2">
                <button
                    className={cn(
                        actionBase,
                        'border border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] bg-(--surface) text-primary',
                    )}
                    onClick={() => handleSetDefault(model._id)}
                >
                    Set as default
                </button>
                <button className={cn(actionBase, actionRemove)} onClick={() => handleRemove(model._id)}>
                    Remove model
                </button>
            </div>
        );
    };

    const {
        data: detailData,
        isLoading: detailLoading,
        isError: detailError,
    } = useModelByIdQuery(focusedId ?? undefined);

    const renderDetail = (model: {
        _id: string;
        name: string;
        provider?: string;
        description?: string;
        model?: string;
    }) => {
        const abbr = getModelAbbr(model.name);
        const color = getModelColor(model._id);
        const selected = isSelected(model._id);
        const isDefault = defaultId === model._id;
        const status = getStatusLabel(isDefault, selected);

        const description = detailData?.description ?? model.description;
        const modelType = detailData?.model ?? model.model;

        return (
            <>
                <div className="modal-agent-header sticky top-0 z-2 flex h-[80px] items-center gap-3 border-b border-border bg-card px-4 py-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn('sm:hidden', btnCls)}
                        aria-label="Back"
                        onClick={() => setFocusedId(null)}
                    >
                        <ArrowLeftIcon size={17} aria-hidden="true" />
                    </Button>
                    <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-h4 font-bold text-white"
                        style={{ background: color }}
                    >
                        {abbr}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-medium tracking-[-0.02em]">{model.name}</h3>
                        <span className="text-sm font-medium text-text-secondary">{model.provider}</span>
                    </div>
                    <Button variant="ghost" size="icon" className={btnCls} aria-label="Close" onClick={onClose}>
                        <XIcon size={17} aria-hidden="true" />
                    </Button>
                </div>
                <div className="modal-agent-content p-4">
                    {detailLoading && <PickerDetailSkeleton />}
                    {!detailLoading && detailError && (
                        <div className="px-2 text-sm text-destructive">Error loading details.</div>
                    )}
                    {!detailLoading && !detailError && (
                        <>
                            <Card className="flex flex-col gap-1 p-4 shadow-none">
                                <span className="text-[12px] font-bold tracking-[0.06em] text-(--text-primary) uppercase">
                                    Overview
                                </span>
                                <p className="m-0 text-sm leading-[1.6] whitespace-pre-wrap text-text-secondary">
                                    {description ||
                                        'No description has been provided for this model yet. You can still add it to this agent.'}
                                </p>
                            </Card>

                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <Card className="flex flex-col gap-1 p-4 shadow-none">
                                    <span className="text-xs font-semibold tracking-[0.06em] uppercase">Type</span>
                                    <span className="text-sm text-text-secondary">{modelType || 'Model'}</span>
                                </Card>
                                <Card className="flex flex-col gap-1 p-4 shadow-none">
                                    <span className="text-xs font-semibold tracking-[0.06em] uppercase">Status</span>
                                    <span className="text-sm text-text-secondary">{status}</span>
                                </Card>
                            </div>
                        </>
                    )}
                </div>
                <div className="modal-agent-footer sticky bottom-0 z-1 mt-auto border-t border-border bg-card p-4">
                    {renderDetailFooter(model as Model)}
                </div>
            </>
        );
    };

    const renderRightPane = () => {
        if (!focusedModel) {
            return renderEmptyDetail();
        }

        return renderDetail(focusedModel);
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
                        focusedModel ? 'hidden sm:flex' : 'flex',
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
                            placeholder="Search models"
                            aria-label="Search models"
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
                        {renderList()}
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
                        'model-detail-pane scrollbar-controller scrollbar-vertical flex-1 flex-col bg-card',
                        focusedModel ? 'flex' : 'hidden sm:flex',
                    )}
                >
                    {renderRightPane()}
                </div>
            </DialogContent>
        </Dialog>
    );
};
