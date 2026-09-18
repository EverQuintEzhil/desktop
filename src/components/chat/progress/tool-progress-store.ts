export interface ToolProgressEntry {
    toolCallId: string;
    toolName: string;
    refName?: string;
    kind?: string;
    startedAt: number;
    phase: 'running' | 'done';
    durationMs?: number;
}

export interface ToolProgressPart {
    id: string;
    phase?: string;
    toolName?: string;
    refName?: string;
    kind?: string;
    elapsedMs?: number;
}

export type ToolProgressSnapshot = ReadonlyMap<string, ToolProgressEntry>;

export interface ToolProgressStore {
    apply(part: ToolProgressPart): void;
    finalize(): void;
    clear(): void;
    subscribe(listener: () => void): () => void;
    getSnapshot(): ToolProgressSnapshot;
}

const EMPTY_SNAPSHOT: ToolProgressSnapshot = new Map();

// External store for live tool-execution progress. Keyed by toolCallId so a
// group's tool can be matched to its rendered tool-call part. A running entry
// drives the live ticker; on done it is frozen with its final duration (kept,
// not deleted) so the finished tool can show "Ran for Xs" for the session. An
// unchanged periodic tick produces no new snapshot and no re-render.
export const createToolProgressStore = (): ToolProgressStore => {
    let snapshot: ToolProgressSnapshot = EMPTY_SNAPSHOT;
    const listeners = new Set<() => void>();

    const emit = () => {
        listeners.forEach((listener) => listener());
    };

    const isSameEntry = (a: ToolProgressEntry | undefined, b: ToolProgressEntry) =>
        a?.toolName === b.toolName &&
        a.refName === b.refName &&
        a.kind === b.kind &&
        a.startedAt === b.startedAt &&
        a.phase === b.phase &&
        a.durationMs === b.durationMs;

    const commit = (toolCallId: string, entry: ToolProgressEntry) => {
        if (isSameEntry(snapshot.get(toolCallId), entry)) return;

        const next = new Map(snapshot);

        next.set(toolCallId, entry);
        snapshot = next;
        emit();
    };

    return {
        apply(part) {
            const toolCallId = part.id;

            if (!toolCallId) return;

            const existing = snapshot.get(toolCallId);
            const startedAt = existing?.startedAt ?? Date.now() - (part.elapsedMs ?? 0);
            const isDone = part.phase === 'done' || part.phase === 'error';

            commit(toolCallId, {
                toolCallId,
                toolName: part.toolName ?? existing?.toolName ?? toolCallId,
                refName: part.refName ?? existing?.refName,
                kind: part.kind ?? existing?.kind,
                startedAt,
                phase: isDone ? 'done' : 'running',
                durationMs: isDone ? (part.elapsedMs ?? Date.now() - startedAt) : undefined,
            });
        },
        // Freeze any entries still running when the turn settles (e.g. abort or
        // error, where no 'done' part arrives) so their tickers stop and they
        // show a final duration instead of counting forever.
        finalize() {
            let next: Map<string, ToolProgressEntry> | null = null;

            snapshot.forEach((entry, toolCallId) => {
                if (entry.phase !== 'running') return;
                if (!next) next = new Map(snapshot);
                next.set(toolCallId, { ...entry, phase: 'done', durationMs: Date.now() - entry.startedAt });
            });

            if (!next) return;
            snapshot = next;
            emit();
        },
        clear() {
            if (snapshot.size === 0) return;
            snapshot = EMPTY_SNAPSHOT;
            emit();
        },
        subscribe(listener) {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot() {
            return snapshot;
        },
    };
};
