import { arrayMove } from '@dnd-kit/helpers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import isEqual from 'lodash/isEqual';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { appAgentLayoutApi, type AgentLayoutPayload, type AgentPinScope } from '@/lib/api/app/agent-layout';

import { AGENT_PIN_LIMIT } from './constants';
import { agentLayoutSchema, type AgentLayout } from './types';

export interface UseAgentLayoutOptions {
    userId: string;
    /** Which tab's list is read and written; the two tabs hold different id spaces. */
    scope: AgentPinScope;
    /** Order for a user who has never customized this tab. `null` = not resolved yet, so every write is refused. */
    defaultPinnedIds: string[] | null;
}

export interface UseAgentLayoutResult {
    pinnedIds: string[];
    isPinned: (id: string) => boolean;
    isPinnable: boolean;
    /** While false every write — `togglePin`, `reorderPinned`, `pruneStalePins` — is a silent no-op, so consumers must disable their pin controls. */
    isLayoutWritable: boolean;
    pinLimit: number;
    togglePin: (id: string) => void;
    reorderPinned: (activeId: string, overId: string) => void;
    pruneStalePins: (staleIds: string[]) => void;
}

export const AGENT_LAYOUT_QUERY_KEY = 'agent-layout';

/** No push channel for the row, so this expiry plus the refetch on window focus is the only way another device's change is seen. */
const AGENT_LAYOUT_STALE_TIME_MS = 30_000;

/** One stable identity for "nothing pinned", so an unresolved render does not churn consumers. */
const NO_PINS: string[] = [];

/**
 * The order the newest gesture put on screen. React state rather than a cache read: react-query
 * notifies observers from `notifyManager`, which schedules through `setTimeout`, so the render a
 * `setQueryData` causes lands one macrotask after the drag library measures the dropped tile.
 */
interface PinnedGesture {
    userId: string;
    scope: AgentPinScope;
    seq: number;
    pinned: string[];
}

interface AgentLayoutWrite {
    /** Only the scope being written, so the other tab's stored list survives the merge. */
    patch: AgentLayoutPayload;
    seq: number;
    previous: AgentLayout | null;
}

interface PendingWrite {
    scope: AgentPinScope;
    pinned: string[];
}

/**
 * An absent key resolves to the defaults; a stored empty array means "pinned nothing on purpose".
 * Never self-prunes against loaded agents — a pinned id can live on an unfetched page. Stale ids are
 * dropped only by the screen via `pruneStalePins`, once the by-ids lookup confirms they resolve to nothing.
 */
const resolvePinned = (
    layout: AgentLayout | null | undefined,
    scope: AgentPinScope,
    defaultPinnedIds: string[],
): string[] => (layout?.[scope] ?? defaultPinnedIds).slice(0, AGENT_PIN_LIMIT);

/** A row that fails the schema resolves to "never customized" rather than failing the read. */
const parseAgentLayout = (value: unknown): AgentLayout | null => {
    const parsed = agentLayoutSchema.safeParse(value);

    return parsed.success ? parsed.data : null;
};

/** Per-user pinned agents for one tab of the agents home page, persisted through `/users/me/agentlayout`. */
export const useAgentLayout = (options: UseAgentLayoutOptions): UseAgentLayoutResult => {
    const { userId, scope, defaultPinnedIds } = options;
    const queryClient = useQueryClient();
    const queryKey = useMemo(() => [AGENT_LAYOUT_QUERY_KEY, userId], [userId]);

    // Latched by content: callers pass a freshly derived defaults array, so identity alone would
    // hand the sortable list and consumer effect arrays a new reference every render.
    const latched = useRef<string[]>(NO_PINS);
    // Newest write's sequence number, so a superseded failure neither rolls the cache back nor
    // triggers a refetch that would resurrect a stale order.
    const writeSeq = useRef(0);
    // react-query applies `onMutate` on a microtask after `mutate()` returns, so the cache is still
    // stale for a second gesture fired in the same tick.
    const pendingPinned = useRef<PendingWrite | null>(null);
    const ownerRef = useRef(userId);
    const [gesture, setGesture] = useState<PinnedGesture | null>(null);

    // Only `queryKey` is per-user, so every ref above has to be handed over with it or one user's
    // order is written under the next user's key. A scope change deliberately hands nothing over:
    // the row is the same, and retiring `writeSeq` would orphan an in-flight write.
    if (ownerRef.current !== userId) {
        ownerRef.current = userId;
        latched.current = NO_PINS;
        writeSeq.current = 0;
        pendingPinned.current = null;
    }

    const { data: stored, isSuccess: isStoredSettled } = useQuery({
        queryKey,
        queryFn: async () => parseAgentLayout(await appAgentLayoutApi.get()),
        enabled: Boolean(userId),
        staleTime: AGENT_LAYOUT_STALE_TIME_MS,
        // A refetch resolving over an unsettled write would put the pre-write order back on screen.
        refetchOnWindowFocus: () => pendingPinned.current === null,
    });

    // A disabled query never settles, so a render without a user id has to resolve to "nothing stored".
    const isStoredResolved = !userId || isStoredSettled;
    const isResolved = isStoredResolved && defaultPinnedIds !== null;
    const resolved = isResolved ? resolvePinned(stored, scope, defaultPinnedIds) : NO_PINS;

    // A gesture outranks the store until the store catches up.
    const isGestureLive =
        gesture !== null &&
        gesture.userId === userId &&
        gesture.scope === scope &&
        gesture.seq === writeSeq.current &&
        !isEqual(gesture.pinned, resolved);

    const applied = isGestureLive ? gesture.pinned : resolved;

    if (!isEqual(applied, latched.current)) {
        latched.current = applied;
    }

    const pinnedIds = latched.current;

    // Held in a ref because a write derives the next order at call time, not at render time.
    const writableDefaultsRef = useRef<string[] | null>(null);

    writableDefaultsRef.current = isResolved ? defaultPinnedIds : null;

    const { mutate } = useMutation({
        // Serializes the writes: racing gestures would leave the store holding the loser's order.
        scope: { id: `${AGENT_LAYOUT_QUERY_KEY}-${userId}` },
        mutationFn: async ({ patch }: AgentLayoutWrite) => {
            await appAgentLayoutApi.save(patch);
        },
        // No `onMutate`: react-query runs it a microtask after `mutate()` returns, one React commit
        // too late for the drop animation, so `writePinned` owns the optimistic update.
        onError: (_error, { seq, previous }) => {
            if (seq !== writeSeq.current) {
                return;
            }

            queryClient.setQueryData<AgentLayout | null>(queryKey, previous);
            // The gesture outranks the cache, so the restored order only shows once it is retired too.
            setGesture(null);

            toast.error("Couldn't save your pinned agents. Please try again.");
        },
        onSettled: (_data, _error, { seq }) => {
            if (seq !== writeSeq.current) {
                return;
            }

            pendingPinned.current = null;
            // Left live, the gesture would mask a later refetch carrying another context's order.
            setGesture(null);
            void queryClient.invalidateQueries({ queryKey });
        },
    });

    /**
     * Derives the next order from the freshest known value rather than from a render-time closure,
     * so two gestures fired inside one tick cannot lose the first one. The order reaches the screen
     * through `setGesture`, in this task: dnd-kit measures the dropped tile once its own `onDragEnd`
     * render commits, and an order that only lands in the react-query cache arrives after that.
     */
    const writePinned = useCallback(
        (next: (current: string[]) => string[]) => {
            const defaults = writableDefaultsRef.current;

            if (!userId || defaults === null) {
                return;
            }

            const previous = queryClient.getQueryData<AgentLayout | null>(queryKey) ?? null;
            const pending = pendingPinned.current;
            const current =
                pending !== null && pending.scope === scope ? pending.pinned : resolvePinned(previous, scope, defaults);
            const pinned = next(current);

            if (pinned === current) {
                return;
            }

            // Merged rather than replaced, mirroring the endpoint: the request carries this tab's key
            // only, so the other tab's list has to survive the write in the cache too.
            const layout: AgentLayout = { ...previous, [scope]: pinned };

            // An in-flight read would otherwise resolve over the value just set. Not awaited, so the
            // cache write stays in this task.
            void queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData<AgentLayout | null>(queryKey, layout);

            pendingPinned.current = { scope, pinned };
            writeSeq.current += 1;
            setGesture({
                userId,
                scope,
                seq: writeSeq.current,
                pinned,
            });
            mutate({ patch: { [scope]: pinned }, seq: writeSeq.current, previous });
        },
        [userId, scope, queryClient, queryKey, mutate],
    );

    const pruneStalePins = useCallback(
        (staleIds: string[]) => {
            if (staleIds.length === 0) return;

            const stale = new Set(staleIds);

            writePinned((current) => {
                const next = current.filter((id) => !stale.has(id));

                // Same reference when nothing was removed, so writePinned's `pinned === current` guard no-ops.
                return next.length === current.length ? current : next;
            });
        },
        [writePinned],
    );

    const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

    const togglePin = useCallback(
        (id: string) =>
            writePinned((current) => {
                if (current.includes(id)) {
                    return current.filter((pinnedId) => pinnedId !== id);
                }

                if (current.length >= AGENT_PIN_LIMIT) {
                    return current;
                }

                return [...current, id];
            }),
        [writePinned],
    );

    const reorderPinned = useCallback(
        (activeId: string, overId: string) =>
            writePinned((current) => {
                const from = current.indexOf(activeId);
                const to = current.indexOf(overId);

                if (from < 0 || to < 0 || from === to) {
                    return current;
                }

                return arrayMove(current, from, to);
            }),
        [writePinned],
    );

    return {
        pinnedIds,
        isPinned,
        isPinnable: pinnedIds.length < AGENT_PIN_LIMIT,
        isLayoutWritable: Boolean(userId) && isResolved,
        pinLimit: AGENT_PIN_LIMIT,
        togglePin,
        reorderPinned,
        pruneStalePins,
    };
};
