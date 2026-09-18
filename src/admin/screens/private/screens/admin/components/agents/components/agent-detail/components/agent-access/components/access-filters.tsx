import { ListFilter } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { AccessFilters as AccessFiltersValue } from '../access-coverage';
import { ACCESS_PATH_FILTERS, ACCESS_PATH_FILTER_LABEL, countActiveFilters, EMPTY_FILTERS } from '../access-coverage';
import type { AccessItemKind } from '../access-types';
import { ACCESS_ITEM_KINDS, ACCESS_ITEM_KIND_LABEL } from '../access-types';

interface AccessFiltersProps {
    value: AccessFiltersValue;
    onChange: (value: AccessFiltersValue) => void;
    /** Per-path row counts, so a filter that would return nothing says so before it is picked. */
    pathCounts: Record<string, number>;
}

const toggle = <T extends string>(list: T[], entry: T): T[] =>
    list.includes(entry) ? list.filter((one) => one !== entry) : [...list, entry];

const AccessFilters = ({ value, onChange, pathCounts }: AccessFiltersProps) => {
    const active = countActiveFilters(value);

    const renderOption = (key: string, label: string, checked: boolean, onToggle: () => void, hint?: ReactNode) => (
        <DropdownMenuCheckboxItem
            key={key}
            checked={checked}
            onCheckedChange={onToggle}
            // Without this the menu closes on the first tick, so a second filter needs a second trip.
            onSelect={(event) => event.preventDefault()}
        >
            <span className="flex-1 truncate">{label}</span>
            {hint}
        </DropdownMenuCheckboxItem>
    );

    const renderPath = (path: (typeof ACCESS_PATH_FILTERS)[number]) =>
        renderOption(
            path,
            ACCESS_PATH_FILTER_LABEL[path],
            value.paths.includes(path),
            () => onChange({ ...value, paths: toggle(value.paths, path) }),
            <span className="shrink-0 text-xs text-text-secondary tabular-nums">{pathCounts[path] ?? 0}</span>,
        );

    const renderStatus = (status: string, label: string) =>
        renderOption(status, label, value.statuses.includes(status), () =>
            onChange({ ...value, statuses: toggle(value.statuses, status) }),
        );

    const renderMissingKind = (kind: AccessItemKind) =>
        renderOption(kind, ACCESS_ITEM_KIND_LABEL[kind], value.missingKinds.includes(kind), () =>
            onChange({ ...value, missingKinds: toggle(value.missingKinds, kind) }),
        );

    return (
        <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="xs" className="shrink-0 rounded-full text-text-secondary">
                    <ListFilter className="size-4" />
                    Filters
                    {active > 0 && (
                        <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary tabular-nums">
                            {active}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                    How they got access
                </DropdownMenuLabel>
                {ACCESS_PATH_FILTERS.map(renderPath)}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                    Status
                </DropdownMenuLabel>
                {renderStatus('ready', 'Ready')}
                {renderStatus('gaps', 'Missing something')}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                    Missing a capability
                </DropdownMenuLabel>
                {ACCESS_ITEM_KINDS.map(renderMissingKind)}
                {active > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <Button
                            size="sm"
                            variant="ghost"
                            className="w-full justify-start text-text-secondary"
                            onClick={() => onChange(EMPTY_FILTERS)}
                        >
                            Clear filters
                        </Button>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );
};

export default AccessFilters;
