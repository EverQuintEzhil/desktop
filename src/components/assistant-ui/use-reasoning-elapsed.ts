import { useAuiState } from '@assistant-ui/react';
import { useEffect, useRef, useState } from 'react';

interface ReasoningElapsed {
    isStreaming: boolean;
    elapsedMs: number | undefined;
}

/**
 * Wall-clock time the model spent streaming reasoning parts within `[startIndex, endIndex]`.
 * Bursts are summed, so a group holding several reasoning runs reports their total rather
 * than only the first.
 *
 * `allowPersistedFallback` gates the replayed-history value: `metadata.custom.reasoningMs` covers
 * the whole message, so only a caller that owns every reasoning part in that message may claim it.
 * Any other caller reports no duration rather than a wrong one.
 */
export const useReasoningElapsed = (
    startIndex: number,
    endIndex: number,
    allowPersistedFallback = true,
): ReasoningElapsed => {
    const isStreaming = useAuiState((s) => {
        if (s.message.status?.type !== 'running') return false;

        const lastIndex = s.message.parts.length - 1;

        if (lastIndex < 0) return false;
        if (s.message.parts[lastIndex]?.type !== 'reasoning') return false;

        return lastIndex >= startIndex && lastIndex <= endIndex;
    });

    const persistedReasoningMs = useAuiState(
        (s) => (s.message.metadata?.custom as { reasoningMs?: number } | undefined)?.reasoningMs,
    );

    const startedAtRef = useRef<number | null>(null);
    const [measuredMs, setMeasuredMs] = useState<number | null>(null);

    useEffect(() => {
        if (isStreaming) {
            if (startedAtRef.current === null) {
                startedAtRef.current = Date.now();
            }

            return;
        }

        if (startedAtRef.current === null) return;

        const burstMs = Date.now() - startedAtRef.current;

        startedAtRef.current = null;
        setMeasuredMs((previous) => (previous ?? 0) + burstMs);
    }, [isStreaming]);

    const fallbackMs = allowPersistedFallback ? persistedReasoningMs : undefined;

    return { isStreaming, elapsedMs: measuredMs ?? fallbackMs ?? undefined };
};
