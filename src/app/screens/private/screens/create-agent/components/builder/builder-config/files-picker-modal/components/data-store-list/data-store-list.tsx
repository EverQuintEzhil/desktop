import { CheckIcon } from 'lucide-react';

import { PickerListEmpty } from '@/app/components/picker/picker-list-empty';
import { DescriptionHoverCard } from '@/components/description-hover-card';
import type { DataStoreProviderFilter } from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';

import { CATEGORY_LABELS, rowActive, rowBase } from '../../constants';
import type { ActivePanel, DataStoreItem } from '../../types';
import { getDataStoreAbbr } from '../../utils/get-data-store-abbr';
import { getDataStoreColor } from '../../utils/get-data-store-color';

export interface DataStoreListProps {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    providerFilter: DataStoreProviderFilter;
    debouncedSearch: string;
    onClearSearch: () => void;
    dataStores: DataStoreItem[];
    selectedFiles: { _id: string; name: string; provider?: string }[];
    activePanel: ActivePanel;
    onSelect: (id: string) => void;
}

const renderLoadingSkeleton = () => (
    <div className="flex flex-col gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
                <div className="h-[42px] w-[42px] shrink-0 rounded-[14px] bg-foreground/10" />
                <div className="h-3 flex-1 rounded bg-foreground/10" style={{ width: `${55 + (i % 3) * 15}%` }} />
            </div>
        ))}
    </div>
);

/** Renders the sidebar list of data stores, split into Selected and Available sections. */
const DataStoreList = ({
    isLoading,
    isError,
    error,
    providerFilter,
    debouncedSearch,
    onClearSearch,
    dataStores,
    selectedFiles,
    activePanel,
    onSelect,
}: DataStoreListProps) => {
    if (isLoading) {
        return renderLoadingSkeleton();
    }

    if (isError) {
        const message = error instanceof Error ? error.message : 'Failed to load data stores.';

        return (
            <p className="px-3 py-2 text-xs" style={{ color: 'var(--danger)' }}>
                {message}
            </p>
        );
    }

    const selectedListItems = debouncedSearch
        ? selectedFiles.filter((f) => f.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
        : selectedFiles;
    const availableListItems = dataStores.filter((ds) => !selectedFiles.some((f) => f._id === ds._id));
    const totalItems = selectedListItems.length + availableListItems.length;

    if (totalItems === 0) {
        return (
            <PickerListEmpty
                label={CATEGORY_LABELS[providerFilter].toLowerCase()}
                search={debouncedSearch}
                onClearSearch={onClearSearch}
            />
        );
    }

    const renderRow = (ds: { _id: string; name: string; description?: string }) => {
        const alreadySelected = selectedFiles.some((f) => f._id === ds._id);
        const abbr = getDataStoreAbbr(ds.name);
        const color = getDataStoreColor(ds._id);

        return (
            <button
                key={ds._id}
                className={cn(rowBase, activePanel === ds._id && rowActive)}
                onClick={() => onSelect(ds._id)}
            >
                <span
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[13px] font-bold text-white"
                    style={{ background: color }}
                >
                    {abbr}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="min-w-0 overflow-hidden font-medium text-ellipsis whitespace-nowrap">
                        {ds.name}
                    </span>
                    {ds.description && (
                        <DescriptionHoverCard name={ds.name} description={ds.description}>
                            <span className="line-clamp-2 text-xs text-text-secondary">{ds.description}</span>
                        </DescriptionHoverCard>
                    )}
                </span>
                {alreadySelected && (
                    <CheckIcon size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} aria-hidden="true" />
                )}
            </button>
        );
    };

    const renderSelectedSection = () => {
        if (selectedListItems.length === 0) return null;

        return (
            <>
                <div className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-[0.07em] text-text-secondary uppercase">
                    Selected
                </div>
                {selectedListItems.map(renderRow)}
                <div className="px-2 pt-3 pb-1 text-[10px] font-bold tracking-[0.07em] text-text-secondary uppercase">
                    Available
                </div>
            </>
        );
    };

    return (
        <>
            {renderSelectedSection()}
            {availableListItems.map(renderRow)}
        </>
    );
};

export default DataStoreList;
