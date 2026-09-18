import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { agentPreferencesApi } from '@/lib/api/common/agent-preferences';

interface ModelWrite {
    agentId: string;
    modelId: string;
    seq: number;
}

export interface AgentModelPreference {
    persistedModelId: string | null;
    persistModelId: (modelId: string) => void;
}

export const agentModelPreferenceQueryKey = (agentId: string): unknown[] => ['agent-preferences', agentId];

/**
 * Also consumed by the chat-agent screen, which prefetches these options at
 * mount so the request is in flight before the composer's own `useQuery`
 * subscribes. The `staleTime` is what keeps that pair to a single request —
 * without it the composer would refetch on subscribe and the model could flip
 * twice.
 */
export const agentModelPreferenceQueryOptions = (agentId: string) =>
    queryOptions({
        queryKey: agentModelPreferenceQueryKey(agentId),
        queryFn: ({ signal }) => agentPreferencesApi.getPreferences(agentId, { signal }),
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

/**
 * True once the preference can no longer change the composer's first paint —
 * resolved, errored (`retry: false`, so one failure settles it), disabled
 * because there is no agent id, or paused. Paused is the one that is not
 * obvious: react-query's default `networkMode: 'online'` leaves an offline
 * query `isPending` with `fetchStatus === 'paused'` indefinitely, so treating
 * only `isPending` as unsettled would hold a skeleton up forever offline.
 *
 * Shares `agentModelPreferenceQueryOptions` with `useAgentModelPreference`, so
 * subscribing here adds no second request.
 */
export const useAgentModelPreferenceSettled = (agentId: string): boolean => {
    const { isPending, fetchStatus } = useQuery({
        ...agentModelPreferenceQueryOptions(agentId),
        enabled: !!agentId,
    });

    return !isPending || fetchStatus !== 'fetching';
};

/**
 * Per-user, per-agent default chat model, stored server-side under the
 * `defaultModelId` key of the agent preferences jsonb.
 */
export const useAgentModelPreference = (agentId: string): AgentModelPreference => {
    const queryClient = useQueryClient();

    const { data } = useQuery({
        ...agentModelPreferenceQueryOptions(agentId),
        enabled: !!agentId,
    });

    const persistedModelId = data?.defaultModelId ?? null;
    const persistedModelIdRef = useRef(persistedModelId);

    persistedModelIdRef.current = persistedModelId;

    // The id of the most recent write we asked for, which is ahead of the query
    // data while a write is in flight. Comparing against the server-confirmed id
    // instead would drop an A -> B -> A re-pick and leave the server on B.
    const requestedModelIdRef = useRef<string | null>(null);
    // Latest write sequence per agent. Keyed by agent id, not a single counter:
    // a shared counter lets a newer write for agent B suppress the cache update
    // of an older-but-still-latest write for agent A (surfaces that swap the
    // agent prop in place rather than remounting), leaving A's cache stale.
    const latestWriteSeqRef = useRef<Map<string, number>>(new Map());
    const agentIdRef = useRef(agentId);

    if (agentIdRef.current !== agentId) {
        agentIdRef.current = agentId;
        // The dedupe id belongs to the agent it was written for; carried over it
        // would swallow the next agent's first genuine pick.
        requestedModelIdRef.current = null;
    }

    const { mutate } = useMutation({
        mutationFn: ({ agentId: writeAgentId, modelId }: ModelWrite) =>
            agentPreferencesApi.patchPreferences(writeAgentId, { defaultModelId: modelId }),
        onSuccess: (result, { agentId: writeAgentId, modelId, seq }) => {
            if (seq !== latestWriteSeqRef.current.get(writeAgentId)) return;

            // Keyed on the agent captured at `mutate()` time: `setOptions`
            // replaces a pending mutation's callbacks, so reading the current
            // render's agent here would write this model into whichever agent
            // the user has since switched to.
            queryClient.setQueryData(agentModelPreferenceQueryKey(writeAgentId), result ?? { defaultModelId: modelId });
        },
        onError: (_error, { agentId: writeAgentId, seq }) => {
            if (seq !== latestWriteSeqRef.current.get(writeAgentId) || writeAgentId !== agentIdRef.current) return;

            requestedModelIdRef.current = null;
        },
    });

    const persistModelId = useCallback(
        (modelId: string) => {
            if (!agentId) return;

            const lastKnownModelId = requestedModelIdRef.current ?? persistedModelIdRef.current;

            if (modelId === lastKnownModelId) return;

            requestedModelIdRef.current = modelId;
            const nextSeq = (latestWriteSeqRef.current.get(agentId) ?? 0) + 1;

            latestWriteSeqRef.current.set(agentId, nextSeq);

            mutate({ agentId, modelId, seq: nextSeq });
        },
        [agentId, mutate],
    );

    return {
        persistedModelId,
        persistModelId,
    };
};
