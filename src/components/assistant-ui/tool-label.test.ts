import { describe, expect, it } from 'vitest';

import { getToolGroupProgress } from './tool-label';

const toolPart = (toolCallId: string) => ({ type: 'tool-call', toolCallId, toolName: 'web_search' });

describe('getToolGroupProgress tool counts', () => {
    it('reports every tool as timed when each one has a persisted duration', () => {
        const progress = getToolGroupProgress([0, 1], [toolPart('a'), toolPart('b')], new Map(), {
            a: 1_000,
            b: 2_000,
        });

        expect(progress).toMatchObject({ durationMs: 3_000, toolCount: 2, timedToolCount: 2 });
    });

    it('counts an untimed tool so a caller cannot read a partial sum as the whole span', () => {
        const progress = getToolGroupProgress([0, 1], [toolPart('a'), toolPart('b')], new Map(), { a: 1_000 });

        expect(progress).toMatchObject({ durationMs: 1_000, toolCount: 2, timedToolCount: 1 });
    });

    it('reports no timed tools when nothing emitted progress', () => {
        const progress = getToolGroupProgress([0, 1], [toolPart('a'), toolPart('b')], new Map());

        expect(progress).toMatchObject({ durationMs: null, toolCount: 2, timedToolCount: 0 });
    });

    it('excludes a tool call with no string id from both counts', () => {
        const progress = getToolGroupProgress(
            [0, 1],
            [{ type: 'tool-call', toolName: 'web_search' }, toolPart('b')],
            new Map(),
            { b: 2_000 },
        );

        expect(progress).toMatchObject({ toolCount: 1, timedToolCount: 1 });
    });

    it('leaves a done tool with no duration untimed', () => {
        const progress = getToolGroupProgress(
            [0],
            [toolPart('a')],
            new Map([['a', { startedAt: 1, phase: 'done' as const }]]),
        );

        expect(progress).toMatchObject({ durationMs: null, toolCount: 1, timedToolCount: 0 });
    });

    it('leaves a still-running tool untimed', () => {
        const progress = getToolGroupProgress(
            [0],
            [toolPart('a')],
            new Map([['a', { startedAt: 1, phase: 'running' as const }]]),
        );

        expect(progress).toMatchObject({ toolCount: 1, timedToolCount: 0 });
    });
});
