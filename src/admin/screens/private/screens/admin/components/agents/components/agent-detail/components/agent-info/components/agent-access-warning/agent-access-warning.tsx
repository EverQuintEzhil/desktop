import { ShieldCheckIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { AccessPrincipalKind } from '@/lib/api/admin/agent-access-check';
import type { AgentType } from '@/types/admin';

import AccessGapSheet from './components/access-gap-sheet';
import { useAgentAccessGaps } from './use-agent-access-gaps';

interface Props {
    agent: AgentType;
    principalKind: AccessPrincipalKind;
    canUserEdit: boolean;
}

const PRINCIPAL_NOUN: Record<AccessPrincipalKind, { one: string; many: string }> = {
    user: { one: 'user', many: 'users' },
    securityGroup: { one: 'security group', many: 'security groups' },
};

const pluralize = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

const AgentAccessWarning = (props: Props) => {
    const { agent, principalKind, canUserEdit } = props;
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const {
        groups,
        people,
        ignored,
        affectedGroupCount,
        affectedPeopleCount,
        affectedItemCount,
        droppedCount,
        hasFailedRead,
        refetch,
    } = useAgentAccessGaps(agent, principalKind);

    // An unreadable response element must still warn: silence here is indistinguishable from
    // "nobody is missing anything", on the one control whose job is to say otherwise.
    const affectedPrincipalCount = affectedGroupCount + affectedPeopleCount;
    // A read that failed warns on its own: with no payload every count below is zero, which is
    // exactly what a clean bill of health looks like.
    const hasGaps = affectedPrincipalCount > 0 || droppedCount > 0 || hasFailedRead;
    // Everything else the sheet holds is a decision already taken. It still has to be reachable:
    // ignoring is a decision to grant or revoke later, and this button is the only door back.
    const hasAnything = hasGaps || ignored.length > 0 || people.length > 0 || groups.length > 0;

    // Read-only viewers are kept out: everything the sheet reports is a gap only someone who can
    // edit the agent can close, and the same rule hides the Access tab.
    if (!canUserEdit) {
        return null;
    }

    // Keep rendering while the sheet is open so granting the last gap does not rip the sheet
    // away mid-interaction; it switches to its all-clear message instead.
    if (!hasAnything && !isSheetOpen) {
        return null;
    }

    const noun = PRINCIPAL_NOUN[principalKind];
    const title = `Access — ${noun.many}`;

    const describeSubjects = (): string => {
        const parts: string[] = [];

        if (affectedGroupCount > 0) parts.push(pluralize(affectedGroupCount, 'security group', 'security groups'));
        if (affectedPeopleCount > 0) parts.push(pluralize(affectedPeopleCount, 'user', 'users'));

        return parts.join(' and ');
    };

    const buildMessage = () => {
        if (hasFailedRead) {
            return 'Could not load who has access to this agent.';
        }

        if (!hasGaps) {
            return 'Everyone listed has access to everything this agent uses.';
        }

        if (affectedPrincipalCount === 0) {
            return 'Some of this agent’s access information could not be read.';
        }

        const verb = affectedPrincipalCount === 1 ? 'lacks' : 'lack';
        // An admin who never opens the sheet would otherwise read the count as exhaustive. Same
        // noun as the sheet's own notice, so the two do not appear to describe different things.
        const partial = droppedCount > 0 ? ` ${pluralize(droppedCount, 'entry', 'entries')} could not be read.` : '';

        return `${describeSubjects()} ${verb} access to ${pluralize(affectedItemCount, 'item', 'items')} this agent uses.${partial}`;
    };

    const renderButton = () => {
        if (!hasAnything) return null;

        return (
            <SimpleTooltip content={buildMessage()} side="bottom">
                <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Review access for ${noun.many}`}
                    className="agent-access-warning h-7 gap-1 px-2 text-xs [&_svg]:size-3.5"
                    onClick={() => setIsSheetOpen(true)}
                >
                    <ShieldCheckIcon />
                    Review access
                </Button>
            </SimpleTooltip>
        );
    };

    return (
        <>
            {renderButton()}
            <AccessGapSheet
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                agentId={agent._id}
                title={title}
                principalKind={principalKind}
                groups={groups}
                people={people}
                droppedCount={droppedCount}
                hasFailedRead={hasFailedRead}
                onRetry={refetch}
                canGrant={canUserEdit}
            />
        </>
    );
};

export default AgentAccessWarning;
