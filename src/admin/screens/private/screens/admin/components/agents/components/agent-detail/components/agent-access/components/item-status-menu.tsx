import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PrincipalAcl } from '@/lib/api/admin/agent-access-check';
import { useCapabilityAclQuery } from '@/lib/api/admin/agent-access-check';
import { cn } from '@/lib/utils';

import { coverageReason, unchangedReason } from '../access-coverage';
import type { AccessItem, AccessUser } from '../access-types';
import { ACCESS_ITEM_KIND_LABEL } from '../access-types';

/** Which write the entry performs — the two that only remove someone from a list can come out as
 *  no-ops, so they are the ones worth checking against the item's real lists. */
export type ItemActionId = 'grant' | 'block' | 'reset' | 'unblock' | 'ignore' | 'unignore';

export interface ItemAction {
    id: ItemActionId;
    label: string;
    description: string;
    icon: typeof ChevronDown;
    /** Colour says the direction before the word does: green opens, red closes, grey is bookkeeping. */
    tone: string;
    /** Set where the caller already knows the write would be stored and ignored: the entry stays on
     *  the menu, disabled and saying so, rather than the whole menu going with it. */
    blockedReason?: string;
    run: () => void;
}

interface ItemStatusMenuProps {
    user: AccessUser;
    item: AccessItem;
    actions: ItemAction[];
    label: React.ReactNode;
    triggerClassName: string;
    isLocked: boolean;
}

/** The two actions that only take someone off a list, and so can turn out to change nothing. */
const REMOVAL_ACTIONS: ItemActionId[] = ['reset', 'unblock'];

/** Whether the action has an entry to take off the item's lists. Unblock lifts the exclusion only;
 *  reset withdraws both halves. */
const removesSomething = (id: ItemActionId, acl: PrincipalAcl, userId: string): boolean => {
    if (id === 'unblock') return acl.excludeIds.includes(userId);

    return acl.includeIds.includes(userId) || acl.excludeIds.includes(userId);
};

const ItemStatusMenu = ({ user, item, actions, label, triggerClassName, isLocked }: ItemStatusMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);

    // Nothing is fetched until the menu is opened: a table of expanded users would otherwise read
    // every capability on screen to answer a question nobody asked.
    const hasRemoval = actions.some((action) => REMOVAL_ACTIONS.includes(action.id));
    // A covered row that cannot be reset — the item denies the write — offers no removal, and would
    // otherwise be the one row that says "Has access" with nothing to explain it.
    const isCovered = item.state === 'covered';
    const { data: acl, isError: hasAclFailed } = useCapabilityAclQuery({
        kind: item.kind,
        itemId: item.id,
        principalKind: 'user',
        enabled: isOpen && (hasRemoval || isCovered),
    });

    // A removal that leaves the row exactly as it is would report success and change nothing, so it
    // is offered as a disabled entry that says why instead. Until the lists are known it stays
    // disabled: enabling it first would let the dead click through.
    const blockedReason = (action: ItemAction): string | null => {
        if (action.blockedReason) return action.blockedReason;
        if (!REMOVAL_ACTIONS.includes(action.id)) return null;
        // A check that could not be made must not stand in the way: the write itself reports the
        // real error, which is more use than a permanently dead entry.
        if (hasAclFailed) return null;
        if (!acl) return 'Checking what this would change…';
        // What matters is whether there is an entry to take off the item's own lists. Someone with a
        // direct include still has one to remove even when a group would keep them covered.
        if (removesSomething(action.id, acl, user.id)) return null;

        const reason = unchangedReason(user, acl);

        if (!reason) return null;

        // Named by kind, because the list this action would edit belongs to the item and not to the
        // agent: someone added directly to the agent still has nothing to remove here.
        const noun = ACCESS_ITEM_KIND_LABEL[item.kind].toLowerCase();

        return reason === 'open-to-everyone'
            ? `This ${noun} is open to everyone, so there is nothing to remove`
            : `A group still allows this ${noun}, so there is nothing to remove`;
    };

    // Only ever rendered once the lists are in: a placeholder would grow the menu under the cursor
    // the moment the read lands.
    const reason = isCovered && acl ? coverageReason(user, acl) : null;

    return (
        <DropdownMenuRoot open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger className={triggerClassName} disabled={isLocked}>
                {label}
                <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                {actions.map((action) => {
                    const blocked = blockedReason(action);

                    return (
                        <DropdownMenuItem
                            key={action.label}
                            className={cn('items-start gap-2.5', blocked ? 'cursor-default' : 'cursor-pointer')}
                            disabled={blocked !== null}
                            onSelect={action.run}
                        >
                            <action.icon className={cn('mt-0.5 size-4 shrink-0', action.tone)} aria-hidden />
                            <span className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium">{action.label}</span>
                                <span className="text-xs text-text-secondary">{blocked ?? action.description}</span>
                            </span>
                        </DropdownMenuItem>
                    );
                })}
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

export default ItemStatusMenu;
