import { ChevronDownIcon } from 'lucide-react';
import type { KeyboardEvent, MouseEvent } from 'react';

import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

interface Props {
    listId: string;
    isExpanded: boolean;
    expandLabel: string;
    collapseLabel: string;
    onClick: (e: MouseEvent<HTMLDivElement>) => void;
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}

/** Nested inside a nav row's `Link`, so it is a div-with-role rather than a button. */
const SidebarNavExpandToggle = (props: Props) => {
    const { listId, isExpanded, expandLabel, collapseLabel, onClick, onKeyDown } = props;
    const label = isExpanded ? collapseLabel : expandLabel;

    return (
        <SimpleTooltip side="right" content={label}>
            <div
                className={cn(
                    'ml-auto flex size-5 items-center justify-center rounded-md',
                    'hover:bg-(--sidebar-primary-foreground)/15',
                    'transition-opacity duration-150 motion-reduce:transition-none',
                    // Hide-until-hover only where hover exists — on touch it must stay visible or it is unreachable.
                    isExpanded
                        ? 'opacity-100'
                        : cn(
                              'opacity-100 [@media(hover:hover)]:opacity-0',
                              'group-focus-within:opacity-100 group-hover:opacity-100',
                          ),
                )}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-expanded={isExpanded}
                // The list only exists while expanded, so the id would otherwise dangle.
                aria-controls={isExpanded ? listId : undefined}
                onClick={onClick}
                onKeyDown={onKeyDown}
            >
                <ChevronDownIcon
                    className={cn(
                        'size-3.5 transition-transform duration-200 motion-reduce:transition-none',
                        isExpanded && 'rotate-180',
                    )}
                />
            </div>
        </SimpleTooltip>
    );
};

export default SidebarNavExpandToggle;
