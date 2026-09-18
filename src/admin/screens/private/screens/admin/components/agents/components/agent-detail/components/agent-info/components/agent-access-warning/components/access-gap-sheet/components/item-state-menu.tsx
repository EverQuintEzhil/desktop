import { Ban, ChevronDownIcon, CircleCheck, CircleX, Eye, EyeOff, RotateCcw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Spinner } from '@/components/ui/spinner';
import type { PrincipalAcl } from '@/lib/api/admin/agent-access-check';
import { useCapabilityAclQuery } from '@/lib/api/admin/agent-access-check';
import { cn } from '@/lib/utils';

import { coverageReason, NO_ACL_RIGHT_REASON, unchangedReason } from '../../../../../../agent-access/access-coverage';
import { ACCESS_ITEM_KIND_LABEL } from '../../../../../../agent-access/access-types';
import type { ItemAccessState } from '../../../use-agent-access-gaps';
import type { GapPair } from '../types';
import type { AccessAction } from '../use-access-actions';

interface Props {
    pair: GapPair;
    /** May this viewer rewrite the capability's ACL — gates the two actions that change access. */
    canWriteAcl: boolean;
    /** May this viewer record an ignore — gated on the agent, not the capability. */
    canIgnore: boolean;
    /** False for someone the item's own ACL cannot exclude, whose exclusion would be stored and ignored. */
    canExclude: boolean;
    /** A write of this row's is on the wire: nothing has moved yet, so the trigger says so and
     *  refuses a second click. */
    isPending: boolean;
    onAction: (action: AccessAction) => void;
}

// Same words as the Access tab's own breakdown, so one state does not have two names.
const STATE_LABEL: Record<ItemAccessState, string> = {
    granted: 'Has access',
    missing: 'No access',
    revoked: 'Excluded',
    ignored: 'Ignored',
};

// Same glyphs as the Access tab, in the label's own colour.
const STATE_ICON: Record<ItemAccessState, typeof CircleCheck> = {
    granted: CircleCheck,
    missing: CircleX,
    revoked: Ban,
    ignored: EyeOff,
};

// Same tones as the Access tab, on the glyph only: green has it, red lacks it, grey was decided.
// The word stays neutral except for the one gap that needs action.
const ICON_CLASS: Record<ItemAccessState, string> = {
    granted: 'text-success',
    missing: 'text-destructive',
    revoked: 'text-text-secondary',
    ignored: 'text-text-secondary',
};

/** The word never carries the state — only the glyph beside it does. */
const TRIGGER_CLASS = 'text-foreground';

interface ActionEntry {
    action: AccessAction;
    label: string;
    description: string;
    icon: typeof CircleCheck;
    /** Colour says the direction before the word does: green opens, red closes, grey is bookkeeping. */
    tone: string;
    needsAclWrite: boolean;
    /** Set where the write lands in the item's excluded list, which some principals are immune to. */
    needsExcludable?: boolean;
}

const ENTRY: Record<AccessAction, ActionEntry> = {
    grant: {
        action: 'grant',
        icon: CircleCheck,
        tone: 'text-success',
        label: 'Grant',
        description: 'Add to this item’s access list',
        needsAclWrite: true,
    },
    revoke: {
        action: 'revoke',
        icon: Ban,
        tone: 'text-destructive',
        label: 'Exclude',
        description: 'Exclude from this item, recorded as deliberate',
        needsAclWrite: true,
        needsExcludable: true,
    },
    ignore: {
        action: 'ignore',
        icon: EyeOff,
        tone: 'text-text-secondary',
        label: 'Ignore',
        description: 'Dismiss the warning without changing access',
        needsAclWrite: false,
    },
    unignore: {
        action: 'unignore',
        icon: Eye,
        tone: 'text-text-secondary',
        label: 'Stop ignoring',
        description: 'Show this gap as needing action again',
        needsAclWrite: false,
    },
    clear: {
        action: 'clear',
        icon: RotateCcw,
        tone: 'text-text-secondary',
        label: 'Reset',
        description: 'Remove from both lists and decide later',
        needsAclWrite: true,
    },
    // Not `clear`: an include already on the capability must survive, or a principal who was both
    // included and excluded is left undecided instead of allowed.
    unblock: {
        action: 'unblock',
        icon: ShieldCheck,
        tone: 'text-success',
        label: 'Stop excluding',
        description: 'Remove from this item’s excluded list',
        needsAclWrite: true,
    },
};

/**
 * Verbs, not target states: the trigger already names where the row is, so the menu's job is
 * only to say what can be done from there. Which verbs make sense depends on the state — there
 * is nothing to grant on a row that already has access, and only a warning can be ignored.
 */
const ACTIONS_FROM: Record<ItemAccessState, ActionEntry[]> = {
    missing: [ENTRY.grant, ENTRY.ignore, ENTRY.revoke],
    granted: [ENTRY.revoke, ENTRY.clear],
    revoked: [ENTRY.grant, ENTRY.unblock],
    ignored: [ENTRY.grant, ENTRY.unignore, ENTRY.revoke],
};

/** The two actions that only take someone off a list, and so can turn out to change nothing. */
const REMOVAL_ACTIONS: AccessAction[] = ['clear', 'unblock'];

/** Whether the action has an entry to take off the item's lists. Unblock lifts the exclusion only;
 *  reset withdraws both halves. */
const removesSomething = (action: AccessAction, acl: PrincipalAcl, principalId: string): boolean => {
    if (action === 'unblock') return acl.excludeIds.includes(principalId);

    return acl.includeIds.includes(principalId) || acl.excludeIds.includes(principalId);
};

const ItemStateMenu = (props: Props) => {
    const { pair, canWriteAcl, canIgnore, canExclude, isPending, onAction } = props;
    const { state, principal } = pair;
    const [isOpen, setIsOpen] = useState(false);

    const entries = ACTIONS_FROM[state].filter((entry) => {
        if (entry.needsExcludable && !canExclude) return false;

        return entry.needsAclWrite ? canWriteAcl : canIgnore;
    });

    // Nothing is fetched until the menu is opened: a sheet full of rows would otherwise read every
    // capability on screen to answer a question nobody asked.
    const hasRemoval = entries.some((entry) => REMOVAL_ACTIONS.includes(entry.action));
    const isCovered = state === 'granted';
    const { data: acl, isError: hasAclFailed } = useCapabilityAclQuery({
        kind: pair.itemKind,
        itemId: pair.itemId,
        principalKind: pair.principalKind,
        enabled: isOpen && (hasRemoval || isCovered),
    });

    // A viewer who can change nothing still deserves the state — glyph and all, as the read-only
    // rows elsewhere print it, and with the one sentence that says why there is no menu.
    if (entries.length === 0) {
        const ReadOnlyIcon = STATE_ICON[state];

        return (
            <SimpleTooltip content={NO_ACL_RIGHT_REASON}>
                <span className={cn('flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap', TRIGGER_CLASS)}>
                    <ReadOnlyIcon className={cn('size-3.5 shrink-0', ICON_CLASS[state])} aria-hidden />
                    {STATE_LABEL[state]}
                </span>
            </SimpleTooltip>
        );
    }

    // A removal that leaves the row exactly as it is would report success and change nothing, so it
    // is offered as a disabled entry that says why instead. Until the lists are known it stays
    // disabled: enabling it first would let the dead click through.
    const blockedReason = (entry: ActionEntry): string | null => {
        if (!REMOVAL_ACTIONS.includes(entry.action)) return null;
        // A check that could not be made must not stand in the way: the write itself reports the
        // real error, which is more use than a permanently dead entry.
        if (hasAclFailed) return null;
        if (!acl) return 'Checking what this would change…';
        // What matters is whether there is an entry to take off the item's own lists. Someone with a
        // direct include still has one to remove even when a group would keep them covered.
        if (removesSomething(entry.action, acl, principal.id)) return null;

        const reason = unchangedReason(principal, acl);

        if (!reason) return null;

        // Named by kind, because the list this action would edit belongs to the item and not to the
        // agent: someone added directly to the agent still has nothing to remove here.
        const noun = ACCESS_ITEM_KIND_LABEL[pair.itemKind].toLowerCase();

        return reason === 'open-to-everyone'
            ? `This ${noun} is open to everyone, so there is nothing to remove`
            : `A group still allows this ${noun}, so there is nothing to remove`;
    };

    // Only ever rendered once the lists are in: a placeholder would grow the menu under the cursor
    // the moment the read lands.
    const reason = isCovered && acl ? coverageReason(principal, acl) : null;

    const renderEntry = (entry: ActionEntry) => {
        const blocked = blockedReason(entry);

        return (
            <DropdownMenuItem
                key={entry.action}
                className={cn('items-start gap-2.5', blocked ? 'cursor-default' : 'cursor-pointer')}
                disabled={blocked !== null}
                onSelect={() => onAction(entry.action)}
            >
                <entry.icon className={cn('mt-0.5 size-4 shrink-0', entry.tone)} aria-hidden />
                <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{entry.label}</span>
                    <span className="text-xs text-text-secondary">{blocked ?? entry.description}</span>
                </span>
            </DropdownMenuItem>
        );
    };

    const StateIcon = STATE_ICON[state];

    return (
        <DropdownMenuRoot open={isOpen} onOpenChange={setIsOpen}>
            {/* The same trigger as the Access tab's own row: a plain, row-height control, not a
                button that grows the row it sits in. */}
            <DropdownMenuTrigger
                className={cn(
                    'item-state-menu flex w-full cursor-pointer items-center justify-end gap-1.5 rounded-md py-0.5 text-sm whitespace-nowrap outline-none hover:bg-muted',
                    TRIGGER_CLASS,
                )}
                disabled={isPending}
            >
                {/* The spinner takes the glyph's place at the glyph's size, so a row in flight keeps
                    every column where it was. */}
                {isPending ? (
                    <Spinner className="size-3.5 shrink-0 text-text-secondary" />
                ) : (
                    <StateIcon className={cn('size-3.5 shrink-0', ICON_CLASS[state])} aria-hidden />
                )}
                {STATE_LABEL[state]}
                <ChevronDownIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" className="z-60 w-72">
                {entries.map(renderEntry)}
                {/* Last, not first: the lists it reads land after the menu is already open, and a
                    row appearing above the actions would slide every one of them under the cursor. */}
                {reason && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-normal text-text-secondary">
                            Has access because {reason}.
                        </DropdownMenuLabel>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );
};

export default ItemStateMenu;
