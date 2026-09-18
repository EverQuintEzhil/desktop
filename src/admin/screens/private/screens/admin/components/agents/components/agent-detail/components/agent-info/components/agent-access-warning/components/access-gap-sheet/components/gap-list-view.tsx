import type { PrincipalGap } from '../../../use-agent-access-gaps';
import type { PeopleSelection } from '../types';

import PersonRow from './person-row';
import SelectionBar from './selection-bar';

interface Props {
    people: PrincipalGap[];
    /** True while the Needs action filter is on, so an empty list means filtered out, not absent. */
    isFiltered: boolean;
    droppedCount: number;
    onSelectPerson: (personId: string) => void;
    selection?: PeopleSelection;
}

const GapListView = (props: Props) => {
    const { people, isFiltered, droppedCount, onSelectPerson, selection } = props;

    const selectableIds = selection ? people.filter(selection.isSelectable).map((person) => person.id) : [];

    const renderSelectionBar = () => {
        if (!selection) return null;

        return (
            <SelectionBar
                selectedCount={selectableIds.filter((id) => selection.selectedIds.has(id)).length}
                selectableCount={selectableIds.length}
                onToggleAll={(checked) => selectableIds.forEach((id) => selection.onToggle(id, checked))}
                onGrant={selection.onGrantSelected}
                isPending={selection.isPending}
            />
        );
    };

    // Renders alongside surviving rows too: a partial drop is the dangerous case, where granting
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

    if (people.length === 0) {
        return (
            <div className="gap-list-view-empty flex flex-col gap-3">
                {renderDroppedNotice()}
                {droppedCount === 0 && (
                    <p className="text-sm text-text-secondary">
                        {isFiltered
                            ? 'Everyone listed has access to everything this agent uses.'
                            : 'No users are included on this agent.'}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="gap-list-view flex flex-col gap-3">
            {renderDroppedNotice()}
            <div className="gap-list-view-list flex flex-col overflow-hidden rounded-lg border border-border bg-card">
                {renderSelectionBar()}
                <ul className="flex flex-col">
                    {people.map((person) => (
                        <PersonRow key={person.id} person={person} onSelect={onSelectPerson} selection={selection} />
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default GapListView;
