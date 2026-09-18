import { TriangleAlertIcon } from 'lucide-react';

import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { RoutineRunType } from '@/types/routines';

import { runFailureAction } from './run-failure-actions';

interface Props {
    run: RoutineRunType;
}

/**
 * The connector reconnect action reads as a static warning glyph on the row, not a button: the
 * fix lives on the Connectors page, and this only has to say a fix is owed, not offer to start it.
 * It sits at the head of the row's reason sentence, where the sentence it qualifies is: pinned to the
 * right of the row it read as unattached to any text. Hover/focus names which connector, since the
 * sentence itself does not.
 *
 * Gated on `needs_reconnect` rather than the error code alone: the ai image now only ever writes
 * that status for a reconnect issue, and `failed` is reserved for every other reason a run breaks.
 * A `failed` row carrying `CONNECTOR_REAUTH_REQUIRED` predates that split and reads as an ordinary
 * failure here, not a reconnect - its sentence still names the connector, it just wears no glyph.
 */
const RunReconnectIndicator = ({ run }: Props) => {
    if (run.status !== 'needs_reconnect') return null;

    const action = runFailureAction(run);

    if (!action || action.kind !== 'link') return null;

    return (
        <SimpleTooltip content={action.label} side="top">
            <span
                className="mt-px flex size-3.5 shrink-0 items-center justify-center"
                role="img"
                aria-label={action.label}
                tabIndex={0}
            >
                <TriangleAlertIcon aria-hidden="true" className="size-3.5 text-warning" />
            </span>
        </SimpleTooltip>
    );
};

export default RunReconnectIndicator;
