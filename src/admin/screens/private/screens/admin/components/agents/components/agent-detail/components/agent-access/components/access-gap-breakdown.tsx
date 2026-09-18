import { Ban, ChevronDown, CircleCheck, CircleX, Eye, EyeOff, RotateCcw, ShieldCheck } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Spinner } from '@/components/ui/spinner';
import { TruncatedLabel } from '@/components/ui/truncated-label';
import { cn } from '@/lib/utils';

import type { IgnoreSet, IgnoresStatus, ItemDisplayState } from '../access-coverage';
import {
    canExclude,
    COVERED_ADMIN_REASON,
    coverageFor,
    coverageRatio,
    isBulkSelectable,
    itemCount,
    itemDisplayState,
    NO_ACL_RIGHT_REASON,
    NOTHING_SELECTABLE_REASON,
} from '../access-coverage';
import type { AccessItem, AccessItemKind, AccessUser } from '../access-types';
import { ACCESS_ITEM_KINDS, ACCESS_ITEM_KIND_PLURAL } from '../access-types';
import type { AccessWrites } from '../use-access-writes';

import CoverageCounts from './coverage-counts';
import type { ItemAction } from './item-status-menu';
import ItemStatusMenu from './item-status-menu';

interface AccessGapBreakdownProps {
    user: AccessUser;
    ignored: IgnoreSet;
    ignoresStatus: IgnoresStatus;
    canEdit: boolean;
    writes: AccessWrites;
}

/** One width for every status cell, so the labels and the section counts share a column. */
const STATUS_COLUMN = 'flex min-w-28 shrink-0 items-center justify-end';

/** Why a control is dead, in the same words the row itself would use. */
const LOCKED_REASON = 'Changes are paused until the ignored gaps have loaded.';

const STATE_LABEL: Record<ItemDisplayState, string> = {
    covered: 'Has access',
    'not-included': 'No access',
    excluded: 'Excluded',
    ignored: 'Ignored',
};

/** The glyph carries the state colour (green has it, red lacks it, grey was decided); the word
 *  beside it never does. */
const STATE_TONE: Record<ItemDisplayState, string> = {
    covered: 'text-success',
    'not-included': 'text-destructive',
    excluded: 'text-text-secondary',
    ignored: 'text-text-secondary',
};

/** The state glyph carries the same colour as its label, so the row reads at a glance. */
const STATE_ICON: Record<ItemDisplayState, typeof CircleCheck> = {
    covered: CircleCheck,
    'not-included': CircleX,
    excluded: Ban,
    ignored: EyeOff,
};

const AccessGapBreakdown = ({ user, ignored, ignoresStatus, canEdit, writes }: AccessGapBreakdownProps) => {
    const stateOf = (item: AccessItem): ItemDisplayState => itemDisplayState(item, user.id, ignored);

    // Kinds with an outstanding gap open themselves; a settled kind stays shut so a long list of
    // things that are already fine cannot bury the two that are not.
    const gappedKinds = ACCESS_ITEM_KINDS.filter((kind) => {
        const { covered, outstanding } = coverageFor(user, kind, ignored);

        return outstanding > 0 && covered < outstanding;
    });
    const [open, setOpen] = useState<string[]>(gappedKinds);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    // No write paints before the server answers, so the control that started one has to say it is
    // working — and refuse a second click while it is.
    const [pendingIds, setPendingIds] = useState<string[]>([]);
    // Keyed by section, not one slot for the panel: two sections can have a batch in flight at
    // once, and one settling must not re-arm the other's buttons mid-write.
    const [pendingBulk, setPendingBulk] = useState<Partial<Record<AccessItemKind, string>>>({});

    // Same contract as the Info sheet: only an explicit `canGrant: false` denies an ACL write; an
    // omitted flag falls back to the agent-edit right. Ignoring is agent-scoped, so it needs only that.
    const canWriteAcl = (item: AccessItem) => canEdit && item.canGrant !== false;
    // While the ignore set is unknown a dismissed pair looks like a live gap, so every write waits.
    // Writes themselves are optimistic and never lock the panel.
    const isLocked = ignoresStatus !== 'ready';

    const isSelectable = (item: AccessItem) =>
        isBulkSelectable(canWriteAcl(item), item.state === 'covered', user, item);

    const selectableOf = (kind: AccessItemKind) =>
        user.items.filter((item) => item.kind === kind && isSelectable(item));

    // Filtered through `isSelectable` on read: a ticked item can stop being selectable after a
    // refetch, and a stale id must not feed a bulk write.
    const selectedOf = (kind: AccessItemKind) => selectableOf(kind).filter((item) => selectedIds.includes(item.id));

    const toggleSelected = (itemId: string) =>
        setSelectedIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));

    const runRow = (item: AccessItem, write: Promise<unknown>) => {
        setPendingIds((prev) => [...prev, item.id]);
        void write.finally(() => setPendingIds((prev) => prev.filter((id) => id !== item.id)));
    };

    // Only the rows that landed lose their tick, and only in this batch: after a partial failure
    // the admin needs the refused rows still ticked to retry them, and ticks in another section
    // are someone else's pending work.
    const runBulk = (kind: AccessItemKind, label: string, items: AccessItem[], write: Promise<string[]>) => {
        setPendingBulk((prev) => ({ ...prev, [kind]: label }));
        void write
            .then((outstanding) => {
                const done = items.map((item) => item.id).filter((id) => !outstanding.includes(id));

                setSelectedIds((prev) => prev.filter((id) => !done.includes(id)));
            })
            .finally(() =>
                setPendingBulk((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== kind))),
            );
    };

    // Same verbs, wording and per-state sets as the Info tab's Review-access sheet
    // (item-state-menu.tsx), so one row cannot offer a different vocabulary on each surface.
    const ENTRY = {
        grant: (item: AccessItem): ItemAction => ({
            id: 'grant',
            label: 'Grant',
            icon: CircleCheck,
            tone: 'text-success',
            description: 'Add to this item’s access list',
            run: () => runRow(item, writes.grantItem(user, item)),
        }),
        block: (item: AccessItem): ItemAction => ({
            id: 'block',
            label: 'Exclude',
            icon: Ban,
            tone: 'text-destructive',
            description: 'Exclude from this item, recorded as deliberate',
            run: () => runRow(item, writes.revokeItem(user, item)),
        }),
        reset: (item: AccessItem): ItemAction => ({
            id: 'reset',
            label: 'Reset',
            icon: RotateCcw,
            tone: 'text-text-secondary',
            description: 'Remove from both lists and decide later',
            run: () => runRow(item, writes.resetItem(user, item)),
        }),
        unblock: (item: AccessItem): ItemAction => ({
            id: 'unblock',
            label: 'Stop excluding',
            icon: ShieldCheck,
            tone: 'text-success',
            description: 'Remove from this item’s excluded list',
            run: () => runRow(item, writes.unblockItem(user, item)),
        }),
        ignore: (item: AccessItem): ItemAction => ({
            id: 'ignore',
            label: 'Ignore',
            icon: EyeOff,
            tone: 'text-text-secondary',
            description: 'Dismiss the warning without changing access',
            run: () => runRow(item, writes.setIgnore(user, item, true)),
        }),
        unignore: (item: AccessItem): ItemAction => ({
            id: 'unignore',
            label: 'Stop ignoring',
            icon: Eye,
            tone: 'text-text-secondary',
            description: 'Show this gap as needing action again',
            run: () => runRow(item, writes.setIgnore(user, item, false)),
        }),
    };

    const actionsFor = (item: AccessItem): ItemAction[] => {
        const acl = canWriteAcl(item);
        // An exclusion the runtime would ignore is never offered as a live write: on the states
        // that have other verbs it is dropped, and on a covered row it is disabled below.
        const block = acl && canExclude(user, item);
        const only = (allowed: boolean, action: ItemAction): ItemAction[] => (allowed ? [action] : []);

        switch (stateOf(item)) {
            // The exclusion stays on the menu, disabled and saying why, rather than taking the
            // whole dropdown with it: Reset is still a write that lands on this row.
            case 'covered':
                return [
                    ...only(
                        acl,
                        block ? ENTRY.block(item) : { ...ENTRY.block(item), blockedReason: COVERED_ADMIN_REASON },
                    ),
                    ...only(acl, ENTRY.reset(item)),
                ];
            case 'not-included':
                return [...only(acl, ENTRY.grant(item)), ENTRY.ignore(item), ...only(block, ENTRY.block(item))];
            case 'ignored':
                return [...only(acl, ENTRY.grant(item)), ENTRY.unignore(item), ...only(block, ENTRY.block(item))];
            case 'excluded':
                return [...only(acl, ENTRY.grant(item)), ...only(acl, ENTRY.unblock(item))];
        }
    };

    const renderStatus = (item: AccessItem) => {
        const state = stateOf(item);
        const covered = state === 'covered';
        const StateIcon = STATE_ICON[state];
        const isPending = pendingIds.includes(item.id);
        // The spinner takes the glyph's place at the glyph's size, so a row in flight keeps every
        // column where it was.
        const label = (
            <>
                {isPending ? (
                    <Spinner className="size-3.5 shrink-0 text-text-secondary" />
                ) : (
                    <StateIcon className={cn('size-3.5 shrink-0', STATE_TONE[state])} aria-hidden />
                )}
                {STATE_LABEL[state]}
            </>
        );
        const actions = actionsFor(item);

        // A dead dropdown that opens onto nothing is worse than a plain label. A platform admin's
        // role short-circuits every capability ACL server-side, and so does administering this
        // capability (api/helpers/acl_access.js), so the row keeps that sentence even here.
        if (!canEdit || actions.length === 0) {
            return (
                <SimpleTooltip content={canEdit && covered && !canExclude(user, item) ? COVERED_ADMIN_REASON : null}>
                    <span className={cn(STATUS_COLUMN, 'gap-1.5 text-sm whitespace-nowrap text-foreground')}>
                        {label}
                    </span>
                </SimpleTooltip>
            );
        }

        return (
            <ItemStatusMenu
                user={user}
                item={item}
                actions={actions}
                label={label}
                triggerClassName={cn(
                    STATUS_COLUMN,
                    'cursor-pointer gap-1.5 rounded-md py-0.5 text-sm whitespace-nowrap text-foreground outline-none hover:bg-muted',
                )}
                // A write in flight closes the menu to a second click: the row cannot yet say what
                // the first one did.
                isLocked={isLocked || isPending}
            />
        );
    };

    /** Null while the row can be ticked; otherwise the one sentence that says why it cannot. */
    const itemBlockedReason = (item: AccessItem): string | null => {
        if (isLocked) return LOCKED_REASON;
        if (isSelectable(item)) return null;
        if (item.state === 'covered' && !canExclude(user, item)) return COVERED_ADMIN_REASON;

        return NO_ACL_RIGHT_REASON;
    };

    const renderItem = (item: AccessItem) => (
        <li
            key={item.id}
            className="access-gap-item flex items-center gap-3 border-b border-border/60 bg-card px-4 py-2 last:border-b-0 hover:bg-muted/30"
        >
            {/* Always rendered, disabled where nothing can be changed, so every name starts on the
                same column and an unpickable row reads as unpickable rather than as a blank. A
                disabled Radix control swallows the pointer, so the reason hangs off a wrapper. */}
            <SimpleTooltip content={itemBlockedReason(item)}>
                <span className={cn('flex', itemBlockedReason(item) !== null && 'cursor-not-allowed')}>
                    <Checkbox
                        className={cn('cursor-pointer', itemBlockedReason(item) !== null && 'pointer-events-none')}
                        checked={isSelectable(item) && selectedIds.includes(item.id)}
                        disabled={!isSelectable(item) || isLocked}
                        onChange={() => toggleSelected(item.id)}
                        aria-label={`Select ${item.name}`}
                    />
                </span>
            </SimpleTooltip>
            <TruncatedLabel text={item.name} className="min-w-0 flex-1 text-sm" />
            {renderStatus(item)}
        </li>
    );

    const renderKind = (kind: AccessItemKind) => {
        const coverageOf = coverageFor(user, kind, ignored);
        const { covered, outstanding } = coverageOf;
        const items = user.items.filter((item) => item.kind === kind);
        const selectable = selectableOf(kind);
        const selected = selectedOf(kind);

        const toggleSelectAll = () =>
            setSelectedIds((prev) => {
                const ids = selectable.map((item) => item.id);
                // Decided from `prev`, not the render-time closure, so two fast clicks toggle
                // rather than both selecting.
                const allSelected = ids.every((id) => prev.includes(id));
                const rest = prev.filter((id) => !ids.includes(id));

                return allSelected ? rest : [...rest, ...ids];
            });

        const isOpen = open.includes(kind);
        const toggleOpen = () =>
            setOpen((prev) => (prev.includes(kind) ? prev.filter((value) => value !== kind) : [...prev, kind]));
        const stop = (event: React.SyntheticEvent) => event.stopPropagation();
        const canSelectAll = selectable.length > 0 && !isLocked;
        const selectAllBlockedReason = (() => {
            if (canSelectAll) return null;

            return isLocked ? LOCKED_REASON : NOTHING_SELECTABLE_REASON;
        })();

        return (
            <AccordionItem key={kind} value={kind}>
                {/* Mouse: the whole row toggles. Keyboard and assistive tech: only the label is the
                    button, because an ARIA button hides every control nested inside it. Height is
                    fixed so ticking a box never shifts the panel. */}
                <div
                    className="access-gap-kind-header flex min-h-11 cursor-pointer items-center gap-3 border-t border-border bg-muted px-4 first:border-t-0 hover:bg-muted/80"
                    onClick={toggleOpen}
                >
                    {/* A disabled button swallows its click, so while nothing is selectable the
                        checkbox stops catching the pointer and the row toggles as elsewhere — which
                        is also what lets the reason hang off this wrapper. */}
                    <SimpleTooltip content={selectAllBlockedReason}>
                        <span
                            className={cn('flex', !canSelectAll && 'cursor-not-allowed')}
                            onClick={canSelectAll ? stop : undefined}
                            onKeyDown={stop}
                        >
                            <Checkbox
                                className={cn('cursor-pointer', !canSelectAll && 'pointer-events-none')}
                                checked={selected.length > 0 && selected.length === selectable.length}
                                indeterminate={selected.length > 0 && selected.length < selectable.length}
                                disabled={!canSelectAll}
                                onChange={toggleSelectAll}
                                aria-label={`Select all ${ACCESS_ITEM_KIND_PLURAL[kind]}`}
                            />
                        </span>
                    </SimpleTooltip>
                    <span
                        role="button"
                        tabIndex={0}
                        aria-expanded={isOpen}
                        aria-label={`${ACCESS_ITEM_KIND_PLURAL[kind]}, ${itemCount(items.length)}`}
                        className="rounded-sm text-xs font-semibold tracking-wider uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;

                            // Space scrolls the page by default, and the label is the control here.
                            event.preventDefault();
                            toggleOpen();
                        }}
                    >
                        {ACCESS_ITEM_KIND_PLURAL[kind]}
                    </span>
                    {/* The bulk actions take the counts' place rather than sharing the row with
                        them: four buttons and five figures cannot both fit, and the counts are the
                        half a reader can come back to once the selection is gone. */}
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden">
                        {selected.length > 0 && (
                            <span className="flex items-center gap-2" onClick={stop} onKeyDown={stop}>
                                {renderKindActions(kind, selected)}
                            </span>
                        )}
                    </span>
                    {/* The ratio drops whatever was settled, so the row spells out the numbers
                        behind it rather than making the reader hover for them. */}
                    {selected.length === 0 && (
                        <CoverageCounts coverage={coverageOf} layout="row" className="hidden md:grid" />
                    )}
                    <span className={cn(STATUS_COLUMN, 'gap-1.5')}>
                        {/* Same rule as the collapsed cell: nothing left to decide is not a win. */}
                        <span
                            className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                                outstanding === 0 && 'text-text-secondary',
                                outstanding > 0 &&
                                    (covered < outstanding
                                        ? 'bg-destructive/10 text-destructive'
                                        : 'bg-success/10 text-success'),
                            )}
                        >
                            {coverageRatio(coverageOf) ?? '—'}
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
                    <ul className="access-gap-list flex flex-col">{items.map(renderItem)}</ul>
                </AccordionContent>
            </AccordionItem>
        );
    };

    const renderKindActions = (kind: AccessItemKind, selected: AccessItem[]) => {
        const toGrant = selected.filter((item) => item.state !== 'covered');
        const toRevoke = selected.filter((item) => item.state === 'covered');
        // An ignore records a decision about a gap, so only a live gap has one to record; it writes
        // no access list, which is why it alone is not gated on `canWriteAcl`.
        const toIgnore = selected.filter((item) => stateOf(item) === 'not-included');
        // A reset withdraws list entries, so a row that is on neither list has nothing to withdraw.
        const toReset = selected.filter((item) => canWriteAcl(item) && ['covered', 'excluded'].includes(stateOf(item)));

        // One batch at a time per section: while it runs every verb here is dead, and the one that
        // started it says so.
        const busyLabel = pendingBulk[kind];

        const renderAction = (label: string, targets: AccessItem[], write: () => Promise<string[]>) => {
            if (targets.length === 0) return null;

            return (
                <Button
                    size="xs"
                    variant={label === 'Grant all' ? 'default' : 'outline'}
                    className={label === 'Grant all' ? undefined : 'text-text-secondary'}
                    disabled={isLocked || busyLabel !== undefined}
                    onClick={() => runBulk(kind, label, targets, write())}
                >
                    {busyLabel === label && <Spinner className="size-3.5" />}
                    {label}
                </Button>
            );
        };

        return (
            <>
                <span className="text-xs whitespace-nowrap text-text-secondary">{selected.length} selected</span>
                {renderAction('Grant all', toGrant, () => writes.grantItems(user, toGrant))}
                {renderAction('Exclude all', toRevoke, () => writes.revokeItems(user, toRevoke))}
                {renderAction('Ignore all', toIgnore, () => writes.ignoreItems(user, toIgnore))}
                {renderAction('Reset all', toReset, () => writes.resetItems(user, toReset))}
            </>
        );
    };

    return (
        <div className="access-gap-breakdown flex flex-col overflow-hidden rounded-lg border border-border bg-card">
            <Accordion type="multiple" value={open} onValueChange={setOpen} className="flex flex-col">
                {/* A kind the agent uses none of is not a section with nothing in it, it is not a
                    section: an empty row only pushes the ones that matter further down. */}
                {ACCESS_ITEM_KINDS.filter((kind) => user.items.some((item) => item.kind === kind)).map(renderKind)}
            </Accordion>
        </div>
    );
};

export default AccessGapBreakdown;
