import { PencilIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { RoutineRunType } from '@/types/routines';

import { runFailureAction } from './run-failure-actions';

interface Props {
    run: RoutineRunType;
    /** Absent where the routine cannot be edited from this list, which drops the edit actions. */
    onEditRoutine?: () => void;
}

/**
 * Only the edit-routine actions (model, schedule, prompt) get a button here: a connector reconnect
 * renders as the row's static warning icon instead, since RunReconnectIndicator owns that action.
 */
const RunFailureActionButton = ({ run, onEditRoutine }: Props) => {
    const action = runFailureAction(run);

    if (!action || action.kind !== 'edit-routine') return null;
    if (!onEditRoutine) return null;

    return (
        <Button
            type="button"
            variant="outline"
            size="xs"
            // A `<button>` and not a link: the row is itself a `<Link>` to the run's conversation,
            // and a nested anchor is invalid.
            className="run-failure-action-button mt-1.5 w-fit max-w-full"
            title={action.label}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onEditRoutine();
            }}
        >
            <PencilIcon aria-hidden="true" className="shrink-0" />
            <span className="truncate">{action.label}</span>
        </Button>
    );
};

export default RunFailureActionButton;
