import { describe, expect, it } from 'vitest';

import type { RoutineType } from '@/types/routines';

import { nextRunAt } from './next-run';

const routine = (overrides: Partial<RoutineType> = {}): RoutineType => ({
    _id: 'routine-1',
    agentId: 'agent-1',
    name: 'Weekly scan',
    prompt: 'Research the market',
    cron: '0 9 * * 1',
    timezone: 'Asia/Kolkata',
    runOnce: false,
    status: 'active',
    lastRunAt: null,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    ...overrides,
});

// A Tuesday, so the next Monday 09:00 is six days out.
const now = new Date('2026-08-25T12:00:00.000Z');

describe('nextRunAt', () => {
    it('resolves a weekly cron in the routine timezone, not the browser one', () => {
        // 09:00 in Asia/Kolkata is 03:30 UTC.
        expect(nextRunAt(routine(), now)?.toISOString()).toBe('2026-08-31T03:30:00.000Z');
    });

    it('honours the timezone it is given', () => {
        expect(nextRunAt(routine({ timezone: 'UTC' }), now)?.toISOString()).toBe('2026-08-31T09:00:00.000Z');
    });

    it('returns null for a paused routine', () => {
        expect(nextRunAt(routine({ status: 'paused' }), now)).toBeNull();
    });

    it('resolves a future one-shot from its wall-clock time', () => {
        const oneShot = routine({ runOnce: true, runAt: '2026-09-12T10:00', cron: '0 10 12 9 *' });

        expect(nextRunAt(oneShot, now)?.toISOString()).toBe('2026-09-12T04:30:00.000Z');
    });

    it('returns null for a one-shot that has already fired', () => {
        const spent = routine({
            runOnce: true,
            runAt: '2026-08-22T10:00',
            lastRunAt: '2026-08-22T04:32:00.000Z',
        });

        expect(nextRunAt(spent, now)).toBeNull();
    });

    it('returns null rather than throwing on a cron it cannot parse', () => {
        expect(nextRunAt(routine({ cron: 'not-a-cron' }), now)).toBeNull();
    });

    it('returns null rather than throwing on an unknown timezone', () => {
        expect(nextRunAt(routine({ timezone: 'Not/AZone' }), now)).toBeNull();
    });

    it("prefers the api's own next fire time over the one derived from the cron", () => {
        const served = routine({ nextRunAt: '2026-09-01T04:15:00.000Z' });

        expect(nextRunAt(served, now)?.toISOString()).toBe('2026-09-01T04:15:00.000Z');
    });

    it('still returns null for a spent one-shot the api has stamped', () => {
        const spent = routine({
            runOnce: true,
            runAt: '2026-08-20T10:00',
            lastRunAt: '2026-08-20T04:30:00.000Z',
            nextRunAt: '2026-09-01T04:15:00.000Z',
        });

        expect(nextRunAt(spent, now)).toBeNull();
    });
});
