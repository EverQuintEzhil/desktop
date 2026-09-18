import { z } from 'zod';

export const routineStatusSchema = z.enum(['active', 'paused']);
export const routineRunStatusSchema = z.enum(['running', 'completed', 'needs_reconnect', 'failed', 'skipped']);
export const routineRunTriggerSchema = z.enum(['schedule', 'manual', 'event']);

export const routineTriggerTypeSchema = z.enum(['cron', 'once', 'manual', 'event']);
export const routineTriggerStatusSchema = z.enum(['active', 'paused', 'spent']);

export const routineRunStepPhaseSchema = z.enum(['plan', 'round', 'report']);
export const routineRunStepStatusSchema = z.enum(['running', 'completed', 'failed']);
export const routineRunStepNoticeSchema = z.enum(['plan_fallback', 'digest_unparseable']);

const WALL_CLOCK_RUN_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

const ISO_RUN_AT_PREFIX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/;

export const toWallClockRunAt = (value: string): string => {
    const trimmed = value.trim();

    if (WALL_CLOCK_RUN_AT.test(trimmed)) return trimmed;

    const match = ISO_RUN_AT_PREFIX.exec(trimmed);

    return match ? match[1] : trimmed;
};

export const routineAgentRefSchema = z.object({
    _id: z.string().min(1),
    name: z.string(),
    slug: z.string(),
});

export const routineProjectRefSchema = z.object({
    _id: z.string().min(1),
    name: z.string(),
});

export const routineModelRefSchema = z.object({
    _id: z.string().min(1),
    label: z.string().nullable().default(null),
    model: z.string(),
});

const eventFilterScalarSchema = z.union([z.string(), z.number(), z.boolean()]);

export const routineEventFilterSchema = z.record(
    z.string(),
    z.union([eventFilterScalarSchema, z.array(eventFilterScalarSchema)]),
);

// `_id: null` with `legacy: true` marks a trigger the api synthesised from a pre-trigger-table
// routine's `cron`/`runOnce`/`runAt` columns: there is no row to address, so it cannot be edited or deleted.
export const routineTriggerSchema = z.object({
    _id: z.string().nullable().default(null),
    routineId: z.string(),
    type: routineTriggerTypeSchema,
    cron: z.string().nullable().default(null),
    runAt: z.string().transform(toWallClockRunAt).nullable().default(null),
    timezone: z.string().default('UTC'),
    eventSource: z.string().nullable().default(null),
    eventFilter: routineEventFilterSchema.nullable().default(null),
    cooldownSeconds: z.number().default(0),
    status: routineTriggerStatusSchema.default('active'),
    lastFiredAt: z.string().nullable().default(null),
    scheduleSyncedAt: z.string().nullable().default(null),
    // False only while Temporal has not confirmed this trigger's schedule; a trigger with no schedule reports true.
    synced: z.boolean().default(true),
    legacy: z.boolean().default(false),
    createdAt: z.string().nullable().default(null),
    updatedAt: z.string().nullable().default(null),
});

const routineEventSourceObjectSchema = z.object({
    id: z.string().min(1).optional(),
    _id: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
});

// `/routines/event-sources` is empty until the api's event ingress flag is on, so the per-item shape is
// unconfirmed: accept a bare source id or any of the id/name spellings and normalise to `{ id, name }`.
export const routineEventSourceSchema = z
    .union([z.string().min(1), routineEventSourceObjectSchema])
    .transform((raw) => {
        if (typeof raw === 'string') return { id: raw, name: raw };

        const id = raw.id ?? raw._id ?? raw.key ?? raw.source ?? '';

        return { id, name: raw.name ?? raw.label ?? id };
    })
    .refine((source) => source.id.length > 0);

/**
 * A person a finished run is emailed (AMP-600). NO `email`: the routines list is Space-scoped,
 * so the api projects recipients through `pickUser` rather than let one Space member harvest
 * another's address. A picker gets addresses from its own candidate list, where `mapMember`
 * already builds the label.
 */
export const routineRecipientSchema = z.object({
    userId: z.string(),
    user: z
        .object({
            _id: z.string().min(1),
            name: z
                .object({
                    first: z.string().nullable().optional(),
                    middle: z.string().nullable().optional(),
                    last: z.string().nullable().optional(),
                })
                .nullable()
                .optional(),
            avatar: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
});

export const routineSchema = z.object({
    _id: z.string().min(1),
    agentId: z.string(),
    name: z.string(),
    prompt: z.string(),
    /** The routine's owner: who the api emails when the recipient list is empty. */
    creatorId: z.string().nullable().optional(),
    // Deprecated mirror of the primary clock, so null once a routine's only triggers are manual or event ones.
    cron: z.string().nullable(),
    timezone: z.string(),
    runOnce: z.boolean().default(false),
    runAt: z.string().transform(toWallClockRunAt).nullable().optional(),
    status: routineStatusSchema,
    lastRunAt: z.string().nullable(),
    /** Temporal's next fire time; absent on a routine that will not fire again. */
    nextRunAt: z.string().nullable().optional(),
    agent: routineAgentRefSchema.nullable().optional(),
    modelId: z.string().nullable().optional(),
    model: routineModelRefSchema.nullable().optional(),
    projectId: z.string().nullable().optional(),
    project: routineProjectRefSchema.nullable().optional(),
    pinnedAt: z.string().nullable().optional(),
    archivedAt: z.string().nullable().optional(),
    emailOnRun: z.boolean().optional(),
    /** Who each finished run is emailed. Empty means the owner alone, not nobody. */
    recipients: z.array(routineRecipientSchema).optional(),
    deepResearch: z.boolean().optional(),
    icon: z.string().nullable().optional(),
    triggers: z.array(routineTriggerSchema).optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const routineRunSchema = z.object({
    _id: z.string().min(1),
    routineId: z.string(),
    status: routineRunStatusSchema,
    trigger: routineRunTriggerSchema,
    conversationId: z.string().nullable(),
    triggerId: z.string().nullable().optional(),
    eventId: z.string().nullable().optional(),
    eventPayload: z.record(z.string(), z.unknown()).nullable().optional(),
    error: z.string(),
    /**
     * The failure class, as a stable string — switch on this to attach an action to the reason
     * rather than reading the sentence (AMP-602). Null on any run that did not fail, and on runs
     * recorded before the column existed.
     *
     * DELIBERATELY `z.string()`, never a `z.enum`: ai adds a class without a migration or a
     * client release, and an enum would drop every run carrying a newer code out of the list.
     * Narrow at the point of use with `RoutineRunErrorCode`.
     */
    errorCode: z.string().nullable().optional(),
    /** What the action needs and the sentence cannot carry, e.g. `{ connectorId, connectorName }`. */
    errorContext: z.record(z.string(), z.unknown()).nullable().optional(),
    startedAt: z.string().min(1),
    finishedAt: z.string().nullable(),
    isRead: z.boolean(),
    routine: z
        .object({
            _id: z.string().min(1),
            name: z.string(),
            agentId: z.string(),
            agent: routineAgentRefSchema.nullable().optional(),
        })
        .nullable()
        .optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const routineRunStepSchema = z.object({
    id: z.number(),
    runId: z.string(),
    phase: routineRunStepPhaseSchema,
    round: z.number().default(0),
    status: routineRunStepStatusSchema,
    modelId: z.string().nullable().default(null),
    messageId: z.string().nullable().default(null),
    queries: z.array(z.string()).default([]),
    sourcesCount: z.number().default(0),
    searchesAttempted: z.number().default(0),
    searchesFailed: z.number().default(0),
    notice: routineRunStepNoticeSchema.nullable().default(null),
    error: z.string().default(''),
    startedAt: z.string(),
    finishedAt: z.string().nullable().default(null),
    model: routineModelRefSchema.nullable().default(null),
});

export const routineRunDetailSchema = routineRunSchema.extend({
    steps: z.array(routineRunStepSchema).default([]),
});

export const EVENT_TRIGGER_COOLDOWN_MIN_SECONDS = 60;
export const EVENT_TRIGGER_COOLDOWN_DEFAULT_SECONDS = 300;
export const ROUTINE_MAX_TRIGGERS = 20;

/** The api caps the recipient list at this; a picker should stop the user before the 400. */
export const ROUTINE_MAX_RECIPIENTS = 25;

/**
 * `GET /routines/connector-health` answers with the agent's connectors and the health of each.
 *
 * THREE states, not two, and the api separates them deliberately: `not_connected` covers a connector
 * never set up (or a started-and-abandoned OAuth flow), while `needs_reconnect` covers one that WAS
 * working and broke. Only the second is worth stopping anyone for - `not_connected` is the resting
 * state of most connectors on an agent, dozens of them on a real account, and the api does not gate
 * a run on those either.
 *
 * Tolerant on purpose: an unrecognised FUTURE value must not read as blocked, because a false
 * warning at create time is worse than a missing one - the run still refuses at the point of use.
 */
export const routineConnectorHealthSchema = z.enum(['ready', 'not_connected', 'needs_reconnect']).catch('ready');

export const routineConnectorSchema = z.object({
    _id: z.string().min(1),
    name: z.string(),
    health: routineConnectorHealthSchema,
});

export const SKIPPED_RUN_REASON = 'This fire produced no research.';
export const NEEDS_RECONNECT_RUN_REASON = 'A connector needs reconnecting before this can run.';

/** The statuses that need their owner to act. */
export const RUN_ATTENTION_STATUSES = ['needs_reconnect', 'failed'] as const;

export const isRunAttentionStatus = (status: RoutineRunStatus): boolean =>
    RUN_ATTENTION_STATUSES.some((entry) => entry === status);

/** Per-routine tallies, kept apart so a chip can word and colour itself from them. */
export interface RunAttentionCounts {
    needsReconnect: number;
    failed: number;
}

export const EMPTY_RUN_ATTENTION: RunAttentionCounts = { needsReconnect: 0, failed: 0 };

/**
 * Mirrors `CODE` in `ai/core/helpers/classify_run_failure.js` (AMP-602). For keying an action
 * map or an exhaustive switch — not for parsing, and never assume it is total: ai can ship a
 * class ahead of app.
 */
export const ROUTINE_RUN_ERROR_CODES = [
    'CONNECTOR_REAUTH_REQUIRED',
    'AGENT_NO_MODEL',
    'MODEL_UNAVAILABLE',
    'MODEL_INCAPABLE',
    'ROUTINE_NO_AGENT',
    'OWNER_MISSING',
    'SCHEDULE_INVALID',
    'APPROVAL_REQUIRED',
    'TOOL_UNAVAILABLE',
    'PROMPT_REJECTED',
    'PROVIDER_REJECTED',
    'PROVIDER_RATE_LIMITED',
    'PROVIDER_UNAVAILABLE',
    'SERVICE_UNAVAILABLE',
    'RUN_TIMED_OUT',
    'UNKNOWN',
] as const;

// `spent` is set by the api when a one-shot fires, never sent by a client.
const routineTriggerWriteStatusSchema = z.enum(['active', 'paused']);

export const routineCronTriggerInputSchema = z.strictObject({
    type: z.literal('cron'),
    cron: z.string().trim().min(1),
    timezone: z.string().default('UTC'),
    status: routineTriggerWriteStatusSchema.default('active'),
});

export const routineOnceTriggerInputSchema = z.strictObject({
    type: z.literal('once'),
    // Wall clock in `timezone`, e.g. `2028-12-25T09:00`, never a UTC instant.
    runAt: z.string().trim().min(1),
    timezone: z.string().default('UTC'),
    status: routineTriggerWriteStatusSchema.default('active'),
});

export const routineManualTriggerInputSchema = z.strictObject({
    type: z.literal('manual'),
    status: routineTriggerWriteStatusSchema.default('active'),
});

export const routineEventTriggerInputSchema = z.strictObject({
    type: z.literal('event'),
    eventSource: z.string().trim().min(1).max(50),
    eventFilter: routineEventFilterSchema.nullable().optional(),
    cooldownSeconds: z
        .number()
        .int()
        .min(EVENT_TRIGGER_COOLDOWN_MIN_SECONDS)
        .default(EVENT_TRIGGER_COOLDOWN_DEFAULT_SECONDS),
    status: routineTriggerWriteStatusSchema.default('active'),
});

export const routineTriggerInputSchema = z.discriminatedUnion('type', [
    routineCronTriggerInputSchema,
    routineOnceTriggerInputSchema,
    routineManualTriggerInputSchema,
    routineEventTriggerInputSchema,
]);

export const routineTriggerListInputSchema = z.array(routineTriggerInputSchema).min(1).max(ROUTINE_MAX_TRIGGERS);

export type RoutineStatus = z.infer<typeof routineStatusSchema>;
export type RoutineConnector = z.infer<typeof routineConnectorSchema>;
export type RoutineConnectorHealth = z.infer<typeof routineConnectorHealthSchema>;
export type RoutineRunStatus = z.infer<typeof routineRunStatusSchema>;
export type RoutineRunTrigger = z.infer<typeof routineRunTriggerSchema>;
export type RoutineTriggerType = z.infer<typeof routineTriggerTypeSchema>;
export type RoutineTriggerStatus = z.infer<typeof routineTriggerStatusSchema>;
export type RoutineRunStepPhase = z.infer<typeof routineRunStepPhaseSchema>;
export type RoutineRunStepStatus = z.infer<typeof routineRunStepStatusSchema>;
export type RoutineRunStepNotice = z.infer<typeof routineRunStepNoticeSchema>;
export type RoutineAgentRef = z.infer<typeof routineAgentRefSchema>;
export type RoutineProjectRef = z.infer<typeof routineProjectRefSchema>;
export type RoutineModelRef = z.infer<typeof routineModelRefSchema>;
export type RoutineRecipient = z.infer<typeof routineRecipientSchema>;
export type RoutineRunErrorCode = (typeof ROUTINE_RUN_ERROR_CODES)[number];
export type RoutineEventFilter = z.infer<typeof routineEventFilterSchema>;
export type RoutineEventSource = z.infer<typeof routineEventSourceSchema>;
export type RoutineTriggerRecord = z.infer<typeof routineTriggerSchema>;
export type RoutineTriggerWriteStatus = z.infer<typeof routineTriggerWriteStatusSchema>;
export type RoutineCronTriggerInput = z.input<typeof routineCronTriggerInputSchema>;
export type RoutineOnceTriggerInput = z.input<typeof routineOnceTriggerInputSchema>;
export type RoutineManualTriggerInput = z.input<typeof routineManualTriggerInputSchema>;
export type RoutineEventTriggerInput = z.input<typeof routineEventTriggerInputSchema>;
export type RoutineTriggerInput = z.input<typeof routineTriggerInputSchema>;
export type RoutineType = z.infer<typeof routineSchema>;
export type RoutineRunType = z.infer<typeof routineRunSchema>;
export type RoutineRunStepType = z.infer<typeof routineRunStepSchema>;
export type RoutineRunDetailType = z.infer<typeof routineRunDetailSchema>;
