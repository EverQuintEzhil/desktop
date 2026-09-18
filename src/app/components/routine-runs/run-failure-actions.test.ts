import { describe, expect, it } from 'vitest';

import { ROUTINE_RUN_ERROR_CODES, type RoutineRunType } from '@/types/routines';

import { CONNECTORS_PATH, runFailureAction, runReconnectConnector } from './run-failure-actions';

const run = (overrides: Partial<RoutineRunType> = {}): RoutineRunType =>
    ({
        _id: 'run-1',
        routineId: 'routine-1',
        status: 'failed',
        trigger: 'schedule',
        conversationId: null,
        error: '',
        startedAt: '2026-09-08T09:00:00.000Z',
        finishedAt: '2026-09-08T09:01:00.000Z',
        isRead: false,
        ...overrides,
    }) as unknown as RoutineRunType;

/**
 * Iterated off the exported constant rather than a copy: a class added to the vocabulary later
 * fails here instead of quietly rendering no action for the rest of the release.
 */
const EXPECTED_LABEL: Record<(typeof ROUTINE_RUN_ERROR_CODES)[number], string | null> = {
    CONNECTOR_REAUTH_REQUIRED: 'Open connectors',
    AGENT_NO_MODEL: 'Choose a model',
    MODEL_UNAVAILABLE: 'Choose a model',
    MODEL_INCAPABLE: 'Choose a model',
    ROUTINE_NO_AGENT: null,
    OWNER_MISSING: null,
    SCHEDULE_INVALID: 'Check the schedule',
    APPROVAL_REQUIRED: null,
    TOOL_UNAVAILABLE: null,
    PROMPT_REJECTED: 'Edit the prompt',
    PROVIDER_REJECTED: null,
    PROVIDER_RATE_LIMITED: null,
    PROVIDER_UNAVAILABLE: null,
    SERVICE_UNAVAILABLE: null,
    RUN_TIMED_OUT: null,
    UNKNOWN: null,
};

describe('runFailureAction', () => {
    it('covers every code the vocabulary exports', () => {
        expect(Object.keys(EXPECTED_LABEL).sort()).toEqual([...ROUTINE_RUN_ERROR_CODES].sort());
    });

    it.each(ROUTINE_RUN_ERROR_CODES)('resolves %s to its documented action', (errorCode) => {
        expect(runFailureAction(run({ errorCode }))?.label ?? null).toBe(EXPECTED_LABEL[errorCode]);
    });

    it('links a connector failure to the connector the context names', () => {
        const action = runFailureAction(
            run({
                errorCode: 'CONNECTOR_REAUTH_REQUIRED',
                errorContext: { connectorId: 'connector-1', connectorName: 'Microsoft 365' },
            }),
        );

        expect(action).toEqual({
            kind: 'link',
            label: 'Reconnect Microsoft 365',
            to: `${CONNECTORS_PATH}/connector-1`,
        });
    });

    // The revoked-token throw in mcp_client.js names the connector but cannot identify it.
    it('keeps the name but falls back to the list when the context carries no id', () => {
        const action = runFailureAction(
            run({ errorCode: 'CONNECTOR_REAUTH_REQUIRED', errorContext: { connectorName: 'Microsoft 365' } }),
        );

        expect(action).toEqual({ kind: 'link', label: 'Reconnect Microsoft 365', to: CONNECTORS_PATH });
    });

    // A failure re-classified from its stored sentence carries no context at all.
    it('still offers the connectors list when there is no context', () => {
        const action = runFailureAction(run({ errorCode: 'CONNECTOR_REAUTH_REQUIRED', errorContext: null }));

        expect(action).toEqual({ kind: 'link', label: 'Open connectors', to: CONNECTORS_PATH });
    });

    // The sentence is not a source: parsing it would name Slack on a Microsoft 365 failure.
    it('labels from the context and never from the reason', () => {
        const action = runFailureAction(
            run({
                errorCode: 'CONNECTOR_REAUTH_REQUIRED',
                error: 'The "Slack" connector needs reconnecting before this routine can run.',
                errorContext: { connectorName: 'Microsoft 365' },
            }),
        );

        expect(action?.label).toBe('Reconnect Microsoft 365');
    });

    // The current ai image writes this class as needs_reconnect; rows from the older one are failed.
    it.each(['failed', 'needs_reconnect'] as const)('keys on the code, not the %s status', (status) => {
        const action = runFailureAction(
            run({ status, errorCode: 'CONNECTOR_REAUTH_REQUIRED', errorContext: { connectorId: 'connector-1' } }),
        );

        expect(action).toEqual({ kind: 'link', label: 'Open connectors', to: `${CONNECTORS_PATH}/connector-1` });
    });

    it('offers nothing for a run recorded before the failure columns existed', () => {
        expect(runFailureAction(run({ errorCode: null }))).toBeNull();
        expect(runFailureAction(run())).toBeNull();
    });

    // ai ships a class ahead of app, and the schema parses z.string() so the run still arrives.
    it('offers nothing for a code shipped after this build', () => {
        expect(runFailureAction(run({ errorCode: 'A_CLASS_FROM_A_LATER_RELEASE' }))).toBeNull();
    });

    // A path-shaped id would build a route that matches nothing, blanking the settings pane.
    it.each(['a/b', 'a?b', 'a#b'])('falls back to the list rather than route to a %s id', (connectorId) => {
        const action = runFailureAction(run({ errorCode: 'CONNECTOR_REAUTH_REQUIRED', errorContext: { connectorId } }));

        expect(action).toEqual({ kind: 'link', label: 'Open connectors', to: CONNECTORS_PATH });
    });

    it('encodes an id carrying a character the path would otherwise reinterpret', () => {
        const action = runFailureAction(
            run({ errorCode: 'CONNECTOR_REAUTH_REQUIRED', errorContext: { connectorId: 'a b&c' } }),
        );

        expect(action).toEqual({ kind: 'link', label: 'Open connectors', to: `${CONNECTORS_PATH}/a%20b%26c` });
    });

    it('ignores a context whose keys are the wrong type', () => {
        const action = runFailureAction(
            run({ errorCode: 'CONNECTOR_REAUTH_REQUIRED', errorContext: { connectorId: 7, connectorName: '' } }),
        );

        expect(action).toEqual({ kind: 'link', label: 'Open connectors', to: CONNECTORS_PATH });
    });
});

/**
 * A chip standing in for several runs at once can only name a connector it is certain of, so this
 * is deliberately stricter than `runFailureAction`: no "Open connectors" degradation.
 */
describe('runReconnectConnector', () => {
    it('names the connector and points at its own screen', () => {
        expect(
            runReconnectConnector(
                run({
                    status: 'needs_reconnect',
                    errorCode: 'CONNECTOR_REAUTH_REQUIRED',
                    errorContext: { connectorId: 'srv-1', connectorName: 'Linear' },
                }),
            ),
        ).toEqual({ name: 'Linear', to: `${CONNECTORS_PATH}/srv-1` });
    });

    it('still names the connector when the id is missing, and falls back to the list', () => {
        expect(
            runReconnectConnector(
                run({
                    status: 'needs_reconnect',
                    errorCode: 'CONNECTOR_REAUTH_REQUIRED',
                    errorContext: { connectorName: 'Microsoft 365' },
                }),
            ),
        ).toEqual({ name: 'Microsoft 365', to: CONNECTORS_PATH });
    });

    it('names nothing when the run carries no connector name', () => {
        expect(
            runReconnectConnector(
                run({ status: 'needs_reconnect', errorCode: 'CONNECTOR_REAUTH_REQUIRED', errorContext: null }),
            ),
        ).toBeNull();
        expect(
            runReconnectConnector(
                run({
                    status: 'needs_reconnect',
                    errorCode: 'CONNECTOR_REAUTH_REQUIRED',
                    errorContext: { connectorId: 'srv-1' },
                }),
            ),
        ).toBeNull();
    });

    it('names nothing for a failure that is not a reconnect', () => {
        expect(
            runReconnectConnector(run({ errorCode: 'AGENT_NO_MODEL', errorContext: { connectorName: 'Linear' } })),
        ).toBeNull();
        expect(runReconnectConnector(run({ errorCode: null }))).toBeNull();
    });
});
