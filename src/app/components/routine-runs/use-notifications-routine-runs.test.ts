import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getPaged, server } from '@/test/msw';
import { renderHookWithProviders } from '@/test/test-utils';
import type { RoutineRunType } from '@/types/routines';

import { useNotificationsRoutineRuns } from './use-notifications-routine-runs';

const run = (overrides: Partial<RoutineRunType>): RoutineRunType =>
    ({
        _id: 'run-1',
        routineId: 'routine-1',
        status: 'needs_reconnect',
        trigger: 'schedule',
        conversationId: null,
        error: '',
        startedAt: '2026-09-08T09:00:00.000Z',
        finishedAt: '2026-09-08T09:01:00.000Z',
        isRead: false,
        createdAt: '2026-09-08T09:00:00.000Z',
        updatedAt: '2026-09-08T09:01:00.000Z',
        ...overrides,
    }) as unknown as RoutineRunType;

const reconnectRun = (id: string, connector: { id: string; name: string }, routineId = 'routine-1') =>
    run({
        _id: id,
        routineId,
        errorCode: 'CONNECTOR_REAUTH_REQUIRED',
        errorContext: { connectorId: connector.id, connectorName: connector.name },
    });

const renderWithRuns = (runs: RoutineRunType[]) => {
    server.use(getPaged('/routines/runs', runs));

    return renderHookWithProviders(() => useNotificationsRoutineRuns());
};

describe('useNotificationsRoutineRuns reconnectTargetByRoutine', () => {
    it('names the connector when every unread run of the routine agrees on it', async () => {
        const { result } = renderWithRuns([
            reconnectRun('run-1', { id: 'srv-1', name: 'Linear' }),
            reconnectRun('run-2', { id: 'srv-1', name: 'Linear' }),
        ]);

        await waitFor(() => expect(result.current.unreadCount).toBe(2));

        expect(result.current.reconnectTargetByRoutine.get('routine-1')).toEqual({
            name: 'Linear',
            to: '/settings/connectors/srv-1',
        });
    });

    it('names nothing when two connectors are waiting, since one chip cannot stand for both', async () => {
        const { result } = renderWithRuns([
            reconnectRun('run-1', { id: 'srv-1', name: 'Linear' }),
            reconnectRun('run-2', { id: 'srv-2', name: 'Microsoft 365' }),
        ]);

        await waitFor(() => expect(result.current.unreadCount).toBe(2));

        expect(result.current.reconnectTargetByRoutine.has('routine-1')).toBe(false);
    });

    // The chip's own wording would then be wrong: a reconnect fixes the blocked run and not the
    // failure beside it, and the count's filtered run list is the honest destination.
    it('names nothing when a plain failure is counted alongside the reconnect', async () => {
        const { result } = renderWithRuns([
            reconnectRun('run-1', { id: 'srv-1', name: 'Linear' }),
            run({ _id: 'run-2', status: 'failed', errorCode: 'PROVIDER_UNAVAILABLE' }),
        ]);

        await waitFor(() => expect(result.current.unreadCount).toBe(2));

        expect(result.current.reconnectTargetByRoutine.has('routine-1')).toBe(false);
    });

    // The revoked-token throw sends the name with no id, so both runs degrade to the bare connectors
    // path. Comparing the path alone would call them the same connector and hide the second blocker.
    it('names nothing for two id-less runs naming different connectors', async () => {
        const { result } = renderWithRuns([
            run({ _id: 'run-1', errorCode: 'CONNECTOR_REAUTH_REQUIRED', errorContext: { connectorName: 'Linear' } }),
            run({
                _id: 'run-2',
                errorCode: 'CONNECTOR_REAUTH_REQUIRED',
                errorContext: { connectorName: 'Microsoft 365' },
            }),
        ]);

        await waitFor(() => expect(result.current.unreadCount).toBe(2));

        expect(result.current.reconnectTargetByRoutine.has('routine-1')).toBe(false);
    });

    it('keeps each routine own answer', async () => {
        const { result } = renderWithRuns([
            reconnectRun('run-1', { id: 'srv-1', name: 'Linear' }),
            reconnectRun('run-2', { id: 'srv-2', name: 'Microsoft 365' }, 'routine-2'),
        ]);

        await waitFor(() => expect(result.current.unreadCount).toBe(2));

        expect(result.current.reconnectTargetByRoutine.get('routine-1')?.name).toBe('Linear');
        expect(result.current.reconnectTargetByRoutine.get('routine-2')?.name).toBe('Microsoft 365');
    });

    // A run in flight is never counted as unread, so it must not decide the chip either.
    it('ignores a run still in flight', async () => {
        const { result } = renderWithRuns([
            reconnectRun('run-1', { id: 'srv-1', name: 'Linear' }),
            run({ _id: 'run-2', status: 'running', errorCode: null }),
        ]);

        await waitFor(() => expect(result.current.unreadCount).toBe(1));

        expect(result.current.reconnectTargetByRoutine.get('routine-1')?.name).toBe('Linear');
    });

    it('names nothing when the blocked run carries no connector name', async () => {
        const { result } = renderWithRuns([
            run({ _id: 'run-1', errorCode: 'CONNECTOR_REAUTH_REQUIRED', errorContext: { connectorId: 'srv-1' } }),
        ]);

        await waitFor(() => expect(result.current.unreadCount).toBe(1));

        expect(result.current.reconnectTargetByRoutine.has('routine-1')).toBe(false);
    });
});
