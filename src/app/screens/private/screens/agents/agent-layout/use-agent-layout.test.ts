import type { QueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AgentLayoutPayload, AgentPinScope } from '@/lib/api/app/agent-layout';
import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';
import { renderHookWithProviders } from '@/test/test-utils';

import { AGENT_PIN_LIMIT } from './constants';
import type { AgentLayout } from './types';
import { AGENT_LAYOUT_QUERY_KEY, useAgentLayout, type UseAgentLayoutOptions } from './use-agent-layout';

const LAYOUT_PATH = '/users/me/agentlayout';

interface LayoutEndpointOptions {
    /** Keeps a write open long enough for a second one to be observed queueing behind it. */
    writeDelayMs?: number;
}

interface LayoutEndpoint {
    /** Every body the `PUT` received, in arrival order. */
    bodies: AgentLayoutPayload[];
    /** `start:`/`done:` markers per write, so serialization is observable. */
    timeline: string[];
    /** `GET` count, which is how a refetch is detected. */
    reads: () => number;
    /** The whole row the endpoint would answer with now, or `null` for no row. */
    row: () => AgentLayoutPayload | null;
    /** One tab's stored list, `undefined` when that tab was never customized. */
    pins: (scope: AgentPinScope) => string[] | undefined;
    /** Rewrites the row the way another tab or device would. */
    setRow: (layout: AgentLayoutPayload | null) => void;
    /** Leaves the next writes unanswered until `releaseWrites`. */
    holdWrites: () => void;
    releaseWrites: () => void;
}

const patchLabel = (patch: AgentLayoutPayload): string =>
    Object.entries(patch)
        .map(([scope, pinned]) => `${scope}=${pinned?.join(',')}`)
        .join('|');

/**
 * A single stored row behind the real endpoint, so every assertion runs through `apiClient`, the
 * envelope unwrap and the zod parse. The `PUT` merges the patch over the row the way the endpoint's
 * jsonb `||` does.
 */
const stubLayoutEndpoint = (
    initial: AgentLayoutPayload | null = null,
    options: LayoutEndpointOptions = {},
): LayoutEndpoint => {
    let current: AgentLayoutPayload | null = initial;
    let reads = 0;
    let hold: Promise<void> | null = null;
    let release: (() => void) | null = null;
    const bodies: AgentLayoutPayload[] = [];
    const timeline: string[] = [];

    server.use(
        http.get(apiUrl(LAYOUT_PATH), () => {
            reads += 1;

            return envelope(current);
        }),
        http.put(apiUrl(LAYOUT_PATH), async ({ request }) => {
            const body = (await request.json()) as AgentLayoutPayload;
            const label = patchLabel(body);

            bodies.push(body);
            timeline.push(`start:${label}`);

            if (options.writeDelayMs !== undefined) {
                await new Promise((resolve) => {
                    setTimeout(resolve, options.writeDelayMs);
                });
            }

            if (hold !== null) {
                await hold;
            }

            current = { ...current, ...body };
            timeline.push(`done:${label}`);

            return envelope(current);
        }),
    );

    return {
        bodies,
        timeline,
        reads: () => reads,
        row: () => current,
        pins: (scope) => current?.[scope],
        setRow: (layout) => {
            current = layout;
        },
        holdWrites: () => {
            hold = new Promise((resolve) => {
                release = resolve;
            });
        },
        releaseWrites: () => {
            release?.();
            hold = null;
            release = null;
        },
    };
};

/** Derived from the cap, so raising it cannot leave a case asserting nothing. */
const agentIds = (count: number): string[] => Array.from({ length: count }, (_unused, index) => `agent-${index}`);

const AT_CAP = agentIds(AGENT_PIN_LIMIT);
const OVER_CAP = agentIds(AGENT_PIN_LIMIT + 2);

const renderLayout = (overrides: Partial<UseAgentLayoutOptions> = {}) =>
    renderHookWithProviders(() =>
        useAgentLayout({
            userId: 'user-1',
            scope: 'firm',
            defaultPinnedIds: ['a', 'b'],
            ...overrides,
        }),
    );

const settled = async (expected: string[], result: { current: { pinnedIds: string[] } }) => {
    await waitFor(() => {
        expect(result.current.pinnedIds).toEqual(expected);
    });
};

/**
 * An unresolved layout also reads as "nothing pinned", so a case whose expected order is empty has
 * to wait for this rather than for `pinnedIds`: otherwise the gesture under test fires before the
 * read settles and is refused by the write gate.
 */
const writable = async (result: { current: { isLayoutWritable: boolean } }) => {
    await waitFor(() => {
        expect(result.current.isLayoutWritable).toBe(true);
    });
};

/**
 * react-query only refetches a *stale* query on focus, and the layout query's `staleTime` is 30s,
 * so freshness has to be simulated by moving the clock rather than by waiting.
 */
const focusAfterStaleTime = () => {
    const realNow = Date.now();

    vi.spyOn(Date, 'now').mockReturnValue(realNow + 31_000);
    window.dispatchEvent(new Event('visibilitychange'));
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useAgentLayout resolution', () => {
    it('falls back to the defaults when the server has no row for the user', async () => {
        stubLayoutEndpoint(null);

        const { result } = renderLayout();

        await settled(['a', 'b'], result);
        expect(result.current.pinLimit).toBe(AGENT_PIN_LIMIT);
        expect(result.current.isLayoutWritable).toBe(true);
    });

    it('does not re-apply the defaults for a stored empty list', async () => {
        stubLayoutEndpoint({ firm: [] });

        const { result } = renderLayout();

        await settled([], result);
    });

    it('uses the stored order rather than the defaults', async () => {
        stubLayoutEndpoint({ firm: ['b', 'c'] });

        const { result } = renderLayout();

        await settled(['b', 'c'], result);
    });

    it('falls back to the defaults when the row fails the schema', async () => {
        server.use(respond('get', LAYOUT_PATH, () => envelope({ firm: [1, 2] })));

        const { result } = renderLayout();

        await settled(['a', 'b'], result);
    });

    it('caps a stored row that is longer than the pin limit', async () => {
        stubLayoutEndpoint({ firm: OVER_CAP });

        const { result } = renderLayout();

        await settled(OVER_CAP.slice(0, AGENT_PIN_LIMIT), result);
        expect(result.current.pinnedIds).toHaveLength(AGENT_PIN_LIMIT);
        expect(result.current.isPinnable).toBe(false);
    });

    it('de-duplicates a stored row, keeping the first occurrence', async () => {
        stubLayoutEndpoint({ firm: ['a', 'b', 'a', 'c', 'b'] });

        const { result } = renderLayout();

        await settled(['a', 'b', 'c'], result);
    });

    it('stays on the defaults without a user id, and reads nothing', async () => {
        const endpoint = stubLayoutEndpoint(null);

        const { result } = renderLayout({ userId: '' });

        await settled(['a', 'b'], result);

        act(() => {
            result.current.togglePin('c');
        });

        expect(result.current.isLayoutWritable).toBe(false);
        expect(endpoint.reads()).toBe(0);
        expect(endpoint.bodies).toEqual([]);
    });
});

/*
 * The two tabs are backed by different tables — My lists `agents._id`, firmwide lists
 * `launchers._id` — so an id pinned in one can never resolve in the other, and the row keeps them
 * as separate lists.
 */
describe('useAgentLayout scope separation', () => {
    it('reads only the scope it was given', async () => {
        stubLayoutEndpoint({ my: ['mine-1'], firm: ['firm-1', 'firm-2'] });

        const firm = renderLayout();

        await settled(['firm-1', 'firm-2'], firm.result);

        const my = renderLayout({ scope: 'my', defaultPinnedIds: [] });

        await settled(['mine-1'], my.result);
    });

    it('still applies the firmwide defaults when only the my list has been customized', async () => {
        stubLayoutEndpoint({ my: ['mine-1'] });

        const { result } = renderLayout();

        await settled(['a', 'b'], result);
    });

    it('sends only the my key and leaves the stored firmwide list untouched', async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['firm-1', 'firm-2'] });

        const { result } = renderLayout({ scope: 'my', defaultPinnedIds: [] });

        await writable(result);
        expect(result.current.pinnedIds).toEqual([]);

        act(() => {
            result.current.togglePin('mine-1');
        });

        await waitFor(() => {
            expect(endpoint.bodies).toHaveLength(1);
        });

        expect(endpoint.bodies[0]).toEqual({ my: ['mine-1'] });
        expect(Object.keys(endpoint.bodies[0])).toEqual(['my']);
        expect(endpoint.pins('firm')).toEqual(['firm-1', 'firm-2']);
        expect(endpoint.pins('my')).toEqual(['mine-1']);
    });

    it('caps each list on its own, so a full my tab does not spend the firmwide allowance', async () => {
        const endpoint = stubLayoutEndpoint({ my: AT_CAP });

        const my = renderLayout({ scope: 'my', defaultPinnedIds: [] });

        await settled(AT_CAP, my.result);
        expect(my.result.current.isPinnable).toBe(false);

        act(() => {
            my.result.current.togglePin('one-too-many');
        });

        await settled(AT_CAP, my.result);
        expect(endpoint.bodies).toEqual([]);

        const firm = renderLayout({ defaultPinnedIds: [] });

        await writable(firm.result);
        expect(firm.result.current.pinnedIds).toEqual([]);
        expect(firm.result.current.isPinnable).toBe(true);

        act(() => {
            firm.result.current.togglePin('firm-1');
        });

        await settled(['firm-1'], firm.result);
        expect(endpoint.bodies).toEqual([{ firm: ['firm-1'] }]);
        expect(endpoint.pins('my')).toEqual(AT_CAP);
    });

    it('writes nothing when the user switches tabs', async () => {
        const endpoint = stubLayoutEndpoint({ my: ['mine-1'], firm: ['firm-1'] });

        const { result, rerender } = renderHookWithProviders(
            ({ scope }: { scope: AgentPinScope }) =>
                useAgentLayout({
                    userId: 'user-1',
                    scope,
                    defaultPinnedIds: scope === 'my' ? [] : ['a', 'b'],
                }),
            { initialProps: { scope: 'firm' as AgentPinScope } },
        );

        await settled(['firm-1'], result);
        expect(endpoint.reads()).toBe(1);

        rerender({ scope: 'my' });

        await settled(['mine-1'], result);

        rerender({ scope: 'firm' });

        await settled(['firm-1'], result);
        expect(endpoint.bodies).toEqual([]);
        // The row is one query regardless of the active tab, so switching costs no request either.
        expect(endpoint.reads()).toBe(1);
    });

    it('does not carry a gesture from the tab the user just left', async () => {
        const endpoint = stubLayoutEndpoint({ my: ['mine-1'], firm: ['firm-1'] });

        endpoint.holdWrites();

        const { result, rerender } = renderHookWithProviders(
            ({ scope }: { scope: AgentPinScope }) =>
                useAgentLayout({
                    userId: 'user-1',
                    scope,
                    defaultPinnedIds: scope === 'my' ? [] : ['a', 'b'],
                }),
            { initialProps: { scope: 'firm' as AgentPinScope } },
        );

        await settled(['firm-1'], result);

        act(() => {
            result.current.togglePin('firm-2');
        });

        await settled(['firm-1', 'firm-2'], result);

        rerender({ scope: 'my' });

        await settled(['mine-1'], result);

        endpoint.releaseWrites();

        await waitFor(() => {
            expect(endpoint.pins('firm')).toEqual(['firm-1', 'firm-2']);
        });
        await settled(['mine-1'], result);
    });
});

describe('useAgentLayout when the read fails', () => {
    it('refuses every write and reports the layout unwritable, so the pin controls can be disabled', async () => {
        const endpoint = stubLayoutEndpoint(null);

        server.use(respond('get', LAYOUT_PATH, () => httpError(500)));

        const { result } = renderLayout();

        await waitFor(() => {
            expect(result.current.isLayoutWritable).toBe(false);
        });

        expect(result.current.pinnedIds).toEqual([]);

        act(() => {
            result.current.togglePin('c');
            result.current.reorderPinned('a', 'b');
        });

        await settled([], result);
        expect(endpoint.bodies).toEqual([]);
    });

    it('refuses every write under the my scope too, where the defaults need no request', async () => {
        const endpoint = stubLayoutEndpoint(null);
        let failedReads = 0;

        server.use(
            http.get(apiUrl(LAYOUT_PATH), () => {
                failedReads += 1;

                return httpError(500);
            }),
        );

        const { result } = renderLayout({ scope: 'my', defaultPinnedIds: [] });

        // The read has to have failed for the refusal below to be attributable to it rather than to
        // a layout that had simply not arrived yet.
        await waitFor(() => {
            expect(failedReads).toBeGreaterThan(0);
        });
        expect(result.current.isLayoutWritable).toBe(false);

        act(() => {
            result.current.togglePin('mine-1');
        });

        await settled([], result);
        expect(endpoint.bodies).toEqual([]);
    });
});

describe('useAgentLayout before the default set resolves', () => {
    it('pins nothing while the default set is unknown', async () => {
        stubLayoutEndpoint(null);

        const { result } = renderLayout({ defaultPinnedIds: null });

        await settled([], result);
        expect(result.current.isPinned('a')).toBe(false);
        expect(result.current.isLayoutWritable).toBe(false);
    });

    it('refuses a pin rather than persisting a list seeded from an unknown default set', async () => {
        const endpoint = stubLayoutEndpoint(null);

        const { result } = renderLayout({ defaultPinnedIds: null });

        await settled([], result);

        act(() => {
            result.current.togglePin('c');
        });

        await settled([], result);
        expect(endpoint.bodies).toEqual([]);
    });

    it('refuses a reorder rather than persisting a list seeded from an unknown default set', async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result } = renderLayout({ defaultPinnedIds: null });

        await settled([], result);

        act(() => {
            result.current.reorderPinned('b', 'a');
        });

        await settled([], result);
        expect(endpoint.bodies).toEqual([]);
        expect(endpoint.pins('firm')).toEqual(['a', 'b']);
    });

    it('applies the stored order as soon as the default set arrives', async () => {
        stubLayoutEndpoint({ firm: ['b', 'c'] });

        const initialProps: { defaultPinnedIds: string[] | null } = { defaultPinnedIds: null };

        const { result, rerender } = renderHookWithProviders(
            ({ defaultPinnedIds }: { defaultPinnedIds: string[] | null }) =>
                useAgentLayout({
                    userId: 'user-1',
                    scope: 'firm',
                    defaultPinnedIds,
                }),
            { initialProps },
        );

        await settled([], result);

        rerender({ defaultPinnedIds: ['a'] });

        await settled(['b', 'c'], result);
    });
});

/*
 * dnd-kit measures the dropped tile as soon as its `onDragEnd` render commits, so the order has to
 * be on screen by then. react-query notifies its observers from a `setTimeout`, a macrotask, which
 * lands strictly later — so `pinnedIds` has to come from state the gesture set. A synchronous `act`
 * flushes React but no timers, which is exactly the window being asserted.
 */
describe('useAgentLayout synchronous rendering', () => {
    const orderAfter = (gesture: () => void, result: { current: { pinnedIds: string[] } }): string[] => {
        act(() => {
            gesture();
        });

        return result.current.pinnedIds;
    };

    it('exposes a reorder before react-query notifies its observers', async () => {
        stubLayoutEndpoint({ firm: ['a', 'b', 'c'] });

        const { result } = renderLayout();

        await settled(['a', 'b', 'c'], result);

        expect(orderAfter(() => result.current.reorderPinned('c', 'a'), result)).toEqual(['c', 'a', 'b']);
        await settled(['c', 'a', 'b'], result);
    });

    it('exposes a pin before react-query notifies its observers', async () => {
        stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result } = renderLayout();

        await settled(['a', 'b'], result);

        expect(orderAfter(() => result.current.togglePin('c'), result)).toEqual(['a', 'b', 'c']);
        await settled(['a', 'b', 'c'], result);
    });

    it('exposes both orders when two reorders land in one tick', async () => {
        stubLayoutEndpoint({ firm: ['a', 'b', 'c'] });

        const { result } = renderLayout();

        await settled(['a', 'b', 'c'], result);

        expect(
            orderAfter(() => {
                result.current.reorderPinned('c', 'a');
                result.current.reorderPinned('b', 'a');
            }, result),
        ).toEqual(['c', 'b', 'a']);
        await settled(['c', 'b', 'a'], result);
    });

    it('keeps the same array identity once the store catches up', async () => {
        stubLayoutEndpoint({ firm: ['a', 'b', 'c'] });

        const { result } = renderLayout();

        await settled(['a', 'b', 'c'], result);

        const gestured = orderAfter(() => result.current.reorderPinned('c', 'a'), result);

        await settled(['c', 'a', 'b'], result);

        // The gesture's array is latched, so handing the order back to the store does not hand
        // consumers a new reference for an order that did not change.
        expect(result.current.pinnedIds).toBe(gestured);
    });

    it('refuses a gesture rather than showing an order it will not persist', async () => {
        stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result } = renderLayout({ defaultPinnedIds: null });

        await settled([], result);

        expect(orderAfter(() => result.current.togglePin('c'), result)).toEqual([]);
    });
});

/*
 * The cache write is what a second gesture in the same tick derives its order from, so it has to
 * land in the same task as the gesture even though it is no longer what puts the order on screen.
 */
describe('useAgentLayout synchronous application', () => {
    const cacheAfter = (gesture: () => void, queryClient: QueryClient): AgentLayout | null | undefined => {
        let snapshot: AgentLayout | null | undefined;

        act(() => {
            gesture();
            snapshot = queryClient.getQueryData<AgentLayout | null>([AGENT_LAYOUT_QUERY_KEY, 'user-1']);
        });

        return snapshot;
    };

    it('applies a reorder to the cache before the call returns', async () => {
        stubLayoutEndpoint({ firm: ['a', 'b', 'c'] });

        const { result, queryClient } = renderLayout();

        await settled(['a', 'b', 'c'], result);

        expect(cacheAfter(() => result.current.reorderPinned('c', 'a'), queryClient)).toEqual({
            firm: ['c', 'a', 'b'],
        });
        await settled(['c', 'a', 'b'], result);
    });

    it('applies a pin to the cache before the call returns', async () => {
        stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result, queryClient } = renderLayout();

        await settled(['a', 'b'], result);

        expect(cacheAfter(() => result.current.togglePin('c'), queryClient)).toEqual({ firm: ['a', 'b', 'c'] });
        await settled(['a', 'b', 'c'], result);
    });

    it('applies an unpin to the cache before the call returns', async () => {
        stubLayoutEndpoint({ firm: ['a', 'b', 'c'] });

        const { result, queryClient } = renderLayout();

        await settled(['a', 'b', 'c'], result);

        expect(cacheAfter(() => result.current.togglePin('b'), queryClient)).toEqual({ firm: ['a', 'c'] });
        await settled(['a', 'c'], result);
    });

    it("keeps the other tab's cached list, which the endpoint would also have kept", async () => {
        stubLayoutEndpoint({ my: ['mine-1'], firm: ['a'] });

        const { result, queryClient } = renderLayout();

        await settled(['a'], result);

        expect(cacheAfter(() => result.current.togglePin('b'), queryClient)).toEqual({
            my: ['mine-1'],
            firm: ['a', 'b'],
        });
    });

    it('leaves the cache untouched when the gesture is refused', async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result, queryClient } = renderLayout({ defaultPinnedIds: null });

        await settled([], result);

        expect(cacheAfter(() => result.current.togglePin('c'), queryClient)).toEqual({ firm: ['a', 'b'] });
        expect(endpoint.bodies).toEqual([]);
    });
});

describe('useAgentLayout togglePin', () => {
    it('appends a newly pinned id to the end and persists it', async () => {
        const endpoint = stubLayoutEndpoint(null);

        const { result } = renderLayout();

        await settled(['a', 'b'], result);

        act(() => {
            result.current.togglePin('c');
        });

        await settled(['a', 'b', 'c'], result);
        expect(endpoint.pins('firm')).toEqual(['a', 'b', 'c']);
    });

    it("sends nothing but the active scope's key, the endpoint validating the body as a strict object", async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result } = renderLayout();

        await settled(['a', 'b'], result);

        act(() => {
            result.current.togglePin('c');
        });

        await waitFor(() => {
            expect(endpoint.bodies).toHaveLength(1);
        });

        expect(endpoint.bodies[0]).toEqual({ firm: ['a', 'b', 'c'] });
        expect(Object.keys(endpoint.bodies[0])).toEqual(['firm']);
    });

    it('removes an already pinned id', async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b', 'c'] });

        const { result } = renderLayout();

        await settled(['a', 'b', 'c'], result);

        act(() => {
            result.current.togglePin('b');
        });

        await settled(['a', 'c'], result);
        expect(endpoint.pins('firm')).toEqual(['a', 'c']);
    });

    it('ignores a new pin once the cap is reached', async () => {
        const endpoint = stubLayoutEndpoint({ firm: AT_CAP });

        const { result } = renderLayout();

        await settled(AT_CAP, result);
        expect(result.current.isPinnable).toBe(false);

        act(() => {
            result.current.togglePin('one-too-many');
        });

        await settled(AT_CAP, result);
        expect(endpoint.bodies).toEqual([]);
    });

    it('still unpins when the cap is reached', async () => {
        stubLayoutEndpoint({ firm: AT_CAP });

        const { result } = renderLayout();

        await settled(AT_CAP, result);

        act(() => {
            result.current.togglePin('agent-0');
        });

        await settled(AT_CAP.slice(1), result);
        expect(result.current.isPinnable).toBe(true);
    });

    it('rolls back and warns when the write fails', async () => {
        const { toast } = await import('sonner');
        const errorToast = vi.spyOn(toast, 'error').mockImplementation(() => 'toast');
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b'] });

        server.use(respond('put', LAYOUT_PATH, () => httpError(500)));

        const { result } = renderLayout();

        await settled(['a', 'b'], result);

        act(() => {
            result.current.togglePin('c');
        });

        await waitFor(() => {
            expect(errorToast).toHaveBeenCalled();
        });
        await settled(['a', 'b'], result);
        expect(endpoint.pins('firm')).toEqual(['a', 'b']);
    });
});

describe('useAgentLayout pruneStalePins', () => {
    it('removes only the listed ids and persists the merged layout, preserving the other tab', async () => {
        const endpoint = stubLayoutEndpoint({ my: ['mine-1'], firm: ['a', 'b', 'c'] });

        const { result } = renderLayout();

        await settled(['a', 'b', 'c'], result);

        act(() => {
            result.current.pruneStalePins(['b']);
        });

        await settled(['a', 'c'], result);
        expect(endpoint.bodies[0]).toEqual({ firm: ['a', 'c'] });
        expect(endpoint.pins('firm')).toEqual(['a', 'c']);
        expect(endpoint.pins('my')).toEqual(['mine-1']);
    });

    it('does not write when the stale set is empty', async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result } = renderLayout();

        await settled(['a', 'b'], result);

        act(() => {
            result.current.pruneStalePins([]);
        });

        await settled(['a', 'b'], result);
        expect(endpoint.bodies).toEqual([]);
    });

    it('does not write when none of the ids are currently pinned', async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result } = renderLayout();

        await settled(['a', 'b'], result);

        act(() => {
            result.current.pruneStalePins(['x', 'y']);
        });

        await settled(['a', 'b'], result);
        expect(endpoint.bodies).toEqual([]);
    });
});

describe('useAgentLayout reorderPinned', () => {
    it('moves the dragged id to the position of the id it was dropped on', async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b', 'c'] });

        const { result } = renderLayout();

        await settled(['a', 'b', 'c'], result);

        act(() => {
            result.current.reorderPinned('c', 'a');
        });

        await settled(['c', 'a', 'b'], result);
        expect(endpoint.pins('firm')).toEqual(['c', 'a', 'b']);
    });

    it('ignores a drop on an id that is not pinned', async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result } = renderLayout();

        await settled(['a', 'b'], result);

        act(() => {
            result.current.reorderPinned('a', 'not-pinned');
        });

        await settled(['a', 'b'], result);
        expect(endpoint.bodies).toEqual([]);
    });
});

describe('useAgentLayout normalization', () => {
    it('keeps a pinned id the loaded pages do not contain, because it may live on a later page', async () => {
        stubLayoutEndpoint({ firm: ['a', 'page-three-agent'] });

        const { result } = renderLayout();

        await settled(['a', 'page-three-agent'], result);
        expect(result.current.isPinned('page-three-agent')).toBe(true);
    });

    it('drops duplicate stored ids so a reorder cannot address the wrong occurrence', async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b', 'a', 'c'] });

        const { result } = renderLayout();

        await settled(['a', 'b', 'c'], result);

        act(() => {
            result.current.reorderPinned('c', 'a');
        });

        await settled(['c', 'a', 'b'], result);
        expect(endpoint.pins('firm')).toEqual(['c', 'a', 'b']);
    });

    it('writes against the capped list rather than silently shedding its tail', async () => {
        const capped = OVER_CAP.slice(0, AGENT_PIN_LIMIT);
        const endpoint = stubLayoutEndpoint({ firm: OVER_CAP });

        const { result } = renderLayout();

        // The cap is applied once at read time, so what the user sees is what the next write starts from.
        await settled(capped, result);

        act(() => {
            result.current.togglePin('agent-3');
        });

        const expected = capped.filter((id) => id !== 'agent-3');

        await settled(expected, result);
        expect(endpoint.pins('firm')).toEqual(expected);
        expect(endpoint.pins('firm')).toHaveLength(AGENT_PIN_LIMIT - 1);
    });
});

describe('useAgentLayout rapid writes', () => {
    it('keeps both updates when two pins are fired in the same tick', async () => {
        const endpoint = stubLayoutEndpoint(null);

        const { result } = renderLayout();

        await settled(['a', 'b'], result);

        act(() => {
            result.current.togglePin('c');
            result.current.togglePin('d');
        });

        await settled(['a', 'b', 'c', 'd'], result);
        expect(endpoint.pins('firm')).toEqual(['a', 'b', 'c', 'd']);
    });

    it('starts the second write only once the first has settled', async () => {
        const endpoint = stubLayoutEndpoint(null, { writeDelayMs: 20 });

        const { result } = renderLayout();

        await settled(['a', 'b'], result);

        act(() => {
            result.current.togglePin('c');
            result.current.togglePin('d');
        });

        await waitFor(() => {
            expect(endpoint.timeline).toHaveLength(4);
        });

        // Interleaved starts would mean the endpoint keeps whichever write happened to land last,
        // which is not necessarily the order the UI is showing.
        expect(endpoint.timeline).toEqual([
            'start:firm=a,b,c',
            'done:firm=a,b,c',
            'start:firm=a,b,c,d',
            'done:firm=a,b,c,d',
        ]);
    });

    it('keeps both reorders when two drags land back to back', async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b', 'c'] });

        const { result } = renderLayout();

        await settled(['a', 'b', 'c'], result);

        act(() => {
            result.current.reorderPinned('c', 'a');
            result.current.reorderPinned('b', 'a');
        });

        await settled(['c', 'b', 'a'], result);
        expect(endpoint.pins('firm')).toEqual(['c', 'b', 'a']);
    });

    it("does not carry one user's in-flight order into the next user's write", async () => {
        const endpoint = stubLayoutEndpoint(null);

        const { result, rerender } = renderHookWithProviders(
            ({ userId }: { userId: string }) =>
                useAgentLayout({
                    userId,
                    scope: 'firm',
                    defaultPinnedIds: ['a', 'b'],
                }),
            { initialProps: { userId: 'user-1' } },
        );

        await settled(['a', 'b'], result);

        endpoint.holdWrites();

        act(() => {
            result.current.togglePin('c');
        });

        await settled(['a', 'b', 'c'], result);

        rerender({ userId: 'user-2' });

        // The first user's pending order must be retired with the query key, or it becomes the base
        // of the next user's write.
        await settled(['a', 'b'], result);

        endpoint.releaseWrites();

        act(() => {
            result.current.togglePin('d');
        });

        await waitFor(() => {
            expect(endpoint.bodies).toHaveLength(2);
        });

        expect(endpoint.bodies[1]).toEqual({ firm: ['a', 'b', 'd'] });
    });
});

describe('useAgentLayout cross-context freshness', () => {
    it("adopts another context's row on focus once the cache has gone stale", async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result } = renderLayout();

        await settled(['a', 'b'], result);

        endpoint.setRow({ firm: ['a', 'b', 'x'] });

        act(() => {
            focusAfterStaleTime();
        });

        await settled(['a', 'b', 'x'], result);
    });

    it("adopts another context's row on focus even after this tab has written its own order", async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result } = renderLayout();

        await settled(['a', 'b'], result);

        act(() => {
            result.current.togglePin('c');
        });

        await settled(['a', 'b', 'c'], result);
        // The write's own invalidation refetch, so the next read is attributable to the focus.
        await waitFor(() => {
            expect(endpoint.reads()).toBe(2);
        });

        endpoint.setRow({ firm: ['a', 'b', 'x'] });

        act(() => {
            focusAfterStaleTime();
        });

        await settled(['a', 'b', 'x'], result);
    });

    it('does not refetch on focus while a write is in flight, so the pre-write order cannot return', async () => {
        const endpoint = stubLayoutEndpoint({ firm: ['a', 'b'] });

        const { result } = renderLayout();

        await settled(['a', 'b'], result);
        expect(endpoint.reads()).toBe(1);

        endpoint.holdWrites();

        act(() => {
            result.current.togglePin('c');
        });

        act(() => {
            focusAfterStaleTime();
        });

        await settled(['a', 'b', 'c'], result);
        expect(endpoint.reads()).toBe(1);

        endpoint.releaseWrites();

        await waitFor(() => {
            expect(endpoint.reads()).toBe(2);
        });
        await settled(['a', 'b', 'c'], result);
    });
});
