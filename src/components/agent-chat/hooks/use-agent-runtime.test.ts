import { beforeEach, describe, expect, it } from 'vitest';

import {
    clearPlanConfirmAnswered,
    markPlanConfirmAnswered,
} from '@/components/agent-chat/research/plan-confirm-answered';
import { PLAN_CONFIRM_TOOL_NAME } from '@/components/agent-chat/research/research-contract';
import type { FluentMindUIMessage } from '@/components/agent-chat/types';

import { collectUnsentResumeResults, toClientTools } from './use-agent-runtime';

const assistantMessage = (parts: unknown[]): FluentMindUIMessage =>
    ({ id: 'assistant-1', role: 'assistant', parts }) as unknown as FluentMindUIMessage;

const navigateResult = { ok: true };

describe('collectUnsentResumeResults', () => {
    it('collects a static `tool-<name>` part for a mounted client tool', () => {
        const messages = [
            assistantMessage([
                {
                    type: 'tool-navigate_app',
                    toolCallId: 'call-1',
                    state: 'output-available',
                    output: navigateResult,
                },
            ]),
        ];

        expect(collectUnsentResumeResults(messages, new Set(['navigate_app']), new Set())).toEqual([
            { toolCallId: 'call-1', output: navigateResult },
        ]);
    });

    it('collects a `dynamic-tool` part carrying the same tool name', () => {
        const messages = [
            assistantMessage([
                {
                    type: 'dynamic-tool',
                    toolName: 'navigate_app',
                    toolCallId: 'call-2',
                    state: 'output-available',
                    output: navigateResult,
                },
            ]),
        ];

        expect(collectUnsentResumeResults(messages, new Set(['navigate_app']), new Set())).toEqual([
            { toolCallId: 'call-2', output: navigateResult },
        ]);
    });

    it('ignores a dynamic tool whose name is not mounted', () => {
        const messages = [
            assistantMessage([
                {
                    type: 'dynamic-tool',
                    toolName: 'mcp_something_else',
                    toolCallId: 'call-3',
                    state: 'output-available',
                    output: { ok: true },
                },
            ]),
        ];

        expect(collectUnsentResumeResults(messages, new Set(['navigate_app']), new Set())).toEqual([]);
    });

    it('collects a refused navigation so the turn resumes instead of stalling', () => {
        const refusal = { ok: false, error: 'Route "pipeline" was not opened: a hash route must start with "#/".' };
        const messages = [
            assistantMessage([
                {
                    type: 'dynamic-tool',
                    toolName: 'navigate_app',
                    toolCallId: 'call-4',
                    state: 'output-available',
                    output: refusal,
                },
            ]),
        ];

        expect(collectUnsentResumeResults(messages, new Set(['navigate_app']), new Set())).toEqual([
            { toolCallId: 'call-4', output: refusal },
        ]);
    });

    it('skips a result that was already sent', () => {
        const messages = [
            assistantMessage([
                { type: 'tool-navigate_app', toolCallId: 'call-5', state: 'output-available', output: navigateResult },
            ]),
        ];

        expect(collectUnsentResumeResults(messages, new Set(['navigate_app']), new Set(['call-5']))).toEqual([]);
    });

    it('skips a tool the turn already answered with text', () => {
        const messages = [
            assistantMessage([
                { type: 'tool-navigate_app', toolCallId: 'call-6', state: 'output-available', output: navigateResult },
                { type: 'text', text: 'Opened the pipeline for you.' },
            ]),
        ];

        expect(collectUnsentResumeResults(messages, new Set(['navigate_app']), new Set())).toEqual([]);
    });
});

describe('collectUnsentResumeResults for the research plan gate', () => {
    const planAnswer = { approved: false, steps: [] };
    const gateMessages = (toolCallId: string) => [
        assistantMessage([
            { type: `tool-${PLAN_CONFIRM_TOOL_NAME}`, toolCallId, state: 'output-available', output: planAnswer },
        ]),
    ];

    beforeEach(() => {
        clearPlanConfirmAnswered();
    });

    it('resumes the turn for a gate answered in this session', () => {
        markPlanConfirmAnswered('call-plan-1');

        expect(
            collectUnsentResumeResults(gateMessages('call-plan-1'), new Set([PLAN_CONFIRM_TOOL_NAME]), new Set()),
        ).toEqual([{ toolCallId: 'call-plan-1', output: planAnswer }]);
    });

    it('never resumes a stored answer replayed from history, even with no text after it', () => {
        expect(
            collectUnsentResumeResults(gateMessages('call-plan-2'), new Set([PLAN_CONFIRM_TOOL_NAME]), new Set()),
        ).toEqual([]);
    });

    it('forgets the session answer once the thread is replaced', () => {
        markPlanConfirmAnswered('call-plan-3');
        clearPlanConfirmAnswered();

        expect(
            collectUnsentResumeResults(gateMessages('call-plan-3'), new Set([PLAN_CONFIRM_TOOL_NAME]), new Set()),
        ).toEqual([]);
    });
});

describe('toClientTools', () => {
    const body = {
        tools: {
            navigate_app: { description: 'Route the app pane.', parameters: { type: 'object' } },
            some_other_tool: { description: 'Not ours.', parameters: { type: 'object' } },
        },
    };

    it('forwards only the tools the host actually mounted', () => {
        expect(toClientTools(body, new Set(['navigate_app']))).toEqual({
            navigate_app: { description: 'Route the app pane.', parameters: { type: 'object' } },
        });
    });

    it('sends nothing when no client tool is mounted', () => {
        expect(toClientTools(body, new Set())).toBeUndefined();
    });

    it('sends nothing when the mounted tool is absent from the request body', () => {
        expect(toClientTools({ tools: {} }, new Set(['navigate_app']))).toBeUndefined();
        expect(toClientTools(undefined, new Set(['navigate_app']))).toBeUndefined();
    });

    it('defaults a missing description to an empty string', () => {
        expect(toClientTools({ tools: { navigate_app: { parameters: {} } } }, new Set(['navigate_app']))).toEqual({
            navigate_app: { description: '', parameters: {} },
        });
    });
});
