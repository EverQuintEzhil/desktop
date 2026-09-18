import { describe, expect, it } from 'vitest';

import type { RoutineType } from '@/types/routines';

import {
    haveSameRecipients,
    isRecipientRejection,
    recipientIds,
    recipientLabel,
    storedRecipients,
    type RecipientOption,
} from './recipients';

const option = (userId: string, name = userId): RecipientOption => ({ userId, name, email: `${userId}@ex.com` });

const routine = (overrides: Partial<RoutineType> = {}): RoutineType =>
    ({
        _id: 'routine-1',
        agentId: 'agent-1',
        name: 'Weekly scan',
        prompt: 'Scan',
        cron: '0 9 * * 1',
        timezone: 'UTC',
        runOnce: false,
        status: 'active',
        lastRunAt: null,
        createdAt: '2026-08-01T09:00:00.000Z',
        updatedAt: '2026-08-01T09:00:00.000Z',
        ...overrides,
    }) as RoutineType;

describe('recipientLabel', () => {
    it('joins first and last, skipping the middle the api also skips', () => {
        expect(recipientLabel({ first: 'Ada', middle: 'Byron', last: 'Lovelace' }, 'ada@ex.com')).toBe('Ada Lovelace');
    });

    it('falls back to the address when there is no name', () => {
        expect(recipientLabel({ first: null, last: null }, 'ada@ex.com')).toBe('ada@ex.com');
    });

    // A recipient read off a routine carries no email at all, so neither half of the label is there.
    it('never renders an empty chip', () => {
        expect(recipientLabel(null, '')).toBe('Unnamed user');
    });
});

describe('storedRecipients', () => {
    it('reads the stored list back off a routine', () => {
        const list = storedRecipients(
            routine({
                recipients: [
                    { userId: 'u1', user: { _id: 'u1', name: { first: 'Ada', last: 'Lovelace' } } },
                    { userId: 'u2', user: { _id: 'u2', name: { first: 'Grace', last: 'Hopper' } } },
                ],
            }),
        );

        expect(list.map((item) => item.name)).toEqual(['Ada Lovelace', 'Grace Hopper']);
        expect(list.every((item) => item.email === '')).toBe(true);
    });

    // Empty means the OWNER, and who that is comes from `useRoutineRecipients`, not from here.
    it('reports a routine with no stored rows as empty', () => {
        expect(storedRecipients(routine({ recipients: [] }))).toEqual([]);
        expect(storedRecipients(routine())).toEqual([]);
    });
});

describe('haveSameRecipients', () => {
    it('ignores order, since the api replaces the list wholesale', () => {
        expect(haveSameRecipients([option('a'), option('b')], [option('b'), option('a')])).toBe(true);
    });

    it('sees an addition and a removal', () => {
        expect(haveSameRecipients([option('a')], [option('a'), option('b')])).toBe(false);
        expect(haveSameRecipients([option('a')], [option('b')])).toBe(false);
    });
});

describe('recipientIds', () => {
    it('sends ids, never addresses', () => {
        expect(recipientIds([option('u1'), option('u2')])).toEqual(['u1', 'u2']);
    });
});

describe('isRecipientRejection', () => {
    it.each([
        'Ada Lovelace cannot see the "Research" agent, so they cannot be a recipient.',
        'Ada Lovelace cannot see the "Client work" space, so they cannot be a recipient.',
        'We could not find a user for "u9".',
    ])('claims the api sentence: %s', (message) => {
        expect(isRecipientRejection(message)).toBe(true);
    });

    it('leaves an unrelated failure to the toast', () => {
        expect(isRecipientRejection('The date and time must be in the future.')).toBe(false);
    });
});
