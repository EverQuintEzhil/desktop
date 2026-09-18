import { Ban, CircleCheck, CircleX, EyeOff } from 'lucide-react';
import type React from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Spinner } from '@/components/ui/spinner';
import { TruncatedLabel } from '@/components/ui/truncated-label';
import { cn } from '@/lib/utils';

import type { KindCoverage } from '../../../../../../agent-access/access-coverage';
import {
    COVERED_ADMIN_REASON,
    coverageRatio,
    NO_ACL_RIGHT_REASON,
    NOTHING_SELECTABLE_REASON,
} from '../../../../../../agent-access/access-coverage';
import type { AccessItemKind } from '../../../../../../agent-access/access-types';
import CoverageCounts from '../../../../../../agent-access/components/coverage-counts';
import type { ItemAccessState, PrincipalGapItem } from '../../../use-agent-access-gaps';
import type { RenderRowActions } from '../types';

import CapabilityGroupAccordion from './capability-group-accordion';

/** The bulk verbs a ticked selection can be acted on with, in the sheet's own action vocabulary. */
export type DetailBulkAction = 'grant' | 'revoke' | 'ignore' | 'clear';

/**
 * Multi-select for bulk granting, held per capability group: a tick in Tools says nothing about
 * Skills. Only rows still open to a grant are selectable — a granted row has nothing to add, and a
 * revoked row records a deliberate exclusion this must not steamroll.
 */
export interface DetailSelection {
    selectedIds: Set<string>;
    isSelectable: (item: PrincipalGapItem) => boolean;
    onToggle: (itemId: string, selected: boolean) => void;
    onToggleMany: (itemIds: string[], selected: boolean) => void;
    onBulk: (action: DetailBulkAction, items: PrincipalGapItem[]) => void;
    /** The verb this group has on the wire, if any: while one runs the rest are dead and it says so. */
    pendingOf: (kind: string) => DetailBulkAction | null;
}

interface Props {
    items: PrincipalGapItem[];
    /** Every item this person has, filter or not: the header's figures describe their whole
     *  coverage of a kind, exactly as the Access tab's do, not just the rows on screen. */
    allItems: PrincipalGapItem[];
    /** Absent for platform admins: their role bypasses every ACL, so no write here can change anything. */
    renderRowActions?: RenderRowActions;
    /** Absent when this viewer may not grant anything for this person. */
    selection?: DetailSelection;
}

const STATE_TEXT: Record<ItemAccessState, string> = {
    granted: 'Has access',
    missing: 'No access',
    revoked: 'Excluded',
    ignored: 'Ignored',
};

/** The state glyph carries the same colour as its label, so the row reads at a glance. */
const STATE_ICON: Record<ItemAccessState, typeof CircleCheck> = {
    granted: CircleCheck,
    missing: CircleX,
    revoked: Ban,
    ignored: EyeOff,
};

// Same tones as the state menu's own trigger, so a read-only row and an actionable one describe
// the same fact identically: green has it, red lacks it, grey was decided.
const ICON_TONE: Record<ItemAccessState, string> = {
    granted: 'text-success',
    missing: 'text-destructive',
    revoked: 'text-text-secondary',
    ignored: 'text-text-secondary',
};

/** Why a row cannot be ticked, in the Access tab's own two sentences: selection follows
 *  `isBulkSelectable`, so the only row that is decided rather than forbidden is a covered one the
 *  item refuses to exclude — its single bulk verb. */
const rowBlockedReason = (item: PrincipalGapItem): string =>
    item.state === 'granted' && item.excludable === false ? COVERED_ADMIN_REASON : NO_ACL_RIGHT_REASON;

const PrincipalDetailView = (props: Props) => {
    const { items, allItems, renderRowActions, selection } = props;

    // Non-selectable rows keep a disabled box rather than a blank, so the marks line up and the
    // view reads the same for every person. A disabled Radix control swallows the pointer, so the
    // reason hangs off a wrapper rather than off the box itself.
    const renderRowCheckbox = (item: PrincipalGapItem) => {
        if (!selection) return null;

        const isSelectable = selection.isSelectable(item);

        return (
            <SimpleTooltip content={isSelectable ? null : rowBlockedReason(item)}>
                <span className={cn('flex', !isSelectable && 'cursor-not-allowed')}>
                    <Checkbox
                        className={cn('cursor-pointer', !isSelectable && 'pointer-events-none')}
                        checked={isSelectable && selection.selectedIds.has(item.itemId)}
                        disabled={!isSelectable}
                        aria-label={`Select ${item.itemName}`}
                        onChange={(_, checked) => selection.onToggle(item.itemId, checked)}
                    />
                </span>
            </SimpleTooltip>
        );
    };

    // The glyph carries the state colour and the word never does — the same split the state menu's
    // trigger uses.
    const renderState = (item: PrincipalGapItem) => {
        const StateIcon = STATE_ICON[item.state];

        return (
            <span className="flex items-center gap-1.5 text-sm whitespace-nowrap text-foreground">
                <StateIcon className={cn('size-3.5 shrink-0', ICON_TONE[item.state])} aria-hidden />
                {STATE_TEXT[item.state]}
            </span>
        );
    };

    const renderItem = (item: PrincipalGapItem) => (
        <>
            {renderRowCheckbox(item)}
            <TruncatedLabel text={item.itemName} className="min-w-0 flex-1 text-sm" />
            {/* One fixed-width, right-aligned cell for every status variant, or rows drift. */}
            <span className="flex w-28 shrink-0 items-center justify-end">
                {renderRowActions ? renderRowActions(item) : renderState(item)}
            </span>
        </>
    );

    const selectedOf = (groupItems: PrincipalGapItem[]): PrincipalGapItem[] =>
        // Filtered through `isSelectable` on read: a ticked item can stop being selectable after a
        // refetch, and a stale id must not feed a bulk write.
        groupItems.filter((item) => selection?.isSelectable(item) && selection.selectedIds.has(item.itemId));

    const stop = (event: React.SyntheticEvent) => event.stopPropagation();

    const renderHeaderCheckbox = (groupItems: PrincipalGapItem[], groupLabel: string) => {
        if (!selection) return null;

        const selectable = groupItems.filter(selection.isSelectable);
        const selected = selectedOf(groupItems);
        const canSelectAll = selectable.length > 0;
        const allSelected = canSelectAll && selected.length === selectable.length;

        return (
            // A disabled button swallows its click, so while nothing is selectable the checkbox
            // stops catching the pointer and the row toggles as it does elsewhere.
            <SimpleTooltip content={canSelectAll ? null : NOTHING_SELECTABLE_REASON}>
                <span
                    className={cn('flex', !canSelectAll && 'cursor-not-allowed')}
                    onClick={canSelectAll ? stop : undefined}
                    onKeyDown={stop}
                >
                    <Checkbox
                        className={cn('cursor-pointer', !canSelectAll && 'pointer-events-none')}
                        checked={allSelected}
                        indeterminate={selected.length > 0 && !allSelected}
                        disabled={!canSelectAll}
                        aria-label={`Select all ${groupLabel}`}
                        onChange={(_, checked) =>
                            selection.onToggleMany(
                                selectable.map((item) => item.itemId),
                                checked,
                            )
                        }
                    />
                </span>
            </SimpleTooltip>
        );
    };

    /**
     * The same per-state rules the Access tab's section header uses, so one selection cannot offer a
     * different verb set on each surface: a verb with nothing to act on is not rendered at all.
     */
    const renderHeaderActions = (groupItems: PrincipalGapItem[]) => {
        if (!selection) return null;

        const selected = selectedOf(groupItems);

        if (selected.length === 0) return null;

        const toGrant = selected.filter((item) => item.state !== 'granted');
        const toExclude = selected.filter((item) => item.state === 'granted' && item.excludable !== false);
        const toIgnore = selected.filter((item) => item.state === 'missing');
        const toReset = selected.filter((item) => item.state === 'granted' || item.state === 'revoked');

        // One batch at a time per group: while it runs every verb here is dead, and the one that
        // started it says so — no row moves until the server has answered.
        const pending = selection.pendingOf(groupItems[0].itemKind);

        const renderAction = (label: string, action: DetailBulkAction, targets: PrincipalGapItem[]) => {
            if (targets.length === 0) return null;

            return (
                <Button
                    size="xs"
                    variant={action === 'grant' ? 'default' : 'outline'}
                    className={action === 'grant' ? undefined : 'text-text-secondary'}
                    disabled={pending !== null}
                    onClick={() => selection.onBulk(action, targets)}
                >
                    {pending === action && <Spinner className="size-3.5" />}
                    {label}
                </Button>
            );
        };

        return (
            <span className="flex items-center gap-2" onClick={stop} onKeyDown={stop}>
                <span className="text-xs whitespace-nowrap text-text-secondary">{selected.length} selected</span>
                {renderAction('Grant all', 'grant', toGrant)}
                {renderAction('Exclude all', 'revoke', toExclude)}
                {renderAction('Ignore all', 'ignore', toIgnore)}
                {renderAction('Reset all', 'clear', toReset)}
            </span>
        );
    };

    /**
     * Coverage over the group, e.g. 2/4, on the tab's own rule: the denominator is the work still to
     * decide, falling back to the total once nothing is outstanding. Red means someone still has to
     * act, so only an unresolved gap earns it — a row deliberately ignored or revoked leaves the
     * group short of full coverage but asks nothing of anyone.
     */
    const renderCoverageBadge = (groupItems: PrincipalGapItem[]) => {
        const coverage = coverageOf(groupItems);
        const { covered, outstanding } = coverage;

        return (
            <span
                className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                    outstanding === 0 && 'text-text-secondary',
                    outstanding > 0 &&
                        (covered < outstanding ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'),
                )}
            >
                {coverageRatio(coverage) ?? '—'}
            </span>
        );
    };

    /** The same four figures the Access tab prints, over the same rule: read off every item of the
     *  kind, so a filtered view narrows which rows are listed and never what the numbers mean. */
    const coverageOf = (groupItems: PrincipalGapItem[]): KindCoverage => {
        const kind = groupItems[0].itemKind;
        const ofKind = allItems.filter((item) => item.itemKind === kind);
        const ignored = ofKind.filter((item) => item.state === 'ignored').length;
        const excluded = ofKind.filter((item) => item.state === 'revoked').length;

        return {
            kind: kind as AccessItemKind,
            covered: ofKind.filter((item) => item.state === 'granted').length,
            ignored,
            excluded,
            total: ofKind.length,
            outstanding: ofKind.length - ignored - excluded,
        };
    };

    const renderHeaderCounts = (groupItems: PrincipalGapItem[]) => (
        <CoverageCounts coverage={coverageOf(groupItems)} layout="row" className="hidden md:grid" />
    );

    /** Same rule as the Access tab's own sections: a kind that still owes work opens itself, and a
     *  settled one stays shut so a long list of things that are fine cannot bury the two that are not. */
    const hasOutstandingGap = (groupItems: PrincipalGapItem[]): boolean => {
        const { covered, outstanding } = coverageOf(groupItems);

        return outstanding > 0 && covered < outstanding;
    };

    const renderItems = () => {
        if (items.length === 0) {
            return <p className="text-sm text-text-secondary">Nothing needs action for this person.</p>;
        }

        return (
            <CapabilityGroupAccordion
                items={items}
                kindOf={(item) => item.itemKind}
                keyOf={(item) => item.itemId}
                renderItem={renderItem}
                renderBadge={renderCoverageBadge}
                renderHeaderCheckbox={renderHeaderCheckbox}
                renderHeaderActions={renderHeaderActions}
                renderHeaderCounts={renderHeaderCounts}
                isOpenByDefault={hasOutstandingGap}
            />
        );
    };

    const renderAdminNote = () => {
        if (renderRowActions) return null;

        return (
            <p className="text-xs text-text-secondary">
                Administrators are not governed by these access lists, so they cannot be changed here.
            </p>
        );
    };

    return (
        <div className="principal-detail-view flex flex-col gap-3">
            {renderAdminNote()}
            {renderItems()}
        </div>
    );
};

export default PrincipalDetailView;
