import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import type { AgentAccessRoster } from '@/lib/api/admin/agent-access';
import { AGENT_ACCESS_ROSTER_QUERY_KEY } from '@/lib/api/admin/agent-access';
import type { AgentAccessCheck } from '@/lib/api/admin/agent-access-check';
import { AGENT_ACCESS_CHECK_QUERY_KEY } from '@/lib/api/admin/agent-access-check';
import { withRefreshDeadline } from '@/lib/api/admin/agent-access-writes';
import { apiUrl, envelope, httpError, server } from '@/test/msw';
import { act, renderHookWithProviders, waitFor } from '@/test/test-utils';

import type { AccessItem, AccessUser } from './access-types';
import { useAccessWrites } from './use-access-writes';

const AGENT_ID = 'agent-1';
const ROSTER_KEY = [...AGENT_ACCESS_ROSTER_QUERY_KEY, AGENT_ID, '', ''];
const CHECK_KEY = [...AGENT_ACCESS_CHECK_QUERY_KEY, AGENT_ID, [], [], ''];

const toolItem = (id: string, name: string): AccessItem => ({ id, name, kind: 'tool', state: 'covered' });

const ITEM_A = toolItem('tool-a', 'Ticket lookup');
const ITEM_B = toolItem('tool-b', 'Ticket writer');

const user: AccessUser = {
    id: 'user-1',
    name: 'Ada Lovelace',
    viaGroups: [],
    items: [ITEM_A, ITEM_B],
};

const roster: AgentAccessRoster = { users: [user], droppedCount: 0 };

/**
 * The lists as the api serves them. A second name on the include list is what makes a reset
 * predictable: clearing this user still leaves the item restricted, so the row moves.
 */
const aclPayload = (id: string) => ({
    _id: id,
    adminIds: [],
    includeUserIds: ['user-1', 'user-2'],
    excludeUserIds: [],
    includeSecurityGroupIds: [],
    excludeSecurityGroupIds: [],
});

/** A promise a test resolves by hand, so two reads can be made to land in a chosen order. */
const deferred = () => {
    let release: () => void = () => {};
    const promise = new Promise<void>((resolve) => {
        release = resolve;
    });

    return { promise, release };
};

const stateOf = (rosterData: AgentAccessRoster | undefined, itemId: string): string | undefined =>
    rosterData?.users[0].items.find((item) => item.id === itemId)?.state;

describe('useAccessWrites — a write that waits for the server', () => {
    it('leaves the rows exactly as they were until the batch has landed, then reads them back', async () => {
        const slowRead = deferred();

        server.use(
            http.get(apiUrl('/tools/tool-a'), async () => {
                await slowRead.promise;

                return envelope(aclPayload('tool-a'));
            }),
            http.get(apiUrl('/tools/tool-b'), () => envelope(aclPayload('tool-b'))),
            http.put(apiUrl('/tools/:id'), () => envelope({ _id: 'tool' })),
            http.post(apiUrl(`/agents/${AGENT_ID}/access-check`), () =>
                HttpResponse.json({ success: true, value: { items: [], ignoredItems: [] } }),
            ),
        );

        const { result, queryClient } = renderHookWithProviders(() => useAccessWrites(AGENT_ID));

        // The test client garbage-collects an unobserved query the moment it is written, and
        // nothing here observes the roster.
        queryClient.setQueryDefaults(AGENT_ACCESS_ROSTER_QUERY_KEY, { gcTime: Infinity });
        queryClient.setQueryData(ROSTER_KEY, roster);

        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        const rosterRefreshes = () =>
            invalidate.mock.calls.filter((call) => call[0]?.queryKey === AGENT_ACCESS_ROSTER_QUERY_KEY).length;

        let settled = false;

        act(() => {
            void result.current.resetItems(user, [ITEM_A, ITEM_B]).then(() => {
                settled = true;
            });
        });

        // The second item's read has already landed, so a screen that painted ahead of the server
        // would show it moved. Nothing moves until the whole batch is in.
        await waitFor(() => expect(rosterRefreshes()).toBe(0));
        expect(stateOf(queryClient.getQueryData<AgentAccessRoster>(ROSTER_KEY), 'tool-a')).toBe('covered');
        expect(stateOf(queryClient.getQueryData<AgentAccessRoster>(ROSTER_KEY), 'tool-b')).toBe('covered');
        expect(settled).toBe(false);

        await act(async () => {
            slowRead.release();
        });

        await waitFor(() => expect(settled).toBe(true));
        expect(rosterRefreshes()).toBe(1);
    });

    it('opens both writes of a batch at once rather than one after the other', async () => {
        const held = deferred();
        const opened: string[] = [];

        server.use(
            http.get(apiUrl('/tools/:id'), async ({ params }) => {
                opened.push(String(params.id));

                await held.promise;

                return envelope(aclPayload(String(params.id)));
            }),
            http.put(apiUrl('/tools/:id'), () => envelope({ _id: 'tool' })),
        );

        const { result, queryClient } = renderHookWithProviders(() => useAccessWrites(AGENT_ID));

        queryClient.setQueryDefaults(AGENT_ACCESS_ROSTER_QUERY_KEY, { gcTime: Infinity });
        queryClient.setQueryData(ROSTER_KEY, roster);

        act(() => {
            void result.current.grantItems(user, [ITEM_A, ITEM_B]);
        });

        // Both reads are on the wire before either answers: a confirmed write must not have
        // re-serialised the batch.
        await waitFor(() => expect(opened).toEqual(['tool-a', 'tool-b']));

        await act(async () => {
            held.release();
        });
    });

    it('changes nothing until the ignore route has answered', async () => {
        const held = deferred();

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}/access-ignores`), async () => {
                await held.promise;

                return envelope({ ignored: true });
            }),
        );

        const { result, queryClient } = renderHookWithProviders(() => useAccessWrites(AGENT_ID));

        queryClient.setQueryDefaults(AGENT_ACCESS_CHECK_QUERY_KEY, { gcTime: Infinity });
        queryClient.setQueryData<AgentAccessCheck>(CHECK_KEY, { items: [], ignoredItems: [], droppedCount: 0 });

        act(() => {
            void result.current.ignoreItems(user, [ITEM_A, ITEM_B]);
        });

        expect(queryClient.getQueryData<AgentAccessCheck>(CHECK_KEY)?.ignoredItems).toEqual([]);

        await act(async () => {
            held.release();
        });
    });

    it('reads the rows back after every write, a grant included', async () => {
        server.use(
            http.get(apiUrl('/tools/:id'), ({ params }) => envelope(aclPayload(String(params.id)))),
            http.put(apiUrl('/tools/:id'), () => envelope({ _id: 'tool' })),
        );

        const { result, queryClient } = renderHookWithProviders(() => useAccessWrites(AGENT_ID));

        queryClient.setQueryDefaults(AGENT_ACCESS_ROSTER_QUERY_KEY, { gcTime: Infinity });
        queryClient.setQueryData(ROSTER_KEY, roster);

        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        const rosterRefreshes = () =>
            invalidate.mock.calls.filter((call) => call[0]?.queryKey === AGENT_ACCESS_ROSTER_QUERY_KEY).length;

        await act(async () => {
            await result.current.grantItems(user, [ITEM_A, ITEM_B]);
        });

        expect(rosterRefreshes()).toBe(1);

        await act(async () => {
            await result.current.resetItems(user, [ITEM_A, ITEM_B]);
        });

        expect(rosterRefreshes()).toBe(2);
    });
});

describe('useAccessWrites — what a write says when it is over', () => {
    // The spies outlive one test, so each takes its own baseline rather than the last one's.
    const spyOnToasts = () => {
        const success = vi.spyOn(toast, 'success').mockClear();
        const error = vi.spyOn(toast, 'error').mockClear();

        return { success, error };
    };

    it('announces a batch once, in the verb that was clicked', async () => {
        server.use(
            http.get(apiUrl('/tools/:id'), ({ params }) => envelope(aclPayload(String(params.id)))),
            http.put(apiUrl('/tools/:id'), () => envelope({ _id: 'tool' })),
        );

        const { success } = spyOnToasts();
        const { result } = renderHookWithProviders(() => useAccessWrites(AGENT_ID));

        await act(async () => {
            await result.current.grantItems(user, [ITEM_A, ITEM_B]);
        });

        expect(success).toHaveBeenCalledTimes(1);
        expect(success).toHaveBeenCalledWith('Granted Ada Lovelace access to 2 items.');
    });

    it('announces a refusal instead, and never both', async () => {
        server.use(
            http.get(apiUrl('/tools/:id'), ({ params }) => envelope(aclPayload(String(params.id)))),
            http.put(apiUrl('/tools/:id'), () => httpError(403)),
        );

        const { success, error } = spyOnToasts();
        const { result } = renderHookWithProviders(() => useAccessWrites(AGENT_ID));

        let outstanding: string[] = [];

        await act(async () => {
            outstanding = await result.current.grantItems(user, [ITEM_A, ITEM_B]);
        });

        expect(success).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledTimes(1);
        // Nothing landed, so both rows are still the admin's to retry.
        expect(outstanding).toEqual(['tool-a', 'tool-b']);
    });
});

describe('useAccessWrites — a read-back that never lands', () => {
    it('gives up on the refresh rather than holding the write open for ever', async () => {
        await expect(withRefreshDeadline(new Promise(() => {}), 5)).resolves.toBeUndefined();
    });

    it('still resolves the write and announces it when the rows cannot be read back', async () => {
        server.use(
            http.get(apiUrl('/tools/:id'), ({ params }) => envelope(aclPayload(String(params.id)))),
            http.put(apiUrl('/tools/:id'), () => envelope({ _id: 'tool' })),
        );

        const success = vi.spyOn(toast, 'success').mockClear();
        const { result, queryClient } = renderHookWithProviders(() => useAccessWrites(AGENT_ID));

        // Only the row read-back fails; the write itself lands. With nothing painted ahead of the
        // server, a refresh that took the write down with it would leave the spinner on for ever.
        const invalidate = queryClient.invalidateQueries.bind(queryClient);

        vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters) =>
            filters?.queryKey === AGENT_ACCESS_ROSTER_QUERY_KEY
                ? Promise.reject(new Error('refresh failed'))
                : invalidate(filters),
        );

        await act(async () => {
            await expect(result.current.grantItem(user, ITEM_A)).resolves.toBe(true);
        });

        expect(success).toHaveBeenCalledWith('Granted Ada Lovelace access to \u201CTicket lookup\u201D.');
    });
});

describe('useAccessWrites — grantMissing', () => {
    it('sends one write per capability with every chosen person on it', async () => {
        const bodies: { itemId: string; body: unknown }[] = [];

        server.use(
            http.get(apiUrl('/tools/:id'), ({ params }) => envelope(aclPayload(String(params.id)))),
            http.put(apiUrl('/tools/:id'), async ({ request, params }) => {
                bodies.push({ itemId: String(params.id), body: await request.json() });

                return envelope({ _id: 'tool' });
            }),
        );

        const other: AccessUser = { ...user, id: 'user-3', name: 'Grace Hopper' };
        const { result } = renderHookWithProviders(() => useAccessWrites(AGENT_ID));

        await act(async () => {
            await result.current.grantMissing([
                { user, items: [ITEM_A, ITEM_B] },
                { user: other, items: [ITEM_A, ITEM_B] },
            ]);
        });

        // Two capabilities, not four person-and-capability pairs: the ACL write replaces the whole
        // list, so a write per person would repeat it — and they queue on the same key.
        expect(bodies).toHaveLength(2);
        expect(bodies.map((write) => write.itemId).sort()).toEqual(['tool-a', 'tool-b']);
        expect(bodies[0].body).toEqual({
            includeUserIds: ['user-1', 'user-2', 'user-3'],
            excludeUserIds: [],
        });
    });
});
