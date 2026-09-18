import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, pagedEnvelope, respond, server } from '@/test/msw';
import {
    EVENT_TRIGGER_COOLDOWN_DEFAULT_SECONDS,
    routineRunDetailSchema,
    routineRunSchema,
    routineSchema,
    routineTriggerInputSchema,
    routineTriggerListInputSchema,
    toWallClockRunAt,
    type RoutineRunType,
} from '@/types/routines';

import {
    appRoutinesApi,
    clearManualRunWindow,
    markManualRunStarted,
    RUNS_ACTIVE_POLL_MS,
    runDetailPollInterval,
    UNREAD_RUNS_ACTIVE_POLL_MS,
    UNREAD_RUNS_IDLE_POLL_MS,
    unreadRunsPollInterval,
} from './routines';

const run = (overrides: Partial<RoutineRunType> = {}): Record<string, unknown> => ({
    _id: 'run-1',
    routineId: 'routine-1',
    status: 'completed',
    trigger: 'schedule',
    conversationId: 'conv-1',
    error: '',
    startedAt: '2026-08-20T09:00:00.000Z',
    finishedAt: '2026-08-20T09:10:00.000Z',
    isRead: false,
    createdAt: '2026-08-20T09:00:00.000Z',
    updatedAt: '2026-08-20T09:10:00.000Z',
    creatorId: 'user-1',
    isDeleted: false,
    ...overrides,
});

// Byte for byte what `format_routine.js` emits after `pickUser`: no email, and no isDeleted.
const recipient = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    userId: 'user-2',
    user: { _id: 'user-2', name: { first: 'Ada', last: 'Lovelace' }, avatar: '' },
    ...overrides,
});

const routine = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    _id: 'routine-1',
    agentId: 'agent-1',
    name: 'Weekly digest',
    prompt: 'Research the market',
    cron: '0 9 * * 1',
    timezone: 'UTC',
    status: 'active',
    lastRunAt: null,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    creatorId: 'user-1',
    isDeleted: false,
    ...overrides,
});

describe('appRoutinesApi.listAllRuns', () => {
    it('keeps rows the schema accepts and drops the malformed ones', async () => {
        server.use(
            respond('get', '/routines/runs', () =>
                pagedEnvelope([
                    run(),
                    run({ _id: 'run-2', status: 'archived' as RoutineRunType['status'] }),
                    { _id: 'run-3' },
                    null,
                ]),
            ),
        );

        const page = await appRoutinesApi.listAllRuns({ unreadOnly: true });

        expect(page.values.map((item) => item._id)).toEqual(['run-1']);
    });

    it('strips keys the UI does not read', async () => {
        server.use(respond('get', '/routines/runs', () => pagedEnvelope([run()])));

        const page = await appRoutinesApi.listAllRuns();

        expect(page.values[0]).not.toHaveProperty('isDeleted');
    });

    it('returns an empty page rather than throwing when every row is malformed', async () => {
        server.use(respond('get', '/routines/runs', () => pagedEnvelope([{ _id: 'run-1' }])));

        await expect(appRoutinesApi.listAllRuns()).resolves.toEqual({
            values: [],
            pageInfo: { page: 0, totalPages: 1, totalCount: 1 },
        });
    });
});

describe('appRoutinesApi.list', () => {
    it('drops routines that fail to parse and keeps the rest', async () => {
        server.use(
            respond('get', '/routines', () =>
                pagedEnvelope([
                    routine(),
                    routine({ _id: 'routine-2', status: 'draft' }),
                    routine({ _id: 'routine-3', agent: { _id: 'agent-1', name: 'Research', slug: 'research' } }),
                ]),
            ),
        );

        const page = await appRoutinesApi.list();

        expect(page.values.map((item) => item._id)).toEqual(['routine-1', 'routine-3']);
    });

    // The api defaults a new routine's recipients to its owner, so every routine created since
    // AMP-600 shipped arrives with one row. A schema demanding a field the api does not send
    // therefore loses exactly the newest routines, and loses them silently.
    it('keeps a routine carrying recipients in the list', async () => {
        server.use(respond('get', '/routines', () => pagedEnvelope([routine({ recipients: [recipient()] })])));

        const page = await appRoutinesApi.list();

        expect(page.values.map((item) => item._id)).toEqual(['routine-1']);
    });
});

describe('unreadRunsPollInterval', () => {
    it('polls fast while a listed run is still running', () => {
        expect(unreadRunsPollInterval([{ status: 'completed' }, { status: 'running' }])).toBe(
            UNREAD_RUNS_ACTIVE_POLL_MS,
        );
    });

    it('falls back to the slow interval when nothing is running', () => {
        expect(unreadRunsPollInterval([{ status: 'completed' }, { status: 'failed' }])).toBe(UNREAD_RUNS_IDLE_POLL_MS);
        expect(unreadRunsPollInterval([])).toBe(UNREAD_RUNS_IDLE_POLL_MS);
    });
});

describe('toWallClockRunAt', () => {
    it('strips the fractional seconds and the zone the api emits', () => {
        expect(toWallClockRunAt('2028-12-25T09:00:00.000Z')).toBe('2028-12-25T09:00:00');
    });

    it('strips an offset suffix', () => {
        expect(toWallClockRunAt('2028-12-25T09:00:00+05:30')).toBe('2028-12-25T09:00:00');
    });

    it('leaves an already wall-clock value untouched', () => {
        expect(toWallClockRunAt('2028-12-25T09:00:00')).toBe('2028-12-25T09:00:00');
        expect(toWallClockRunAt('2028-12-25T09:00')).toBe('2028-12-25T09:00');
    });

    it('trims surrounding whitespace', () => {
        expect(toWallClockRunAt('  2028-12-25T09:00:00.000Z ')).toBe('2028-12-25T09:00:00');
    });

    it('passes an unrecognised value through unchanged', () => {
        expect(toWallClockRunAt('not-a-date')).toBe('not-a-date');
        expect(toWallClockRunAt('')).toBe('');
    });
});

describe('routineSchema runAt', () => {
    const oneShot = (runAt: unknown): Record<string, unknown> =>
        routine({
            cron: '0 9 25 12 *',
            runOnce: true,
            ...(runAt === undefined ? {} : { runAt }),
        });

    it('normalises the literal server shape to a wall clock', () => {
        expect(routineSchema.parse(oneShot('2028-12-25T09:00:00.000Z')).runAt).toBe('2028-12-25T09:00:00');
    });

    it('keeps the year the api sent', () => {
        expect(routineSchema.parse(oneShot('2028-02-29T23:59:00.000Z')).runAt).toBe('2028-02-29T23:59:00');
    });

    it('keeps a wall-clock value the api may already send', () => {
        expect(routineSchema.parse(oneShot('2028-12-25T09:00:00')).runAt).toBe('2028-12-25T09:00:00');
    });

    it('accepts a null run-at', () => {
        expect(routineSchema.parse(oneShot(null)).runAt).toBeNull();
    });

    it('accepts a missing run-at', () => {
        expect(routineSchema.parse(oneShot(undefined)).runAt).toBeUndefined();
    });
});

describe('appRoutinesApi.list runAt', () => {
    it('hands the UI a wall-clock run-at for the year the api sent', async () => {
        server.use(
            respond('get', '/routines', () =>
                pagedEnvelope([routine({ cron: '0 9 25 12 *', runOnce: true, runAt: '2028-12-25T09:00:00.000Z' })]),
            ),
        );

        const page = await appRoutinesApi.list();

        expect(page.values[0].runAt).toBe('2028-12-25T09:00:00');
    });
});

describe('appRoutinesApi mutations', () => {
    const oneShot = routine({ cron: '0 9 25 12 *', runOnce: true, runAt: '2028-12-25T09:00:00.000Z' });

    it('normalises the run-at a create returns', async () => {
        server.use(respond('post', '/routines', () => envelope(oneShot)));

        const created = await appRoutinesApi.create({
            name: 'Holiday brief',
            prompt: 'Research the market',
            agentId: 'agent-1',
            triggers: [{ type: 'once', runAt: '2028-12-25T09:00:00', timezone: 'UTC' }],
        });

        expect(created.runAt).toBe('2028-12-25T09:00:00');
        expect(created).not.toHaveProperty('isDeleted');
        // Kept, unlike the rest: an empty recipient list means the owner, so the picker has to
        // know who that is before it can stand them in (AMP-600).
        expect(created).toHaveProperty('creatorId', 'user-1');
    });

    it('normalises the run-at an update returns', async () => {
        server.use(respond('put', '/routines/routine-1', () => envelope(oneShot)));

        const updated = await appRoutinesApi.update('routine-1', { name: 'Holiday brief' });

        expect(updated.runAt).toBe('2028-12-25T09:00:00');
    });

    it('rejects a mutation response the schema refuses', async () => {
        server.use(respond('put', '/routines/routine-1', () => envelope({ _id: 'routine-1' })));

        await expect(appRoutinesApi.update('routine-1', { name: 'Holiday brief' })).rejects.toThrow();
    });
});

const trigger = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    _id: 'trigger-1',
    routineId: 'routine-1',
    type: 'cron',
    cron: '0 9 * * 1',
    runAt: null,
    timezone: 'UTC',
    eventSource: null,
    eventFilter: null,
    cooldownSeconds: 0,
    status: 'active',
    lastFiredAt: null,
    scheduleSyncedAt: '2026-08-01T09:00:00.000Z',
    synced: true,
    creatorId: 'user-1',
    updatedById: 'user-1',
    isDeleted: false,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    ...overrides,
});

const legacyTrigger = (): Record<string, unknown> => ({
    _id: null,
    routineId: 'routine-1',
    type: 'once',
    cron: null,
    runAt: '2028-12-25T09:00:00.000Z',
    timezone: 'Europe/London',
    eventSource: null,
    eventFilter: null,
    cooldownSeconds: 0,
    status: 'active',
    lastFiredAt: null,
    scheduleSyncedAt: null,
    legacy: true,
    synced: true,
});

const step = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 1,
    runId: 'run-1',
    phase: 'plan',
    round: 0,
    status: 'completed',
    modelId: 'model-1',
    messageId: 'message-1',
    queries: ['market size'],
    sourcesCount: 4,
    searchesAttempted: 5,
    searchesFailed: 2,
    notice: 'plan_fallback',
    error: '',
    startedAt: '2026-08-20T09:00:00.000Z',
    finishedAt: '2026-08-20T09:01:00.000Z',
    model: { _id: 'model-1', label: null, model: 'claude-opus-4' },
    ...overrides,
});

describe('routineSchema against both backend releases', () => {
    it('parses a response carrying none of the new fields', () => {
        const parsed = routineSchema.parse(routine());

        expect(parsed.triggers).toBeUndefined();
        expect(parsed.pinnedAt).toBeUndefined();
        expect(parsed.archivedAt).toBeUndefined();
        expect(parsed.model).toBeUndefined();
        expect(parsed.emailOnRun).toBeUndefined();
        expect(parsed.icon).toBeUndefined();
        expect(parsed.recipients).toBeUndefined();
    });

    it('parses a recipient in the shape the api emits, which carries no email', () => {
        const parsed = routineSchema.parse(routine({ recipients: [recipient()] }));

        expect(parsed.recipients).toEqual([
            { userId: 'user-2', user: { _id: 'user-2', name: { first: 'Ada', last: 'Lovelace' }, avatar: '' } },
        ]);
    });

    it('parses an empty recipient list, which means the owner alone', () => {
        expect(routineSchema.parse(routine({ recipients: [] })).recipients).toEqual([]);
    });

    it('parses a response carrying every new field', () => {
        const parsed = routineSchema.parse(
            routine({
                modelId: 'model-1',
                model: { _id: 'model-1', label: 'Opus', model: 'claude-opus-4' },
                projectId: 'project-1',
                project: { _id: 'project-1', name: 'Market intel' },
                pinnedAt: '2026-08-02T09:00:00.000Z',
                archivedAt: null,
                emailOnRun: true,
                icon: 'trending-up',
                triggers: [trigger(), legacyTrigger()],
            }),
        );

        expect(parsed.model).toEqual({ _id: 'model-1', label: 'Opus', model: 'claude-opus-4' });
        expect(parsed.emailOnRun).toBe(true);
        expect(parsed.icon).toBe('trending-up');
        expect(parsed.triggers).toHaveLength(2);
    });

    it('keeps a synthesised trigger addressable as legacy with no id', () => {
        const parsed = routineSchema.parse(routine({ triggers: [legacyTrigger()] }));

        expect(parsed.triggers?.[0]).toMatchObject({
            _id: null,
            legacy: true,
            type: 'once',
            runAt: '2028-12-25T09:00:00',
        });
    });

    it('marks a real trigger as not legacy', () => {
        const parsed = routineSchema.parse(routine({ triggers: [trigger()] }));

        expect(parsed.triggers?.[0].legacy).toBe(false);
        expect(parsed.triggers?.[0].synced).toBe(true);
    });

    it('accepts a null cron, which a manual-only routine has', () => {
        const parsed = routineSchema.parse(
            routine({ cron: null, triggers: [trigger({ type: 'manual', cron: null })] }),
        );

        expect(parsed.cron).toBeNull();
    });

    it('keeps an unsynced trigger rather than dropping the routine', () => {
        const parsed = routineSchema.parse(routine({ triggers: [trigger({ synced: false, scheduleSyncedAt: null })] }));

        expect(parsed.triggers?.[0].synced).toBe(false);
    });

    it('parses an event trigger with a filter', () => {
        const parsed = routineSchema.parse(
            routine({
                triggers: [
                    trigger({
                        type: 'event',
                        cron: null,
                        eventSource: 'microsoft-graph-email',
                        eventFilter: { from: 'a@b.com', labels: ['rfp', 'bid'] },
                        cooldownSeconds: 300,
                    }),
                ],
            }),
        );

        expect(parsed.triggers?.[0].eventFilter).toEqual({ from: 'a@b.com', labels: ['rfp', 'bid'] });
    });
});

describe('routineRunSchema new fields', () => {
    it('accepts the skipped status and the event trigger the api can now send', () => {
        const parsed = routineRunSchema.parse(
            run({
                status: 'skipped',
                trigger: 'event',
                triggerId: 'trigger-1',
                eventId: 'manual-abc',
                eventPayload: { subject: 'RFP' },
            }),
        );

        expect(parsed.status).toBe('skipped');
        expect(parsed.trigger).toBe('event');
        expect(parsed.eventPayload).toEqual({ subject: 'RFP' });
    });

    it('parses a failed run carrying its class and the context an action needs', () => {
        const parsed = routineRunSchema.parse(
            run({
                status: 'failed',
                error: 'Reconnect Microsoft 365 to run this routine.',
                errorCode: 'CONNECTOR_REAUTH_REQUIRED',
                errorContext: { connectorId: 'connector-1', connectorName: 'Microsoft 365' },
            }),
        );

        expect(parsed.errorCode).toBe('CONNECTOR_REAUTH_REQUIRED');
        expect(parsed.errorContext).toEqual({ connectorId: 'connector-1', connectorName: 'Microsoft 365' });
    });

    it('parses a run recorded before the failure columns existed', () => {
        const parsed = routineRunSchema.parse(run({ status: 'failed', error: 'Deep research run failed.' }));

        expect(parsed.errorCode).toBeUndefined();
        expect(parsed.errorContext).toBeUndefined();
    });

    // The ai side adds a class without a migration or a client release, so a code this build has
    // never seen has to survive parsing. Turning errorCode into a z.enum breaks exactly this.
    it('keeps a code shipped after this build rather than dropping the run', () => {
        const parsed = routineRunSchema.parse(run({ status: 'failed', errorCode: 'A_CLASS_FROM_A_LATER_RELEASE' }));

        expect(parsed.errorCode).toBe('A_CLASS_FROM_A_LATER_RELEASE');
    });
});

describe('routineRunDetailSchema', () => {
    it('parses a run with its steps', () => {
        const parsed = routineRunDetailSchema.parse({
            ...run(),
            steps: [step(), step({ id: 2, phase: 'round', round: 1, notice: null })],
        });

        expect(parsed.steps.map((item) => item.phase)).toEqual(['plan', 'round']);
        expect(parsed.steps[0].model).toEqual({ _id: 'model-1', label: null, model: 'claude-opus-4' });
        expect(parsed.steps[0].notice).toBe('plan_fallback');
    });

    it('defaults steps to empty for a run the api answered without them', () => {
        expect(routineRunDetailSchema.parse(run()).steps).toEqual([]);
    });
});

describe('routineTriggerInputSchema', () => {
    it('accepts each trigger type', () => {
        expect(routineTriggerInputSchema.parse({ type: 'cron', cron: '0 9 * * 1' })).toEqual({
            type: 'cron',
            cron: '0 9 * * 1',
            timezone: 'UTC',
            status: 'active',
        });
        expect(routineTriggerInputSchema.parse({ type: 'once', runAt: '2028-12-25T09:00' })).toMatchObject({
            type: 'once',
            runAt: '2028-12-25T09:00',
        });
        expect(routineTriggerInputSchema.parse({ type: 'manual' })).toEqual({ type: 'manual', status: 'active' });
        expect(routineTriggerInputSchema.parse({ type: 'event', eventSource: 'email' })).toMatchObject({
            type: 'event',
            eventSource: 'email',
            cooldownSeconds: EVENT_TRIGGER_COOLDOWN_DEFAULT_SECONDS,
        });
    });

    it('rejects a payload field that belongs to another type', () => {
        expect(
            routineTriggerInputSchema.safeParse({ type: 'cron', cron: '0 9 * * 1', runAt: '2028-12-25T09:00' }).success,
        ).toBe(false);
        expect(routineTriggerInputSchema.safeParse({ type: 'manual', cron: '0 9 * * 1' }).success).toBe(false);
        expect(
            routineTriggerInputSchema.safeParse({ type: 'event', eventSource: 'email', cron: '0 9 * * 1' }).success,
        ).toBe(false);
        expect(routineTriggerInputSchema.safeParse({ type: 'once', cron: '0 9 * * 1' }).success).toBe(false);
    });

    it('rejects a missing per-type payload', () => {
        expect(routineTriggerInputSchema.safeParse({ type: 'cron' }).success).toBe(false);
        expect(routineTriggerInputSchema.safeParse({ type: 'once' }).success).toBe(false);
        expect(routineTriggerInputSchema.safeParse({ type: 'event' }).success).toBe(false);
    });

    it('rejects an unknown type and a cooldown under the floor', () => {
        expect(routineTriggerInputSchema.safeParse({ type: 'webhook' }).success).toBe(false);
        expect(
            routineTriggerInputSchema.safeParse({ type: 'event', eventSource: 'email', cooldownSeconds: 30 }).success,
        ).toBe(false);
    });

    it('refuses an empty trigger list, which would leave a routine unable to fire', () => {
        expect(routineTriggerListInputSchema.safeParse([]).success).toBe(false);
        expect(routineTriggerListInputSchema.safeParse([{ type: 'manual' }]).success).toBe(true);
    });
});

describe('appRoutinesApi routine state endpoints', () => {
    it('toggles a pin with PUT /routines/:id/pin', async () => {
        server.use(
            respond('put', '/routines/routine-1/pin', () =>
                envelope(routine({ pinnedAt: '2026-08-02T09:00:00.000Z' })),
            ),
        );

        await expect(appRoutinesApi.pin('routine-1')).resolves.toMatchObject({ pinnedAt: '2026-08-02T09:00:00.000Z' });
    });

    it('archives with POST /routines/:id/archive', async () => {
        server.use(
            respond('post', '/routines/routine-1/archive', () =>
                envelope(routine({ archivedAt: '2026-08-02T09:00:00.000Z', status: 'paused' })),
            ),
        );

        await expect(appRoutinesApi.archive('routine-1')).resolves.toMatchObject({
            archivedAt: '2026-08-02T09:00:00.000Z',
        });
    });

    it('unarchives with POST /routines/:id/unarchive', async () => {
        server.use(respond('post', '/routines/routine-1/unarchive', () => envelope(routine({ archivedAt: null }))));

        await expect(appRoutinesApi.unarchive('routine-1')).resolves.toMatchObject({ archivedAt: null });
    });

    it('sends the archived and pinned filters as query params', async () => {
        let query = '';

        server.use(
            http.get(apiUrl('/routines'), ({ request }) => {
                query = new URL(request.url).search;

                return pagedEnvelope([routine()]);
            }),
        );

        await appRoutinesApi.list({ archived: true, pinned: false, search: 'digest' });

        expect(query).toContain('archived=true');
        expect(query).toContain('pinned=false');
    });
});

describe('appRoutinesApi run detail', () => {
    it('reads one run with its steps from GET /routines/:id/runs/:runId', async () => {
        server.use(respond('get', '/routines/routine-1/runs/run-1', () => envelope({ ...run(), steps: [step()] })));

        const detail = await appRoutinesApi.getRun('routine-1', 'run-1');

        expect(detail.steps).toHaveLength(1);
        expect(detail.steps[0].phase).toBe('plan');
    });

    it('drops the steps that fail to parse and still returns the run', async () => {
        server.use(
            respond('get', '/routines/routine-1/runs/run-1', () =>
                envelope({
                    ...run(),
                    steps: [
                        step(),
                        step({ id: 2, phase: 'summarise' }),
                        step({ id: '3' }),
                        step({ id: 4, notice: 'digest_truncated' }),
                        null,
                        step({ id: 5, phase: 'report' }),
                    ],
                }),
            ),
        );

        const detail = await appRoutinesApi.getRun('routine-1', 'run-1');

        expect(detail._id).toBe('run-1');
        expect(detail.steps.map((item) => item.id)).toEqual([1, 5]);
    });

    it('returns the run with no steps rather than throwing when every step is malformed', async () => {
        server.use(
            respond('get', '/routines/routine-1/runs/run-1', () => envelope({ ...run(), steps: [{ id: 1 }, 'plan'] })),
        );

        const detail = await appRoutinesApi.getRun('routine-1', 'run-1');

        expect(detail.steps).toEqual([]);
    });

    it('returns the run with no steps rather than throwing when steps is not an array', async () => {
        server.use(respond('get', '/routines/routine-1/runs/run-1', () => envelope({ ...run(), steps: 'plan' })));

        await expect(appRoutinesApi.getRun('routine-1', 'run-1')).resolves.toMatchObject({ steps: [] });
    });
});

describe('runDetailPollInterval', () => {
    it('polls only while the fetched run is still running', () => {
        expect(runDetailPollInterval({ status: 'running' })).toBe(RUNS_ACTIVE_POLL_MS);
    });

    it('never polls a terminal run, even inside a manual run discovery window', () => {
        markManualRunStarted();

        try {
            expect(runDetailPollInterval({ status: 'completed' })).toBe(false);
            expect(runDetailPollInterval({ status: 'failed' })).toBe(false);
            expect(runDetailPollInterval({ status: 'skipped' })).toBe(false);
            expect(runDetailPollInterval(undefined)).toBe(false);
        } finally {
            clearManualRunWindow();
        }
    });
});

describe('appRoutinesApi triggers', () => {
    it('lists triggers from GET /routines/:id/triggers and drops the malformed ones', async () => {
        server.use(
            respond('get', '/routines/routine-1/triggers', () =>
                envelope({ values: [trigger(), { _id: 'trigger-2' }] }),
            ),
        );

        const triggers = await appRoutinesApi.listTriggers('routine-1');

        expect(triggers.map((item) => item._id)).toEqual(['trigger-1']);
    });

    it('nests the trigger under a trigger key on POST', async () => {
        let body: unknown = null;

        server.use(
            http.post(apiUrl('/routines/routine-1/triggers'), async ({ request }) => {
                body = await request.json();

                return envelope(trigger());
            }),
        );

        await appRoutinesApi.createTrigger('routine-1', { type: 'cron', cron: '0 9 * * 1' });

        expect(body).toEqual({ trigger: { type: 'cron', cron: '0 9 * * 1', timezone: 'UTC', status: 'active' } });
    });

    it('replaces a trigger whole on PUT /routines/:id/triggers/:triggerId', async () => {
        let body: unknown = null;

        server.use(
            http.put(apiUrl('/routines/routine-1/triggers/trigger-1'), async ({ request }) => {
                body = await request.json();

                return envelope(trigger({ type: 'manual', cron: null }));
            }),
        );

        const updated = await appRoutinesApi.updateTrigger('routine-1', 'trigger-1', { type: 'manual' });

        expect(body).toEqual({ trigger: { type: 'manual', status: 'active' } });
        expect(updated.type).toBe('manual');
    });

    it('refuses to send a trigger the api would reject', async () => {
        await expect(
            appRoutinesApi.createTrigger('routine-1', { type: 'manual', cron: '0 9 * * 1' } as never),
        ).rejects.toThrow();
    });

    it('deletes a trigger with DELETE /routines/:id/triggers/:triggerId', async () => {
        server.use(
            respond('delete', '/routines/routine-1/triggers/trigger-1', () =>
                envelope({ _id: 'trigger-1', isDeleted: true }),
            ),
        );

        await expect(appRoutinesApi.deleteTrigger('routine-1', 'trigger-1')).resolves.toEqual({
            _id: 'trigger-1',
            isDeleted: true,
        });
    });

    it('posts an event payload to the fire route', async () => {
        let body: unknown = null;

        server.use(
            http.post(apiUrl('/routines/routine-1/triggers/trigger-1/fire'), async ({ request }) => {
                body = await request.json();

                return envelope({ candidates: 1, matched: 1, results: [] });
            }),
        );

        await appRoutinesApi.fireTrigger('routine-1', 'trigger-1', { subject: 'RFP' });

        expect(body).toEqual({ payload: { subject: 'RFP' } });
    });

    it('sends an empty body when firing a clock trigger by hand', async () => {
        let body: unknown = null;

        server.use(
            http.post(apiUrl('/routines/routine-1/triggers/trigger-1/fire'), async ({ request }) => {
                body = await request.json();

                return envelope({ runId: 'run-9' });
            }),
        );

        await appRoutinesApi.fireTrigger('routine-1', 'trigger-1');

        expect(body).toEqual({});
    });
});

describe('appRoutinesApi write keys', () => {
    const payload = {
        name: 'Holiday brief',
        prompt: 'Research the market',
        agentId: 'agent-1',
        status: 'active' as const,
        modelId: null,
        projectId: 'project-1',
        emailOnRun: true,
        recipients: ['user-2'],
        icon: 'trending-up',
        triggers: [{ type: 'cron' as const, cron: '0 9 * * 1' }],
    };

    const captureBody = (method: 'post' | 'put', path: string) => {
        const captured: { body: Record<string, unknown> | null } = { body: null };

        server.use(
            http[method](apiUrl(path), async ({ request }) => {
                captured.body = (await request.json()) as Record<string, unknown>;

                return envelope(routine());
            }),
        );

        return captured;
    };

    it('sends every write key on a create', async () => {
        const captured = captureBody('post', '/routines');

        await appRoutinesApi.create(payload);

        expect(captured.body).toEqual(payload);
    });

    it('sends every write key on an update', async () => {
        const captured = captureBody('put', '/routines/routine-1');

        await appRoutinesApi.update('routine-1', payload);

        expect(captured.body).toEqual(payload);
    });
});

describe('appRoutinesApi space scoping', () => {
    const captureQuery = (path: string) => {
        const captured: { search: string } = { search: '' };

        server.use(
            http.get(apiUrl(path), ({ request }) => {
                captured.search = new URL(request.url).search;

                return pagedEnvelope([]);
            }),
        );

        return captured;
    };

    it('sends projectId when listing a space of routines', async () => {
        const captured = captureQuery('/routines');

        await appRoutinesApi.list({ projectId: 'project-1', page: 0, size: 5 });

        expect(captured.search).toContain('projectId=project-1');
    });

    it('sends projectId when listing a space of runs', async () => {
        const captured = captureQuery('/routines/runs');

        await appRoutinesApi.listAllRuns({ projectId: 'project-1', unreadOnly: true });

        expect(captured.search).toContain('projectId=project-1');
        expect(captured.search).toContain('unreadOnly=true');
    });

    it('omits projectId when the caller asks for their own routines', async () => {
        const captured = captureQuery('/routines');

        await appRoutinesApi.list();

        expect(captured.search).not.toContain('projectId');
    });
});

describe('appRoutinesApi.listEventSources', () => {
    it('reads sources sitting beside success rather than inside a value envelope', async () => {
        server.use(
            respond('get', '/routines/event-sources', () =>
                HttpResponse.json({
                    success: true,
                    sources: [{ id: 'microsoft-graph-email', name: 'Outlook email' }],
                }),
            ),
        );

        await expect(appRoutinesApi.listEventSources()).resolves.toEqual([
            { id: 'microsoft-graph-email', name: 'Outlook email' },
        ]);
    });

    it('returns an empty list while the api event flag is off', async () => {
        server.use(respond('get', '/routines/event-sources', () => HttpResponse.json({ success: true, sources: [] })));

        await expect(appRoutinesApi.listEventSources()).resolves.toEqual([]);
    });

    it('returns an empty list when the response carries no sources key', async () => {
        server.use(respond('get', '/routines/event-sources', () => HttpResponse.json({ success: true, value: null })));

        await expect(appRoutinesApi.listEventSources()).resolves.toEqual([]);
    });

    it('fails loudly on a soft error rather than reading it as an empty source list', async () => {
        server.use(
            respond('get', '/routines/event-sources', () =>
                HttpResponse.json({ success: false, message: 'Event ingress is unavailable.' }),
            ),
        );

        await expect(appRoutinesApi.listEventSources()).rejects.toThrow('Event ingress is unavailable.');
    });

    it('tolerates the id and name spellings the api may use', async () => {
        server.use(
            respond('get', '/routines/event-sources', () =>
                HttpResponse.json({
                    success: true,
                    sources: [
                        'plain-string-source',
                        { key: 'keyed', label: 'Keyed source' },
                        { _id: 'mongo-id' },
                        { source: 'sourced', name: 'Sourced' },
                        { name: 'no id at all' },
                        null,
                    ],
                }),
            ),
        );

        await expect(appRoutinesApi.listEventSources()).resolves.toEqual([
            { id: 'plain-string-source', name: 'plain-string-source' },
            { id: 'keyed', name: 'Keyed source' },
            { id: 'mongo-id', name: 'mongo-id' },
            { id: 'sourced', name: 'Sourced' },
        ]);
    });
});

describe('appRoutinesApi trigger set writes', () => {
    it('sends the whole trigger set on an update, unreshaped and in order', async () => {
        let body: Record<string, unknown> | null = null;

        server.use(
            http.put(apiUrl('/routines/routine-1'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope(routine());
            }),
        );

        const triggers = [
            { type: 'cron' as const, cron: '0 9 * * 1', timezone: 'Europe/London', status: 'active' as const },
            { type: 'manual' as const },
            {
                type: 'event' as const,
                eventSource: 'microsoft-graph-email',
                eventFilter: { from: 'a@b.com', labels: ['rfp'] },
                cooldownSeconds: 600,
            },
        ];

        await appRoutinesApi.update('routine-1', { triggers });

        expect(body).toEqual({ triggers });
    });

    it('lets an update carry the trigger set alongside the other write keys', async () => {
        let body: Record<string, unknown> | null = null;

        server.use(
            http.put(apiUrl('/routines/routine-1'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope(routine());
            }),
        );

        await appRoutinesApi.update('routine-1', {
            name: 'Holiday brief',
            triggers: [{ type: 'manual' }],
        });

        expect(body).toEqual({ name: 'Holiday brief', triggers: [{ type: 'manual' }] });
    });
});
