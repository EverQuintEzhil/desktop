import type { QueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';
import { renderHookWithProviders } from '@/test/test-utils';
import type { ChatAgentUiType } from '@/types/ui';

import { MY_AGENTS_QUERY_KEY } from '../../../agents/hooks/use-agents-queries';
import { buildDefaultUiConfig } from '../../lib/create-agent-api';
import type { AgentConfigDraft } from '../../types';

import type { AgentAutosaveSeed } from './types';
import { useAgentAutosave } from './use-agent-autosave';

const AGENT_ID = 'agent-1';
const OTHER_AGENT_ID = 'agent-2';

const code = (id: string, version = '1.0.1') => ({
    _id: id,
    version,
    type: 'agent_system_prompt',
    lang: 'markdown',
    code: '',
});

const stubAgentPut = () => server.use(respond('put', `/agents/${AGENT_ID}`, () => envelope({ _id: AGENT_ID })));

const uiConfigWith = (models: { name: string; modelId: string }[]): ChatAgentUiType => ({
    ...buildDefaultUiConfig('Support bot'),
    models,
    ...(models[0] ? { defaultModel: models[0] } : {}),
});

const renderAutosave = (config: AgentConfigDraft, seed: AgentAutosaveSeed = {}) =>
    renderHookWithProviders(
        ({ nextConfig }: { nextConfig: AgentConfigDraft }) => useAgentAutosave(AGENT_ID, nextConfig, seed),
        { initialProps: { nextConfig: config } },
    );

// `agentId` and the config move independently: a consumer that is not keyed on the agent re-renders
// this hook with a new id while still holding the previous agent's draft.
const renderAutosaveAcrossAgents = (config: AgentConfigDraft, seed: AgentAutosaveSeed = {}) =>
    renderHookWithProviders(
        ({ nextAgentId, nextConfig }: { nextAgentId: string; nextConfig: AgentConfigDraft }) =>
            useAgentAutosave(nextAgentId, nextConfig, seed),
        { initialProps: { nextAgentId: AGENT_ID, nextConfig: config } },
    );

// A cached my-agents page proves the invalidation is observable: `isInvalidated` flips only if the
// write reached the same QueryClient the list reads.
const seedMyAgentsCache = (queryClient: QueryClient) => {
    const queryKey = [...MY_AGENTS_QUERY_KEY, 'user-1', ''];

    // The test QueryClient sets `gcTime: 0`, which would evict an observer-less cache entry before
    // the assertion runs.
    queryClient.setQueryDefaults(MY_AGENTS_QUERY_KEY, { gcTime: Infinity });
    queryClient.setQueryData(queryKey, { values: [], pageInfo: { page: 0, totalPages: 1 } });

    return () => queryClient.getQueryState(queryKey)?.isInvalidated ?? false;
};

const captureAgentPuts = () => {
    const writes: { agentId: string; body: Record<string, unknown> }[] = [];
    const capture = (agentId: string) =>
        http.put(apiUrl(`/agents/${agentId}`), async ({ request }) => {
            writes.push({ agentId, body: (await request.json()) as Record<string, unknown> });

            return envelope({ _id: agentId });
        });

    server.use(capture(AGENT_ID), capture(OTHER_AGENT_ID));

    return writes;
};

describe('useAgentAutosave', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts clean with the seeded published instructions', () => {
        const { result } = renderAutosave(
            { name: 'Support bot', instructions: 'Original' },
            { systemPromptCodeId: 'code-pub', defaultInstructions: 'Original', description: 'Handles billing' },
        );

        expect(result.current.saving).toBe(false);
        expect(result.current.saved).toBe(false);
        expect(result.current.hasPendingChanges).toBe(false);
        expect(result.current.hasPendingUiConfig).toBe(false);
        expect(result.current.originalInstructions).toBe('Original');
        expect(result.current.getIsDirty()).toBe(false);
        expect(result.current.getDescription()).toBe('Handles billing');
    });

    it('debounces a rename before PUTting the agent', async () => {
        let body: Record<string, unknown> = {};

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { result, rerender } = renderAutosave({ name: 'Support bot', instructions: '' });

        rerender({ nextConfig: { name: 'Renamed bot', instructions: '' } });

        expect(body).toEqual({});
        expect(result.current.getIsDirty()).toBe(true);

        act(() => {
            vi.advanceTimersByTime(600);
        });

        await waitFor(() => {
            expect(body).toEqual({ name: 'Renamed bot', slug: 'renamed-bot' });
        });
        await waitFor(() => {
            expect(result.current.saved).toBe(true);
        });
    });

    it('flushes a pending rename when the hook unmounts before the debounce fires', async () => {
        const bodies: unknown[] = [];

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                bodies.push(await request.json());

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { rerender, unmount } = renderAutosave({ name: 'Support bot', instructions: '' });

        rerender({ nextConfig: { name: 'Renamed bot', instructions: '' } });

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(bodies).toEqual([]);

        act(() => {
            unmount();
        });

        // Collected as a list, not a scalar: the flush must not write alongside the
        // timer path, and a scalar would hide the second write.
        await waitFor(() => {
            expect(bodies).toEqual([{ name: 'Renamed bot', slug: 'renamed-bot' }]);
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(bodies).toEqual([{ name: 'Renamed bot', slug: 'renamed-bot' }]);
    });

    it('flushes a pending instruction edit when the hook unmounts before the debounce fires', async () => {
        const codeBodies: Record<string, unknown>[] = [];

        stubAgentPut();
        server.use(
            http.post(apiUrl('/codes'), async ({ request }) => {
                codeBodies.push((await request.json()) as Record<string, unknown>);

                return envelope(code('code-draft'));
            }),
        );

        const { rerender, unmount } = renderAutosave(
            { name: 'Support bot', instructions: 'Original' },
            { systemPromptCodeId: 'code-pub', systemPromptVersion: '1.0.0', defaultInstructions: 'Original' },
        );

        rerender({ nextConfig: { name: 'Support bot', instructions: '# Purpose\nHelps with billing.' } });

        act(() => {
            vi.advanceTimersByTime(400);
        });

        expect(codeBodies).toEqual([]);

        act(() => {
            unmount();
        });

        await waitFor(() => {
            expect(codeBodies).toHaveLength(1);
        });
        expect(codeBodies[0]!.code).toBe('# Purpose\nHelps with billing.');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(codeBodies).toHaveLength(1);
    });

    it('collapses two renames inside one debounce window into a single save of the latest name', async () => {
        const bodies: unknown[] = [];

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                bodies.push(await request.json());

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { rerender } = renderAutosave({ name: 'Support bot', instructions: '' });

        rerender({ nextConfig: { name: 'First rename', instructions: '' } });

        act(() => {
            vi.advanceTimersByTime(300);
        });

        rerender({ nextConfig: { name: 'Second rename', instructions: '' } });

        act(() => {
            vi.advanceTimersByTime(600);
        });

        await waitFor(() => {
            expect(bodies).toEqual([{ name: 'Second rename', slug: 'second-rename' }]);
        });
    });

    it('saves nothing on unmount when neither the name nor the instructions were edited', async () => {
        const bodies: unknown[] = [];

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                bodies.push(await request.json());

                return envelope({ _id: AGENT_ID });
            }),
        );
        server.use(respond('post', '/codes', () => envelope(code('code-draft'))));

        const { rerender, unmount } = renderAutosave(
            { name: 'Support bot', instructions: 'Original' },
            { systemPromptCodeId: 'code-pub', defaultInstructions: 'Original' },
        );

        rerender({ nextConfig: { name: 'Support bot', instructions: 'Original' } });

        act(() => {
            unmount();
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(bodies).toEqual([]);
    });

    it('does not resurrect a rename that was reverted inside the debounce window', async () => {
        const bodies: unknown[] = [];

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                bodies.push(await request.json());

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { rerender, unmount } = renderAutosave({ name: 'Support bot', instructions: '' });

        rerender({ nextConfig: { name: 'Support botX', instructions: '' } });

        act(() => {
            vi.advanceTimersByTime(300);
        });

        rerender({ nextConfig: { name: 'Support bot', instructions: '' } });

        act(() => {
            unmount();
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(bodies).toEqual([]);
    });

    it('does not resurrect an instruction edit that was reverted inside the debounce window', async () => {
        const codeBodies: unknown[] = [];

        stubAgentPut();
        server.use(
            http.post(apiUrl('/codes'), async ({ request }) => {
                codeBodies.push(await request.json());

                return envelope(code('code-draft'));
            }),
        );

        const { rerender, unmount } = renderAutosave(
            { name: 'Support bot', instructions: 'Original' },
            { systemPromptCodeId: 'code-pub', defaultInstructions: 'Original' },
        );

        rerender({ nextConfig: { name: 'Support bot', instructions: 'Originalx' } });

        act(() => {
            vi.advanceTimersByTime(400);
        });

        rerender({ nextConfig: { name: 'Support bot', instructions: 'Original' } });

        act(() => {
            unmount();
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(codeBodies).toEqual([]);
    });

    it('surfaces a rename failure without leaving the saving flag stuck', async () => {
        server.use(respond('put', `/agents/${AGENT_ID}`, () => httpError(500)));

        const { result, rerender } = renderAutosave({ name: 'Support bot', instructions: '' });

        rerender({ nextConfig: { name: 'Renamed bot', instructions: '' } });

        act(() => {
            vi.advanceTimersByTime(600);
        });

        await waitFor(() => {
            expect(result.current.saving).toBe(false);
        });
        expect(result.current.saved).toBe(false);
    });

    it('debounces an instruction edit into a draft code without touching the description', async () => {
        const agentBodies: unknown[] = [];
        let codeBody: Record<string, unknown> = {};

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                agentBodies.push(await request.json());

                return envelope({ _id: AGENT_ID });
            }),
        );
        server.use(
            http.post(apiUrl('/codes'), async ({ request }) => {
                codeBody = (await request.json()) as Record<string, unknown>;

                return envelope(code('code-draft'));
            }),
        );

        const { result, rerender } = renderAutosave(
            { name: 'Support bot', instructions: 'Original' },
            { systemPromptCodeId: 'code-pub', systemPromptVersion: '1.0.0', defaultInstructions: 'Original' },
        );

        rerender({ nextConfig: { name: 'Support bot', instructions: '# Purpose\nHelps with billing.' } });

        act(() => {
            vi.advanceTimersByTime(800);
        });

        await waitFor(() => {
            expect(codeBody.code).toBe('# Purpose\nHelps with billing.');
        });
        expect(codeBody.version).toBe('1.0.1');
        await waitFor(() => {
            expect(result.current.hasPendingChanges).toBe(true);
        });
        expect(agentBodies).toEqual([]);
    });

    it('never writes a description when instructions change', async () => {
        const descriptions: unknown[] = [];

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                descriptions.push(await request.json());

                return envelope({ _id: AGENT_ID });
            }),
        );
        server.use(respond('post', '/codes', () => envelope(code('code-draft'))));

        const { result, rerender } = renderAutosave(
            { name: 'Support bot', instructions: 'Original' },
            { systemPromptCodeId: 'code-pub', defaultInstructions: 'Original' },
        );

        await act(async () => {
            await result.current.saveChannelDescription('Hand written');
        });

        expect(descriptions).toEqual([{ description: 'Hand written' }]);
        expect(result.current.getDescription()).toBe('Hand written');

        rerender({ nextConfig: { name: 'Support bot', instructions: '# Purpose\nSomething else.' } });

        act(() => {
            vi.advanceTimersByTime(800);
        });

        await waitFor(() => {
            expect(result.current.hasPendingChanges).toBe(true);
        });

        // `hasPendingChanges` flips off the code write, not off the agent PUT, so
        // follow with a rename that must PUT: the recorded bodies then have to be
        // the hand-written description and that rename, proving the instruction
        // edit in between wrote nothing to the agent.
        rerender({ nextConfig: { name: 'Renamed bot', instructions: '# Purpose\nSomething else.' } });

        act(() => {
            vi.advanceTimersByTime(600);
        });

        await waitFor(() => {
            expect(descriptions).toEqual([
                { description: 'Hand written' },
                { name: 'Renamed bot', slug: 'renamed-bot' },
            ]);
        });
    });

    it('saves only the capability ids that actually changed', async () => {
        let body: Record<string, unknown> = {};

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { rerender } = renderAutosave({
            name: 'Support bot',
            instructions: '',
            tools: [{ _id: 'tool-1', name: 'Search' }],
            skills: [{ _id: 'skill-1', name: 'Report' }],
        });

        rerender({
            nextConfig: {
                name: 'Support bot',
                instructions: '',
                tools: [
                    { _id: 'tool-1', name: 'Search' },
                    { _id: 'tool-2', name: 'Fetch' },
                ],
                skills: [{ _id: 'skill-1', name: 'Report' }],
            },
        });

        await waitFor(() => {
            expect(body).toEqual({ toolIds: ['tool-1', 'tool-2'] });
        });
    });

    it('sends the skills attachment when a skill is marked recommended', async () => {
        const bodies: unknown[] = [];

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                bodies.push(await request.json());

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { rerender } = renderAutosave({
            name: 'Support bot',
            instructions: '',
            skills: [
                { _id: 'skill-1', name: 'Report' },
                { _id: 'skill-2', name: 'Summarise' },
            ],
        });

        rerender({
            nextConfig: {
                name: 'Support bot',
                instructions: '',
                skills: [
                    { _id: 'skill-1', name: 'Report', isRecommended: true },
                    { _id: 'skill-2', name: 'Summarise' },
                ],
            },
        });

        await waitFor(() => {
            expect(bodies).toEqual([
                {
                    skills: [
                        { skillId: 'skill-1', isRecommended: true },
                        { skillId: 'skill-2', isRecommended: false },
                    ],
                },
            ]);
        });
    });

    it('does not rewrite the skills attachment when only an unrelated capability changes', async () => {
        const bodies: unknown[] = [];

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                bodies.push(await request.json());

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { rerender } = renderAutosave({
            name: 'Support bot',
            instructions: '',
            skills: [{ _id: 'skill-1', name: 'Report' }],
            tools: [{ _id: 'tool-1', name: 'Search' }],
        });

        rerender({
            nextConfig: {
                name: 'Support bot',
                instructions: '',
                skills: [{ _id: 'skill-1', name: 'Report' }],
                tools: [
                    { _id: 'tool-1', name: 'Search' },
                    { _id: 'tool-2', name: 'Fetch' },
                ],
            },
        });

        await waitFor(() => {
            expect(bodies).toEqual([{ toolIds: ['tool-1', 'tool-2'] }]);
        });
    });

    it('keeps sending the connector attachment on its own mcpServers shape', async () => {
        const bodies: unknown[] = [];

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                bodies.push(await request.json());

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { rerender } = renderAutosave({
            name: 'Support bot',
            instructions: '',
            mcpServers: [{ _id: 'mcp-1', name: 'Jira' }],
        });

        rerender({
            nextConfig: {
                name: 'Support bot',
                instructions: '',
                mcpServers: [{ _id: 'mcp-1', name: 'Jira', isRecommended: true }],
            },
        });

        await waitFor(() => {
            expect(bodies).toEqual([{ mcpServers: [{ mcpServerId: 'mcp-1', isRecommended: true }] }]);
        });
    });

    it('treats a reordered capability list as unchanged', async () => {
        const bodies: unknown[] = [];

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                bodies.push(await request.json());

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { rerender } = renderAutosave({
            name: 'Support bot',
            instructions: '',
            tools: [
                { _id: 'tool-1', name: 'A' },
                { _id: 'tool-2', name: 'B' },
            ],
        });

        rerender({
            nextConfig: {
                name: 'Support bot',
                instructions: '',
                tools: [
                    { _id: 'tool-2', name: 'B' },
                    { _id: 'tool-1', name: 'A' },
                ],
            },
        });

        act(() => {
            vi.advanceTimersByTime(1000);
        });

        // A write that never happens has no signal of its own, so add a real tool
        // afterwards: the recorded bodies then have to be only that one write.
        rerender({
            nextConfig: {
                name: 'Support bot',
                instructions: '',
                tools: [
                    { _id: 'tool-2', name: 'B' },
                    { _id: 'tool-1', name: 'A' },
                    { _id: 'tool-3', name: 'C' },
                ],
            },
        });

        await waitFor(() => {
            expect(bodies).toEqual([{ toolIds: ['tool-2', 'tool-1', 'tool-3'] }]);
        });
    });

    it('writes a model change into the ui-config draft, resolving missing names', async () => {
        let codeBody: Record<string, unknown> = {};
        const agentBodies: Record<string, unknown>[] = [];

        server.use(
            http.post(apiUrl('/codes'), async ({ request }) => {
                codeBody = (await request.json()) as Record<string, unknown>;

                return envelope(code('code-ui-draft'));
            }),
        );
        server.use(respond('get', '/models/m-2', () => envelope({ _id: 'm-2', model: 'claude-5' })));
        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                agentBodies.push((await request.json()) as Record<string, unknown>);

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { result, rerender } = renderAutosave(
            {
                name: 'Support bot',
                instructions: '',
                models: [{ _id: 'm-1', name: 'gpt-5' }],
            },
            {
                uiConfigCodeId: 'code-ui',
                uiConfigVersion: '1.0.0',
                uiConfig: uiConfigWith([{ name: 'gpt-5', modelId: 'm-1' }]),
            },
        );

        rerender({
            nextConfig: {
                name: 'Support bot',
                instructions: '',
                models: [
                    { _id: 'm-1', name: 'gpt-5' },
                    { _id: 'm-2', name: 'm-2' },
                ],
            },
        });

        await waitFor(() => {
            expect(codeBody.code).toBeDefined();
        });

        const saved = JSON.parse(codeBody.code as string) as ChatAgentUiType;

        expect(saved.models).toEqual([
            { name: 'gpt-5', modelId: 'm-1' },
            { name: 'claude-5', modelId: 'm-2' },
        ]);
        expect(saved.defaultModel).toEqual({ name: 'gpt-5', modelId: 'm-1' });
        expect(agentBodies).toContainEqual({ modelIds: ['m-1', 'm-2'], defaultModelId: 'm-1' });
        await waitFor(() => {
            expect(result.current.hasPendingUiConfig).toBe(true);
        });
    });

    it('does not assign models to the live agent when models are only reordered', async () => {
        let codeBody: Record<string, unknown> = {};
        const agentBodies: Record<string, unknown>[] = [];

        server.use(
            http.post(apiUrl('/codes'), async ({ request }) => {
                codeBody = (await request.json()) as Record<string, unknown>;

                return envelope(code('code-ui-draft'));
            }),
        );
        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                agentBodies.push((await request.json()) as Record<string, unknown>);

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { rerender } = renderAutosave(
            {
                name: 'Support bot',
                instructions: '',
                models: [
                    { _id: 'm-1', name: 'gpt-5' },
                    { _id: 'm-2', name: 'claude-5' },
                ],
            },
            {
                uiConfigCodeId: 'code-ui',
                uiConfigVersion: '1.0.0',
                uiConfig: uiConfigWith([
                    { name: 'gpt-5', modelId: 'm-1' },
                    { name: 'claude-5', modelId: 'm-2' },
                ]),
            },
        );

        rerender({
            nextConfig: {
                name: 'Support bot',
                instructions: '',
                models: [
                    { _id: 'm-2', name: 'claude-5' },
                    { _id: 'm-1', name: 'gpt-5' },
                ],
            },
        });

        await waitFor(() => {
            expect(codeBody.code).toBeDefined();
        });

        const saved = JSON.parse(codeBody.code as string) as ChatAgentUiType;

        expect(saved.defaultModel).toEqual({ name: 'claude-5', modelId: 'm-2' });
        expect(agentBodies).toEqual([]);
    });

    it('removes a model from the live agent when it is deleted from the draft', async () => {
        let codeBody: Record<string, unknown> = {};
        const agentBodies: Record<string, unknown>[] = [];

        server.use(
            http.post(apiUrl('/codes'), async ({ request }) => {
                codeBody = (await request.json()) as Record<string, unknown>;

                return envelope(code('code-ui-draft'));
            }),
        );
        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                agentBodies.push((await request.json()) as Record<string, unknown>);

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { rerender } = renderAutosave(
            {
                name: 'Support bot',
                instructions: '',
                models: [
                    { _id: 'm-1', name: 'gpt-5' },
                    { _id: 'm-2', name: 'claude-5' },
                ],
            },
            {
                uiConfigCodeId: 'code-ui',
                uiConfigVersion: '1.0.0',
                uiConfig: uiConfigWith([
                    { name: 'gpt-5', modelId: 'm-1' },
                    { name: 'claude-5', modelId: 'm-2' },
                ]),
            },
        );

        rerender({
            nextConfig: {
                name: 'Support bot',
                instructions: '',
                models: [{ _id: 'm-1', name: 'gpt-5' }],
            },
        });

        await waitFor(() => {
            expect(codeBody.code).toBeDefined();
        });

        expect(agentBodies).toContainEqual({ modelIds: ['m-1'], defaultModelId: 'm-1' });
    });

    it('publishAll promotes both drafts and pushes the published models back onto the agent', async () => {
        const pointerBodies: Record<string, unknown>[] = [];

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                pointerBodies.push((await request.json()) as Record<string, unknown>);

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { result } = renderAutosave(
            { name: 'Support bot', instructions: 'Draft text' },
            {
                systemPromptCodeId: 'code-pub',
                pendingCodeId: 'code-draft',
                pendingVersion: '1.0.1',
                defaultInstructions: 'Original',
                uiConfigCodeId: 'code-ui',
                uiConfig: uiConfigWith([{ name: 'gpt-5', modelId: 'm-1' }]),
                pendingUiConfigCodeId: 'code-ui-draft',
                pendingUiConfigVersion: '1.0.1',
                pendingUiConfig: uiConfigWith([{ name: 'claude-5', modelId: 'm-2' }]),
            },
        );

        expect(result.current.hasPendingChanges).toBe(true);
        expect(result.current.hasPendingUiConfig).toBe(true);

        await act(async () => {
            await result.current.publishAll();
        });

        expect(pointerBodies).toContainEqual({ systemPromptCodeId: 'code-draft' });
        expect(pointerBodies).toContainEqual({ uiConfigCodeId: 'code-ui-draft' });
        expect(pointerBodies).toContainEqual({ modelIds: ['m-2'], defaultModelId: 'm-2' });
        expect(result.current.hasPendingChanges).toBe(false);
        expect(result.current.hasPendingUiConfig).toBe(false);
        expect(result.current.isPublishing).toBe(false);
    });

    it('discardPending deletes the instruction draft and returns the published text', async () => {
        let deleted = '';

        server.use(
            http.delete(apiUrl('/codes/code-draft'), () => {
                deleted = 'code-draft';

                return envelope(null);
            }),
        );

        const { result } = renderAutosave(
            { name: 'Support bot', instructions: 'Draft text' },
            {
                systemPromptCodeId: 'code-pub',
                pendingCodeId: 'code-draft',
                defaultInstructions: 'Original',
            },
        );

        let restored = '';

        await act(async () => {
            restored = await result.current.discardPending();
        });

        expect(deleted).toBe('code-draft');
        expect(restored).toBe('Original');
        expect(result.current.hasPendingChanges).toBe(false);
    });

    it('discardModelPending drops the whole draft when only the model changed', async () => {
        let deleted = '';

        server.use(
            http.delete(apiUrl('/codes/code-ui-draft'), () => {
                deleted = 'code-ui-draft';

                return envelope(null);
            }),
        );

        const { result } = renderAutosave(
            { name: 'Support bot', instructions: '', models: [{ _id: 'm-2', name: 'claude-5' }] },
            {
                uiConfigCodeId: 'code-ui',
                uiConfig: uiConfigWith([{ name: 'gpt-5', modelId: 'm-1' }]),
                pendingUiConfigCodeId: 'code-ui-draft',
                pendingUiConfig: uiConfigWith([{ name: 'claude-5', modelId: 'm-2' }]),
            },
        );

        let outcome: { ok: boolean; models?: { _id: string }[] } = { ok: false };

        await act(async () => {
            outcome = await result.current.discardModelPending();
        });

        expect(deleted).toBe('code-ui-draft');
        expect(outcome.ok).toBe(true);
        expect(outcome.models).toEqual([{ _id: 'm-1', name: 'gpt-5' }]);
        expect(result.current.hasPendingUiConfig).toBe(false);
    });

    it('discardModelPending keeps the draft and restores only the models when appearance also changed', async () => {
        let updateBody: Record<string, unknown> = {};

        server.use(
            http.put(apiUrl('/codes/code-ui-draft'), async ({ request }) => {
                updateBody = (await request.json()) as Record<string, unknown>;

                return envelope(code('code-ui-draft'));
            }),
        );

        const published = uiConfigWith([{ name: 'gpt-5', modelId: 'm-1' }]);
        const pending: ChatAgentUiType = {
            ...uiConfigWith([{ name: 'claude-5', modelId: 'm-2' }]),
            home: { ...published.home!, title: 'Renamed home' },
        };

        const { result } = renderAutosave(
            { name: 'Support bot', instructions: '' },
            {
                uiConfigCodeId: 'code-ui',
                uiConfig: published,
                pendingUiConfigCodeId: 'code-ui-draft',
                pendingUiConfig: pending,
            },
        );

        await act(async () => {
            await result.current.discardModelPending();
        });

        const saved = JSON.parse(updateBody.code as string) as ChatAgentUiType;

        expect(saved.models).toEqual([{ name: 'gpt-5', modelId: 'm-1' }]);
        expect(saved.home?.title).toBe('Renamed home');
        expect(result.current.hasPendingUiConfig).toBe(true);
    });

    it('discardAppearancePending keeps the model when both changed', async () => {
        let updateBody: Record<string, unknown> = {};

        server.use(
            http.put(apiUrl('/codes/code-ui-draft'), async ({ request }) => {
                updateBody = (await request.json()) as Record<string, unknown>;

                return envelope(code('code-ui-draft'));
            }),
        );

        const published = uiConfigWith([{ name: 'gpt-5', modelId: 'm-1' }]);
        const pending: ChatAgentUiType = {
            ...uiConfigWith([{ name: 'claude-5', modelId: 'm-2' }]),
            home: { ...published.home!, title: 'Renamed home' },
        };

        const { result } = renderAutosave(
            { name: 'Support bot', instructions: '' },
            {
                uiConfigCodeId: 'code-ui',
                uiConfig: published,
                pendingUiConfigCodeId: 'code-ui-draft',
                pendingUiConfig: pending,
            },
        );

        let ok = false;

        await act(async () => {
            ok = await result.current.discardAppearancePending();
        });

        const saved = JSON.parse(updateBody.code as string) as ChatAgentUiType;

        expect(ok).toBe(true);
        expect(saved.home?.title).toBe('Support bot');
        expect(saved.models).toEqual([{ name: 'claude-5', modelId: 'm-2' }]);
    });

    it('saveChannelUiConfig writes straight through to the ui-config draft', async () => {
        let codeBody: Record<string, unknown> = {};

        server.use(
            http.post(apiUrl('/codes'), async ({ request }) => {
                codeBody = (await request.json()) as Record<string, unknown>;

                return envelope(code('code-ui-draft'));
            }),
        );

        const { result } = renderAutosave(
            { name: 'Support bot', instructions: '' },
            { uiConfigCodeId: 'code-ui', uiConfigVersion: '1.0.0', uiConfig: uiConfigWith([]) },
        );

        await act(async () => {
            await result.current.saveChannelUiConfig({
                ...uiConfigWith([]),
                home: { ...uiConfigWith([]).home!, title: 'Channel title' },
            });
        });

        const saved = JSON.parse(codeBody.code as string) as ChatAgentUiType;

        expect(saved.home?.title).toBe('Channel title');
        expect(result.current.getUiConfig()?.home?.title).toBe('Channel title');
        expect(result.current.getPublishedUiConfig()?.home?.title).toBe('Support bot');
    });

    it('never writes a pending rename onto the agent navigated to', async () => {
        const writes = captureAgentPuts();

        const { rerender, unmount } = renderAutosaveAcrossAgents({ name: 'Support bot', instructions: '' });

        rerender({ nextAgentId: AGENT_ID, nextConfig: { name: 'Renamed bot', instructions: '' } });

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(writes).toEqual([]);

        rerender({ nextAgentId: OTHER_AGENT_ID, nextConfig: { name: 'Renamed bot', instructions: '' } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });

        expect(writes.filter((write) => write.agentId === OTHER_AGENT_ID)).toEqual([]);

        // The edit must still reach the agent it was made on, not be dropped.
        act(() => {
            unmount();
        });

        await waitFor(() => {
            expect(writes).toEqual([{ agentId: AGENT_ID, body: { name: 'Renamed bot', slug: 'renamed-bot' } }]);
        });
    });

    it('never writes a pending instruction edit onto the agent navigated to', async () => {
        const writes = captureAgentPuts();
        const codeBodies: Record<string, unknown>[] = [];

        server.use(
            http.post(apiUrl('/codes'), async ({ request }) => {
                codeBodies.push((await request.json()) as Record<string, unknown>);

                return envelope(code('code-draft'));
            }),
        );

        const { rerender, unmount } = renderAutosaveAcrossAgents(
            { name: 'Support bot', instructions: 'Original' },
            { systemPromptCodeId: 'code-pub', systemPromptVersion: '1.0.0', defaultInstructions: 'Original' },
        );

        rerender({
            nextAgentId: AGENT_ID,
            nextConfig: { name: 'Support bot', instructions: '# Purpose\nHelps with billing.' },
        });

        act(() => {
            vi.advanceTimersByTime(400);
        });

        rerender({
            nextAgentId: OTHER_AGENT_ID,
            nextConfig: { name: 'Support bot', instructions: '# Purpose\nHelps with billing.' },
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });

        expect(writes.filter((write) => write.agentId === OTHER_AGENT_ID)).toEqual([]);
        expect(codeBodies).toEqual([]);

        act(() => {
            unmount();
        });

        await waitFor(() => {
            expect(codeBodies).toHaveLength(1);
        });
        expect(codeBodies[0]!.code).toBe('# Purpose\nHelps with billing.');
        // `useCodeDraft` stamps the code with an agent id resolved at write time, so the flush must
        // not associate the outgoing agent's instructions with the agent navigated to.
        expect(codeBodies[0]!.agentId).toBe(AGENT_ID);
        expect(writes.filter((write) => write.agentId === OTHER_AGENT_ID)).toEqual([]);
    });

    it('never writes pending capability changes onto the agent navigated to', async () => {
        const writes = captureAgentPuts();

        const { rerender } = renderAutosaveAcrossAgents({ name: 'Support bot', instructions: '', skills: [] });

        // Capability writes are not debounced: the window is the in-flight PUT, not a timer.
        rerender({
            nextAgentId: OTHER_AGENT_ID,
            nextConfig: { name: 'Support bot', instructions: '', skills: [{ _id: 'skill-1', name: 'Billing' }] },
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });

        expect(writes.filter((write) => write.agentId === OTHER_AGENT_ID)).toEqual([]);
    });

    it('invalidates the my-agents list after a rename is persisted', async () => {
        stubAgentPut();

        const { rerender, queryClient } = renderAutosave({ name: 'Support bot', instructions: '' });
        const isInvalidated = seedMyAgentsCache(queryClient);

        rerender({ nextConfig: { name: 'Renamed bot', instructions: '' } });

        expect(isInvalidated()).toBe(false);

        act(() => {
            vi.advanceTimersByTime(600);
        });

        await waitFor(() => {
            expect(isInvalidated()).toBe(true);
        });
    });

    it('does not invalidate the my-agents list when the rename write fails', async () => {
        server.use(respond('put', `/agents/${AGENT_ID}`, () => httpError(500)));

        const { result, rerender, queryClient } = renderAutosave({ name: 'Support bot', instructions: '' });
        const isInvalidated = seedMyAgentsCache(queryClient);

        rerender({ nextConfig: { name: 'Renamed bot', instructions: '' } });

        act(() => {
            vi.advanceTimersByTime(600);
        });
        expect(result.current.saving).toBe(true);

        await waitFor(() => {
            expect(result.current.saving).toBe(false);
        });

        expect(isInvalidated()).toBe(false);
    });

    it('invalidates the my-agents list after saveChannelDescription', async () => {
        stubAgentPut();

        const { result, queryClient } = renderAutosave(
            { name: 'Support bot', instructions: '' },
            { description: 'Old description' },
        );
        const isInvalidated = seedMyAgentsCache(queryClient);

        await act(async () => {
            await result.current.saveChannelDescription('New description');
        });

        expect(result.current.getDescription()).toBe('New description');
        expect(isInvalidated()).toBe(true);
    });

    it('synchronizePersistedState re-baselines everything after a reload', async () => {
        const { result, rerender } = renderAutosave(
            { name: 'Support bot', instructions: 'Original' },
            { systemPromptCodeId: 'code-pub', defaultInstructions: 'Original' },
        );

        rerender({ nextConfig: { name: 'Renamed', instructions: 'Original' } });

        expect(result.current.getIsDirty()).toBe(true);

        act(() => {
            result.current.synchronizePersistedState(
                { name: 'Renamed', instructions: 'Original' },
                { systemPromptCodeId: 'code-pub', defaultInstructions: 'Original', description: 'Fresh' },
            );
        });
        rerender({ nextConfig: { name: 'Renamed', instructions: 'Original' } });

        expect(result.current.hasUnsavedLocalEdits()).toBe(false);
        expect(result.current.getDescription()).toBe('Fresh');
        expect(result.current.saving).toBe(false);
    });
});
