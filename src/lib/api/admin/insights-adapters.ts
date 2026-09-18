import {
    CAPABILITIES,
    FAILURE_CAPABILITIES,
    FAILURE_REASONS,
    GOVERNANCE_FLAGS,
    type AdoptionTrend,
    type Capabilities,
    type Consumption,
    type CostMover,
    type Distribution,
    type FailureCapability,
    type FailureReason,
    type Failures,
    type FreshnessSource,
    type FreshnessStatus,
    type InsightsSummary,
    type Leaderboards,
    type LeaderboardEntry,
    type Metric,
    type MetricUnit,
    type Severity,
    type UsageCostByModelResponse,
    type UsageCostBySecurityGroupResponse,
    type UsageFailuresResponse,
    type UsageMetricsResponse,
    type UsageSeriesByModelResponse,
    type UsageSeriesTenantResponse,
    type UsageUsersResponse,
    type WireFreshnessSource,
    type WireMetric,
    type WireSeriesBucket,
    type WireUserRow,
    type Watchlist,
    type ActivationFunnel,
} from './insights-schema';

export const CAPABILITY_LABELS: Record<(typeof CAPABILITIES)[number], string> = {
    chat: 'Chat',
    incognito: 'Incognito',
    builder: 'Builder',
    image: 'Image',
    video: 'Video',
};

export const GOVERNANCE_FLAG_LABELS: Record<(typeof GOVERNANCE_FLAGS)[number], string> = {
    never_activated_with_access: 'Never activated, still has access',
    dormant: 'Dormant',
    incognito_usage: 'Incognito usage',
    guardrail_blocks: 'Guardrail blocks',
};

/** The API's `formula` is a predicate ("portal_access_enabled AND ..."). Readable, but not on a card. */
const GOVERNANCE_FLAG_DETAILS: Record<(typeof GOVERNANCE_FLAGS)[number], string> = {
    never_activated_with_access: 'Can sign in, but has never used any capability.',
    dormant: 'Was active once — nothing recorded in the last 60 days.',
    incognito_usage: 'Used incognito chat at least once in this period.',
    guardrail_blocks: 'Had at least one request stopped by a guardrail.',
};

const GOVERNANCE_FLAG_SEVERITY: Record<(typeof GOVERNANCE_FLAGS)[number], Severity> = {
    guardrail_blocks: 'critical',
    never_activated_with_access: 'warning',
    dormant: 'notice',
    incognito_usage: 'notice',
};

const freshnessStatus = (source: WireFreshnessSource): FreshnessStatus => {
    if (source.lag_seconds === null) return 'stale';
    if (source.lag_seconds < 3600) return 'fresh';
    if (source.lag_seconds < 24 * 3600) return 'lagging';

    return 'stale';
};

// The short key, not `description` — the latter names the datastore, which is not the
// reader's language. The UI maps the key to a product name.
export const adaptFreshness = (sources: WireFreshnessSource[]): FreshnessSource[] =>
    sources.map((source) => ({
        source: source.source,
        lastEventAt: source.latest_event_at,
        lagSeconds: source.lag_seconds,
        status: freshnessStatus(source),
    }));

// ---------------------------------------------------------------------------
// Trend — built from `GET /reports/usage/series` (AMP-565 gap 1). A metric with
// no equivalent bucket field (activation rate, governance flags) simply gets
// no trend rather than a faked one.
// ---------------------------------------------------------------------------

interface Trend {
    series: number[];
    previousValue: number | null;
    label: string | null;
}

const NO_TREND: Trend = { series: [], previousValue: null, label: null };

function bucketTrend(
    buckets: WireSeriesBucket[],
    interval: string,
    select: (bucket: WireSeriesBucket) => number,
): Trend {
    if (buckets.length === 0) return NO_TREND;

    return {
        series: buckets.map(select),
        previousValue: buckets.length >= 2 ? select(buckets[buckets.length - 2]) : null,
        label: buckets.length >= 2 ? `vs previous ${interval}` : null,
    };
}

interface MetricInput {
    key: string;
    label: string;
    unit: MetricUnit;
    wire: WireMetric;
    denominator?: { value: number; label: string } | null;
    why?: string;
    targetQuery?: string | null;
    collectionStartedAt?: string | null;
    attention?: boolean;
    trend?: Trend;
}

const buildMetric = ({
    key,
    label,
    unit,
    wire,
    denominator = null,
    why = '',
    targetQuery = null,
    collectionStartedAt = null,
    attention = false,
    trend = NO_TREND,
}: MetricInput): Metric => ({
    key,
    label,
    unit,
    value: wire.value ?? 0,
    valueIsHidden: wire.value === null,
    previousValue: trend.previousValue,
    denominator,
    series: trend.series,
    trendLabel: trend.label,
    formula: wire.formula,
    source: wire.source,
    why,
    collectionStartedAt,
    attention,
    targetQuery,
});

const formatCountLabel = (value: number | null): string => (value ?? 0).toLocaleString('en-US');

const medianOf = (sorted: number[]): number => {
    if (sorted.length === 0) return 0;

    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 1) return sorted[mid];

    return (sorted[mid - 1] + sorted[mid]) / 2;
};

export function buildSummary(metrics: UsageMetricsResponse, series?: UsageSeriesTenantResponse): InsightsSummary {
    const { adoption, stickiness, spend, governance, privacy } = metrics;
    const governanceTotal = governance.reduce((sum, row) => sum + row.users, 0);
    const governanceSources = governance.map((row) => `${row.formula} (${row.source})`).join(' · ');

    const activeUsersTrend = series
        ? bucketTrend(series.values, series.interval, (b) => b.active_users ?? 0)
        : NO_TREND;
    const costTrend = series ? bucketTrend(series.values, series.interval, (b) => b.cost) : NO_TREND;
    const conversationsTrend = series ? bucketTrend(series.values, series.interval, (b) => b.conversations) : NO_TREND;

    const kpis: Metric[] = [
        buildMetric({
            key: 'active_users',
            label: 'Active users',
            unit: 'count',
            wire: adoption.active_users,
            denominator: adoption.provisioned_users.value
                ? {
                      value: adoption.provisioned_users.value,
                      label: `of ${formatCountLabel(adoption.provisioned_users.value)} provisioned`,
                  }
                : null,
            why: 'The only adoption number leadership recognises. Provisioned seats tell you what you bought; this tells you what got used.',
            trend: activeUsersTrend,
        }),
        buildMetric({
            key: 'activation_rate',
            label: 'Activation rate',
            unit: 'percent',
            wire: {
                ...adoption.activation_rate,
                value: adoption.activation_rate.value === null ? null : adoption.activation_rate.value * 100,
            },
            denominator: adoption.activated_users.value
                ? {
                      value: adoption.activated_users.value,
                      label: `${formatCountLabel(adoption.activated_users.value)} ever activated`,
                  }
                : null,
            why: 'Separates a rollout problem (low activation) from a retention problem (activation high, actives low).',
            targetQuery: 'segment=never_activated',
        }),
        buildMetric({
            key: 'consumption_cost',
            label: 'Consumption',
            unit: 'currency',
            wire: spend.cost,
            denominator: spend.tokens.value
                ? { value: spend.tokens.value, label: `${formatCountLabel(spend.tokens.value)} tokens` }
                : null,
            why: 'The renewal number. Pair it with cost per conversation so growth is not mistaken for waste.',
            trend: costTrend,
        }),
        buildMetric({
            key: 'governance_flags',
            label: 'Governance flags',
            unit: 'count',
            wire: {
                value: governanceTotal,
                formula: `Sum of the governance rows below: ${governance.map((row) => GOVERNANCE_FLAG_LABELS[row.flag]).join(', ')}.`,
                source: governanceSources || 'See the Governance watch-list below for each flag’s own source.',
            },
            why: 'One number security and IT can both act on. Every flag opens the exact records behind it.',
            // OR-ed across every flag actually present, not just one hardcoded flag — matches
            // GET /reports/usage/users?flags=<a>&flags=<b>&... (repeatable, OR-ed).
            targetQuery: governance.length > 0 ? governance.map((row) => `flags=${row.flag}`).join('&') : null,
            attention: governanceTotal > 0,
        }),
    ];

    const trend: Metric[] = [
        buildMetric({
            key: 'conversations',
            label: 'Conversations',
            unit: 'count',
            wire: adoption.conversations,
            why: 'Volume, not value — read it next to cost per conversation, never alone.',
            trend: conversationsTrend,
        }),
        buildMetric({
            key: 'stickiness',
            label: 'Stickiness',
            unit: 'percent',
            wire: {
                value: stickiness.ratio === null ? null : stickiness.ratio * 100,
                formula: stickiness.formula,
                source: stickiness.source,
            },
            denominator:
                stickiness.dau !== null && stickiness.mau !== null
                    ? {
                          value: stickiness.mau,
                          label: `${stickiness.dau.toFixed(1)} avg daily of ${formatCountLabel(stickiness.mau)} monthly`,
                      }
                    : null,
            why: 'DAU ÷ MAU — how much of the monthly crowd shows up on a given day. High activation with low stickiness means people tried it once, not that they use it.',
        }),
    ];

    const provisioned = adoption.provisioned_users.value ?? 0;
    const active = adoption.active_users.value ?? 0;
    const headline =
        provisioned > 0
            ? `${formatCountLabel(active)} of ${formatCountLabel(provisioned)} provisioned people used Amplify in the selected period.`
            : 'No provisioned users found for the selected period.';

    return {
        generatedAt: metrics.generated_at,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        perPersonAnalyticsEnabled: privacy.per_person_visible,
        headline,
        kpis,
        trend,
        freshness: adaptFreshness(metrics.freshness),
    };
}

export function buildFunnel(metrics: UsageMetricsResponse): ActivationFunnel {
    const { adoption } = metrics;
    const provisioned = adoption.provisioned_users.value ?? 0;
    const activated = adoption.activated_users.value ?? 0;
    const active = adoption.active_users.value ?? 0;
    const neverActivated = adoption.never_activated_users.value ?? 0;
    const dormant = adoption.dormant_users.value ?? 0;

    const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null);

    return {
        formula: 'Provisioned → ever activated → active in the selected period.',
        source: `${adoption.provisioned_users.source}; ${adoption.activated_users.source}; ${adoption.active_users.source}`,
        stages: [
            { key: 'provisioned', label: 'Provisioned', count: provisioned, percentOfPrevious: null, gap: null },
            {
                key: 'activated',
                label: 'Activated',
                count: activated,
                percentOfPrevious: pct(activated, provisioned),
                gap:
                    neverActivated > 0
                        ? {
                              count: neverActivated,
                              note: 'have never taken a first action',
                              action: `Open the ${formatCountLabel(neverActivated)} never-activated people`,
                              filterQuery: 'segment=never_activated',
                          }
                        : null,
            },
            {
                key: 'active',
                label: 'Active in period',
                count: active,
                percentOfPrevious: pct(active, activated),
                gap:
                    dormant > 0
                        ? {
                              count: dormant,
                              note: 'activated, then went dormant',
                              action: `Open the ${formatCountLabel(dormant)} dormant people`,
                              filterQuery: 'segment=dormant',
                          }
                        : null,
            },
        ],
    };
}

export function buildCapabilities(metrics: UsageMetricsResponse): Capabilities {
    const activeUsers = metrics.adoption.active_users.value ?? 0;
    const firstRow = metrics.capability_adoption[0];

    return {
        activeUsers,
        formula: firstRow?.formula ?? 'Unique users of this capability ÷ active users this period.',
        source: firstRow?.source ?? 'Agent-run and conversation events',
        rows: metrics.capability_adoption.map((row) => ({
            id: row.capability,
            name: row.label || CAPABILITY_LABELS[row.capability],
            activeUsers: row.users,
            adoptionRate: Math.round(row.adoption_rate * 100),
            failures: row.failures ? row.failures.by_reason : null,
            failuresAvailable: row.failures_available,
            failuresTotal: row.failures?.total ?? 0,
            formula: row.formula,
            source: row.source,
        })),
    };
}

export function buildGovernance(metrics: UsageMetricsResponse): Watchlist {
    return {
        retentionNote: 'Each card opens the people it counts, filtered to that flag.',
        flags: metrics.governance.map((row) => ({
            key: row.flag,
            label: GOVERNANCE_FLAG_LABELS[row.flag],
            detail: GOVERNANCE_FLAG_DETAILS[row.flag],
            formula: `${row.formula} (${row.source})`,
            count: row.users,
            severity: GOVERNANCE_FLAG_SEVERITY[row.flag],
            targetQuery: `flags=${row.flag}`,
        })),
    };
}

export function buildFailures(response: UsageFailuresResponse): Failures {
    const byReason = Object.fromEntries(
        FAILURE_REASONS.map((reason) => [reason, response.totals.by_reason[reason]]),
    ) as Record<FailureReason, number>;
    const byCapability = Object.fromEntries(
        FAILURE_CAPABILITIES.map((capability) => [capability, response.totals.by_capability[capability].total]),
    ) as Record<FailureCapability, number>;

    return {
        totalEvents: response.totals.events,
        byReason,
        byCapability,
        attempts: response.totals.attempts,
        formula: response.formula,
        source: response.source,
        truncated: response.truncated,
        totalIssues: response.page_info.total_count,
        issues: response.values.map((issue) => ({
            fingerprint: issue.fingerprint,
            reason: issue.reason,
            capability: issue.capability ?? null,
            agentId: issue.agent_id,
            toolId: issue.tool_id,
            normalizedMessage: issue.normalized_message,
            sampleMessage: issue.sample_message,
            count: issue.count,
            firstSeenAt: issue.first_seen,
            lastSeenAt: issue.last_seen,
            events: issue.events.map((event) => ({
                source: event.source,
                id: event.id,
                occurredAt: event.occurred_at,
                agentId: event.agent_id,
                conversationId: event.conversation_id,
            })),
            eventsTruncated: issue.count > issue.events.length,
        })),
    };
}

/** Compares the last two buckets per model — real movers, no prior-period read needed. */
function buildCostMovers(modelSeries: UsageSeriesByModelResponse): CostMover[] {
    return modelSeries.values
        .map((model, index) => ({ model, index }))
        .filter(({ model }) => model.buckets.length >= 2)
        .map(({ model, index }) => {
            const last = model.buckets[model.buckets.length - 1];
            const previous = model.buckets[model.buckets.length - 2];
            const deltaUsd = last.cost - previous.cost;

            return {
                // `model_id` can be null for an unresolved model — the index keeps the id
                // unique even then, and two different providers can share a model name.
                id: model.model_id ?? `unresolved-model-${index}`,
                label: model.model_name,
                detail: `$${previous.cost.toFixed(2)} → $${last.cost.toFixed(2)}`,
                deltaUsd,
                magnitude: Math.abs(deltaUsd),
            };
        })
        .filter((mover) => mover.magnitude > 0)
        .sort((a, b) => b.magnitude - a.magnitude)
        .slice(0, 5)
        .map(({ id, label, detail, deltaUsd }) => ({ id, label, detail, deltaUsd }));
}

export function buildConsumption(
    metrics: UsageMetricsResponse,
    byModel: UsageCostByModelResponse,
    series?: UsageSeriesTenantResponse,
    modelSeries?: UsageSeriesByModelResponse,
): Consumption {
    const { spend, adoption } = metrics;
    const conversations = adoption.conversations.value ?? 0;
    const spendValue = spend.cost.value ?? 0;
    const costPerConversation = conversations > 0 ? spendValue / conversations : 0;
    const totalModelCost = byModel.values.reduce((sum, row) => sum + (row.cost ?? 0), 0);

    const headline =
        conversations > 0
            ? `${formatCountLabel(spendValue)} spent across ${formatCountLabel(conversations)} conversations this period — an average of ${costPerConversation < 1 ? costPerConversation.toFixed(2) : Math.round(costPerConversation)} per conversation.`
            : `${formatCountLabel(spendValue)} spent this period.`;

    const spendTrend = series ? bucketTrend(series.values, series.interval, (b) => b.cost) : NO_TREND;
    const carbonTrend = series ? bucketTrend(series.values, series.interval, (b) => b.co2) : NO_TREND;
    const tokensTrend = series ? bucketTrend(series.values, series.interval, (b) => b.tokens) : NO_TREND;
    const costPerConversationTrend = series
        ? bucketTrend(series.values, series.interval, (b) => (b.conversations > 0 ? b.cost / b.conversations : 0))
        : NO_TREND;

    return {
        headline,
        spend: buildMetric({
            key: 'spend',
            label: 'Total spend',
            unit: 'currency',
            wire: spend.cost,
            why: 'The renewal number. Read it next to cost per conversation, never alone.',
            trend: spendTrend,
        }),
        costPerConversation: buildMetric({
            key: 'cost_per_conversation',
            label: 'Cost per conversation',
            unit: 'currency',
            wire: {
                value: conversations > 0 ? costPerConversation : null,
                formula: `Total spend ÷ conversations. Spend: ${spend.cost.formula} Conversations: ${adoption.conversations.formula}`,
                source: `${spend.cost.source}; ${adoption.conversations.source}`,
            },
            why: 'The honest efficiency line. Total spend rising while unit cost falls is success, not a problem.',
            trend: costPerConversationTrend,
        }),
        carbon: buildMetric({
            key: 'carbon',
            label: 'Carbon',
            unit: 'co2',
            wire: spend.co2,
            why: 'The number firm sustainability reporting asks for. Energy and water are not measured yet.',
            collectionStartedAt: metrics.collection_started_at ?? null,
            trend: carbonTrend,
        }),
        tokens: buildMetric({
            key: 'tokens',
            label: 'Tokens',
            unit: 'tokens',
            wire: spend.tokens,
            why: 'The raw quantity behind both spend and carbon.',
            trend: tokensTrend,
        }),
        models: byModel.values.map((row, index) => ({
            // `model_id` is null for a usage document whose model no longer resolves — the
            // index keeps the React key stable and unique without inventing an identity.
            id: row.model_id ?? `unresolved-model-${index}`,
            name: row.model_name,
            provider: row.provider,
            costUsd: row.cost ?? 0,
            costShare: totalModelCost > 0 && row.cost !== null ? Math.round((row.cost / totalModelCost) * 100) : 0,
            tokens: row.tokens ?? 0,
            co2Kg: row.co2 ?? 0,
        })),
        movers: modelSeries ? buildCostMovers(modelSeries) : [],
        series: series
            ? series.values.map((bucket) => ({
                  bucket: bucket.period_start,
                  costUsd: bucket.cost,
                  co2Kg: bucket.co2,
                  tokens: bucket.tokens,
              }))
            : [],
    };
}

/**
 * Pairs each current-period bucket with the bucket in the same relative position from the
 * previous period (fetched separately, shifted back by the period's own length), so the chart
 * can draw a ghost line. Buckets align by index rather than timestamp because the two series
 * cover different calendar ranges by design.
 */
export function buildAdoptionTrend(
    current: UsageSeriesTenantResponse,
    previous?: UsageSeriesTenantResponse,
): AdoptionTrend {
    const points = current.values.map((bucket, index) => {
        const prevBucket = previous?.values[index];

        return {
            bucket: bucket.period_start,
            users: bucket.active_users ?? 0,
            conversations: bucket.conversations,
            costUsd: bucket.cost,
            prevUsers: prevBucket ? (prevBucket.active_users ?? 0) : null,
            prevConversations: prevBucket ? prevBucket.conversations : null,
            prevCostUsd: prevBucket ? prevBucket.cost : null,
        };
    });

    return { interval: current.interval, points };
}

const buildLeaderboardEntry = (row: WireUserRow, value: number): LeaderboardEntry => ({
    id: row._id,
    name: (row.name ? [row.name.first, row.name.last].filter(Boolean).join(' ') : '') || 'Unnamed user',
    avatar: row.avatar,
    value,
});

/**
 * `capabilities_used_count` has no server-side sort (`sortBy` only accepts
 * `last_active|conversations|tokens|name|email`), so "Broadest capability use" fetches a
 * larger page and sorts client-side — exact at this tenant's size, approximate past it.
 */
export function buildLeaderboards(mostActive: UsageUsersResponse, broadest: UsageUsersResponse): Leaderboards {
    const broadestSorted = [...broadest.values].sort(
        (a, b) => (b.capabilities_used_count ?? 0) - (a.capabilities_used_count ?? 0),
    );

    return {
        perPersonVisible: mostActive.privacy.per_person_visible,
        mostActive: mostActive.values.map((row) => buildLeaderboardEntry(row, row.conversations ?? 0)),
        broadestCapabilityUse: broadestSorted
            .slice(0, 5)
            .map((row) => buildLeaderboardEntry(row, row.capabilities_used_count ?? 0)),
    };
}

export function buildDistribution(bySecurityGroup: UsageCostBySecurityGroupResponse): Distribution {
    const rows = bySecurityGroup.values;
    // A group below `min_cohort_size` comes back with cost AND activation nulled and
    // `suppressed: true` (AMP-565 gap 4) — excluded from the median so one hidden group
    // can't skew everyone else's "vs. median" reading, and rendered as "Hidden".
    const visibleRatios = rows
        .filter((row) => !row.suppressed && row.activation_rate !== null)
        .map((row) => (row.activation_rate as number) * 100);
    const sorted = [...visibleRatios].sort((a, b) => a - b);
    const median = medianOf(sorted);

    return {
        medianActiveRatio: median,
        formula: `${bySecurityGroup.formula} Activation rate is activated ÷ people in the group; a person in two groups counts in both, so rows do not sum to the tenant total.`,
        source: bySecurityGroup.source,
        rows: rows.map((row) => {
            const suppressed = Boolean(row.suppressed) || row.activation_rate === null;
            const activeRatio = !suppressed ? (row.activation_rate as number) * 100 : 0;

            return {
                groupId: row.security_group_id,
                name: row.name,
                headcount: row.users,
                activated: row.activated_users ?? 0,
                activeRatio,
                deltaVsMedian: suppressed ? 0 : activeRatio - median,
                cost: row.cost ?? 0,
                targetQuery: `securityGroupIds=${row.security_group_id}`,
                suppressed,
                suppressedReason: row.suppressed_reason ?? null,
            };
        }),
    };
}
