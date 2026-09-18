import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useStreamResumeController } from './use-stream-resume-controller';

interface ControllerOverrides {
    isSendInFlight?: () => boolean;
    abortAttach?: () => void;
    resetAssistantMessage?: (messageId: string) => void;
}

const renderController = (conversationId: string | null, overrides: ControllerOverrides = {}) =>
    renderHook(() =>
        useStreamResumeController({
            conversationIdRef: { current: conversationId },
            resetAssistantMessage: overrides.resetAssistantMessage ?? (() => {}),
            abortAttach: overrides.abortAttach ?? (() => {}),
            isSendInFlight: overrides.isSendInFlight ?? (() => false),
        }),
    );

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('useStreamResumeController', () => {
    it('warns once, naming the conversation, when the chat runtime never binds', async () => {
        vi.useFakeTimers();

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderController('conversation-7');

        const pending = result.current.resumeStream();

        await vi.advanceTimersByTimeAsync(40 * 50);
        await expect(pending).resolves.toBeUndefined();

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('conversation-7');
    });

    it('resumes without warning when the chat binds after a few retries', async () => {
        vi.useFakeTimers();

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const resumeStream = vi.fn().mockResolvedValue(undefined);
        const { result } = renderController('conversation-7');

        const pending = result.current.resumeStream();

        await vi.advanceTimersByTimeAsync(150);
        result.current.bindChat({ status: 'ready', resumeStream, stop: vi.fn() });
        await vi.advanceTimersByTimeAsync(40 * 50);
        await pending;

        expect(resumeStream).toHaveBeenCalledTimes(1);
        expect(warn).not.toHaveBeenCalled();
    });

    it('skips the probe while the status snapshot still says streaming', async () => {
        const resumeStream = vi.fn().mockResolvedValue(undefined);
        const { result } = renderController('conversation-7');

        result.current.bindChat({ status: 'streaming', resumeStream, stop: vi.fn() });
        await result.current.resumeStream();

        expect(resumeStream).not.toHaveBeenCalled();
    });

    it('skips the probe while a send is in flight, even though the status snapshot still reads ready', async () => {
        const resumeStream = vi.fn().mockResolvedValue(undefined);
        const { result } = renderController('conversation-7', { isSendInFlight: () => true });

        result.current.bindChat({ status: 'ready', resumeStream, stop: vi.fn() });
        await result.current.resumeStream();

        expect(resumeStream).not.toHaveBeenCalled();
    });

    it('forces a resume past both gates', async () => {
        const resumeStream = vi.fn().mockResolvedValue(undefined);
        const { result } = renderController('conversation-7', { isSendInFlight: () => true });

        result.current.bindChat({ status: 'streaming', resumeStream, stop: vi.fn() });
        await result.current.resumeStream({ force: true });

        expect(resumeStream).toHaveBeenCalledTimes(1);
    });

    it('single-flights concurrent probes for the same conversation into one resume', async () => {
        let release = () => {};
        const resumeStream = vi.fn().mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    release = resolve;
                }),
        );
        const { result } = renderController('conversation-7');

        result.current.bindChat({ status: 'ready', resumeStream, stop: vi.fn() });

        const first = result.current.resumeStream();
        const second = result.current.resumeStream();

        release();
        await Promise.all([first, second]);

        expect(resumeStream).toHaveBeenCalledTimes(1);
    });

    it('allows a later probe once the in-flight one has settled', async () => {
        const resumeStream = vi.fn().mockResolvedValue(undefined);
        const { result } = renderController('conversation-7');

        result.current.bindChat({ status: 'ready', resumeStream, stop: vi.fn() });

        await result.current.resumeStream();
        await result.current.resumeStream();

        expect(resumeStream).toHaveBeenCalledTimes(2);
    });

    it('aborts the attach and clears the message before re-attaching on an attempt bump', async () => {
        const order: string[] = [];
        const resumeStream = vi.fn().mockImplementation(() => {
            order.push('resume');

            return Promise.resolve();
        });
        const { result } = renderController('conversation-7', {
            abortAttach: () => order.push('abort'),
            resetAssistantMessage: () => order.push('reset'),
        });

        result.current.bindChat({
            status: 'streaming',
            resumeStream,
            stop: vi.fn().mockImplementation(() => {
                order.push('stop');

                return Promise.resolve();
            }),
        });

        await result.current.reattachAfterAttemptBump('m-live');

        expect(order).toEqual(['abort', 'stop', 'reset', 'resume']);
    });
});
