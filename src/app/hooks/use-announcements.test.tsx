import { act, waitFor } from '@testing-library/react';
import { delay, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setTenant } from '@/store/reducers/tenant';
import { testTenant } from '@/test/fixtures/auth';
import { apiUrl, pagedEnvelope, server } from '@/test/msw';
import { renderHookWithProviders } from '@/test/test-utils';
import type { BlogPostType } from '@/types/admin';

import { useAnnouncements } from './use-announcements';

const makePost = (id: string, sortOrder = 0) =>
    ({
        _id: id,
        title: `Announcement ${id}`,
        slug: id,
        type: 'announcement',
        sortOrder,
    }) as unknown as BlogPostType;

const slowAgentAFastAgentB = (agentAPosts: BlogPostType[], agentBPosts: BlogPostType[]) =>
    http.get(apiUrl('/blogposts'), async ({ request }) => {
        const agentId = new URL(request.url).searchParams.get('agentId');

        if (agentId === 'agent-a') {
            await delay(60);

            return pagedEnvelope(agentAPosts, { page: 0 });
        }

        return pagedEnvelope(agentBPosts, { page: 0 });
    });

/** A response the test releases by hand, so the tenant flag can flip while the request is in flight. */
const deferred = () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });

    return { held, release: () => release() };
};

const tenantWithWhatsNewHidden = (hidden: boolean) => setTenant({ ...testTenant, hideWhatsNew: hidden });

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useAnnouncements', () => {
    it('opens the modal with the fetched announcements sorted by sortOrder', async () => {
        server.use(
            http.get(apiUrl('/blogposts'), () =>
                pagedEnvelope([makePost('second', 2), makePost('first', 1)], { page: 0 }),
            ),
        );

        const { result } = renderHookWithProviders(() => useAnnouncements());

        await act(async () => {
            await result.current.fetchAnnouncements('agent-a');
        });

        expect(result.current.announcementsState.loading).toBe(false);
        expect(result.current.announcementsState.isModalOpen).toBe(true);
        expect(result.current.announcementsState.announcements.map((a) => a._id)).toEqual(['first', 'second']);
    });

    it('keeps the newest agent announcements when an older slow request resolves last', async () => {
        server.use(slowAgentAFastAgentB([makePost('agent-a-post')], [makePost('agent-b-post')]));

        const { result } = renderHookWithProviders(() => useAnnouncements());

        await act(async () => {
            const first = result.current.fetchAnnouncements('agent-a');
            const second = result.current.fetchAnnouncements('agent-b');

            await Promise.all([first, second]);
        });

        await waitFor(() => {
            expect(result.current.announcementsState.announcements.map((a) => a._id)).toEqual(['agent-b-post']);
        });

        expect(result.current.announcementsState.isModalOpen).toBe(true);
    });

    it('does not log or reset state when the superseded request settles empty', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        server.use(slowAgentAFastAgentB([], [makePost('agent-b-post')]));

        const { result } = renderHookWithProviders(() => useAnnouncements());

        await act(async () => {
            const first = result.current.fetchAnnouncements('agent-a');
            const second = result.current.fetchAnnouncements('agent-b');

            await Promise.all([first, second]);
        });

        await act(async () => {
            await delay(120);
        });

        expect(consoleError).not.toHaveBeenCalled();
        expect(result.current.announcementsState.isModalOpen).toBe(true);
        expect(result.current.announcementsState.announcements.map((a) => a._id)).toEqual(['agent-b-post']);
    });

    it('makes no request and opens nothing when the tenant hides What’s New', async () => {
        const requests: string[] = [];

        server.use(
            http.get(apiUrl('/blogposts'), ({ request }) => {
                requests.push(request.url);

                return pagedEnvelope([makePost('unwanted')], { page: 0 });
            }),
        );

        const { result } = renderHookWithProviders(() => useAnnouncements(), {
            preloadedState: { tenant: { ...testTenant, hideWhatsNew: true } },
        });

        await act(async () => {
            await result.current.fetchAnnouncements('agent-a');
        });

        expect(requests).toEqual([]);
        expect(result.current.announcementsState.isModalOpen).toBe(false);
        expect(result.current.announcementsState.announcements).toEqual([]);
    });

    it('never opens the modal when the tenant hides What’s New before the response lands', async () => {
        const { held, release } = deferred();

        server.use(
            http.get(apiUrl('/blogposts'), async () => {
                await held;

                return pagedEnvelope([makePost('late')], { page: 0 });
            }),
        );

        const { result, store } = renderHookWithProviders(() => useAnnouncements());

        let pending!: Promise<void>;

        act(() => {
            pending = result.current.fetchAnnouncements('agent-a');
        });

        act(() => {
            store.dispatch(tenantWithWhatsNewHidden(true));
        });

        await act(async () => {
            release();
            await pending;
        });

        expect(result.current.announcementsState.isModalOpen).toBe(false);
        expect(result.current.announcementsState.announcements).toEqual([]);
    });

    it('aborts the in-flight request when a later call is gated by the flag', async () => {
        const { held, release } = deferred();

        server.use(
            http.get(apiUrl('/blogposts'), async () => {
                await held;

                return pagedEnvelope([makePost('late')], { page: 0 });
            }),
        );

        const { result, store } = renderHookWithProviders(() => useAnnouncements());

        let pending!: Promise<void>;

        act(() => {
            pending = result.current.fetchAnnouncements('agent-a');
        });

        act(() => {
            store.dispatch(tenantWithWhatsNewHidden(true));
        });

        await act(async () => {
            await result.current.fetchAnnouncements('agent-b');
        });

        await act(async () => {
            release();
            await pending;
            await delay(20);
        });

        // Turning the flag back off must not reveal a result the abort should have discarded.
        act(() => {
            store.dispatch(tenantWithWhatsNewHidden(false));
        });

        expect(result.current.announcementsState.isModalOpen).toBe(false);
        expect(result.current.announcementsState.announcements).toEqual([]);
    });
});
