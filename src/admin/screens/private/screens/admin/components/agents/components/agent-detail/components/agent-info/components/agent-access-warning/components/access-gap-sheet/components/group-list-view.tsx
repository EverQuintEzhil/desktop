import { ChevronRightIcon } from 'lucide-react';

import { TruncatedLabel } from '@/components/ui/truncated-label';

import type { GroupGap } from '../../../use-agent-access-gaps';

interface Props {
    groups: GroupGap[];
    /** True while the Needs action filter is on, so an empty list means filtered out, not absent. */
    isFiltered: boolean;
    droppedCount: number;
    onSelectGroup: (groupId: string) => void;
}

/**
 * Groups lead, members follow: access is granted person by person, so a group row is a doorway to
 * its affected members, never a target for a write.
 */
const GroupListView = (props: Props) => {
    const { groups, isFiltered, droppedCount, onSelectGroup } = props;

    // Renders alongside surviving rows too: a partial drop is the dangerous case, where fixing
    // what is listed looks like fixing the agent.
    const renderDroppedNotice = () => {
        if (droppedCount === 0) return null;

        const noun = droppedCount === 1 ? 'entry' : 'entries';
        const verb = droppedCount === 1 ? 'is' : 'are';

        return (
            <p className="text-sm text-text-secondary">
                {`${droppedCount} ${noun} could not be read and ${verb} not shown here.`}
            </p>
        );
    };

    const renderMemberNote = (group: GroupGap) => {
        if (group.memberIds.length === 0) {
            return <span className="text-xs text-text-secondary">No members</span>;
        }

        const noun = group.memberIds.length === 1 ? 'member' : 'members';

        return <span className="text-xs text-text-secondary">{`${group.memberIds.length} ${noun}`}</span>;
    };

    const renderGroup = (group: GroupGap) => (
        <li
            key={group.id}
            className="group-list-view-row border-b border-border/60 bg-card px-4 py-2 last:border-b-0 hover:bg-muted/30"
        >
            <button
                type="button"
                className="flex w-full min-w-0 cursor-pointer items-center gap-2 text-left"
                onClick={() => onSelectGroup(group.id)}
            >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <TruncatedLabel text={group.name} className="text-sm font-medium" />
                    {renderMemberNote(group)}
                </div>
                <ChevronRightIcon className="size-4 shrink-0 text-text-secondary" />
            </button>
        </li>
    );

    if (groups.length === 0) {
        return (
            <div className="group-list-view-empty flex flex-col gap-3">
                {renderDroppedNotice()}
                {droppedCount === 0 && (
                    <p className="text-sm text-text-secondary">
                        {isFiltered
                            ? 'Every included security group has access to everything this agent uses.'
                            : 'No security groups are included on this agent.'}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="group-list-view flex flex-col gap-3">
            {renderDroppedNotice()}
            <ul className="group-list-view-list flex flex-col overflow-hidden rounded-lg border border-border bg-card">
                {groups.map(renderGroup)}
            </ul>
        </div>
    );
};

export default GroupListView;
