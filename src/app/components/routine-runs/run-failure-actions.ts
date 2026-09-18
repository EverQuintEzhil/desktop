import type { RoutineRunErrorCode, RoutineRunType } from '@/types/routines';

export const CONNECTORS_PATH = '/settings/connectors';

export interface RunFailureLinkAction {
    kind: 'link';
    label: string;
    to: string;
}

export type RunFailureAction = RunFailureLinkAction | { kind: 'edit-routine'; label: string };

/**
 * Codes whose fix is a field on the routine itself, so they all open the one edit modal the detail
 * screen already owns.
 *
 * DELIBERATELY partial, never a total `Record`: the run's code parses as `z.string()` because ai
 * ships a failure class ahead of app, so a miss is the normal case and has to render no action
 * rather than fail an exhaustive switch.
 */
const EDIT_ROUTINE_LABELS: Partial<Record<RoutineRunErrorCode, string>> = {
    AGENT_NO_MODEL: 'Choose a model',
    MODEL_UNAVAILABLE: 'Choose a model',
    MODEL_INCAPABLE: 'Choose a model',
    SCHEDULE_INVALID: 'Check the schedule',
    PROMPT_REJECTED: 'Edit the prompt',
};

const textField = (context: RoutineRunType['errorContext'], key: string): string | null => {
    const value = context?.[key];

    return typeof value === 'string' && value.length > 0 ? value : null;
};

/**
 * Only `build_mcp_tools.js` sends both keys; the revoked-token throw sends the name alone, and a
 * failure re-classified from its stored sentence sends neither. So the label and the target degrade
 * independently — and neither is ever recovered by reading the sentence.
 */
const connectorAction = (context: RoutineRunType['errorContext']): RunFailureLinkAction => {
    const connectorId = textField(context, 'connectorId');
    const connectorName = textField(context, 'connectorName');
    // A `/`, `?` or `#` in the id would build a path that matches no route, which lands the owner on
    // a blank settings pane rather than an error. The list is the honest fallback.
    const isPathSegment = connectorId !== null && !/[/?#]/.test(connectorId);

    return {
        kind: 'link',
        label: connectorName ? `Reconnect ${connectorName}` : 'Open connectors',
        to: isPathSegment ? `${CONNECTORS_PATH}/${encodeURIComponent(connectorId)}` : CONNECTORS_PATH,
    };
};

/**
 * Keyed on the code and never on the status: the same class is written as `needs_reconnect` by the
 * current ai image and as `failed` by rows that predate it, and both owe the owner the same button.
 */
export const runFailureAction = (run: RoutineRunType): RunFailureAction | null => {
    if (!run.errorCode) return null;
    if (run.errorCode === 'CONNECTOR_REAUTH_REQUIRED') return connectorAction(run.errorContext);

    const label = EDIT_ROUTINE_LABELS[run.errorCode as RoutineRunErrorCode];

    return label ? { kind: 'edit-routine', label } : null;
};

/** The connector one reconnect-blocked run names, and where to go and fix it. */
export interface RunReconnectTarget {
    name: string;
    to: string;
}

/**
 * The connector a run is waiting on, for a surface that has to NAME it rather than link to it — a
 * notification chip standing in for several runs at once.
 *
 * Null unless the run both carries the code and names the connector: "Reconnect" with no name asks
 * more of the reader than the count it would replace, and `connectorAction`'s "Open connectors"
 * fallback exists for a button next to the run's own sentence, which a chip does not have.
 */
export const runReconnectConnector = (run: RoutineRunType): RunReconnectTarget | null => {
    if (run.errorCode !== 'CONNECTOR_REAUTH_REQUIRED') return null;

    const name = textField(run.errorContext, 'connectorName');

    if (!name) return null;

    return { name, to: connectorAction(run.errorContext).to };
};
