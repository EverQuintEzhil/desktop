import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, failureEnvelope, httpError, pagedEnvelope, server } from '@/test/msw';
import { act, renderWithProviders } from '@/test/test-utils';
import type { AgentType } from '@/types/admin';

import Conversations from './conversations';

const CONVERSATIONS_PATH = '/assistant/agent-builder/conversations';
const AGENT_ID = 'agent-1';
const OTHER_AGENT_ID = 'agent-2';

const agent = { _id: AGENT_ID, slug: 'agent-one' } as AgentType;
const otherAgent = { _id: OTHER_AGENT_ID, slug: 'agent-two' } as AgentType;

/** Titles carry the agent so a row from the previous agent cannot satisfy a query after a switch. */
const conversationTitle = (page: number, agentId: string) => `${agentId} conversation ${page}`;

const messageForPage = (page: number, agentId: string) => ({
    _id: `${agentId}-message-${page}`,
    conversation_id: `${agentId}-conversation-${page}`,
    agent_id: agentId,
    title: conversationTitle(page, agentId),
    role: 'user' as const,
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-01T10:00:00.000Z',
});

/**
 * `useInfiniteScroll` rebuilds its `IntersectionObserver` on every render, so a
 * test must fire the most recently connected instance rather than the first one.
 */
interface ObserverRecord {
    callback: IntersectionObserverCallback;
    connected: boolean;
}

const observers: ObserverRecord[] = [];

class ControllableIntersectionObserver {
    root = null;

    rootMargin = '';

    thresholds: number[] = [];

    private record: ObserverRecord;

    constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, connected: false };
        observers.push(this.record);
    }

    observe = () => {
        this.record.connected = true;
    };

    unobserve = () => {
        this.record.connected = false;
    };

    disconnect = () => {
        this.record.connected = false;
    };

    takeRecords = () => [];
}

const scrollToLoadMore = async () => {
    const connected = observers.filter((observer) => observer.connected);

    expect(connected).not.toHaveLength(0);

    await act(async () => {
        connected.forEach((observer) => {
            observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
        });
    });
};

/**
 * One page of messages that all belong to the same conversation. `normalizeConversations`
 * dedupes by `conversation_id`, so the rendered list grows more slowly than the message
 * count the API pages by.
 */
const sharedConversationMessages = (page: number, agentId: string) => [
    { ...messageForPage(page, agentId), _id: `${agentId}-message-${page}-a` },
    { ...messageForPage(page, agentId), _id: `${agentId}-message-${page}-b` },
];

const flushAsync = () =>
    act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    });

interface Gate {
    agentId: string;
    page: number;
    promise: Promise<void>;
    release: () => void;
}

const createGate = (agentId: string, page: number): Gate => {
    let release = () => {};
    const promise = new Promise<void>((resolve) => {
        release = resolve;
    });

    return {
        agentId,
        page,
        promise,
        release,
    };
};

const failingPages = new Set<number>();
let failureShape: 'http' | 'envelope' = 'http';
const requestedPages: { agentId: string; page: number }[] = [];

/** Mutable per-test scenario knobs, kept in one object so `beforeEach` can reset them all. */
const scenario: { sharedConversations: boolean; gate: Gate | null } = {
    sharedConversations: false,
    gate: null,
};

const pagesRequestedFor = (agentId: string) =>
    requestedPages.filter((request) => request.agentId === agentId).map((request) => request.page);

// `vi.unstubAllGlobals` would also drop the ResizeObserver stub that `src/test/setup.ts`
// installs once at module load, so the original is restored explicitly instead.
const defaultIntersectionObserver = globalThis.IntersectionObserver;

describe('admin builder Conversations', () => {
    beforeEach(() => {
        observers.length = 0;
        requestedPages.length = 0;
        failingPages.clear();
        failureShape = 'http';
        scenario.sharedConversations = false;
        scenario.gate = null;
        vi.stubGlobal('IntersectionObserver', ControllableIntersectionObserver);

        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), async ({ request }) => {
                const params = new URL(request.url).searchParams;
                const page = Number(params.get('page') ?? 0);
                const agentId = params.get('agentId') ?? '';

                requestedPages.push({ agentId, page });

                if (scenario.gate?.agentId === agentId && scenario.gate?.page === page) {
                    await scenario.gate.promise;
                }

                if (failingPages.has(page)) {
                    return failureShape === 'http' ? httpError(500) : failureEnvelope('Conversations unavailable');
                }

                if (scenario.sharedConversations) {
                    const values = page < 3 ? sharedConversationMessages(page, agentId) : [];

                    return pagedEnvelope(values, { page, totalPages: 3, totalCount: 6 });
                }

                return pagedEnvelope([messageForPage(page, agentId)], { page, totalPages: 3, totalCount: 3 });
            }),
        );
    });

    afterEach(() => {
        scenario.gate?.release();
        vi.stubGlobal('IntersectionObserver', defaultIntersectionObserver);
    });

    it('shows the error card when the first page fails, and recovers on Retry', async () => {
        const user = userEvent.setup();

        failingPages.add(0);
        renderWithProviders(<Conversations agent={agent} />);

        expect(await screen.findByText('Something went wrong')).toBeInTheDocument();

        failingPages.delete(0);
        await user.click(screen.getByRole('button', { name: /retry/i }));

        expect(await screen.findByText(conversationTitle(0, AGENT_ID))).toBeInTheDocument();
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('treats a success:false envelope on the first page like a 500', async () => {
        failureShape = 'envelope';
        failingPages.add(0);
        renderWithProviders(<Conversations agent={agent} />);

        expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('keeps the already-loaded rows visible when loading the next page fails', async () => {
        renderWithProviders(<Conversations agent={agent} />);

        expect(await screen.findByText(conversationTitle(0, AGENT_ID))).toBeInTheDocument();

        failingPages.add(1);
        await scrollToLoadMore();

        await screen.findByText(/could not load more conversations/i);

        expect(screen.getByText(conversationTitle(0, AGENT_ID))).toBeInTheDocument();
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('releases the load-more spinner when the next page fails, so pagination can continue', async () => {
        const user = userEvent.setup();

        const { container } = renderWithProviders(<Conversations agent={agent} />);

        expect(await screen.findByText(conversationTitle(0, AGENT_ID))).toBeInTheDocument();

        failingPages.add(1);
        await scrollToLoadMore();

        await screen.findByRole('button', { name: /retry/i });

        failingPages.delete(1);
        await user.click(screen.getByRole('button', { name: /retry/i }));

        expect(await screen.findByText(conversationTitle(1, AGENT_ID))).toBeInTheDocument();

        // `InfiniteScrollTrigger` renders `SpinnerBlade`, which carries no accessible role,
        // so the stuck spinner is only observable through its class.
        await waitFor(() => {
            expect(container.querySelector('.spinner')).toBeNull();
        });

        await scrollToLoadMore();

        expect(await screen.findByText(conversationTitle(2, AGENT_ID))).toBeInTheDocument();
    });

    it('requests pages 0, 1, 1, 2 when a load-more fails, is retried, and pagination continues', async () => {
        const user = userEvent.setup();

        const { container } = renderWithProviders(<Conversations agent={agent} />);

        expect(await screen.findByText(conversationTitle(0, AGENT_ID))).toBeInTheDocument();

        failingPages.add(1);
        await scrollToLoadMore();

        await screen.findByRole('button', { name: /retry/i });

        expect(screen.getByText(conversationTitle(0, AGENT_ID))).toBeInTheDocument();
        expect(screen.queryByText(conversationTitle(1, AGENT_ID))).not.toBeInTheDocument();
        expect(pagesRequestedFor(AGENT_ID)).toEqual([0, 1]);

        failingPages.delete(1);
        await user.click(screen.getByRole('button', { name: /retry/i }));

        expect(await screen.findByText(conversationTitle(1, AGENT_ID))).toBeInTheDocument();

        await waitFor(() => {
            expect(container.querySelector('.spinner')).toBeNull();
        });

        await scrollToLoadMore();

        expect(await screen.findByText(conversationTitle(2, AGENT_ID))).toBeInTheDocument();
        expect(pagesRequestedFor(AGENT_ID)).toEqual([0, 1, 1, 2]);
    });

    it('restarts pagination at page 0 when the agent changes', async () => {
        const { rerender } = renderWithProviders(<Conversations agent={agent} />);

        expect(await screen.findByText(conversationTitle(0, AGENT_ID))).toBeInTheDocument();

        await scrollToLoadMore();

        expect(await screen.findByText(conversationTitle(1, AGENT_ID))).toBeInTheDocument();
        expect(pagesRequestedFor(AGENT_ID)).toEqual([0, 1]);

        rerender(<Conversations agent={otherAgent} />);

        await waitFor(() => {
            expect(pagesRequestedFor(OTHER_AGENT_ID)).toEqual([0]);
        });
        await screen.findByText(conversationTitle(0, OTHER_AGENT_ID));

        await scrollToLoadMore();

        await waitFor(() => {
            expect(pagesRequestedFor(OTHER_AGENT_ID)).toEqual([0, 1]);
        });
    });

    it('stops paginating at the last page even when pages share conversations', async () => {
        scenario.sharedConversations = true;

        const { container } = renderWithProviders(<Conversations agent={agent} />);

        expect(await screen.findByText(conversationTitle(0, AGENT_ID))).toBeInTheDocument();

        // A runaway sentinel would scroll forever, so the loop is capped and the cap itself
        // is asserted: hitting it means pagination never terminated.
        const SCROLL_CAP = 8;
        let scrolls = 0;

        while (scrolls < SCROLL_CAP && observers.some((observer) => observer.connected)) {
            await scrollToLoadMore();
            scrolls += 1;

            // The sentinel is swapped for the spinner while a page is in flight, so the loop
            // must wait for the page to settle before reading `connected` again.
            await waitFor(() => {
                expect(container.querySelector('.spinner')).toBeNull();
            });
        }

        expect(scrolls).toBeLessThan(SCROLL_CAP);
        expect(pagesRequestedFor(AGENT_ID)).toEqual([0, 1, 2]);
        expect(screen.getByText(conversationTitle(2, AGENT_ID))).toBeInTheDocument();
    });

    it('discards a load-more response the agent has already moved on from', async () => {
        scenario.gate = createGate(AGENT_ID, 1);

        const { rerender } = renderWithProviders(<Conversations agent={agent} />);

        expect(await screen.findByText(conversationTitle(0, AGENT_ID))).toBeInTheDocument();

        await scrollToLoadMore();

        rerender(<Conversations agent={otherAgent} />);

        expect(await screen.findByText(conversationTitle(0, OTHER_AGENT_ID))).toBeInTheDocument();

        scenario.gate.release();
        await flushAsync();

        expect(screen.queryByText(conversationTitle(1, AGENT_ID))).not.toBeInTheDocument();
        expect(screen.queryByText(conversationTitle(0, AGENT_ID))).not.toBeInTheDocument();
        expect(screen.getByText(conversationTitle(0, OTHER_AGENT_ID))).toBeInTheDocument();

        // Discarding the superseded response must not leave the in-flight latch closed.
        await scrollToLoadMore();

        await waitFor(() => {
            expect(pagesRequestedFor(OTHER_AGENT_ID)).toEqual([0, 1]);
        });
        expect(await screen.findByText(conversationTitle(1, OTHER_AGENT_ID))).toBeInTheDocument();
    });
});
