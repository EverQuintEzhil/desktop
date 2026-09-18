export interface ToolPartLabelCandidate {
    type?: unknown;
    toolName?: unknown;
    result?: unknown;
    output?: unknown;
    state?: unknown;
    isError?: unknown;
}

const stripMcpPrefix = (toolName: string) => toolName.replace(/^mcp_[^_]+_/, '');

const titleCase = (value: string) =>
    value
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

/** `run_python` -> `Run Python`, `mcp_atlassian_search_pages` -> `Search Pages`. The one
 * definition of how a raw tool name is shown, so a group header and the steps beneath it
 * cannot disagree about what the same tool is called. */
export const formatToolName = (name: string): string => titleCase(stripMcpPrefix(name));

const formatResourceName = (resource: string) => titleCase(resource).toLowerCase();

const pluralize = (resource: string): string => `${resource}${resource.endsWith('s') ? '' : 's'}`;

export const hasToolPartOutput = (part: ToolPartLabelCandidate): boolean =>
    part.result !== undefined || part.output !== undefined || part.state === 'output-available';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isToolPartErrored = (part: ToolPartLabelCandidate): boolean => {
    if (part.isError === true) return true;
    if (isRecord(part.result) && part.result.isError === true) return true;
    if (isRecord(part.output) && part.output.isError === true) return true;

    return false;
};

const getToolActionLabel = (toolName: string, part?: ToolPartLabelCandidate): string => {
    const normalizedName = stripMcpPrefix(toolName);
    const [action, ...resourceParts] = normalizedName.split('_');
    const resource = formatResourceName(resourceParts.join('_') || 'resource');
    const toolLabel = titleCase(normalizedName);
    const hasOutput = part ? hasToolPartOutput(part) : false;

    if (part && isToolPartErrored(part)) {
        return `${toolLabel} failed`;
    }

    if (action === 'ask') {
        return hasOutput ? `Used ${toolLabel}` : `Using ${toolLabel}`;
    }

    if (['find', 'list', 'query', 'search'].includes(action)) {
        return hasOutput ? `Searched ${pluralize(resource)}` : `Searching ${pluralize(resource)}`;
    }

    return hasOutput ? `Used ${toolLabel}` : `Using ${toolLabel}`;
};

export const getToolNameFromPart = (part: unknown): string | null => {
    if (typeof part !== 'object' || part === null) return null;

    const candidate = part as ToolPartLabelCandidate;

    if (candidate.type !== 'tool-call' || typeof candidate.toolName !== 'string') return null;

    return candidate.toolName;
};

export type ToolLabelPhase = 'running' | 'done';

export type ToolLabelResolver = (toolName: string, phase: ToolLabelPhase) => string | undefined;

export const getToolGroupLabel = (
    indices: readonly number[],
    parts: readonly unknown[],
    resolveLabel?: ToolLabelResolver,
): string => {
    const labels = indices.reduce<string[]>((acc, index) => {
        const part = parts[index];
        const toolName = getToolNameFromPart(part);

        if (!toolName) return acc;

        const candidate = part as ToolPartLabelCandidate;
        const phase = hasToolPartOutput(candidate) ? 'done' : 'running';
        const label = resolveLabel?.(toolName, phase) ?? getToolActionLabel(toolName, candidate);

        return acc.includes(label) ? acc : [...acc, label];
    }, []);

    if (labels.length === 0) return 'Using tools';

    const toolCount = indices.reduce((acc, index) => (getToolNameFromPart(parts[index]) ? acc + 1 : acc), 0);

    if (toolCount <= 1) return labels[0];
    if (toolCount === 2 && labels.length === 2)
        return `${labels[0]} and ${labels[1].charAt(0).toLowerCase()}${labels[1].slice(1)}`;

    const more = toolCount - 1;

    return `${labels[0]} and ${more} more step${more === 1 ? '' : 's'}`;
};

interface ToolGroupProgressEntry {
    startedAt: number;
    phase: 'running' | 'done';
    durationMs?: number;
}

export interface ToolGroupProgress {
    // Present-tense label of the most-recent active tool (running or done), held steady through between-tool gaps; null only before the first tool has any store entry.
    runningLabel: string | null;
    // Start anchor of the group (earliest tool start), drives the live ticker while any tool runs, else null.
    runningStartedAt: number | null;
    // Total elapsed of completed tools in the group (drives "Ran for Xs"), else null.
    durationMs: number | null;
    // Number of tool calls in the group, and how many of them contributed a duration to
    // `durationMs`. A caller reporting one span for the whole group needs the difference: not every
    // tool emits progress, so `durationMs` can be a partial sum that looks complete.
    toolCount: number;
    timedToolCount: number;
}

export const getToolGroupProgress = (
    indices: readonly number[],
    parts: readonly unknown[],
    tools: ReadonlyMap<string, ToolGroupProgressEntry>,
    persistedDurations?: Record<string, number>,
    resolveLabel?: ToolLabelResolver,
): ToolGroupProgress => {
    let runningLabel: string | null = null;
    let earliestStartedAt: number | null = null;
    let anyRunning = false;
    let durationMs: number | null = null;
    let toolCount = 0;
    let timedToolCount = 0;

    for (const index of indices) {
        const part = parts[index];

        if (typeof part !== 'object' || part === null) continue;
        const candidate = part as { type?: unknown; toolCallId?: unknown; toolName?: unknown };

        if (candidate.type !== 'tool-call' || typeof candidate.toolCallId !== 'string') continue;
        toolCount += 1;
        const entry = tools.get(candidate.toolCallId);

        if (!entry) {
            const persisted = persistedDurations?.[candidate.toolCallId];

            if (typeof persisted === 'number') {
                durationMs = (durationMs ?? 0) + persisted;
                timedToolCount += 1;
            }
            continue;
        }

        if (earliestStartedAt === null || entry.startedAt < earliestStartedAt) {
            earliestStartedAt = entry.startedAt;
        }

        if (entry.phase === 'running') {
            anyRunning = true;
        }

        if (typeof candidate.toolName === 'string') {
            runningLabel = resolveLabel?.(candidate.toolName, 'running') ?? getToolActionLabel(candidate.toolName);
        }

        if (entry.phase === 'done' && typeof entry.durationMs === 'number') {
            durationMs = (durationMs ?? 0) + entry.durationMs;
            timedToolCount += 1;
        }
    }

    const runningStartedAt = anyRunning ? earliestStartedAt : null;

    return { runningLabel, runningStartedAt, durationMs, toolCount, timedToolCount };
};
