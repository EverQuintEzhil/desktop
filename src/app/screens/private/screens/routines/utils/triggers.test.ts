import { describe, expect, it } from 'vitest';

import type { RoutineTriggerRecord } from '@/types/routines';

import { canArmTrigger, type TriggerFormValue, triggersFromRecords } from './triggers';

const NOW = new Date('2026-08-28T12:00:00Z');

const record = (overrides: Partial<RoutineTriggerRecord> = {}): RoutineTriggerRecord => ({
    _id: 'trigger-1',
    routineId: 'routine-1',
    type: 'once',
    cron: null,
    runAt: '2026-01-01T09:00',
    timezone: 'UTC',
    eventSource: null,
    eventFilter: null,
    cooldownSeconds: 0,
    status: 'paused',
    lastFiredAt: null,
    scheduleSyncedAt: null,
    synced: true,
    legacy: false,
    createdAt: null,
    updatedAt: null,
    ...overrides,
});

const loadOne = (overrides: Partial<RoutineTriggerRecord> = {}): TriggerFormValue =>
    triggersFromRecords([record(overrides)])[0];

const onDate = (value: TriggerFormValue, year: number, month: number, monthDay: number): TriggerFormValue => ({
    ...value,
    schedule: { ...value.schedule, year, month, monthDay },
});

describe('canArmTrigger', () => {
    it('refuses to arm a paused one-shot whose date has already gone by', () => {
        expect(canArmTrigger(loadOne(), NOW)).toBe(false);
    });

    it('arms a paused one-shot once the form holds a future date, whatever the stored one says', () => {
        expect(canArmTrigger(onDate(loadOne(), 2026, 12, 1), NOW)).toBe(true);
    });

    it('refuses again once the form holds a date in the past', () => {
        const future = loadOne({ runAt: '2026-12-01T09:00' });

        expect(canArmTrigger(onDate(future, 2026, 1, 1), NOW)).toBe(false);
    });

    it('always arms a row that is not a one-shot', () => {
        expect(canArmTrigger(loadOne({ type: 'cron', cron: '0 9 * * 1', runAt: null }), NOW)).toBe(true);
        expect(canArmTrigger(loadOne({ type: 'manual', runAt: null }), NOW)).toBe(true);
    });

    // Both zones sit far enough from every real device offset that the device clock gives the other answer.
    it('judges a one-shot in its own timezone, not the device one', () => {
        const fired = loadOne({ runAt: '2026-08-28T00:00', timezone: 'Pacific/Kiritimati' });

        expect(canArmTrigger(fired, new Date('2026-08-27T10:01:00Z'))).toBe(false);

        const pending = loadOne({ runAt: '2026-08-28T00:00', timezone: 'Pacific/Pago_Pago' });

        expect(canArmTrigger(pending, new Date('2026-08-28T10:59:00Z'))).toBe(true);
    });

    it('reads the stored clock on a row this form cannot edit', () => {
        const legacy = loadOne({ _id: null, legacy: true });

        expect(canArmTrigger(onDate(legacy, 2026, 12, 1), NOW)).toBe(false);
    });
});
