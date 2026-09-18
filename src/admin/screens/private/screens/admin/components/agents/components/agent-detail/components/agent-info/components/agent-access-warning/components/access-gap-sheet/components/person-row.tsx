import { ChevronRightIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { TruncatedLabel } from '@/components/ui/truncated-label';
import { cn } from '@/lib/utils';

import type { PrincipalGap } from '../../../use-agent-access-gaps';
import type { PeopleSelection } from '../types';

interface Props {
    person: PrincipalGap;
    onSelect: (personId: string) => void;
    selection?: PeopleSelection;
}

/** The one thing the row still says about a person: their gaps cannot be acted on here at all. */
const renderAdminBadge = (person: PrincipalGap) => {
    if (!person.bypassesAccessLists) return null;

    return (
        <Badge variant="ghost" className="shrink-0 bg-muted text-text-secondary">
            Admin
        </Badge>
    );
};

// The same sentence the detail view prints above an administrator's own rows.
const ADMIN_REASON = 'Administrators are not governed by these access lists, so they cannot be changed here.';

const NOTHING_TO_GRANT = 'Nothing for this person can be granted from here.';

const PersonRow = (props: Props) => {
    const { person, onSelect, selection } = props;

    // Outside the row button: a checkbox nested in it would open the person on every tick.
    // Non-selectable rows keep a disabled box rather than a blank, so columns line up and the
    // list reads the same whether or not anything on it can be granted. A disabled Radix control
    // swallows the pointer, so the reason hangs off a wrapper rather than off the box itself.
    const renderCheckbox = () => {
        if (!selection) return null;

        const isSelectable = selection.isSelectable(person);
        const reason = person.bypassesAccessLists ? ADMIN_REASON : NOTHING_TO_GRANT;

        return (
            <SimpleTooltip content={isSelectable ? null : reason}>
                <span className={cn('flex', !isSelectable && 'cursor-not-allowed')}>
                    <Checkbox
                        className={cn('cursor-pointer', !isSelectable && 'pointer-events-none')}
                        checked={isSelectable && selection.selectedIds.has(person.id)}
                        disabled={!isSelectable}
                        aria-label={`Select ${person.name}`}
                        onChange={(_, checked) => selection.onToggle(person.id, checked)}
                    />
                </span>
            </SimpleTooltip>
        );
    };

    return (
        <li className="person-row flex items-center gap-3 border-b border-border/60 bg-card px-4 py-2 last:border-b-0 hover:bg-muted/30">
            {renderCheckbox()}
            <button
                type="button"
                className="flex w-full min-w-0 cursor-pointer items-center gap-2 text-left"
                onClick={() => onSelect(person.id)}
            >
                <TruncatedLabel text={person.name} className="flex-1 text-sm font-medium" />
                {renderAdminBadge(person)}
                <ChevronRightIcon className="size-4 shrink-0 text-text-secondary" />
            </button>
        </li>
    );
};

export default PersonRow;
