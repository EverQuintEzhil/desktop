import { z } from 'zod';

import { isToolPendingApproval, type ToolApprovalState } from '../utils/tool-approval-state';

// PROPOSED backend contract (AMP-512). The merged `ai` tool runs deep research in-process
// and returns one result, so none of the parts below are emitted yet. Every wire name,
// payload shape and persisted field is written down here and nowhere else — when `ai` emits
// phases, this module is the single edit. `docs/features/AMP-512-deep-research.md` is the
// human-readable spec handed to the backend, and must be updated with this file.
//
// Everything is accepted in two shapes: the correlated one this contract asks for
// (`queryId` / `stepId`), and the uncorrelated one that carries only text. The second
// exists so a partial backend ships without breaking the UI; it costs the two text-matching
// inferences documented in `research-view-model.ts`.

/** Data-part names streamed inside the assistant message that carries the report. */
const PLAN_PART_NAME = 'research-plan';
const ROUND_PART_NAME = 'research-round';
const STATUS_PART_NAME = 'research-status';
const REPORT_PART_NAME = 'research-report';

/** Keys on the persisted `message.metadata` document the history endpoint returns. */
const PERSISTED_PLAN_KEY = 'research_plan';
const PERSISTED_ROUNDS_KEY = 'research_rounds';
const PERSISTED_REPORT_KEY = 'research_report';
const PERSISTED_DEEP_RESEARCH_KEY = 'deep_research';

/** Key on `message.metadata.custom` that flags an answer as deep research. */
const DEEP_RESEARCH_CUSTOM_KEY = 'deepResearch';

export const RESEARCH_GROUP_KEY: `group-${string}` = 'group-research';

export const DEFAULT_RESEARCH_TITLE = 'Deep research';

const RESEARCH_PART_NAMES: ReadonlySet<string> = new Set([
    PLAN_PART_NAME,
    ROUND_PART_NAME,
    STATUS_PART_NAME,
    REPORT_PART_NAME,
]);

/** A plan entry. The id is what a round's query points at to tick the entry off. */
const planStepSchema = z.union([z.string(), z.looseObject({ id: z.string().optional(), text: z.string() })]);

const planSchema = z
    .looseObject({
        title: z.string().optional(),
        /** Epoch ms the run began. Anchors the live elapsed clock across a remount. */
        startedAt: z.number().positive().optional(),
        steps: z.array(planStepSchema).optional(),
        /** Legacy uncorrelated shape: plan entries as bare strings. */
        queries: z.array(planStepSchema).optional(),
    })
    .refine((plan) => plan.steps !== undefined || plan.queries !== undefined);

/** One executed search. `queryId` is the correlation id every source of it carries. */
const querySchema = z.union([
    z.string(),
    z.looseObject({
        queryId: z.string().optional(),
        text: z.string().optional(),
        /** Accepted alias so a backend may name the field after the search itself. */
        query: z.string().optional(),
        /** Plan entry this search serves, which is how the checklist ticks off. */
        stepId: z.string().optional(),
        /** 1-based position within the round, so `index`/`total` reads as "2 of 4". */
        index: z.number().int().positive().optional(),
        total: z.number().int().positive().optional(),
        status: z.enum(['pending', 'complete', 'error']).optional(),
    }),
]);

/**
 * A source a round turned up. `queryId` attributes it to one of the round's own queries.
 * `query` is the legacy uncorrelated form — the search text, matched by string.
 */
const sourceSchema = z.looseObject({
    queryId: z.string().optional(),
    title: z.string(),
    url: z.string(),
    favicon: z.string().optional(),
    siteName: z.string().optional(),
    query: z.string().optional(),
});

const roundSchema = z.looseObject({
    round: z.number().int().nonnegative(),
    queries: z.array(querySchema),
    summary: z.string().optional(),
    sources: z.array(sourceSchema).optional(),
});

const RESEARCH_PHASES = ['planning', 'awaiting-approval', 'searching', 'writing', 'done'] as const;

const statusSchema = z.looseObject({
    label: z.string().min(1),
    phase: z.enum(RESEARCH_PHASES).optional(),
    sourceCount: z.number().int().nonnegative().optional(),
    /**
     * Milliseconds the backend has measured. Preferred over the clock this client runs, so
     * the reading stays honest after a remount mid-run.
     */
    elapsedMs: z.number().nonnegative().optional(),
    /** Set once the searching is over, even though the report is still streaming. */
    done: z.boolean().optional(),
});

// The status part is written with one stable id per run and re-written as it progresses, so the
// SDK reconciles it in place rather than appending a row. It must NOT be sent `transient`: a
// transient part never lands in `message.parts`, which is the only thing read here. The backend
// simply does not persist it.

const deepResearchSchema = z.union([
    z.literal(true),
    z.looseObject({ durationMs: z.number().nonnegative().optional() }),
]);

export type ResearchPhaseName = (typeof RESEARCH_PHASES)[number];
export type ResearchPlan = z.infer<typeof planSchema>;
export type ResearchRound = z.infer<typeof roundSchema>;
export type DeepResearchReceipt = { durationMs?: number };

/** Mixin for `metadata.custom`, so the key name lives only in this module. */
export interface DeepResearchCustom {
    deepResearch?: DeepResearchReceipt;
}

type NamedPart = { readonly type: string; readonly name?: string };

export const isResearchPartName = (name: string | undefined): boolean =>
    name !== undefined && RESEARCH_PART_NAMES.has(name);

export const isResearchPart = (part: NamedPart): boolean => part.type === 'data' && isResearchPartName(part.name);

const RESEARCH_PART_TYPES: ReadonlySet<string> = new Set([...RESEARCH_PART_NAMES].map((name) => `data-${name}`));

export const isResearchPartType = (type: unknown): boolean => typeof type === 'string' && RESEARCH_PART_TYPES.has(type);

export const parseResearchPlanPart = (part: NamedPart): ResearchPlan | undefined => {
    if (part.name !== PLAN_PART_NAME) return undefined;

    const parsed = planSchema.safeParse((part as { data?: unknown }).data);

    return parsed.success ? parsed.data : undefined;
};

export const parseResearchRoundPart = (part: NamedPart): ResearchRound | undefined => {
    if (part.name !== ROUND_PART_NAME) return undefined;

    const parsed = roundSchema.safeParse((part as { data?: unknown }).data);

    return parsed.success ? parsed.data : undefined;
};

export interface ResearchStatus {
    label: string;
    phase?: ResearchPhaseName;
    sourceCount?: number;
    elapsedMs?: number;
    done?: boolean;
}

export const parseResearchStatusPart = (part: NamedPart): ResearchStatus | undefined => {
    if (part.name !== STATUS_PART_NAME) return undefined;

    const parsed = statusSchema.safeParse((part as { data?: unknown }).data);

    if (!parsed.success) return undefined;

    return {
        label: parsed.data.label,
        phase: parsed.data.phase,
        sourceCount: parsed.data.sourceCount,
        elapsedMs: parsed.data.elapsedMs,
        done: parsed.data.done,
    };
};

const readRecord = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;

/** Accepts both the boolean flag already in use and the richer `{ durationMs }` object. */
export const parseDeepResearchReceipt = (custom: unknown): DeepResearchReceipt | undefined => {
    const parsed = deepResearchSchema.safeParse(readRecord(custom)?.[DEEP_RESEARCH_CUSTOM_KEY]);

    if (!parsed.success) return undefined;

    return parsed.data === true ? {} : { durationMs: parsed.data.durationMs };
};

export interface ResearchQueryItem {
    id: string;
    text: string;
}

export interface ResearchSourceItem {
    id: string;
    title: string;
    url: string;
    faviconUrl?: string;
    siteName: string;
}

/** One executed query and the sources it turned up — the panel's collapsible unit. */
export interface ResearchQueryGroup {
    id: string;
    text: string;
    round: number;
    /** Plan entry this search serves, when the backend correlates them. */
    stepId?: string;
    sources: ResearchSourceItem[];
    /** `pending` while the search is in flight, so the panel can show a live row. */
    status?: 'pending' | 'complete' | 'error';
    /** Position within its round, as the backend reported it. */
    index?: number;
    total?: number;
    /** Sources the round reported without naming the query they came from. */
    isUnattributed?: boolean;
}

/** Roughly two lines in the trace's narrative slot; past that the row stops being a summary. */
const SUMMARY_MAX_LENGTH = 220;

/**
 * A round's `summary` is meant to be one narrative line, but the merged backend sends its whole
 * raw findings blob — search headings, `Source:` lines, bare URLs and markdown tables, thousands
 * of characters. Rendering that verbatim turns the trace into a wall of markup, so the prose is
 * recovered here: structural lines are dropped, the first real sentences kept, and a payload with
 * no prose in it at all yields nothing rather than a wall.
 */
const readRoundNarrative = (raw: string): string | undefined => {
    const prose = raw
        .replace(/```[\s\S]*?```/g, ' ')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !line.startsWith('#'))
        .filter((line) => !line.startsWith('|'))
        .filter((line) => !/^source\s*:/i.test(line))
        .filter((line) => !/^https?:\/\//i.test(line))
        .map((line) =>
            line
                .replace(/^[-*+]\s+/, '')
                .replace(/\*\*/g, '')
                .trim(),
        )
        .filter((line) => line.length > 0)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (prose.length === 0) return undefined;
    if (prose.length <= SUMMARY_MAX_LENGTH) return prose;

    // Cut on a sentence end when one is in reach, so the row does not stop mid-clause.
    const window = prose.slice(0, SUMMARY_MAX_LENGTH);
    const lastStop = window.lastIndexOf('. ');

    return lastStop > SUMMARY_MAX_LENGTH / 2 ? window.slice(0, lastStop + 1) : `${window.trimEnd()}…`;
};

export interface ResearchRoundSummary {
    round: number;
    text: string;
    sourceCount: number;
}

export interface ResearchContent {
    title: string;
    planQueries: ResearchQueryItem[];
    queryGroups: ResearchQueryGroup[];
    /**
     * Plan-entry ids a round's query claimed via `stepId`. Empty when the backend sends no
     * correlation, which is what pushes the checklist onto its inference fallback.
     */
    executedStepIds: readonly string[];
    /**
     * Distinct sources the trace can actually show. This is the settled receipt, and it is
     * the only count derived from persisted data, so live and reloaded receipts agree.
     */
    sourceCount: number;
    /** Higher progress count the backend reported while running; never used once settled. */
    runningSourceCount: number;
    startedAt?: number;
    /** Duration the backend measured, preferred over this client's own clock. */
    reportedElapsedMs?: number;
    statusLabel?: string;
    phase?: ResearchPhaseName;
    /** The report itself, as the run's own text parts wrote it. Read by the side pane. */
    reportMarkdown?: string;
    /** What each round concluded, in round order — the trace's narrative entries. */
    roundSummaries: ResearchRoundSummary[];
    /** The backend declared the searching over, independently of the report still streaming. */
    isComplete: boolean;
    /** Read off the tool parts, not the phases: a stopped run's phases still look settled. */
    runOutcome?: ResearchRunOutcome;
}

const readStepText = (step: z.infer<typeof planStepSchema>): string =>
    (typeof step === 'string' ? step : step.text).trim();

const toPlanSteps = (steps: readonly z.infer<typeof planStepSchema>[]): ResearchQueryItem[] =>
    steps
        .map((step, position) => ({
            id: (typeof step === 'string' ? undefined : step.id) ?? `plan-${position}`,
            text: readStepText(step),
        }))
        .filter((item) => item.text.length > 0);

const readHostname = (url: string): string => {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
};

/** A backend that sends a bare host as the site name sends it with the `www.` still on. */
const readSiteName = (siteName: string | undefined, url: string): string => {
    const stated = siteName?.trim();

    if (stated === undefined || stated.length === 0) return readHostname(url);

    return stated.replace(/^www\./, '');
};

const toSourceItem = (source: z.infer<typeof sourceSchema>, id: string): ResearchSourceItem => ({
    id,
    title: source.title.trim() || readHostname(source.url),
    url: source.url,
    faviconUrl: source.favicon,
    siteName: readSiteName(source.siteName, source.url),
});

/**
 * Only a web URL may become an `href`. A round is untrusted input, and `javascript:` or
 * `data:` in a source would otherwise render as a live link the reader can click.
 */
const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url.trim());

const UNATTRIBUTED_GROUP_LABEL = 'Other results';

const roundGroupLabel = (round: number): string => `Round ${round} results`;

interface NormalizedQuery {
    queryId?: string;
    text: string;
    stepId?: string;
    index?: number;
    total?: number;
    status?: 'pending' | 'complete' | 'error';
}

const normalizeQuery = (query: z.infer<typeof querySchema>): NormalizedQuery => {
    if (typeof query === 'string') return { text: query.trim() };

    return {
        queryId: query.queryId,
        text: (query.text ?? query.query ?? '').trim(),
        stepId: query.stepId,
        index: query.index,
        total: query.total,
        status: query.status,
    };
};

/**
 * One group per query the round ran. A source joins its group by `queryId`; failing that by
 * matching the query text it names; failing that it joins the round's only query, and lands
 * in an explicit bucket when the round ran several — guessing an attribution would read as
 * fact the payload never stated.
 *
 * A round is allowed to name no queries at all, and its sources must still survive: they
 * collapse into a single round-level group rather than being discarded.
 */
const buildRoundQueryGroups = (round: ResearchRound, prefix: string): ResearchQueryGroup[] => {
    const queries = round.queries.map(normalizeQuery).filter((query) => query.text.length > 0);

    if (queries.length === 0) {
        const sources = (round.sources ?? []).filter((source) => isHttpUrl(source.url));

        if (sources.length === 0) return [];

        return [
            {
                id: `${prefix}-all`,
                text: roundGroupLabel(round.round),
                round: round.round,
                sources: sources.map((source, position) => toSourceItem(source, `${prefix}-source-${position}`)),
                isUnattributed: true,
            },
        ];
    }

    const groups = queries.map<ResearchQueryGroup>((query, position) => ({
        id: query.queryId ?? `${prefix}-query-${position}`,
        text: query.text,
        round: round.round,
        stepId: query.stepId,
        sources: [],
        status: query.status,
        index: query.index,
        total: query.total,
    }));
    const byId = new Map(groups.filter((group) => group.id !== undefined).map((group) => [group.id, group]));
    const byText = new Map(groups.map((group) => [group.text, group]));
    const unattributed: ResearchQueryGroup = {
        id: `${prefix}-unattributed`,
        text: UNATTRIBUTED_GROUP_LABEL,
        round: round.round,
        sources: [],
        isUnattributed: true,
    };
    const fallback = groups.length === 1 ? groups[0] : unattributed;

    (round.sources ?? [])
        .filter((source) => isHttpUrl(source.url))
        .forEach((source, position) => {
            const correlated = source.queryId !== undefined ? byId.get(source.queryId) : undefined;
            const named = source.query !== undefined ? byText.get(source.query.trim()) : undefined;

            (correlated ?? named ?? fallback).sources.push(toSourceItem(source, `${prefix}-source-${position}`));
        });

    return unattributed.sources.length > 0 ? [...groups, unattributed] : groups;
};

const reportSchema = z.looseObject({ markdown: z.string() });

/**
 * The report, from whichever of the two contracts the backend is speaking.
 *
 * A `data-research-report` part is the current one: the report is delivered as its own payload so
 * the model writes only a lead-in. Before that it was the message's own text after the last
 * phase, which put the same document on screen twice — once inline, once in the pane. Both are
 * read, and the explicit part wins, so either side can deploy first and conversations already in
 * the database keep rendering.
 */
const collectReportMarkdown = (parts: readonly (NamedPart | undefined)[]): string | undefined => {
    const delivered = parts.reduce<string | undefined>((found, part) => {
        if (part?.type !== 'data' || part.name !== REPORT_PART_NAME) return found;

        const parsed = reportSchema.safeParse((part as { data?: unknown }).data);
        const markdown = parsed.success ? parsed.data.markdown.trim() : '';

        return markdown.length > 0 ? markdown : found;
    }, undefined);

    if (delivered !== undefined) return delivered;

    const textAfter = (anchor: number): string =>
        parts
            .slice(anchor + 1)
            .filter((part): part is NamedPart => part?.type === 'text')
            .map((part) => (part as { text?: unknown }).text)
            .filter((text): text is string => typeof text === 'string')
            .join('\n\n')
            .trim();

    const lastAnchor = parts.reduce((last, part, index) => (part && isResearchPart(part) ? index : last), -1);

    if (lastAnchor === -1) return undefined;

    const report = textAfter(lastAnchor);

    if (report.length > 0) return report;

    // Nothing followed the last part, so it was a blank report part landing after the text — the
    // backend can emit one. Retry from the last part that is not a report, which is where the text
    // that IS the report begins.
    const beforeReport = parts.reduce(
        (last, part, index) => (part && isResearchPart(part) && part.name !== REPORT_PART_NAME ? index : last),
        -1,
    );

    if (beforeReport === -1 || beforeReport === lastAnchor) return undefined;

    const fallback = textAfter(beforeReport);

    return fallback.length > 0 ? fallback : undefined;
};

/**
 * The one place a set of parts is turned into renderable research. The card and the panel
 * render exactly what this returns, so the tag's suppression check can share it and the
 * two can never disagree about whether a payload survived parsing.
 *
 * Rounds are keyed by their round number, last write wins: a backend that re-emits a round
 * as its sources accumulate must not make the panel list the same query several times. The
 * plan is replaced for the same reason — a re-emitted plan is the whole plan, not an
 * addition to it.
 */
export const collectResearchContent = (parts: readonly (NamedPart | undefined)[]): ResearchContent => {
    let planQueries: ResearchQueryItem[] = [];
    const roundsByNumber = new Map<number, ResearchQueryGroup[]>();
    const summariesByRound = new Map<number, ResearchRoundSummary>();
    const executedStepIds = new Set<string>();
    let title: string | undefined;
    let startedAt: number | undefined;
    let statusLabel: string | undefined;
    let phase: ResearchPhaseName | undefined;
    let reportedElapsedMs: number | undefined;
    let runningSourceCount = 0;
    let isComplete = false;

    parts.forEach((part) => {
        if (!part) return;

        const plan = parseResearchPlanPart(part);

        if (plan) {
            title = plan.title?.trim() || title;
            startedAt = plan.startedAt ?? startedAt;
            planQueries = toPlanSteps(plan.steps ?? plan.queries ?? []);

            return;
        }

        const round = parseResearchRoundPart(part);

        if (round) {
            const groups = buildRoundQueryGroups(round, `round-${round.round}`);

            roundsByNumber.set(round.round, groups);

            const summary = round.summary === undefined ? undefined : readRoundNarrative(round.summary);

            if (summary) {
                summariesByRound.set(round.round, {
                    round: round.round,
                    text: summary,
                    sourceCount: groups.reduce((total, group) => total + group.sources.length, 0),
                });
            }

            // A query still in flight must not tick its plan entry off — the checklist would
            // report an entry done while its own search is still running.
            round.queries.forEach((query) => {
                const { stepId, status } = normalizeQuery(query);

                if (stepId !== undefined && status !== 'pending') executedStepIds.add(stepId);
            });

            return;
        }

        const status = parseResearchStatusPart(part);

        if (status) {
            statusLabel = status.label;
            phase = status.phase ?? phase;
            runningSourceCount = Math.max(runningSourceCount, status.sourceCount ?? 0);
            reportedElapsedMs = status.elapsedMs ?? reportedElapsedMs;
            isComplete = isComplete || status.done === true || status.phase === 'done';
        }
    });

    const queryGroups = [...roundsByNumber.values()].flat();
    const roundSummaries = [...summariesByRound.entries()].sort(([a], [b]) => a - b).map(([, summary]) => summary);
    const sourceUrls = new Set(queryGroups.flatMap((group) => group.sources.map((source) => source.url)));

    return {
        reportMarkdown: collectReportMarkdown(parts),
        roundSummaries,
        title: title ?? planQueries[0]?.text ?? DEFAULT_RESEARCH_TITLE,
        planQueries,
        queryGroups,
        executedStepIds: [...executedStepIds],
        sourceCount: sourceUrls.size,
        runningSourceCount,
        startedAt,
        reportedElapsedMs,
        statusLabel,
        phase,
        isComplete,
        runOutcome: readResearchRunOutcome(parts),
    };
};

const isReportTextPart = (part: NamedPart | undefined): boolean => {
    if (part?.type !== 'text') return false;

    const text = (part as { text?: unknown }).text;

    return typeof text === 'string' && text.trim().length > 0;
};

/**
 * Whether the searching itself is still going. Deliberately not read off the part group's
 * status: assistant-ui derives that from "is this the message's last part", so any part
 * landing after the first phase would settle the card in the middle of a live run.
 */
export const isResearchRunActive = (
    parts: readonly (NamedPart | undefined)[],
    isMessageRunning: boolean,
    content: ResearchContent,
): boolean => {
    if (!isMessageRunning || content.isComplete) return false;

    const lastResearchIndex = parts.reduce((last, part, index) => (part && isResearchPart(part) ? index : last), -1);

    if (lastResearchIndex === -1) return false;

    // Once the report starts streaming the searching is over, whatever the message status says.
    return !parts.slice(lastResearchIndex + 1).some(isReportTextPart);
};

/**
 * Whether there is a run worth drawing. A status label on its own is not one: the backend
 * announces the mode at the top of every deep-research turn, before the model has chosen whether
 * to research at all — so on a turn that answers from research the conversation already did, that
 * announcement was the only part there was, and the card sat frozen on "Planning the research"
 * describing a run that never happened.
 *
 * `isTurnLive` must be the message's own running state, never `isResearchRunActive`: that goes
 * false the moment the report starts streaming, which would settle the card mid-run. The
 * `isComplete` half keeps a run that failed before it ever had a plan visible.
 *
 * `planning` alone is the exception in both directions: the backend announces it before the gate
 * tool call exists, so drawing it would flash a card for a second and then hand over to the
 * gate's own shell — and on a turn that answers from earlier research it is all that ever arrives.
 */
// `phase` is sticky across status rewrites and optional on each, so the announcement is judged by
// what has arrived, not by the phase alone: a later "Researching 8 websites" without a phase must
// still draw.
const isBareAnnouncement = (content: ResearchContent): boolean =>
    content.phase === 'planning' && content.sourceCount === 0 && content.runningSourceCount === 0;

export const hasRenderableResearch = (content: ResearchContent, isTurnLive: boolean): boolean =>
    content.planQueries.length > 0 ||
    content.queryGroups.length > 0 ||
    (content.statusLabel !== undefined && !isBareAnnouncement(content) && (isTurnLive || content.isComplete));

const STARTED_PHASES: ReadonlySet<ResearchPhaseName> = new Set(['searching', 'writing', 'done']);

/**
 * Whether searching has actually begun. Deliberately not "any research part exists": the
 * contract streams the plan part *before* the gate, so a plan on its own means a plan was
 * proposed, not that a run started. Reading it the other way retires the gate the moment the
 * plan lands and leaves the turn paused with no way to answer it.
 */
export const hasResearchRunStarted = (content: ResearchContent): boolean =>
    content.queryGroups.length > 0 || (content.phase !== undefined && STARTED_PHASES.has(content.phase));

export interface ResearchDomainCount {
    siteName: string;
    faviconUrl?: string;
    count: number;
}

const DOMAIN_ROW_LIMIT = 4;

/**
 * Sources per domain, busiest first, capped — Claude's breakdown under "Gathered N sources".
 * The tail is summed rather than listed, because a long run touches dozens of domains once.
 */
export const buildDomainBreakdown = (
    sources: readonly ResearchSourceItem[],
): { rows: ResearchDomainCount[]; otherCount: number } => {
    const byDomain = new Map<string, ResearchDomainCount>();

    for (const source of sources) {
        const existing = byDomain.get(source.siteName);

        if (existing) {
            existing.count += 1;
            continue;
        }

        byDomain.set(source.siteName, {
            siteName: source.siteName,
            faviconUrl: source.faviconUrl,
            count: 1,
        });
    }

    const sorted = [...byDomain.values()].sort((a, b) => b.count - a.count || a.siteName.localeCompare(b.siteName));

    return {
        rows: sorted.slice(0, DOMAIN_ROW_LIMIT),
        otherCount: sorted.slice(DOMAIN_ROW_LIMIT).reduce((total, row) => total + row.count, 0),
    };
};

export interface ReportHeading {
    text: string;
    level: 1 | 2 | 3;
}

const HEADING_RE = /^(#{1,3})\s+(.+?)\s*#*$/;

/** The report's own headings, in document order, for the pane's Contents menu. */
export const buildReportOutline = (markdown: string): ReportHeading[] => {
    const headings: ReportHeading[] = [];
    let inFence = false;

    for (const line of markdown.split('\n')) {
        // A `#` inside a fenced block is a comment or a shell prompt, not a heading.
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }

        if (inFence) continue;

        const match = HEADING_RE.exec(line);

        if (match) headings.push({ text: match[2].trim(), level: match[1].length as 1 | 2 | 3 });
    }

    return headings;
};

type PersistedResearchPart = { type: string; id: string; data: unknown };

/** Rebuilds the streamed research parts from a persisted message's metadata. */
export const buildPersistedResearchParts = (metadata: unknown): PersistedResearchPart[] => {
    const record = readRecord(metadata);

    if (!record) return [];

    const parts: PersistedResearchPart[] = [];
    const plan = planSchema.safeParse(record[PERSISTED_PLAN_KEY]);

    if (plan.success) {
        parts.push({ type: `data-${PLAN_PART_NAME}`, id: PERSISTED_PLAN_KEY, data: plan.data });
    }

    const rounds = z.array(roundSchema).safeParse(record[PERSISTED_ROUNDS_KEY]);

    if (rounds.success) {
        for (const round of rounds.data) {
            parts.push({ type: `data-${ROUND_PART_NAME}`, id: `${PERSISTED_ROUNDS_KEY}-${round.round}`, data: round });
        }
    }

    // Last, mirroring the stream: the report is written once the rounds are done, and the text
    // fallback in `collectReportMarkdown` reads from after the final research part. Either shape is
    // accepted — the backend stores bare markdown, while the stream part wraps it in `{ markdown }`.
    const report = z
        .union([z.string(), reportSchema.transform((wrapped) => wrapped.markdown)])
        .safeParse(record[PERSISTED_REPORT_KEY]);

    if (report.success && report.data.trim().length > 0) {
        parts.push({
            type: `data-${REPORT_PART_NAME}`,
            id: PERSISTED_REPORT_KEY,
            data: { markdown: report.data.trim() },
        });
    }

    return parts;
};

/**
 * The rebuilt parts a persisted message still needs, given what its own content already carries.
 *
 * Judged per kind, because the three do not behave alike. A delivered plan wins outright. Rounds
 * are many parts under one type and `collectResearchContent` keys them by round number with the
 * later write winning, so rebuilt rounds are always safe to add — the streamed ones sit after them
 * and take precedence. A delivered report only wins when it actually carries markdown: the backend
 * can emit a blank report part, and treating that as the report loses the one in metadata.
 */
export const buildMissingResearchParts = (metadata: unknown, content: readonly unknown[]): PersistedResearchPart[] => {
    const types = new Set(
        content.map((part) => (part as { type?: unknown } | null)?.type).filter((type) => typeof type === 'string'),
    );
    const hasUsableReport = content.some((part) => {
        if ((part as { type?: unknown } | null)?.type !== `data-${REPORT_PART_NAME}`) return false;

        const parsed = reportSchema.safeParse((part as { data?: unknown }).data);

        return parsed.success && parsed.data.markdown.trim().length > 0;
    });

    return buildPersistedResearchParts(metadata).filter((part) => {
        if (part.type === `data-${ROUND_PART_NAME}`) return true;
        if (part.type === `data-${REPORT_PART_NAME}`) return !hasUsableReport;

        return !types.has(part.type);
    });
};

/** Spread into `metadata.custom` so the receipt survives a reload. */
export const buildDeepResearchCustom = (metadata: unknown): DeepResearchCustom => {
    const raw = readRecord(metadata)?.[PERSISTED_DEEP_RESEARCH_KEY];
    const parsed = deepResearchSchema.safeParse(raw);

    if (!parsed.success) return {};

    return { [DEEP_RESEARCH_CUSTOM_KEY]: parsed.data === true ? {} : { durationMs: parsed.data.durationMs } };
};

export const PLAN_CONFIRM_TOOL_NAME = 'confirm_research_plan';

/**
 * Whether the message holds a plan gate still waiting for an answer. The gate renders the
 * proposed plan itself, so the run's own plan card must stand down until it is answered —
 * otherwise the same five lines are drawn twice, one set above the other.
 */
/**
 * Two shapes on purpose: assistant-ui normalises a tool call to `tool-call` + `toolName` +
 * `result`, while the raw AI SDK part is `tool-<name>` + `output`. Both sides of that boundary
 * are read here.
 */
interface ToolPartShape extends ToolApprovalState {
    type?: string;
    toolName?: string;
    result?: unknown;
    output?: unknown;
}

const readPlanGatePart = (part: NamedPart | undefined): ToolPartShape | undefined => {
    if (!part) return undefined;

    const tool = part as ToolPartShape;
    const toolName =
        tool.type === 'tool-call' || tool.type === 'dynamic-tool' ? tool.toolName : tool.type?.replace(/^tool-/, '');

    return toolName === PLAN_CONFIRM_TOOL_NAME ? tool : undefined;
};

export const hasUnansweredPlanGate = (parts: readonly (NamedPart | undefined)[]): boolean =>
    parts.some((part) => {
        const tool = readPlanGatePart(part);

        return tool !== undefined && tool.result === undefined && tool.output === undefined;
    });

/**
 * Whether the reader cancelled the plan. A rejected run never searched, so the gate's own
 * "this plan was never run" receipt is the whole story: the run's plan card and its document
 * card both stand down rather than describing a run that does not exist.
 *
 * Read from the answer rather than from the absence of phases, because `ai` writes no status
 * part on the cancel leg — there is nothing else in the message that says a cancel happened.
 */
export const wasResearchPlanRejected = (parts: readonly (NamedPart | undefined)[]): boolean => {
    // The LAST answered gate decides, not any of them: a model may propose again after a refusal,
    // and `some` would let the abandoned plan hide the run the reader then approved — trace and
    // report both unreachable, live and on every reload.
    let latest: boolean | undefined;

    parts.forEach((part) => {
        const tool = readPlanGatePart(part);

        if (tool === undefined) return;

        const answer = parsePlanConfirmResult(tool.result ?? tool.output);

        if (answer !== undefined) latest = answer.approved;
    });

    return latest === false;
};

/** The last answered gate was approved — the run is committed even before its first phase lands. */
export const wasResearchPlanApproved = (parts: readonly (NamedPart | undefined)[]): boolean => {
    let latest: boolean | undefined;

    parts.forEach((part) => {
        const tool = readPlanGatePart(part);

        if (tool === undefined) return;

        const answer = parsePlanConfirmResult(tool.result ?? tool.output);

        if (answer !== undefined) latest = answer.approved;
    });

    return latest === true;
};

/**
 * The plan gate is a human tool: the backend declares `confirm_research_plan` with the
 * proposed plan as its input and no server-side execute, and this client answers with a
 * tool result. That keeps the edited plan a typed, persisted tool result the model reads —
 * rather than a JSON string smuggled through an approval `reason`, which is the only
 * free-form field `ToolApprovalResponse` has.
 */
export const isPlanConfirmToolName = (name: string): boolean => name === PLAN_CONFIRM_TOOL_NAME;

/** The tool that runs an approved plan. Its own progress is the research card, not a tool step. */
export const RUN_RESEARCH_TOOL_NAME = 'deep_research';

export const isRunResearchToolName = (name: string): boolean => name === RUN_RESEARCH_TOOL_NAME;

/**
 * The run tool reports failure and every refusal — a cancelled plan, an unusable one, a round
 * that threw — as `{ error }` rather than by rejecting, so this is the only way to tell a run
 * that failed from one that finished.
 */
export const isFailedResearchResult = (result: unknown): boolean => {
    const error = (result as { error?: unknown } | null | undefined)?.error;

    return typeof error === 'string' ? error.trim().length > 0 : error != null;
};

export type ResearchRunOutcome = 'failed' | 'unfinished';

const readRunToolPart = (part: NamedPart | undefined): ToolPartShape | undefined => {
    if (!part) return undefined;

    const tool = part as ToolPartShape;
    const toolName =
        tool.type === 'tool-call' || tool.type === 'dynamic-tool' ? tool.toolName : tool.type?.replace(/^tool-/, '');

    return toolName === RUN_RESEARCH_TOOL_NAME ? tool : undefined;
};

/**
 * Whether the run ended badly, which no other part records — the phases the card reads describe
 * only what was reached, so a stopped or failed run looks identical to a finished one.
 *
 * `unfinished` is a resultless call on a settled message: pressing Stop mid-tool-call leaves a
 * bare `requires-action` with neither an approval nor an interrupt, so an absent result is the
 * only signal. Call this only once the run is no longer streaming, or a call still in flight
 * reads as stopped.
 */
export const readResearchRunOutcome = (parts: readonly (NamedPart | undefined)[]): ResearchRunOutcome | undefined => {
    let outcome: ResearchRunOutcome | undefined;

    for (const part of parts) {
        const tool = readRunToolPart(part);

        if (tool === undefined) continue;

        const result = tool.result ?? tool.output;

        // Any call that returned a report settles it. A model that calls the tool twice is refused
        // on the second — the backend answers `{ error: 'deep_research has already run for this
        // message' }` — and letting that refusal decide would label the run failed while its real
        // report sits on screen underneath.
        if (result !== undefined && !isFailedResearchResult(result)) return undefined;

        // A retry still searching means there is no verdict yet — otherwise the first failure
        // sticks and the card reads "Research failed" for the whole of the second attempt.
        if (tool.status?.type === 'running') return undefined;

        // An approval prompt is also a resultless call on a settled message, and the user can
        // still answer it — calling that stopped would settle a run that never started.
        if (isToolPendingApproval(tool)) return undefined;

        if (isFailedResearchResult(result)) {
            outcome ??= 'failed';

            continue;
        }

        outcome ??= 'unfinished';
    }

    return outcome;
};

const planConfirmArgsSchema = z.looseObject({
    title: z.string().optional(),
    steps: z.array(planStepSchema).optional(),
    /** Legacy uncorrelated shape, accepted for the same reason as everywhere else. */
    queries: z.array(planStepSchema).optional(),
    /** Human estimate the backend may supply, shown verbatim rather than computed here. */
    etaLabel: z.string().optional(),
});

export interface PlanConfirmArgs {
    title?: string;
    steps: ResearchQueryItem[];
    etaLabel?: string;
}

export const parsePlanConfirmArgs = (args: unknown): PlanConfirmArgs | undefined => {
    const parsed = planConfirmArgsSchema.safeParse(args);

    if (!parsed.success) return undefined;

    const steps = toPlanSteps(parsed.data.steps ?? parsed.data.queries ?? []);

    if (steps.length === 0) return undefined;

    return { title: parsed.data.title?.trim() || undefined, steps, etaLabel: parsed.data.etaLabel };
};

export interface PlanConfirmResult {
    approved: boolean;
    steps: { id: string; text: string }[];
}

const planConfirmResultSchema = z.looseObject({
    approved: z.boolean(),
    steps: z.array(z.looseObject({ id: z.string(), text: z.string() })).optional(),
});

/** Reads back an answered gate — from the live tool result or a reloaded, persisted one. */
export const parsePlanConfirmResult = (result: unknown): PlanConfirmResult | undefined => {
    const parsed = planConfirmResultSchema.safeParse(result);

    if (!parsed.success) return undefined;

    return { approved: parsed.data.approved, steps: parsed.data.steps ?? [] };
};

/**
 * The tool result the gate answers with. Approving unchanged and approving an edit are the
 * same call — the backend reads `steps` and researches those, so it never has to diff.
 * Cancelling sends `approved: false`, which is how the run ends without searching.
 */
export const buildPlanConfirmResult = (steps: readonly ResearchQueryItem[], approved: boolean): PlanConfirmResult => ({
    approved,
    steps: steps.map((step) => ({ id: step.id, text: step.text.trim() })).filter((step) => step.text.length > 0),
});
