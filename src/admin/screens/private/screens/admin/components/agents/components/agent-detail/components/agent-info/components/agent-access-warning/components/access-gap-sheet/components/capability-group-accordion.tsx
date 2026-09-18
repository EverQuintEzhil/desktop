import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { useState, type ReactNode } from 'react';

import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import type { CapabilityKind } from '@/lib/api/admin/agent-access-check';
import { cn } from '@/lib/utils';

import { itemCount } from '../../../../../../agent-access/access-coverage';

// Exhaustive by type: a kind added to CapabilityKind but not here is a compile error, so it can
// never silently render no group on the one screen whose job is to warn. The order is the Access
// tab's `ACCESS_ITEM_KINDS`, so one agent's capabilities read the same way on both screens.
const CAPABILITY_KIND_GROUP: Record<CapabilityKind, { label: string; order: number }> = {
    tool: { label: 'Tools', order: 0 },
    skill: { label: 'Skills', order: 1 },
    connector: { label: 'Connectors', order: 2 },
    dataStore: { label: 'Data stores', order: 3 },
};

const CAPABILITY_KIND_ORDER = (Object.keys(CAPABILITY_KIND_GROUP) as CapabilityKind[]).sort(
    (a, b) => CAPABILITY_KIND_GROUP[a].order - CAPABILITY_KIND_GROUP[b].order,
);

const UNMAPPED_GROUP_VALUE = '__unmapped';

interface Group<TItem> {
    value: string;
    label: string;
    groupItems: TItem[];
}

interface Props<TItem> {
    items: TItem[];
    kindOf: (item: TItem) => CapabilityKind;
    keyOf: (item: TItem) => string;
    renderItem: (item: TItem) => ReactNode;
    /** Replaces the plain count in the header, e.g. with a coverage pill. */
    renderBadge?: (groupItems: TItem[]) => ReactNode;
    /** Select-all for this group alone. The caller owns the propagation guard, because whether a
     *  click on it should still toggle the section depends on whether it can be ticked at all. */
    renderHeaderCheckbox?: (groupItems: TItem[], groupLabel: string) => ReactNode;
    /** The bulk actions for whatever is ticked in this group; nothing ticked renders nothing. */
    renderHeaderActions?: (groupItems: TItem[]) => ReactNode;
    /** The figures behind the pill. They give way to the bulk actions, which need the same room. */
    renderHeaderCounts?: (groupItems: TItem[]) => ReactNode;
    /** Which groups start open. Absent means all closed. */
    isOpenByDefault?: (groupItems: TItem[]) => boolean;
}

const buildGroups = <TItem,>(items: TItem[], kindOf: (item: TItem) => CapabilityKind): Group<TItem>[] => {
    const groups: Group<TItem>[] = CAPABILITY_KIND_ORDER.map((kind) => ({
        value: kind,
        label: CAPABILITY_KIND_GROUP[kind].label,
        groupItems: items.filter((item) => kindOf(item) === kind),
    })).filter((group) => group.groupItems.length > 0);

    // Runtime counterpart of the type-level exhaustiveness: an unrecognised kind is still shown.
    const unmapped = items.filter((item) => !(kindOf(item) in CAPABILITY_KIND_GROUP));

    if (unmapped.length > 0) {
        groups.push({ value: UNMAPPED_GROUP_VALUE, label: 'Other', groupItems: unmapped });
    }

    return groups;
};

const CapabilityGroupAccordion = <TItem,>(props: Props<TItem>) => {
    const {
        items,
        kindOf,
        keyOf,
        renderItem,
        renderBadge,
        renderHeaderCheckbox,
        renderHeaderActions,
        renderHeaderCounts,
        isOpenByDefault,
    } = props;
    const [manualOpen, setManualOpen] = useState<{ signature: string; value: string[] } | null>(null);

    const groups = buildGroups(items, kindOf);
    // Only a change in which groups are present discards the admin's own collapse/expand — a grant
    // that reshapes the list must not leave the sheet holding open a group that no longer exists,
    // since closed content is unmounted.
    const signature = groups.map((group) => group.value).join('|');
    // A group that still owes work opens itself and a settled one stays shut, until the reader says
    // otherwise — their own collapse survives every render that keeps the same groups.
    const autoOpen = isOpenByDefault
        ? groups.filter((group) => isOpenByDefault(group.groupItems)).map((group) => group.value)
        : [];
    const openValue = manualOpen?.signature === signature ? manualOpen.value : autoOpen;

    const setOpen = (value: string[]) => setManualOpen({ signature, value });

    const renderGroup = ({ value, label, groupItems }: Group<TItem>) => {
        const isOpen = openValue.includes(value);
        const toggleOpen = () => setOpen(isOpen ? openValue.filter((open) => open !== value) : [...openValue, value]);

        return (
            <AccordionItem key={value} value={value}>
                {/* Mouse: the whole row toggles. Keyboard and assistive tech: only the label is the
                    button, because an ARIA button hides every control nested inside it. Height is
                    fixed so ticking a box never shifts the panel. */}
                <div
                    className="capability-group-accordion-header flex min-h-11 cursor-pointer items-center gap-3 border-t border-border bg-muted px-4 first:border-t-0 hover:bg-muted/80"
                    onClick={toggleOpen}
                >
                    {renderHeaderCheckbox?.(groupItems, label)}
                    <span
                        role="button"
                        tabIndex={0}
                        aria-expanded={isOpen}
                        aria-label={`${label}, ${itemCount(groupItems.length)}`}
                        className="rounded-sm text-xs font-semibold tracking-wider uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onKeyDown={(event: React.KeyboardEvent) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;

                            // Space scrolls the page by default, and the label is the control here.
                            event.preventDefault();
                            toggleOpen();
                        }}
                    >
                        {label}
                    </span>
                    {/* The bulk actions take the counts' place rather than sharing the row with
                        them: four buttons and four figures cannot both fit, and the counts are the
                        half a reader can come back to once the selection is gone. */}
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden">
                        {renderHeaderActions?.(groupItems) ?? renderHeaderCounts?.(groupItems)}
                    </span>
                    {/* w-22 + this gap and the chevron equals the rows' w-28 status cell, so the
                        pill sits exactly above the item statuses. */}
                    <span className="flex shrink-0 items-center gap-2">
                        <span className="flex w-22 justify-end">
                            {renderBadge ? (
                                renderBadge(groupItems)
                            ) : (
                                <span className="text-xs font-normal text-text-secondary">{groupItems.length}</span>
                            )}
                        </span>
                        <ChevronDown
                            aria-hidden
                            className={cn(
                                'size-4 text-muted-foreground transition-transform duration-300',
                                isOpen && 'rotate-180',
                            )}
                        />
                    </span>
                </div>
                <AccordionContent className="pb-2">
                    <ul className="capability-group-accordion-list flex flex-col">
                        {groupItems.map((item) => (
                            <li
                                key={keyOf(item)}
                                className="capability-group-accordion-row flex items-center gap-3 border-b border-border/60 bg-card px-4 py-2 last:border-b-0 hover:bg-muted/30"
                            >
                                {renderItem(item)}
                            </li>
                        ))}
                    </ul>
                </AccordionContent>
            </AccordionItem>
        );
    };

    return (
        <Accordion
            type="multiple"
            value={openValue}
            onValueChange={setOpen}
            className="capability-group-accordion flex flex-col overflow-hidden rounded-lg border border-border bg-card"
        >
            {groups.map(renderGroup)}
        </Accordion>
    );
};

export default CapabilityGroupAccordion;
