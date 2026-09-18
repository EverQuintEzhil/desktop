import { isAxiosError } from 'axios';

import { CONNECTORS_PATH, type RunFailureAction } from '@/app/components/routine-runs';

/** The api's code for a run it would not start because a connector is disconnected. */
export const RUN_REFUSAL_CODE = 'MCP_REAUTH_REQUIRED';

const RUN_REFUSAL_STATUS = 424;

const FALLBACK_REFUSAL_MESSAGE = 'Run now was refused because a connector is not connected.';

export interface RunRefusal {
    message: string;
    action: Extract<RunFailureAction, { kind: 'link' }>;
}

/**
 * A refusal is not a failure: nothing ran, and the fix is one click away, so it owes the owner the
 * connector and a way to reach it rather than "Failed to start the run."
 *
 * Unlike a stored run, the 424 carries the connectors named in prose and NO ids, so there is no
 * `errorContext` to deep-link from the way `runFailureAction` does - the list is the only honest
 * target. Gated on the code as well as the status so a future 424 of another kind falls through to
 * the plain message rather than offering a connector action that would not fix it.
 */
export const runRefusalOf = (error: unknown): RunRefusal | null => {
    if (!isAxiosError(error) || error.response?.status !== RUN_REFUSAL_STATUS) return null;

    const data = error.response?.data;

    if (!data || typeof data !== 'object') return null;

    const { code, message } = data as { code?: unknown; message?: unknown };

    if (code !== RUN_REFUSAL_CODE) return null;

    return {
        message: typeof message === 'string' && message.trim() ? message : FALLBACK_REFUSAL_MESSAGE,
        action: { kind: 'link', label: 'Open connectors', to: CONNECTORS_PATH },
    };
};
