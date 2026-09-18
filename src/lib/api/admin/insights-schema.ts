import { z } from 'zod';

export const FAILURE_REASONS = [
    'network',
    'rate_limited',
    'oversized_request',
    'bad_request',
    'bad_tool_response',
    'guardrail_block',
    'application_error',
] as const;

export const FAILURE_REASON_LABELS: Record<FailureReason, string> = {
    network: 'Network',
    rate_limited: 'Rate limited',
    oversized_request: 'Oversized request',
    bad_request: 'Bad request',
    bad_tool_response: 'Bad tool response',
    guardrail_block: 'Guardrail block',
    application_error: 'Application error',
};

export const CAPABILITIES = ['chat', 'incognito', 'builder', 'image', 'video'] as const;

/** The subset of capabilities failures are ever classified under — media failures aren't persisted. */
export const FAILURE_CAPABILITIES = ['chat', 'incognito', 'builder'] as const;
export type FailureCapability = (typeof FAILURE_CAPABILITIES)[number];

export const GOVERNANCE_FLAGS = [
    'never_activated_with_access',
    'dormant',
    'incognito_usage',
    'guardrail_blocks',
] as const;

export const FAILURE_SOURCES = ['conversation', 'routine_run', 'tool_execution'] as const;

export const METRIC_UNITS = ['count', 'percent', 'currency', 'tokens', 'ratio', 'co2'] as const;
export const FRESHNESS_STATUSES = ['fresh', 'lagging', 'stale'] as const;
export const SEVERITIES = ['critical', 'warning', 'notice'] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];
export type Capability = (typeof CAPABILITIES)[number];
export type GovernanceFlag = (typeof GOVERNANCE_FLAGS)[number];
export type FailureSource = (typeof FAILURE_SOURCES)[number];
export type MetricUnit = (typeof METRIC_UNITS)[number];
export type FreshnessStatus = (typeof FRESHNESS_STATUSES)[number];
export type Severity = (typeof SEVERITIES)[number];

// ---------------------------------------------------------------------------
// Wire schemas — these mirror `/reports/usage/*` exactly, per the contract
// Madhu posted on AMP-565. Every field name and nesting matches the real
// response so `schema.parse(response)` is the only translation layer.
// ---------------------------------------------------------------------------

export const wireFreshnessSourceSchema = z.object({
    source: z.string(),
    description: z.string(),
    first_event_at: z.string().nullable(),
    latest_event_at: z.string().nullable(),
    lag_seconds: z.number().nullable(),
});

export const wirePrivacySchema = z.object({
    per_person_visible: z.boolean(),
    min_cohort_size: z.number(),
    source: z.string(),
});

export const wireMetricSchema = z.object({
    value: z.number().nullable(),
    formula: z.string(),
    source: z.string(),
});

export const wireAdoptionSchema = z.object({
    provisioned_users: wireMetricSchema,
    active_users: wireMetricSchema,
    activated_users: wireMetricSchema,
    never_activated_users: wireMetricSchema,
    activation_rate: wireMetricSchema,
    dormant_users: wireMetricSchema,
    conversations: wireMetricSchema,
    requests: wireMetricSchema,
});

/**
 * `dau`/`mau`/`ratio` are per-person derived figures, suppressed like every other one on a
 * tenant with `hide-ai-usage` on — confirmed by Madhu on AMP-565. `days_counted`/`active_days`
 * are structural (how the average was taken), not per-person, so they stay plain numbers.
 */
export const wireStickinessSchema = z.object({
    dau: z.number().nullable(),
    mau: z.number().nullable(),
    ratio: z.number().nullable(),
    days_counted: z.number(),
    active_days: z.number(),
    formula: z.string(),
    source: z.string(),
});

export const wireSpendSchema = z.object({
    tokens: wireMetricSchema,
    cost: wireMetricSchema,
    co2: wireMetricSchema,
});

export const wireGovernanceRowSchema = z.object({
    flag: z.enum(GOVERNANCE_FLAGS),
    users: z.number(),
    formula: z.string(),
    source: z.string(),
});

const wireFailureCountsByReasonSchema = z.object({
    network: z.number(),
    rate_limited: z.number(),
    oversized_request: z.number(),
    bad_request: z.number(),
    bad_tool_response: z.number(),
    guardrail_block: z.number(),
    application_error: z.number(),
});

const wireFailureCountsBySourceSchema = z.object({
    conversation: z.number(),
    routine_run: z.number(),
    tool_execution: z.number(),
    all: z.number(),
});

const wireAttemptsSchema = z.object({
    conversation: z.number(),
    routine_run: z.number(),
    tool_execution: z.number(),
});

// Real response nests a full reason breakdown per capability, not a flat count.
const wireCapabilityFailuresSchema = z.object({
    total: z.number(),
    by_reason: wireFailureCountsByReasonSchema,
});

const wireFailureCountsByCapabilitySchema = z.object({
    chat: wireCapabilityFailuresSchema,
    incognito: wireCapabilityFailuresSchema,
    builder: wireCapabilityFailuresSchema,
});

export const wireFailureTotalsSchema = z.object({
    total: z.number(),
    truncated: z.boolean(),
    by_reason: wireFailureCountsByReasonSchema,
    by_source: wireFailureCountsBySourceSchema,
    by_capability: wireFailureCountsByCapabilitySchema,
    attempts: wireAttemptsSchema,
    formula: z.string(),
    source: z.string(),
});

export const wireCapabilityAdoptionRowSchema = z.object({
    capability: z.enum(CAPABILITIES),
    label: z.string(),
    users: z.number(),
    adoption_rate: z.number(),
    // `image`/`video` failures are never persisted — a media failure returns straight to the
    // caller and there is no document to count — so these come back `null` with
    // `failures_available: false` rather than a `0` that would assert media never fails.
    failures: wireCapabilityFailuresSchema.nullable(),
    failures_available: z.boolean(),
    formula: z.string(),
    source: z.string(),
});

/** `GET /reports/usage/metrics?from&to` */
export type WireFreshnessSource = z.infer<typeof wireFreshnessSourceSchema>;
export type WireMetric = z.infer<typeof wireMetricSchema>;
export type WireStickiness = z.infer<typeof wireStickinessSchema>;

export const usageMetricsResponseSchema = z.object({
    generated_at: z.string(),
    period: z.object({ from: z.string(), to: z.string() }),
    collection_started_at: z.string().nullable().optional(),
    freshness: z.array(wireFreshnessSourceSchema),
    privacy: wirePrivacySchema,
    adoption: wireAdoptionSchema,
    stickiness: wireStickinessSchema,
    spend: wireSpendSchema,
    capability_adoption: z.array(wireCapabilityAdoptionRowSchema),
    governance: z.array(wireGovernanceRowSchema),
    failures: wireFailureTotalsSchema,
});

export type UsageMetricsResponse = z.infer<typeof usageMetricsResponseSchema>;

// --- Failures list -----------------------------------------------------

export const wireFailureEventSchema = z.object({
    source: z.enum(FAILURE_SOURCES),
    id: z.string(),
    occurred_at: z.string(),
    actor_id: z.string().nullable(),
    agent_id: z.string().nullable(),
    conversation_id: z.string().nullable(),
    capability: z.enum(FAILURE_CAPABILITIES).nullable().optional(),
});

export const wireFailureIssueSchema = z.object({
    fingerprint: z.string(),
    reason: z.enum(FAILURE_REASONS),
    capability: z.enum(FAILURE_CAPABILITIES).nullable().optional(),
    agent_id: z.string().nullable(),
    tool_id: z.string().nullable(),
    sources: z.array(z.string()),
    sample_message: z.string(),
    normalized_message: z.string(),
    count: z.number(),
    first_seen: z.string(),
    last_seen: z.string(),
    events: z.array(wireFailureEventSchema),
});

export const wirePageInfoSchema = z.object({
    page: z.number(),
    count: z.number(),
    total_count: z.number(),
    total_pages: z.number(),
});

/** `GET /reports/usage/failures?from&to[&reasons][&agent_id][&fingerprint][&capability][&page][&size]` */
export const usageFailuresResponseSchema = z.object({
    generated_at: z.string(),
    period: z.object({ from: z.string(), to: z.string() }),
    freshness: z.array(wireFreshnessSourceSchema),
    privacy: wirePrivacySchema,
    formula: z.string(),
    source: z.string(),
    totals: z.object({
        events: z.number(),
        by_source: wireFailureCountsBySourceSchema,
        by_reason: wireFailureCountsByReasonSchema,
        by_capability: wireFailureCountsByCapabilitySchema,
        attempts: wireAttemptsSchema,
    }),
    truncated: z.boolean(),
    page_info: wirePageInfoSchema,
    values: z.array(wireFailureIssueSchema),
});

export type UsageFailuresResponse = z.infer<typeof usageFailuresResponseSchema>;

// --- Cost ----------------------------------------------------------------

export const COST_DIMENSIONS = ['tenant', 'security_group', 'agent', 'model'] as const;
export type CostDimension = (typeof COST_DIMENSIONS)[number];

// A row's figures are nullable and `suppressed`/`suppressed_reason` appear together when the
// cohort behind it is below `min_cohort_size` — observed on `dimension=security_group` for a
// 1-2 person group, per Madhu's note on AMP-565 ("a security group below min_cohort_size
// returns suppressed figures, not small ones"). Applied to every dimension defensively.
const costFiguresSchema = z.object({
    requests: z.number().nullable(),
    tokens: z.number().nullable(),
    cost: z.number().nullable(),
    provider_cost: z.number().nullable(),
    co2: z.number().nullable(),
    suppressed: z.boolean().optional(),
    suppressed_reason: z.string().optional(),
});

export const wireCostModelRowSchema = costFiguresSchema.extend({
    // Null when a usage document points at a model that no longer resolves (deleted or
    // reconfigured) — the name/provider denormalised onto the document survive even then.
    model_id: z.string().nullable(),
    model_name: z.string(),
    provider: z.string(),
});

export const wireCostAgentRowSchema = costFiguresSchema.extend({
    agent_id: z.string().nullable(),
    name: z.string(),
});

export const wireCostSecurityGroupRowSchema = costFiguresSchema.extend({
    security_group_id: z.string(),
    name: z.string(),
    users: z.number(),
    // Nulled alongside cost/tokens when the group is suppressed for being below the minimum
    // cohort size — per Madhu's AMP-565 update, "the small-cohort rule now hides activation
    // as well as spend." `activation_rate` is a 0-1 fraction, not a percentage.
    activated_users: z.number().nullable(),
    active_users: z.number().nullable(),
    activation_rate: z.number().nullable(),
});

const wireCostResponseBase = z.object({
    generated_at: z.string(),
    period: z.object({ from: z.string(), to: z.string() }),
    collection_started_at: z.string().nullable().optional(),
    freshness: z.array(wireFreshnessSourceSchema),
    privacy: wirePrivacySchema,
    formula: z.string(),
    source: z.string(),
});

/** `GET /reports/usage/cost?from&to&dimension=model` */
export const usageCostByModelResponseSchema = wireCostResponseBase.extend({
    dimension: z.literal('model'),
    values: z.array(wireCostModelRowSchema),
});

/** `GET /reports/usage/cost?from&to&dimension=security_group` */
export const usageCostBySecurityGroupResponseSchema = wireCostResponseBase.extend({
    dimension: z.literal('security_group'),
    values: z.array(wireCostSecurityGroupRowSchema),
});

export type UsageCostByModelResponse = z.infer<typeof usageCostByModelResponseSchema>;
export type UsageCostBySecurityGroupResponse = z.infer<typeof usageCostBySecurityGroupResponseSchema>;

// --- Time series (AMP-565 gap 1) -----------------------------------------

export const SERIES_INTERVALS = ['day', 'week', 'month'] as const;
export type SeriesInterval = (typeof SERIES_INTERVALS)[number];

export const SERIES_DIMENSIONS = ['tenant', 'model'] as const;
export type SeriesDimension = (typeof SERIES_DIMENSIONS)[number];

const wireSeriesBucketSchema = z.object({
    period_start: z.string(),
    requests: z.number(),
    tokens: z.number(),
    cost: z.number(),
    provider_cost: z.number(),
    co2: z.number(),
    conversations: z.number(),
    // A distinct count *within* this bucket — does not sum across buckets, per Madhu's note.
    // Null on `?dimension=model` buckets specifically — per-model distinct people isn't an
    // aggregation the backend supports, confirmed live, so it's null there rather than wrong.
    active_users: z.number().nullable(),
});

export type WireSeriesBucket = z.infer<typeof wireSeriesBucketSchema>;

const wireSeriesResponseBase = z.object({
    generated_at: z.string(),
    period: z.object({ from: z.string(), to: z.string() }),
    collection_started_at: z.string().nullable().optional(),
    freshness: z.array(wireFreshnessSourceSchema),
    privacy: wirePrivacySchema,
    interval: z.enum(SERIES_INTERVALS),
    formula: z.string(),
    source: z.string(),
});

/** `GET /reports/usage/series?from&to[&interval][&dimension=tenant]` (default dimension) */
export const usageSeriesTenantResponseSchema = wireSeriesResponseBase.extend({
    dimension: z.literal('tenant'),
    values: z.array(wireSeriesBucketSchema),
});

const wireSeriesModelSchema = z.object({
    model_id: z.string().nullable(),
    model_name: z.string(),
    provider: z.string(),
    buckets: z.array(wireSeriesBucketSchema),
});

/** `GET /reports/usage/series?from&to[&interval]&dimension=model` */
export const usageSeriesByModelResponseSchema = wireSeriesResponseBase.extend({
    dimension: z.literal('model'),
    values: z.array(wireSeriesModelSchema),
});

export type UsageSeriesTenantResponse = z.infer<typeof usageSeriesTenantResponseSchema>;
export type UsageSeriesByModelResponse = z.infer<typeof usageSeriesByModelResponseSchema>;

// --- Users -----------------------------------------------------------------

export const USER_SEGMENTS = ['all', 'dormant', 'never_activated', 'power_users', 'admins', 'flagged'] as const;
export type UserSegment = (typeof USER_SEGMENTS)[number];

export const wireUserSecurityGroupRefSchema = z.object({ _id: z.string(), name: z.string() });

export const wireUserActivitySchema = z.object({
    buckets: z.array(z.string()),
    values: z.array(z.number()),
});

export const wireUserRowSchema = z.object({
    _id: z.string(),
    // Null on `GET /reports/usage/users/:userId` for an id that never resolved to a person —
    // that endpoint always returns a `user` object (never `null`), with every field nulled
    // out and `exists: false` rather than a 404, so nullability has to reach every field below.
    name: z
        .object({
            // Some legacy records omit `middle` entirely rather than carrying it as null —
            // `.optional()` alongside `.nullable()` tolerates both, not just the latter.
            first: z.string().nullable().optional(),
            middle: z.string().nullable().optional(),
            last: z.string().nullable().optional(),
        })
        .nullable(),
    email: z.string().nullable(),
    avatar: z.string().nullable(),
    role: z.string().nullable(),
    portal_access_enabled: z.boolean(),
    is_deleted: z.boolean(),
    activated: z.boolean().nullable(),
    activated_at: z.string().nullable(),
    last_active_at: z.string().nullable(),
    conversations: z.number().nullable(),
    requests: z.number().nullable(),
    tokens: z.number().nullable(),
    cost: z.number().nullable(),
    co2: z.number().nullable(),
    capabilities_used: z.array(z.string()).nullable(),
    capabilities_used_count: z.number().nullable(),
    flags: z.array(z.string()),
    is_dormant: z.boolean().nullable(),
    is_power_user: z.boolean().nullable(),
    /** Only on `GET /reports/usage/users/:userId` — true unless the id never resolved to a person. */
    exists: z.boolean().optional(),
    security_groups: z.array(wireUserSecurityGroupRefSchema),
    activity: wireUserActivitySchema.nullable(),
    suppressed: z.boolean().optional(),
    suppressed_reason: z.string().optional(),
});

export type WireUserRow = z.infer<typeof wireUserRowSchema>;

/** `GET /reports/usage/users?from&to[&segment][&search][&sortBy][&page][&size]` */
export const usageUsersResponseSchema = z.object({
    generated_at: z.string(),
    period: z.object({ from: z.string(), to: z.string() }),
    collection_started_at: z.string().nullable().optional(),
    freshness: z.array(wireFreshnessSourceSchema),
    privacy: wirePrivacySchema,
    formulas: z.record(z.string(), z.object({ formula: z.string(), source: z.string() })),
    segment: z.string(),
    page_info: wirePageInfoSchema,
    truncated: z.boolean(),
    values: z.array(wireUserRowSchema),
});

export type UsageUsersResponse = z.infer<typeof usageUsersResponseSchema>;

/**
 * `GET /reports/usage/users/:userId?from&to` — confirmed live: `user` is always an object
 * (never `null`), with every field nulled out and `user.exists: false` for an id that never
 * resolved to a person, rather than a 404 or a top-level flag.
 */
export const usageUserDetailResponseSchema = z.object({
    generated_at: z.string(),
    period: z.object({ from: z.string(), to: z.string() }),
    user: wireUserRowSchema,
});

export type UsageUserDetailResponse = z.infer<typeof usageUserDetailResponseSchema>;

// --- Writes ------------------------------------------------------------

export const bulkUsersResultRowSchema = z.object({
    _id: z.string(),
    // Nullable for the same reason as `wireUserRowSchema.name`/`.email` — a row this endpoint
    // reaches can belong to a person whose record is gone.
    name: z.string().nullable(),
    email: z.string().nullable(),
    success: z.boolean(),
    applied: z.array(z.string()),
    message: z.string().nullable().optional(),
});

export const bulkUsersResponseSchema = z.object({
    requested: z.number(),
    succeeded: z.number(),
    failed: z.number(),
    results: z.array(bulkUsersResultRowSchema),
});

export type BulkUsersResponse = z.infer<typeof bulkUsersResponseSchema>;

export const userSecurityGroupMembershipSchema = z.object({
    _id: z.string(),
    name: z.string(),
    direct: z.boolean(),
});

export type UserSecurityGroupMembership = z.infer<typeof userSecurityGroupMembershipSchema>;

// ---------------------------------------------------------------------------
// View models — what the Usage Report components render. Assembled by
// `insights-adapters.ts` from the wire responses above. `series` and
// `previousValue` come from `GET /reports/usage/series` (AMP-565 gap 1) —
// real bucket-over-bucket data — and are simply absent (empty array / null)
// for the handful of metrics that endpoint has no equivalent field for
// (activation rate, governance flags), rather than faked.
// ---------------------------------------------------------------------------

export const metricSchema = z.object({
    key: z.string(),
    label: z.string(),
    value: z.number(),
    valueIsHidden: z.boolean(),
    unit: z.enum(METRIC_UNITS),
    previousValue: z.number().nullable(),
    denominator: z.object({ value: z.number(), label: z.string() }).nullable(),
    series: z.array(z.number()),
    /** e.g. "vs previous week" — null when there is no series data behind this metric. */
    trendLabel: z.string().nullable(),
    formula: z.string(),
    source: z.string(),
    why: z.string(),
    collectionStartedAt: z.string().nullable(),
    attention: z.boolean(),
    targetQuery: z.string().nullable(),
});

export const freshnessSourceSchema = z.object({
    source: z.string(),
    lastEventAt: z.string().nullable(),
    lagSeconds: z.number().nullable(),
    status: z.enum(FRESHNESS_STATUSES),
});

export const insightsSummarySchema = z.object({
    generatedAt: z.string(),
    timezone: z.string(),
    perPersonAnalyticsEnabled: z.boolean(),
    headline: z.string(),
    kpis: z.array(metricSchema),
    trend: z.array(metricSchema),
    freshness: z.array(freshnessSourceSchema),
});

export const funnelStageSchema = z.object({
    key: z.string(),
    label: z.string(),
    count: z.number(),
    percentOfPrevious: z.number().nullable(),
    gap: z
        .object({
            count: z.number(),
            note: z.string(),
            action: z.string(),
            filterQuery: z.string(),
        })
        .nullable(),
});

export const activationFunnelSchema = z.object({
    stages: z.array(funnelStageSchema),
    formula: z.string(),
    source: z.string(),
});

export const capabilityRowSchema = z.object({
    id: z.string(),
    name: z.string(),
    activeUsers: z.number(),
    adoptionRate: z.number(),
    // `null` + `failuresAvailable: false` for image/video — media failures aren't persisted.
    failures: z.record(z.enum(FAILURE_REASONS), z.number()).nullable(),
    failuresAvailable: z.boolean(),
    failuresTotal: z.number(),
    formula: z.string(),
    source: z.string(),
});

export const capabilitiesSchema = z.object({
    rows: z.array(capabilityRowSchema),
    activeUsers: z.number(),
    formula: z.string(),
    source: z.string(),
});

export const failureEventViewSchema = z.object({
    source: z.enum(FAILURE_SOURCES),
    id: z.string(),
    occurredAt: z.string(),
    agentId: z.string().nullable(),
    conversationId: z.string().nullable(),
});

export const failureIssueSchema = z.object({
    fingerprint: z.string(),
    reason: z.enum(FAILURE_REASONS),
    capability: z.enum(FAILURE_CAPABILITIES).nullable(),
    agentId: z.string().nullable(),
    toolId: z.string().nullable(),
    normalizedMessage: z.string(),
    sampleMessage: z.string(),
    count: z.number(),
    firstSeenAt: z.string(),
    lastSeenAt: z.string(),
    events: z.array(failureEventViewSchema),
    eventsTruncated: z.boolean(),
});

export const failuresSchema = z.object({
    totalEvents: z.number(),
    byReason: z.record(z.enum(FAILURE_REASONS), z.number()),
    byCapability: z.record(z.enum(FAILURE_CAPABILITIES), z.number()),
    attempts: wireAttemptsSchema,
    formula: z.string(),
    source: z.string(),
    truncated: z.boolean(),
    totalIssues: z.number(),
    issues: z.array(failureIssueSchema),
});

export const modelRowSchema = z.object({
    id: z.string(),
    name: z.string(),
    provider: z.string(),
    costUsd: z.number(),
    costShare: z.number(),
    tokens: z.number(),
    co2Kg: z.number(),
});

export const costMoverSchema = z.object({
    // Distinct from `label` — two models can share a display name across providers
    // (e.g. "gpt-5.4-mini" on both `azure.responses` and `openai.responses`), so a
    // React list key needs this rather than the label.
    id: z.string(),
    label: z.string(),
    detail: z.string(),
    deltaUsd: z.number(),
});

export const consumptionBucketSchema = z.object({
    bucket: z.string(),
    costUsd: z.number(),
    co2Kg: z.number(),
    tokens: z.number(),
});

export const consumptionSchema = z.object({
    headline: z.string(),
    spend: metricSchema,
    costPerConversation: metricSchema,
    carbon: metricSchema,
    tokens: metricSchema,
    models: z.array(modelRowSchema),
    movers: z.array(costMoverSchema),
    series: z.array(consumptionBucketSchema),
});

// Reverted to the originally-scoped activation-rate distribution now that
// `cost?dimension=security_group` carries `activated_users`/`active_users`/`activation_rate`
// (AMP-565 gap 4) — cost rides along on the same row since it's already on the response.
export const distributionRowSchema = z.object({
    groupId: z.string(),
    name: z.string(),
    headcount: z.number(),
    activated: z.number(),
    activeRatio: z.number(),
    deltaVsMedian: z.number(),
    cost: z.number(),
    targetQuery: z.string(),
    suppressed: z.boolean(),
    suppressedReason: z.string().nullable(),
});

export const distributionSchema = z.object({
    medianActiveRatio: z.number(),
    formula: z.string(),
    source: z.string(),
    rows: z.array(distributionRowSchema),
});

export const watchlistFlagSchema = z.object({
    key: z.string(),
    label: z.string(),
    detail: z.string(),
    /** The API's own wording, kept for the tooltip the ticket asks every figure to carry. */
    formula: z.string(),
    count: z.number(),
    severity: z.enum(SEVERITIES),
    targetQuery: z.string(),
});

export const watchlistSchema = z.object({
    flags: z.array(watchlistFlagSchema),
    retentionNote: z.string(),
});

export const adoptionTrendPointSchema = z.object({
    bucket: z.string(),
    users: z.number(),
    conversations: z.number(),
    costUsd: z.number(),
    /** Same bucket, one period earlier — null past the shorter of the two series. */
    prevUsers: z.number().nullable(),
    prevConversations: z.number().nullable(),
    prevCostUsd: z.number().nullable(),
});

export const adoptionTrendSchema = z.object({
    interval: z.enum(SERIES_INTERVALS),
    points: z.array(adoptionTrendPointSchema),
});

export const leaderboardEntrySchema = z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string().nullable(),
    value: z.number(),
});

export const leaderboardsSchema = z.object({
    /** Both lists come from the same tenant-wide privacy flag, so one covers both. */
    perPersonVisible: z.boolean(),
    mostActive: z.array(leaderboardEntrySchema),
    broadestCapabilityUse: z.array(leaderboardEntrySchema),
});

export type Metric = z.infer<typeof metricSchema>;
export type FreshnessSource = z.infer<typeof freshnessSourceSchema>;
export type InsightsSummary = z.infer<typeof insightsSummarySchema>;
export type FunnelStage = z.infer<typeof funnelStageSchema>;
export type ActivationFunnel = z.infer<typeof activationFunnelSchema>;
export type CapabilityRow = z.infer<typeof capabilityRowSchema>;
export type Capabilities = z.infer<typeof capabilitiesSchema>;
export type FailureEventView = z.infer<typeof failureEventViewSchema>;
export type FailureIssue = z.infer<typeof failureIssueSchema>;
export type Failures = z.infer<typeof failuresSchema>;
export type ModelRow = z.infer<typeof modelRowSchema>;
export type CostMover = z.infer<typeof costMoverSchema>;
export type ConsumptionBucket = z.infer<typeof consumptionBucketSchema>;
export type Consumption = z.infer<typeof consumptionSchema>;
export type DistributionRow = z.infer<typeof distributionRowSchema>;
export type Distribution = z.infer<typeof distributionSchema>;
export type WatchlistFlag = z.infer<typeof watchlistFlagSchema>;
export type Watchlist = z.infer<typeof watchlistSchema>;
export type AdoptionTrendPoint = z.infer<typeof adoptionTrendPointSchema>;
export type AdoptionTrend = z.infer<typeof adoptionTrendSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type Leaderboards = z.infer<typeof leaderboardsSchema>;
