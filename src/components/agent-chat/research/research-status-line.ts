import { formatElapsed } from '@/components/assistant-ui/format-elapsed';

import type { ResearchContent, ResearchRunOutcome } from './research-contract';

const formatSourceCount = (count: number): string => `${count} source${count === 1 ? '' : 's'}`;

const joinStatus = (...segments: (string | undefined)[]): string => segments.filter(Boolean).join(' • ');

/**
 * Precedence for the reading: the receipt persisted with a settled run, then a clock anchored
 * to the run's own `startedAt`, then the duration the backend measured, then a clock measured
 * from mount. The persisted one wins so a reloaded run reads exactly as it did live. An
 * anchored clock outranks the backend's number because status parts arrive every few seconds
 * and the reading would otherwise freeze between them; unanchored, ours starts at mount and
 * the backend's is the honest one. Re-applied here rather than left to `useElapsedMs` alone
 * because a caller may hand this function a raw locally-measured reading.
 */
export const resolveResearchElapsedMs = (
    content: ResearchContent,
    measuredMs: number,
    persistedDurationMs?: number,
): number | undefined => {
    if (persistedDurationMs !== undefined) return persistedDurationMs;
    if (content.startedAt !== undefined && measuredMs > 0) return measuredMs;

    return content.reportedElapsedMs ?? (measuredMs > 0 ? measuredMs : undefined);
};

/**
 * Shared by the plan card and the compact row so a run reads the same either side of the
 * collapse: the counter the backend is reporting must not vanish when the card changes shape.
 */
export const buildRunningStatus = (content: ResearchContent, elapsedMs: number): string => {
    const count = Math.max(content.sourceCount, content.runningSourceCount);
    const lead = count > 0 ? `${formatSourceCount(count)} and counting…` : (content.statusLabel ?? 'Researching…');

    return joinStatus(lead, formatElapsed(resolveResearchElapsedMs(content, elapsedMs) ?? 0));
};

const SETTLED_LEAD: Record<ResearchRunOutcome, string> = {
    failed: 'Research failed',
    unfinished: 'Research stopped',
};

export const buildSettledStatus = (
    content: ResearchContent,
    durationMs: number | undefined,
    outcome?: ResearchRunOutcome,
): string =>
    joinStatus(
        outcome === undefined ? 'Research complete' : SETTLED_LEAD[outcome],
        content.sourceCount > 0 ? formatSourceCount(content.sourceCount) : undefined,
        durationMs !== undefined ? formatElapsed(durationMs) : undefined,
    );
