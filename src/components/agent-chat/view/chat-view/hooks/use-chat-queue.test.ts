import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { TextAreaRef } from '@/components/text-area';

interface FakeThreadState {
    isRunning: boolean;
    messages: Array<{
        role?: string;
        content?: unknown;
        status?: { type: string; reason?: string };
    }>;
}

const pausedOnApprovalMessage = {
    role: 'assistant',
    content: [{ type: 'tool-call', approval: { id: 'approval-1' } }],
};

// useQueueDrain (mounted by useChatQueue) reads the assistant-ui store hooks;
// point them at the same fake state the aui param serves.
const stateRef = vi.hoisted(() => ({
    current: { isRunning: false, messages: [] } as { isRunning: boolean; messages: unknown[] },
}));

vi.mock('@assistant-ui/react', () => ({
    useAui: () => ({ thread: { getState: () => stateRef.current } }),
    useAuiState: (selector: (s: { thread: typeof stateRef.current }) => unknown) =>
        selector({ thread: stateRef.current }),
}));

import useChatQueue from './use-chat-queue';

// `state` is what the hook's aui param reports; `drainState` is what the
// store hooks (useQueueDrain) see — separate so a test can exercise the
// idle-but-queued submit branch without the drain effect firing first.
const createFakeAui = (state: FakeThreadState, drainState: FakeThreadState = state) => {
    const appends: unknown[] = [];
    const cancelRun = vi.fn();
    const thread = {
        getState: () => state,
        append: (message: unknown) => {
            appends.push(message);
        },
        cancelRun,
    };

    stateRef.current = drainState;

    return { aui: { thread } as never, appends, cancelRun, state };
};

const renderQueue = (state: FakeThreadState, isPendingGeneration = false, drainState: FakeThreadState = state) => {
    const fake = createFakeAui(state, drainState);
    const onStopGeneration = vi.fn();
    const hook = renderHook(() =>
        useChatQueue({
            aui: fake.aui,
            conversationId: 'conv-1',
            pendingQuote: null,
            clearPendingQuote: () => {},
            clearDraft: () => {},
            onDraftChange: () => {},
            composerTextAreaRef: createRef<TextAreaRef | null>(),
            onStopGeneration,
            isPendingGeneration,
        }),
    );

    return { ...fake, onStopGeneration, hook };
};

describe('useChatQueue.submitWidgetMessage', () => {
    it('appends directly when the thread is idle and the queue is empty', () => {
        const { hook, appends } = renderQueue({ isRunning: false, messages: [] });

        act(() => hook.result.current.submitWidgetMessage('Show full details for project "X"'));

        expect(appends).toHaveLength(1);
        expect(appends[0]).toMatchObject({
            role: 'user',
            content: [{ type: 'text', text: 'Show full details for project "X"' }],
        });
        expect(hook.result.current.queue).toHaveLength(0);
    });

    it('queues instead of appending while a run is streaming', () => {
        const { hook, appends } = renderQueue({ isRunning: true, messages: [] });

        act(() => hook.result.current.submitWidgetMessage('Show the relationship map for "Saudi Aramco"'));

        expect(appends).toHaveLength(0);
        expect(hook.result.current.queue).toHaveLength(1);
        expect(hook.result.current.queue[0].sendText).toBe('Show the relationship map for "Saudi Aramco"');
    });

    it('queues while a generation is pending even if the thread reports idle', () => {
        const { hook, appends } = renderQueue({ isRunning: false, messages: [] }, true);

        act(() => hook.result.current.submitWidgetMessage('queued behind pending'));

        expect(appends).toHaveLength(0);
        expect(hook.result.current.queue).toHaveLength(1);
    });

    it('interrupts and appends when paused on approval even if the pending-generation poll is stale-true', () => {
        const { hook, appends, cancelRun, onStopGeneration } = renderQueue(
            { isRunning: false, messages: [pausedOnApprovalMessage] },
            true,
            { isRunning: true, messages: [] },
        );

        act(() => hook.result.current.submitWidgetMessage('show details'));

        expect(onStopGeneration).toHaveBeenCalledTimes(1);
        expect(cancelRun).toHaveBeenCalledTimes(1);
        expect(appends).toHaveLength(1);
        expect(appends[0]).toMatchObject({ content: [{ type: 'text', text: 'show details' }] });
        expect(hook.result.current.queue).toHaveLength(0);
    });

    it('enqueues behind existing queued messages and re-kicks the head when idle', () => {
        // The drain's store view stays "running" so only the submit branch acts.
        const paramState: FakeThreadState = { isRunning: true, messages: [] };
        const { hook, appends } = renderQueue(paramState, false, { isRunning: true, messages: [] });

        // First widget send lands in the queue while running.
        act(() => hook.result.current.submitWidgetMessage('first'));
        expect(hook.result.current.queue).toHaveLength(1);

        // Thread settles (no drain edge in the store view); a widget send while
        // idle must go BEHIND the waiting queue and re-kick its head.
        paramState.isRunning = false;

        act(() => hook.result.current.submitWidgetMessage('second'));

        expect(appends).toHaveLength(1);
        expect(appends[0]).toMatchObject({ content: [{ type: 'text', text: 'first' }] });
        expect(hook.result.current.queue.map((m) => m.sendText)).toEqual(['second']);
    });

    it('interrupts the paused turn and appends when the turn is paused on approval', () => {
        const { hook, appends, cancelRun, onStopGeneration } = renderQueue(
            { isRunning: false, messages: [pausedOnApprovalMessage] },
            false,
            { isRunning: true, messages: [] },
        );

        act(() => hook.result.current.submitWidgetMessage('show details'));

        expect(onStopGeneration).toHaveBeenCalledTimes(1);
        expect(cancelRun).toHaveBeenCalledTimes(1);
        expect(appends).toHaveLength(1);
        expect(appends[0]).toMatchObject({ content: [{ type: 'text', text: 'show details' }] });
        expect(hook.result.current.queue).toHaveLength(0);
    });

    it('interrupts the paused turn and re-kicks the head when messages are already queued', () => {
        const paramState: FakeThreadState = { isRunning: true, messages: [] };
        const { hook, appends, cancelRun, onStopGeneration } = renderQueue(paramState, false, {
            isRunning: true,
            messages: [],
        });

        act(() => hook.result.current.submitWidgetMessage('first'));
        expect(hook.result.current.queue).toHaveLength(1);

        paramState.isRunning = false;
        paramState.messages = [pausedOnApprovalMessage];

        act(() => hook.result.current.submitWidgetMessage('second'));

        expect(onStopGeneration).toHaveBeenCalledTimes(1);
        expect(cancelRun).toHaveBeenCalledTimes(1);
        expect(appends).toHaveLength(1);
        expect(appends[0]).toMatchObject({ content: [{ type: 'text', text: 'first' }] });
        expect(hook.result.current.queue.map((m) => m.sendText)).toEqual(['second']);
    });
});

describe('useChatQueue.handleSendNowQueued', () => {
    const queueTwoWhileRunning = () => {
        const paramState: FakeThreadState = { isRunning: true, messages: [] };
        const rendered = renderQueue(paramState, false, { isRunning: true, messages: [] });

        act(() => rendered.hook.result.current.submitWidgetMessage('first'));
        act(() => rendered.hook.result.current.submitWidgetMessage('second'));

        return { ...rendered, paramState };
    };

    it('interrupts the paused turn and sends the picked item, leaving the rest queued', () => {
        const { hook, appends, cancelRun, onStopGeneration, paramState } = queueTwoWhileRunning();

        paramState.isRunning = false;
        paramState.messages = [pausedOnApprovalMessage];

        act(() => hook.result.current.handleSendNowQueued(hook.result.current.queue[1]));

        expect(onStopGeneration).toHaveBeenCalledTimes(1);
        expect(cancelRun).toHaveBeenCalledTimes(1);
        expect(appends).toHaveLength(1);
        expect(appends[0]).toMatchObject({ content: [{ type: 'text', text: 'second' }] });
        expect(hook.result.current.queue.map((m) => m.sendText)).toEqual(['first']);
    });

    it('only promotes and stops the run while a turn is genuinely running', () => {
        const { hook, appends, cancelRun, onStopGeneration } = queueTwoWhileRunning();

        act(() => hook.result.current.handleSendNowQueued(hook.result.current.queue[1]));

        expect(onStopGeneration).toHaveBeenCalledTimes(1);
        expect(cancelRun).toHaveBeenCalledTimes(1);
        expect(appends).toHaveLength(0);
        expect(hook.result.current.queue.map((m) => m.sendText)).toEqual(['second', 'first']);
    });
});
