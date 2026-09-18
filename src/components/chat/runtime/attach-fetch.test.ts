import { describe, expect, it } from 'vitest';

import { createAttachFetch } from './attach-fetch';
import { ATTACH_FAILURE_MESSAGE } from './attach-response';

const eventStream = () =>
    new Response('', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
    });

describe('createAttachFetch', () => {
    it('reports the reconnect message when the request never lands, so raw transport text cannot reach the thread', async () => {
        const ref: { current: null } = { current: null };
        const attach = createAttachFetch(() => Promise.reject(new TypeError('Failed to fetch')), ref);

        await expect(attach('/attach')).rejects.toThrow(ATTACH_FAILURE_MESSAGE);
    });

    it('resolves a teardown abort as nothing to resume', async () => {
        const ref: { current: { abortInternal: () => void } | null } = { current: null };
        const attach = createAttachFetch(
            (_input, init) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
                }),
            ref,
        );

        const pending = attach('/attach');

        ref.current?.abortInternal();

        await expect(pending).resolves.toMatchObject({ status: 204 });
    });

    it('keeps a caller abort an AbortError, so the SDK still reports the turn as stopped', async () => {
        const ref: { current: null } = { current: null };
        const controller = new AbortController();
        const attach = createAttachFetch(
            (_input, init) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
                }),
            ref,
        );

        const pending = attach('/attach', { signal: controller.signal });

        controller.abort();

        await expect(pending).rejects.toThrow(/abort/i);
    });

    it('aborts the previous attach when a new one starts', async () => {
        const ref: { current: { abortInternal: () => void } | null } = { current: null };
        let firstAborted = false;
        const attach = createAttachFetch((_input, init) => {
            init?.signal?.addEventListener('abort', () => {
                firstAborted = true;
            });

            return Promise.resolve(eventStream());
        }, ref);

        await attach('/attach');
        await attach('/attach');

        expect(firstAborted).toBe(true);
    });
});
