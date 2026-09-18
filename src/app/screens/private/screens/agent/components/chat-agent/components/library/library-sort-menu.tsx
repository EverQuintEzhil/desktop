import { ArrowDownUpIcon, CheckIcon, ChevronsUpDownIcon } from 'lucide-react';

import type { LibrarySort } from '@/components/agent-chat/hooks/use-media-library';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Props {
    sort: LibrarySort;
    onChange: (sort: LibrarySort) => void;
}

const SORT_OPTIONS: { value: LibrarySort; label: string }[] = [
    { value: 'newest', label: 'Most recent' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'largest', label: 'Largest' },
    { value: 'smallest', label: 'Smallest' },
];

const LibrarySortMenu = ({ sort, onChange }: Props) => {
    const activeLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Sort';

    return (
        <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 rounded-full">
                    <ArrowDownUpIcon className="size-3.5 text-text-secondary" />
                    <span className="text-sm">{activeLabel}</span>
                    <ChevronsUpDownIcon className="size-3.5 text-text-secondary" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                {SORT_OPTIONS.map(({ value, label }) => (
                    <DropdownMenuItem
                        key={value}
                        className="cursor-pointer justify-between gap-2"
                        onSelect={() => onChange(value)}
                    >
                        <span>{label}</span>
                        <CheckIcon
                            className={cn('size-4 text-primary', value === sort ? 'opacity-100' : 'opacity-0')}
                        />
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );
};

export default LibrarySortMenu;
