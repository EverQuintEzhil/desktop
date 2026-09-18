import { describe, expect, it } from 'vitest';

import {
    buildAdoptionTrend,
    buildCapabilities,
    buildConsumption,
    buildDistribution,
    buildFailures,
    buildFunnel,
    buildGovernance,
    buildLeaderboards,
    buildSummary,
} from './insights-adapters';
import {
    FAILURE_REASONS,
    type UsageCostByModelResponse,
    type UsageCostBySecurityGroupResponse,
    type UsageFailuresResponse,
    type UsageMetricsResponse,
    type UsageSeriesByModelResponse,
    type UsageSeriesTenantResponse,
    type UsageUsersResponse,
    type WireUserRow,
} from './insights-schema';

const wireMetric = (value: number | null) => ({ value, formula: 'formula', source: 'source' });

const metricsFixture: UsageMetricsResponse = {
    generated_at: '2026-08-31T07:35:00.000Z',
    period: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T00:00:00.000Z' },
    collection_started_at: null,
    freshness: [
        {
            source: 'conversations',
            description: 'Conversations',
            first_event_at: null,
            latest_event_at: '2026-08-31T07:30:00.000Z',
            lag_seconds: 300,
        },
    ],
    privacy: { per_person_visible: true, min_cohort_size: 5, source: 'about' },
    adoption: {
        provisioned_users: wireMetric(2500),
        active_users: wireMetric(1284),
        activated_users: wireMetric(1742),
        never_activated_users: wireMetric(758),
        activation_rate: wireMetric(0.6968),
        dormant_users: wireMetric(458),
        conversations: wireMetric(48_910),
        requests: wireMetric(60_000),
    },
    stickiness: {
        dau: 422.52,
        mau: 1284,
        ratio: 0.329,
        days_counted: 30,
        active_days: 28,
        formula: 'formula',
        source: 'source',
    },
    spend: { tokens: wireMetric(2_400_000), cost: wireMetric(6180), co2: wireMetric(47.9) },
    capability_adoption: [
        {
            capability: 'chat',
            label: 'Chat',
            users: 1200,
            adoption_rate: 0.934,
            failures: {
                total: 3,
                by_reason: {
                    network: 2,
                    rate_limited: 0,
                    oversized_request: 0,
                    bad_request: 0,
                    bad_tool_response: 0,
                    guardrail_block: 1,
                    application_error: 0,
                },
            },
            failures_available: true,
            formula: 'f',
            source: 's',
        },
        {
            capability: 'incognito',
            label: 'Incognito',
            users: 40,
            adoption_rate: 0.03,
            failures: {
                total: 0,
                by_reason: {
                    network: 0,
                    rate_limited: 0,
                    oversized_request: 0,
                    bad_request: 0,
                    bad_tool_response: 0,
                    guardrail_block: 0,
                    application_error: 0,
                },
            },
            failures_available: true,
            formula: 'f',
            source: 's',
        },
        {
            capability: 'image',
            label: 'Image',
            users: 10,
            adoption_rate: 0.01,
            failures: null,
            failures_available: false,
            formula: 'f',
            source: 's',
        },
    ],
    governance: [
        { flag: 'never_activated_with_access', users: 758, formula: 'f', source: 's' },
        { flag: 'guardrail_blocks', users: 12, formula: 'f', source: 's' },
    ],
    failures: {
        total: 100,
        truncated: false,
        by_reason: {
            network: 10,
            rate_limited: 20,
            oversized_request: 0,
            bad_request: 5,
            bad_tool_response: 15,
            guardrail_block: 30,
            application_error: 20,
        },
        by_source: { conversation: 60, routine_run: 20, tool_execution: 20, all: 100 },
        by_capability: {
            chat: {
                total: 60,
                by_reason: {
                    network: 60,
                    rate_limited: 0,
                    oversized_request: 0,
                    bad_request: 0,
                    bad_tool_response: 0,
                    guardrail_block: 0,
                    application_error: 0,
                },
            },
            incognito: {
                total: 20,
                by_reason: {
                    network: 20,
                    rate_limited: 0,
                    oversized_request: 0,
                    bad_request: 0,
                    bad_tool_response: 0,
                    guardrail_block: 0,
                    application_error: 0,
                },
            },
            builder: {
                total: 20,
                by_reason: {
                    network: 20,
                    rate_limited: 0,
                    oversized_request: 0,
                    bad_request: 0,
                    bad_tool_response: 0,
                    guardrail_block: 0,
                    application_error: 0,
                },
            },
        },
        attempts: { conversation: 1000, routine_run: 200, tool_execution: 200 },
        formula: 'f',
        source: 's',
    },
};

const seriesFixture: UsageSeriesTenantResponse = {
    generated_at: metricsFixture.generated_at,
    period: metricsFixture.period,
    freshness: metricsFixture.freshness,
    privacy: metricsFixture.privacy,
    interval: 'week',
    dimension: 'tenant',
    formula: 'f',
    source: 's',
    values: [
        {
            period_start: '2026-08-10',
            requests: 0,
            tokens: 0,
            cost: 0,
            provider_cost: 0,
            co2: 0,
            conversations: 0,
            active_users: 0,
        },
        {
            period_start: '2026-08-17',
            requests: 14,
            tokens: 38_870,
            cost: 100,
            provider_cost: 0,
            co2: 5,
            conversations: 20,
            active_users: 5,
        },
        {
            period_start: '2026-08-24',
            requests: 2,
            tokens: 1_600,
            cost: 150,
            provider_cost: 0,
            co2: 6,
            conversations: 25,
            active_users: 8,
        },
    ],
};

describe('buildSummary', () => {
    it('ships exactly four hero KPIs with a formula and a source on every one', () => {
        const summary = buildSummary(metricsFixture, seriesFixture);

        expect(summary.kpis.map((kpi) => kpi.key)).toEqual([
            'active_users',
            'activation_rate',
            'consumption_cost',
            'governance_flags',
        ]);

        for (const metric of [...summary.kpis, ...summary.trend]) {
            expect(metric.formula.length).toBeGreaterThan(0);
            expect(metric.source.length).toBeGreaterThan(0);
        }
    });

    it('converts the activation rate fraction to a percentage', () => {
        const summary = buildSummary(metricsFixture);
        const activationRate = summary.kpis.find((kpi) => kpi.key === 'activation_rate');

        expect(activationRate?.value).toBeCloseTo(69.68);
    });

    it('builds a real trend for active_users and consumption from the series buckets', () => {
        const summary = buildSummary(metricsFixture, seriesFixture);
        const activeUsers = summary.kpis.find((kpi) => kpi.key === 'active_users');
        const consumption = summary.kpis.find((kpi) => kpi.key === 'consumption_cost');

        expect(activeUsers?.series).toEqual([0, 5, 8]);
        expect(activeUsers?.previousValue).toBe(5);
        expect(activeUsers?.trendLabel).toBe('vs previous week');
        expect(consumption?.series).toEqual([0, 100, 150]);
    });

    it('has no trend for activation rate or governance flags — the series endpoint has no equivalent field', () => {
        const summary = buildSummary(metricsFixture, seriesFixture);
        const activationRate = summary.kpis.find((kpi) => kpi.key === 'activation_rate');
        const governanceFlags = summary.kpis.find((kpi) => kpi.key === 'governance_flags');

        expect(activationRate?.series).toEqual([]);
        expect(activationRate?.trendLabel).toBeNull();
        expect(governanceFlags?.series).toEqual([]);
    });

    it('has no trend at all when the series call has not resolved yet', () => {
        const summary = buildSummary(metricsFixture);
        const activeUsers = summary.kpis.find((kpi) => kpi.key === 'active_users');

        expect(activeUsers?.series).toEqual([]);
        expect(activeUsers?.previousValue).toBeNull();
    });

    it('sums the governance rows into the governance-flags KPI', () => {
        const summary = buildSummary(metricsFixture);
        const governanceFlags = summary.kpis.find((kpi) => kpi.key === 'governance_flags');

        expect(governanceFlags?.value).toBe(770);
        expect(governanceFlags?.attention).toBe(true);
    });

    it('drills the governance-flags KPI into every flag actually present, not one hardcoded flag', () => {
        const summary = buildSummary(metricsFixture);
        const governanceFlags = summary.kpis.find((kpi) => kpi.key === 'governance_flags');

        // metricsFixture.governance has never_activated_with_access and guardrail_blocks
        expect(governanceFlags?.targetQuery).toBe('flags=never_activated_with_access&flags=guardrail_blocks');
    });

    it('has no drill-through for the governance-flags KPI when there are no governance rows', () => {
        const noGovernance: UsageMetricsResponse = { ...metricsFixture, governance: [] };
        const summary = buildSummary(noGovernance);
        const governanceFlags = summary.kpis.find((kpi) => kpi.key === 'governance_flags');

        expect(governanceFlags?.targetQuery).toBeNull();
    });

    it('hides a value rather than showing zero when the server nulls it', () => {
        const suppressed: UsageMetricsResponse = {
            ...metricsFixture,
            adoption: { ...metricsFixture.adoption, active_users: wireMetric(null) },
        };
        const summary = buildSummary(suppressed);
        const activeUsers = summary.kpis.find((kpi) => kpi.key === 'active_users');

        expect(activeUsers?.valueIsHidden).toBe(true);
        expect(activeUsers?.value).toBe(0);
    });
});

describe('buildFunnel', () => {
    it('derives stage counts and the never-activated / dormant gaps from real adoption figures', () => {
        const funnel = buildFunnel(metricsFixture);

        expect(funnel.stages.map((stage) => stage.count)).toEqual([2500, 1742, 1284]);
        expect(funnel.stages[1].gap).toMatchObject({ count: 758, filterQuery: 'segment=never_activated' });
        expect(funnel.stages[2].gap).toMatchObject({ count: 458, filterQuery: 'segment=dormant' });
    });

    it('has no gap for a stage the server reports as fully closed', () => {
        const closed: UsageMetricsResponse = {
            ...metricsFixture,
            adoption: { ...metricsFixture.adoption, never_activated_users: wireMetric(0) },
        };

        expect(buildFunnel(closed).stages[1].gap).toBeNull();
    });
});

describe('buildCapabilities', () => {
    it('carries real per-capability failures for chat/incognito/builder', () => {
        const capabilities = buildCapabilities(metricsFixture);
        const chat = capabilities.rows.find((row) => row.id === 'chat');

        expect(chat?.failuresAvailable).toBe(true);
        expect(chat?.failuresTotal).toBe(3);
        expect(chat?.failures).toMatchObject({ network: 2, guardrail_block: 1 });
    });

    it('marks image/video as "not measured" rather than a zero — media failures are never persisted', () => {
        const capabilities = buildCapabilities(metricsFixture);
        const image = capabilities.rows.find((row) => row.id === 'image');

        expect(image?.failuresAvailable).toBe(false);
        expect(image?.failures).toBeNull();
    });
});

describe('buildGovernance', () => {
    it('drills each flag into its own segment now that the users endpoint supports ?flags=', () => {
        const watchlist = buildGovernance(metricsFixture);
        const dormant = watchlist.flags.find((flag) => flag.key === 'never_activated_with_access');
        const guardrail = watchlist.flags.find((flag) => flag.key === 'guardrail_blocks');

        expect(dormant?.targetQuery).toBe('flags=never_activated_with_access');
        expect(guardrail?.targetQuery).toBe('flags=guardrail_blocks');
    });
});

describe('buildFailures', () => {
    const failuresResponse: UsageFailuresResponse = {
        generated_at: metricsFixture.generated_at,
        period: metricsFixture.period,
        freshness: metricsFixture.freshness,
        privacy: metricsFixture.privacy,
        formula: 'f',
        source: 's',
        totals: {
            events: 100,
            by_source: metricsFixture.failures.by_source,
            by_reason: metricsFixture.failures.by_reason,
            by_capability: metricsFixture.failures.by_capability,
            attempts: metricsFixture.failures.attempts,
        },
        truncated: false,
        page_info: { page: 1, count: 1, total_count: 1, total_pages: 1 },
        values: [
            {
                fingerprint: 'fp-1',
                reason: 'guardrail_block',
                capability: 'chat',
                agent_id: 'agent-1',
                tool_id: null,
                sources: ['conversation'],
                sample_message: 'raw',
                normalized_message: 'Blocked by guardrail',
                count: 30,
                first_seen: '2026-08-01T00:00:00.000Z',
                last_seen: '2026-08-30T00:00:00.000Z',
                events: [
                    {
                        source: 'conversation',
                        id: 'evt-1',
                        occurred_at: '2026-08-30T00:00:00.000Z',
                        actor_id: 'user-1',
                        agent_id: 'agent-1',
                        conversation_id: 'conv-1',
                    },
                ],
            },
        ],
    };

    it('splits failures by every reason the ticket names, never as one rate', () => {
        const failures = buildFailures(failuresResponse);

        expect(Object.keys(failures.byReason).sort()).toEqual([...FAILURE_REASONS].sort());
        expect(failures.totalEvents).toBe(100);
    });

    it('carries the by-capability breakdown and each issue’s own capability', () => {
        const failures = buildFailures(failuresResponse);

        expect(failures.byCapability).toEqual({ chat: 60, incognito: 20, builder: 20 });
        expect(failures.issues[0].capability).toBe('chat');
    });

    it('flags an issue as truncated when the server sent fewer events than its count', () => {
        const failures = buildFailures(failuresResponse);

        expect(failures.issues[0].eventsTruncated).toBe(true);
    });
});

describe('buildConsumption', () => {
    const byModel: UsageCostByModelResponse = {
        generated_at: metricsFixture.generated_at,
        period: metricsFixture.period,
        freshness: metricsFixture.freshness,
        privacy: metricsFixture.privacy,
        dimension: 'model',
        formula: 'f',
        source: 's',
        values: [
            {
                model_id: 'm1',
                model_name: 'Sonnet',
                provider: 'anthropic',
                requests: 100,
                tokens: 1000,
                cost: 750,
                provider_cost: 0,
                co2: 5,
            },
            {
                model_id: 'm2',
                model_name: 'Haiku',
                provider: 'anthropic',
                requests: 100,
                tokens: 500,
                cost: 250,
                provider_cost: 0,
                co2: 1,
            },
        ],
    };

    const modelSeries: UsageSeriesByModelResponse = {
        generated_at: metricsFixture.generated_at,
        period: metricsFixture.period,
        freshness: metricsFixture.freshness,
        privacy: metricsFixture.privacy,
        interval: 'week',
        dimension: 'model',
        formula: 'f',
        source: 's',
        values: [
            {
                model_id: 'm1',
                model_name: 'Sonnet',
                provider: 'anthropic',
                buckets: [
                    {
                        period_start: '2026-08-17',
                        requests: 10,
                        tokens: 500,
                        cost: 50,
                        provider_cost: 0,
                        co2: 1,
                        conversations: 5,
                        active_users: 2,
                    },
                    {
                        period_start: '2026-08-24',
                        requests: 20,
                        tokens: 1000,
                        cost: 120,
                        provider_cost: 0,
                        co2: 2,
                        conversations: 10,
                        active_users: 3,
                    },
                ],
            },
            {
                model_id: 'm2',
                model_name: 'Haiku',
                provider: 'anthropic',
                buckets: [
                    {
                        period_start: '2026-08-17',
                        requests: 10,
                        tokens: 500,
                        cost: 60,
                        provider_cost: 0,
                        co2: 1,
                        conversations: 5,
                        active_users: 2,
                    },
                    {
                        period_start: '2026-08-24',
                        requests: 5,
                        tokens: 200,
                        cost: 30,
                        provider_cost: 0,
                        co2: 0.5,
                        conversations: 2,
                        active_users: 1,
                    },
                ],
            },
        ],
    };

    it('computes cost per conversation from two real fields rather than shipping an invented number', () => {
        const consumption = buildConsumption(metricsFixture, byModel);

        expect(consumption.costPerConversation.value).toBeCloseTo(6180 / 48_910);
    });

    it('computes each model’s cost share from the real per-model totals', () => {
        const consumption = buildConsumption(metricsFixture, byModel);

        expect(consumption.models.map((m) => m.costShare)).toEqual([75, 25]);
    });

    it('gives a row a stable key when the server sends a null model_id (an unresolved model)', () => {
        const withUnresolvedModel: UsageCostByModelResponse = {
            ...byModel,
            values: [
                ...byModel.values,
                {
                    model_id: null,
                    model_name: 'gpt-5.6-sol',
                    provider: 'azure.responses',
                    requests: 9,
                    tokens: 90344,
                    cost: 0.46,
                    provider_cost: 0,
                    co2: 0.05,
                },
            ],
        };
        const consumption = buildConsumption(metricsFixture, withUnresolvedModel);
        const unresolved = consumption.models[consumption.models.length - 1];

        expect(unresolved.id).toBe('unresolved-model-2');
        expect(unresolved.name).toBe('gpt-5.6-sol');
    });

    it('builds the "Over time" chart from real tenant-series buckets', () => {
        const consumption = buildConsumption(metricsFixture, byModel, seriesFixture);

        expect(consumption.series).toEqual([
            { bucket: '2026-08-10', costUsd: 0, co2Kg: 0, tokens: 0 },
            { bucket: '2026-08-17', costUsd: 100, co2Kg: 5, tokens: 38_870 },
            { bucket: '2026-08-24', costUsd: 150, co2Kg: 6, tokens: 1_600 },
        ]);
    });

    it('computes real top cost movers by comparing the last two buckets per model', () => {
        const consumption = buildConsumption(metricsFixture, byModel, seriesFixture, modelSeries);

        // Sonnet: 50 -> 120 (+70), Haiku: 60 -> 30 (-30) — sorted by magnitude
        expect(consumption.movers).toEqual([
            { id: 'm1', label: 'Sonnet', detail: '$50.00 → $120.00', deltaUsd: 70 },
            { id: 'm2', label: 'Haiku', detail: '$60.00 → $30.00', deltaUsd: -30 },
        ]);
    });

    it('gives movers a unique key even when two models share a display name across providers', () => {
        const duplicateNameSeries: UsageSeriesByModelResponse = {
            ...modelSeries,
            values: [
                {
                    model_id: 'azure-m1',
                    model_name: 'gpt-5.4-mini',
                    provider: 'azure.responses',
                    buckets: [
                        {
                            period_start: '2026-08-17',
                            requests: 1,
                            tokens: 1,
                            cost: 10,
                            provider_cost: 0,
                            co2: 0,
                            conversations: 1,
                            active_users: 1,
                        },
                        {
                            period_start: '2026-08-24',
                            requests: 1,
                            tokens: 1,
                            cost: 20,
                            provider_cost: 0,
                            co2: 0,
                            conversations: 1,
                            active_users: 1,
                        },
                    ],
                },
                {
                    model_id: 'openai-m1',
                    model_name: 'gpt-5.4-mini',
                    provider: 'openai.responses',
                    buckets: [
                        {
                            period_start: '2026-08-17',
                            requests: 1,
                            tokens: 1,
                            cost: 5,
                            provider_cost: 0,
                            co2: 0,
                            conversations: 1,
                            active_users: 1,
                        },
                        {
                            period_start: '2026-08-24',
                            requests: 1,
                            tokens: 1,
                            cost: 15,
                            provider_cost: 0,
                            co2: 0,
                            conversations: 1,
                            active_users: 1,
                        },
                    ],
                },
            ],
        };
        const consumption = buildConsumption(metricsFixture, byModel, seriesFixture, duplicateNameSeries);
        const ids = consumption.movers.map((mover) => mover.id);

        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toEqual(['azure-m1', 'openai-m1']);
    });

    it('has no chart or movers when series data has not resolved', () => {
        const consumption = buildConsumption(metricsFixture, byModel);

        expect(consumption.series).toEqual([]);
        expect(consumption.movers).toEqual([]);
    });
});

describe('buildDistribution', () => {
    const bySecurityGroup: UsageCostBySecurityGroupResponse = {
        generated_at: metricsFixture.generated_at,
        period: metricsFixture.period,
        freshness: metricsFixture.freshness,
        privacy: metricsFixture.privacy,
        dimension: 'security_group',
        formula: 'f',
        source: 's',
        values: [
            {
                security_group_id: 'sg-1',
                name: 'Design',
                users: 100,
                requests: 0,
                tokens: 0,
                cost: 1000,
                provider_cost: 0,
                co2: 0,
                activated_users: 80,
                active_users: 60,
                activation_rate: 0.8,
            },
            {
                security_group_id: 'sg-2',
                name: 'Delivery',
                users: 50,
                requests: 0,
                tokens: 0,
                cost: 500,
                provider_cost: 0,
                co2: 0,
                activated_users: 30,
                active_users: 20,
                activation_rate: 0.6,
            },
        ],
    };

    it('computes a real median activation rate across the returned groups', () => {
        const distribution = buildDistribution(bySecurityGroup);

        // sg-1: 80%, sg-2: 60% → median of two values is their average
        expect(distribution.medianActiveRatio).toBe(70);
        expect(distribution.rows.find((r) => r.groupId === 'sg-1')?.deltaVsMedian).toBe(10);
        expect(distribution.rows.find((r) => r.groupId === 'sg-2')?.deltaVsMedian).toBe(-10);
    });

    it('carries cost alongside activation on the same row', () => {
        const distribution = buildDistribution(bySecurityGroup);

        expect(distribution.rows.find((r) => r.groupId === 'sg-1')?.cost).toBe(1000);
    });

    it('marks a below-cohort-size group as suppressed rather than 0, and excludes it from the median', () => {
        const withSuppressedGroup: UsageCostBySecurityGroupResponse = {
            ...bySecurityGroup,
            values: [
                ...bySecurityGroup.values,
                {
                    security_group_id: 'sg-3',
                    name: 'Tiny Group',
                    users: 2,
                    requests: null,
                    tokens: null,
                    cost: null,
                    provider_cost: null,
                    co2: null,
                    activated_users: null,
                    active_users: null,
                    activation_rate: null,
                    suppressed: true,
                    suppressed_reason: 'cohort_too_small',
                },
            ],
        };
        const distribution = buildDistribution(withSuppressedGroup);
        const suppressedRow = distribution.rows.find((r) => r.groupId === 'sg-3');

        expect(suppressedRow).toMatchObject({ suppressed: true, suppressedReason: 'cohort_too_small', activeRatio: 0 });
        // the median stays 70 — the suppressed group must not pull it toward 0
        expect(distribution.medianActiveRatio).toBe(70);
    });
});

describe('buildAdoptionTrend', () => {
    it('pairs each current-period bucket with the same-index previous-period bucket', () => {
        const previous: UsageSeriesTenantResponse = {
            ...seriesFixture,
            values: seriesFixture.values.map((bucket) => ({
                ...bucket,
                active_users: (bucket.active_users ?? 0) + 1,
            })),
        };

        const trend = buildAdoptionTrend(seriesFixture, previous);

        expect(trend.interval).toBe('week');
        expect(trend.points).toHaveLength(seriesFixture.values.length);
        trend.points.forEach((point, index) => {
            expect(point.users).toBe(seriesFixture.values[index].active_users ?? 0);
            expect(point.prevUsers).toBe((seriesFixture.values[index].active_users ?? 0) + 1);
        });
    });

    it('leaves the previous-period fields null when no previous series is available', () => {
        const trend = buildAdoptionTrend(seriesFixture);

        expect(trend.points.every((point) => point.prevUsers === null)).toBe(true);
        expect(trend.points.every((point) => point.prevConversations === null)).toBe(true);
        expect(trend.points.every((point) => point.prevCostUsd === null)).toBe(true);
    });

    it('leaves a bucket past the shorter series null rather than 0', () => {
        const shorterPrevious: UsageSeriesTenantResponse = {
            ...seriesFixture,
            values: seriesFixture.values.slice(0, 1),
        };

        const trend = buildAdoptionTrend(seriesFixture, shorterPrevious);

        expect(trend.points[0].prevUsers).toBe(seriesFixture.values[0].active_users);
        expect(trend.points[1].prevUsers).toBeNull();
    });

    // `?dimension=model` returns `active_users: null` per bucket — confirmed live. `buildAdoptionTrend`
    // only ever runs on the tenant dimension, but the bucket type is shared, so this must not crash.
    it('reads a null active_users bucket as 0 rather than crashing', () => {
        const withNullActiveUsers: UsageSeriesTenantResponse = {
            ...seriesFixture,
            values: seriesFixture.values.map((bucket) => ({ ...bucket, active_users: null })),
        };

        const trend = buildAdoptionTrend(withNullActiveUsers, withNullActiveUsers);

        expect(trend.points.every((point) => point.users === 0)).toBe(true);
        expect(trend.points.every((point) => point.prevUsers === 0)).toBe(true);
    });
});

describe('buildLeaderboards', () => {
    const buildRow = (overrides: Partial<WireUserRow>): WireUserRow => ({
        _id: 'user-1',
        name: { first: 'Ada', middle: '', last: 'Lovelace' },
        email: 'ada@example.com',
        avatar: null,
        role: 'user',
        portal_access_enabled: true,
        is_deleted: false,
        activated: true,
        activated_at: '2026-01-01T00:00:00.000Z',
        last_active_at: '2026-08-30T00:00:00.000Z',
        conversations: 10,
        requests: 20,
        tokens: 1000,
        cost: 1,
        co2: 1,
        capabilities_used: ['chat'],
        capabilities_used_count: 1,
        flags: [],
        is_dormant: false,
        is_power_user: false,
        security_groups: [],
        activity: { buckets: [], values: [] },
        ...overrides,
    });

    const usersResponse = (values: WireUserRow[]): UsageUsersResponse => ({
        generated_at: '2026-08-31T00:00:00.000Z',
        period: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T00:00:00.000Z' },
        freshness: [],
        privacy: { per_person_visible: true, min_cohort_size: 5, source: 'test' },
        formulas: {},
        segment: 'all',
        page_info: { page: 0, count: values.length, total_count: values.length, total_pages: 1 },
        truncated: false,
        values,
    });

    it('keeps the most-active list in the order the server already sorted', () => {
        const mostActive = usersResponse([
            buildRow({ _id: 'a', conversations: 50 }),
            buildRow({ _id: 'b', conversations: 30 }),
        ]);
        const broadest = usersResponse([buildRow({ _id: 'a', capabilities_used_count: 1 })]);

        const leaderboards = buildLeaderboards(mostActive, broadest);

        expect(leaderboards.mostActive.map((entry) => entry.id)).toEqual(['a', 'b']);
        expect(leaderboards.mostActive.map((entry) => entry.value)).toEqual([50, 30]);
    });

    it('sorts broadest capability use client-side, descending, capped at 5', () => {
        const mostActive = usersResponse([buildRow({ _id: 'z' })]);
        const broadest = usersResponse(
            ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => buildRow({ _id: id, capabilities_used_count: index })),
        );

        const leaderboards = buildLeaderboards(mostActive, broadest);

        expect(leaderboards.broadestCapabilityUse).toHaveLength(5);
        expect(leaderboards.broadestCapabilityUse.map((entry) => entry.value)).toEqual([5, 4, 3, 2, 1]);
    });

    it('carries the tenant-wide privacy flag from the response rather than per entry', () => {
        const mostActive: UsageUsersResponse = {
            ...usersResponse([buildRow({})]),
            privacy: { per_person_visible: false, min_cohort_size: 5, source: 'test' },
        };
        const broadest = usersResponse([buildRow({})]);

        const leaderboards = buildLeaderboards(mostActive, broadest);

        expect(leaderboards.perPersonVisible).toBe(false);
    });

    it('falls back to "Unnamed user" when the row has no name', () => {
        const mostActive = usersResponse([buildRow({ name: null })]);
        const broadest = usersResponse([buildRow({ name: null })]);

        const leaderboards = buildLeaderboards(mostActive, broadest);

        expect(leaderboards.mostActive[0].name).toBe('Unnamed user');
    });
});
