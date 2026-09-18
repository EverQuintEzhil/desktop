import type { PrincipalGap } from '../../../use-agent-access-gaps';
import type { PeopleSelection } from '../types';

import PersonRow from './person-row';
import SelectionBar from './selection-bar';

interface Props {
    /** The group's members, already resolved and sorted by the hook's people list. */
    members: PrincipalGap[];
    /** True while the Needs action filter is on, so an empty list means filtered out, not absent. */
    isFiltered: boolean;
    onSelectPerson: (personId: string) => void;
    selection?: PeopleSelection;
}

/**
 * Members only, by decision: a group-level write would hand access to members nobody reviewed and
 * to anyone who joins later, so every grant happens on a member's own row.
 */
const GroupDetailView = (props: Props) => {
    const { members, isFiltered, onSelectPerson, selection } = props;

    if (members.length === 0) {
        return (
            <p className="text-sm text-text-secondary">
                {isFiltered
                    ? 'No members of this group need action. Switch to All to see everyone in it.'
                    : 'This security group has no members.'}
            </p>
        );
    }

    const selectableIds = selection ? members.filter(selection.isSelectable).map((member) => member.id) : [];

    return (
        <div className="group-detail-view flex flex-col gap-3">
            <div className="group-detail-view-list flex flex-col overflow-hidden rounded-lg border border-border bg-card">
                {selection ? (
                    <SelectionBar
                        selectedCount={selectableIds.filter((id) => selection.selectedIds.has(id)).length}
                        selectableCount={selectableIds.length}
                        onToggleAll={(checked) => selectableIds.forEach((id) => selection.onToggle(id, checked))}
                        onGrant={selection.onGrantSelected}
                        isPending={selection.isPending}
                    />
                ) : null}
                <ul className="flex flex-col">
                    {members.map((member) => (
                        <PersonRow key={member.id} person={member} onSelect={onSelectPerson} selection={selection} />
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default GroupDetailView;
