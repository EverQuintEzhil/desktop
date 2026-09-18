import type {
    ResearchContent,
    ResearchPhaseName,
    ResearchQueryGroup,
    ResearchQueryItem,
    ResearchSourceItem,
} from './research-contract';

export type ResearchStepState = 'pending' | 'active' | 'done' | 'stopped';

export interface ResearchStep {
    id: string;
    text: string;
    state: ResearchStepState;
}

export interface ResearchPhase {
    id: string;
    label: string;
    state: ResearchStepState;
    /** What the round concluded, shown under the row as Claude's narrative entries are. */
    summary?: string;
    /** Round this phase drills into, so the panel can open its query groups directly. */
    round?: number;
    favicons: ResearchFavicon[];
}

export interface ResearchFavicon {
    id: string;
    url?: string;
    siteName: string;
}

const FAVICON_STRIP_LIMIT = 3;

const normalize = (text: string): string => text.trim().toLowerCase();

const formatSourceCount = (count: number): string => `${count} source${count === 1 ? '' : 's'}`;

/**
 * Distinct sites, first-seen order, capped for a strip. Keyed by site rather than by URL so
 * five hits on one domain do not fill the strip with the same mark.
 */
const toFaviconStrip = (sources: readonly ResearchSourceItem[]): ResearchFavicon[] => {
    const bySite = new Map<string, ResearchFavicon>();

    for (const source of sources) {
        if (bySite.size >= FAVICON_STRIP_LIMIT) break;
        if (bySite.has(source.siteName)) continue;

        bySite.set(source.siteName, { id: source.siteName, url: source.faviconUrl, siteName: source.siteName });
    }

    return [...bySite.values()];
};

export const collectFaviconStrip = (content: ResearchContent): ResearchFavicon[] =>
    toFaviconStrip(content.queryGroups.flatMap((group) => group.sources));

/**
 * The plan as a checklist.
 *
 * The signal is correlation when there is one: a round's query names the plan entry it serves
 * via `stepId`, `content.executedStepIds` collects those ids, and an entry listed there is
 * done as a matter of record.
 *
 * A backend that sends no `stepId` leaves that set empty, and only then do the two inferences
 * below apply. They exist so a partial backend still shows progress rather than a checklist
 * frozen at "nothing started":
 *
 * - an entry whose exact text a round also ran is done. Reliable but rare: a plan entry is an
 *   intent ("Compare pricing models") while a round's query is a search string ("acme pricing
 *   2026"), so the two seldom match.
 * - failing that, entries are assumed to be worked through in order, one per round: an entry
 *   sitting below the number of rounds reported is counted done. That is an assumption about
 *   pacing, not something the payload states, and it is wrong for a backend that spends
 *   several rounds on one entry.
 *
 * The first entry nothing marks done is active while the run is live; the rest are pending. A
 * settled run shows no active entry.
 */
export const buildPlanSteps = (content: ResearchContent, isRunning: boolean): ResearchStep[] => {
    const executedStepIds = new Set(content.executedStepIds);
    const executedTexts = new Set(
        content.queryGroups.filter((group) => !group.isUnattributed).map((group) => normalize(group.text)),
    );
    const roundCount = new Set(content.queryGroups.map((group) => group.round)).size;
    const isDone = (query: ResearchQueryItem, position: number): boolean =>
        executedStepIds.size > 0
            ? executedStepIds.has(query.id)
            : position < roundCount || executedTexts.has(normalize(query.text));
    let hasActive = false;

    return content.planQueries.map((query, position) => {
        if (isDone(query, position)) {
            return { id: query.id, text: query.text, state: 'done' as const };
        }

        if (isRunning && !hasActive) {
            hasActive = true;

            return { id: query.id, text: query.text, state: 'active' as const };
        }

        return { id: query.id, text: query.text, state: 'pending' as const };
    });
};

const groupsByRound = (groups: readonly ResearchQueryGroup[]): Map<number, ResearchQueryGroup[]> => {
    const byRound = new Map<number, ResearchQueryGroup[]>();

    for (const group of groups) {
        byRound.set(group.round, [...(byRound.get(group.round) ?? []), group]);
    }

    return byRound;
};

const buildRoundLabel = (sourceCount: number, isLive: boolean): string => {
    if (sourceCount === 0) return isLive ? 'Searching…' : 'No sources found';

    return isLive
        ? `Gathering ${formatSourceCount(sourceCount)} and counting…`
        : `Gathered ${formatSourceCount(sourceCount)}`;
};

/**
 * The phase the run is in right now, or nothing when it is not running. `content.phase` is
 * what the backend reports; `isRunning` alone cannot tell searching apart from writing the
 * report, and a run that is over has no live phase whatever a stale part still says. A
 * payload with no phase at all is treated as still searching, which is what every row below
 * assumed before the backend named its phases.
 */
const readActivePhase = (content: ResearchContent, isRunning: boolean): ResearchPhaseName | undefined => {
    // `isRunning` means the *searching* is still going, and it goes false the moment the report
    // starts streaming — so the writing phase has to be read off the payload instead, or a run
    // still writing its report is labelled as one that already wrote it.
    if (content.phase === 'writing') return 'writing';

    return isRunning ? (content.phase ?? 'searching') : undefined;
};

/**
 * The panel's top level: one row per phase the run reported, newest last. While the run is
 * searching, a round is live if one of its own queries is still `pending` and otherwise only
 * if it is the final one — an earlier round is finished by definition, because a later one
 * exists. Nothing is live in any other phase, so a leftover `pending` query cannot leave a
 * settled run with a row that reads as still working.
 */
export const buildResearchPhases = (content: ResearchContent, isRunning: boolean): ResearchPhase[] => {
    const activePhase = readActivePhase(content, isRunning);
    const phases: ResearchPhase[] = [];

    if (content.planQueries.length > 0) {
        phases.push({ id: 'plan', label: 'Research plan created', state: 'done', favicons: [] });
    } else if (activePhase === 'planning') {
        phases.push({ id: 'planning', label: 'Building a research plan', state: 'active', favicons: [] });
    }

    if (activePhase === 'awaiting-approval') {
        phases.push({ id: 'approval', label: 'Waiting for your go-ahead', state: 'active', favicons: [] });
    }

    const byRound = [...groupsByRound(content.queryGroups).entries()].sort(([a], [b]) => a - b);

    byRound.forEach(([round, groups], position) => {
        const sources = groups.flatMap((group) => group.sources);
        const isLast = position === byRound.length - 1;
        const isLive = activePhase === 'searching' && (groups.some((group) => group.status === 'pending') || isLast);

        const summary = content.roundSummaries.find((entry) => entry.round === round);

        phases.push({
            id: `round-${round}`,
            label: buildRoundLabel(sources.length, isLive),
            state: isLive ? 'active' : 'done',
            round,
            favicons: toFaviconStrip(sources),
            summary: summary?.text,
        });
    });

    if (phases.length === 0 && content.statusLabel !== undefined) {
        phases.push({
            id: 'status',
            label: content.statusLabel,
            state: activePhase === undefined ? 'done' : 'active',
            favicons: [],
        });
    }

    // A stopped run still leaves a settled-looking trail of phases, so the outcome must come from the tool call.
    if (!isRunning && content.runOutcome !== undefined) {
        phases.push({
            id: 'report',
            label: content.runOutcome === 'failed' ? 'Research failed' : 'Research stopped',
            state: 'stopped',
            favicons: [],
        });

        return phases;
    }

    if (content.queryGroups.length > 0) {
        if (activePhase === 'writing') {
            phases.push({ id: 'report', label: 'Writing the report…', state: 'active', favicons: [] });
        } else if ((activePhase === undefined || content.phase === 'done') && content.reportMarkdown !== undefined) {
            phases.push({ id: 'report', label: 'Research report is ready', state: 'done', favicons: [] });
        }
    }

    return phases;
};
