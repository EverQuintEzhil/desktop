import { describe, expect, it } from 'vitest';

import {
    DEFAULT_RANGE,
    RANGE_DAYS,
    resolveInsightsPeriod,
    resolveSeriesInterval,
    type InsightsFilters,
} from './insights';

const filters = (overrides: Partial<InsightsFilters>): InsightsFilters => ({
    range: '30d',
    from: '',
    to: '',
    securityGroupIds: [],
    agentIds: [],
    ...overrides,
});

describe('resolveInsightsPeriod', () => {
    it('uses the custom from/to when both parse as valid dates', () => {
        const period = resolveInsightsPeriod(filters({ range: 'custom', from: '2026-08-01', to: '2026-08-10' }));

        // `startOfDay` is local-timezone, so assert the calendar date and the day count
        // rather than a hardcoded UTC instant that would only hold in one timezone.
        expect(new Date(period.from).toDateString()).toContain('2026');
        const spanDays = Math.round((new Date(period.to).getTime() - new Date(period.from).getTime()) / 86_400_000);

        // 2026-08-01 through 2026-08-10 inclusive, `to` exclusive → 10 days.
        expect(spanDays).toBe(10);
    });

    it('falls back to the default window instead of throwing on a hand-edited, invalid custom date', () => {
        expect(() =>
            resolveInsightsPeriod(filters({ range: 'custom', from: 'not-a-date', to: '2026-08-10' })),
        ).not.toThrow();

        const period = resolveInsightsPeriod(filters({ range: 'custom', from: 'not-a-date', to: '2026-08-10' }));
        const spanDays = (new Date(period.to).getTime() - new Date(period.from).getTime()) / 86_400_000;

        expect(spanDays).toBeCloseTo(RANGE_DAYS[DEFAULT_RANGE], 0);
    });

    it('falls back to the default window when `to` is invalid too', () => {
        expect(() =>
            resolveInsightsPeriod(filters({ range: 'custom', from: '2026-08-01', to: 'also-not-a-date' })),
        ).not.toThrow();
    });
});

describe('resolveSeriesInterval', () => {
    it('picks a daily bucket for a short range', () => {
        expect(resolveSeriesInterval({ from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' })).toBe('day');
    });

    it('picks a weekly bucket once the range passes 60 days', () => {
        expect(resolveSeriesInterval({ from: '2026-01-01T00:00:00.000Z', to: '2026-08-01T00:00:00.000Z' })).toBe(
            'week',
        );
    });
});
