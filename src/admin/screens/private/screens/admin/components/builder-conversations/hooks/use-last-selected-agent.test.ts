import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BUILDER_CONVERSATIONS_AGENT_STORAGE_KEY as KEY } from '../constants';

import { clearLastSelectedAgent, useLastSelectedAgent } from './use-last-selected-agent';

interface Params {
    agentSlug: string;
    resolvedSlug: string | null;
    error: unknown;
    onRestore: (slug: string) => void;
}

const defaults = (overrides: Partial<Params> = {}): Params => ({
    agentSlug: '',
    resolvedSlug: null,
    error: null,
    onRestore: vi.fn(),
    ...overrides,
});

/** The API reports a missing agent either as a 404 or as a `success: false` envelope. */
const notFoundStatus = Object.assign(new Error('Request failed'), { response: { status: 404 } });
const notFoundEnvelope = Object.assign(new Error('There is no such agent with id x'), {
    response: { data: { message: 'There is no such agent with id x' } },
});
const serverError = Object.assign(new Error('Internal error'), { response: { status: 500 } });

describe('useLastSelectedAgent', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('restore', () => {
        it('restores the remembered agent when the screen is entered without one', () => {
            localStorage.setItem(KEY, 'remembered-agent');
            const onRestore = vi.fn();

            renderHook(() => useLastSelectedAgent(defaults({ onRestore })));

            expect(onRestore).toHaveBeenCalledWith('remembered-agent');
        });

        it('does not restore when the URL already names an agent', () => {
            localStorage.setItem(KEY, 'remembered-agent');
            const onRestore = vi.fn();

            renderHook(() => useLastSelectedAgent(defaults({ agentSlug: 'url-agent', onRestore })));

            expect(onRestore).not.toHaveBeenCalled();
        });

        it('does nothing when nothing is remembered', () => {
            const onRestore = vi.fn();

            renderHook(() => useLastSelectedAgent(defaults({ onRestore })));

            expect(onRestore).not.toHaveBeenCalled();
        });

        /**
         * The breadcrumb deliberately returns to the chooser. A restore that fired on every
         * arrival at the bare path would bounce the user straight back into the agent they
         * just left, defeating that navigation.
         */
        it('does not restore again when the agent is left later in the same session', () => {
            localStorage.setItem(KEY, 'remembered-agent');
            const onRestore = vi.fn();

            const { rerender } = renderHook((props: Params) => useLastSelectedAgent(props), {
                initialProps: defaults({ agentSlug: 'remembered-agent', onRestore }),
            });

            expect(onRestore).not.toHaveBeenCalled();

            rerender(defaults({ agentSlug: '', onRestore }));

            expect(onRestore).not.toHaveBeenCalled();
        });
    });

    describe('remembering', () => {
        it('stores the slug the server confirmed, not the one in the URL', () => {
            renderHook(() =>
                useLastSelectedAgent(
                    defaults({
                        agentSlug: '65f0c0ffee',
                        resolvedSlug: 'canonical-slug',
                    }),
                ),
            );

            expect(localStorage.getItem(KEY)).toBe('canonical-slug');
        });

        /** A mistyped URL never resolves, so it must not evict a good remembered agent. */
        it('leaves the memory alone while the agent has not resolved', () => {
            localStorage.setItem(KEY, 'good-agent');

            renderHook(() =>
                useLastSelectedAgent(
                    defaults({
                        agentSlug: 'typo-agent',
                        resolvedSlug: null,
                    }),
                ),
            );

            expect(localStorage.getItem(KEY)).toBe('good-agent');
        });
    });

    describe('forgetting', () => {
        it.each([
            ['a 404', notFoundStatus],
            ['a success:false envelope', notFoundEnvelope],
        ])('forgets the remembered agent when it is gone — %s', (_label, error) => {
            localStorage.setItem(KEY, 'dead-agent');

            renderHook(() => useLastSelectedAgent(defaults({ agentSlug: 'dead-agent', error })));

            expect(localStorage.getItem(KEY)).toBeNull();
        });

        /**
         * Clearing on any failure would let a dropped connection silently forget the agent —
         * invisible to the user and recurring on every visit.
         */
        it('keeps the memory through a transient failure', () => {
            localStorage.setItem(KEY, 'good-agent');

            renderHook(() =>
                useLastSelectedAgent(
                    defaults({
                        agentSlug: 'good-agent',
                        error: serverError,
                    }),
                ),
            );

            expect(localStorage.getItem(KEY)).toBe('good-agent');
        });

        /** Browsing to some other dead agent must not evict a memory that is still good. */
        it('keeps the memory when a different agent is the one that is gone', () => {
            localStorage.setItem(KEY, 'good-agent');

            renderHook(() =>
                useLastSelectedAgent(
                    defaults({
                        agentSlug: 'deleted-other',
                        error: notFoundStatus,
                    }),
                ),
            );

            expect(localStorage.getItem(KEY)).toBe('good-agent');
        });
    });

    it('clearLastSelectedAgent removes the memory', () => {
        localStorage.setItem(KEY, 'remembered-agent');

        clearLastSelectedAgent();

        expect(localStorage.getItem(KEY)).toBeNull();
    });
});
