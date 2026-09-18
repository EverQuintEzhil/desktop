import { SearchXIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PickerListEmptyProps {
    /** Plural, lowercase noun for the list contents, e.g. 'skills', 'connectors'. */
    label: string;
    search?: string;
    onClearSearch?: () => void;
}

export const PickerListEmpty = ({ label, search, onClearSearch }: PickerListEmptyProps) => (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <span
            className={cn(
                'flex h-11 w-11 items-center justify-center rounded-[14px]',
                'bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] text-primary',
                'border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]',
            )}
        >
            <SearchXIcon size={18} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-(--text-primary)">{`No ${label} found`}</span>
            <span className="max-w-[220px] text-xs leading-normal text-text-secondary">
                {search ? `Nothing matches "${search}". Try a different search.` : `You don't have any ${label} yet.`}
            </span>
        </div>
        {search && onClearSearch ? (
            <Button type="button" variant="secondary" size="sm" className="rounded-[10px]" onClick={onClearSearch}>
                Clear search
            </Button>
        ) : null}
    </div>
);
