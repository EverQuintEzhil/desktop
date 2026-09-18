import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import type { AgentComposerState } from '@/components/agent-chat/types';
import { ChatHostProvider, type ChatHost } from '@/components/chat-host';
import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';
import type { ChatAgentType } from '@/types/admin';

import { buildChatRequestBody } from '../runtime/build-chat-request-body';

import { useAgentComposerOptions } from './use-agent-composer-options';

const chatHost = {
    session: { user: { id: 'user-1' }, tenant: { id: 'tenant-1' } },
} as unknown as ChatHost;

/** One client per mount: a client rebuilt on every render would drop the cache a rerender test depends on. */
const Wrapper = ({ children }: { children: ReactNode }) => {
    const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    return (
        <QueryClientProvider client={queryClient}>
            <ChatHostProvider value={chatHost}>{children}</ChatHostProvider>
        </QueryClientProvider>
    );
};

const agent = {
    _id: 'agent-1',
    uiConfig: {
        models: [
            { name: 'Fast', modelId: 'model-fast' },
            { name: 'Deep', modelId: 'model-deep' },
        ],
        defaultModel: { modelId: 'model-fast' },
    },
} as unknown as ChatAgentType;

const agentWithParameters = {
    ...agent,
    uiConfig: {
        ...agent.uiConfig,
        parameters: {
            tone: {
                label: 'Tone',
                type: 'select',
                default: { label: 'Neutral', value: 'neutral' },
                options: [
                    { label: 'Neutral', value: 'neutral' },
                    { label: 'Playful', value: 'playful' },
                ],
            },
        },
    },
} as unknown as ChatAgentType;

const agentWithDeepSearch = {
    ...agent,
    uiConfig: {
        ...agent.uiConfig,
        home: { search: { showDeepSearch: true } },
    },
} as unknown as ChatAgentType;

const noop = () => {};

interface ComposerProps {
    composerAgent: ChatAgentType;
    conversationId?: string | null;
}

const renderComposer = (composerAgent: ChatAgentType = agent, conversationId?: string | null) =>
    renderHook<AgentComposerState, ComposerProps>(
        ({ composerAgent: current, conversationId: currentConversationId }) =>
            useAgentComposerOptions(current, noop, currentConversationId),
        { wrapper: Wrapper, initialProps: { composerAgent, conversationId } },
    );

/** Holds the preferences GET until the returned release is called. */
const holdPreferencesGet = (value: unknown) => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });

    server.use(
        http.get(apiUrl('/agents/agent-1/preferences'), async () => {
            await held;

            return envelope(value);
        }),
    );

    return () => release();
};

const collectPatchBodies = () => {
    const bodies: unknown[] = [];

    server.use(
        http.patch(apiUrl('/agents/agent-1/preferences'), async ({ request }) => {
            const body = await request.json();

            bodies.push(body);

            return envelope(body);
        }),
    );

    return bodies;
};

describe('useAgentComposerOptions model selection', () => {
    it('resolves the agent default before the preferences request settles', () => {
        holdPreferencesGet({ defaultModelId: 'model-deep' });

        const { result } = renderComposer();

        expect(result.current.model?.value.modelId).toBe('model-fast');
    });

    it('stamps a modelId on a request built before the preferences request settles', () => {
        holdPreferencesGet({ defaultModelId: 'model-deep' });

        const { result } = renderComposer();

        const body = buildChatRequestBody({
            agentIdentifier: 'agent-1',
            conversationId: null,
            model: result.current.model,
            parameters: {},
            isWebSearchEnabled: false,
            isDeepSearchEnabled: false,
            isRelatedQuestionsEnabled: false,
            isIncognitoMode: false,
            isPublic: false,
            fileIds: [],
        });

        expect(body.modelId).toBe('model-fast');
    });

    it('prefers the persisted model over the agent default', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => envelope({ defaultModelId: 'model-deep' })));

        const { result } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-deep'));
    });

    it('falls back to the agent default when nothing is persisted', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => envelope(null)));

        const { result } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));
    });

    it('ignores a persisted model that is no longer available', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => envelope({ defaultModelId: 'model-retired' })));

        const { result } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));
    });

    it('still resolves the default model when the preferences request fails', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => httpError(500, 'Boom')));

        const { result } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));
    });

    it('keeps the in-session pick when a persisted preference arrives late', async () => {
        const releaseGet = holdPreferencesGet({ defaultModelId: 'model-fast' });
        const patchBodies = collectPatchBodies();

        const { result } = renderComposer();

        act(() => {
            result.current.setModel({ label: 'Deep', value: { modelId: 'model-deep', name: 'Deep' } });
        });

        releaseGet();

        await waitFor(() => expect(patchBodies).toEqual([{ defaultModelId: 'model-deep' }]));
        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-deep'));
    });

    it('writes only on a user pick that differs from the persisted value', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => envelope({ defaultModelId: 'model-deep' })));
        const patchBodies = collectPatchBodies();

        const { result } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-deep'));
        expect(patchBodies).toEqual([]);

        act(() => {
            result.current.setModel({ label: 'Deep', value: { modelId: 'model-deep', name: 'Deep' } });
        });
        expect(patchBodies).toEqual([]);

        act(() => {
            result.current.setModel({ label: 'Fast', value: { modelId: 'model-fast', name: 'Fast' } });
        });

        await waitFor(() => expect(patchBodies).toEqual([{ defaultModelId: 'model-fast' }]));
    });

    it('writes again when the user re-picks the persisted model while the first write is in flight', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => envelope({ defaultModelId: 'model-fast' })));

        const patchBodies: unknown[] = [];
        let releaseFirstPatch = () => {};
        const firstPatchHeld = new Promise<void>((resolve) => {
            releaseFirstPatch = resolve;
        });

        server.use(
            http.patch(apiUrl('/agents/agent-1/preferences'), async ({ request }) => {
                const body = await request.json();

                patchBodies.push(body);

                if (patchBodies.length === 1) await firstPatchHeld;

                return envelope(body);
            }),
        );

        const { result } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        act(() => {
            result.current.setModel({ label: 'Deep', value: { modelId: 'model-deep', name: 'Deep' } });
        });
        await waitFor(() => expect(patchBodies).toHaveLength(1));

        act(() => {
            result.current.setModel({ label: 'Fast', value: { modelId: 'model-fast', name: 'Fast' } });
        });

        await waitFor(() => expect(patchBodies).toHaveLength(2));
        expect(patchBodies).toEqual([{ defaultModelId: 'model-deep' }, { defaultModelId: 'model-fast' }]);

        releaseFirstPatch();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));
    });

    it('keeps the in-session pick when the write fails', async () => {
        server.use(
            respond('get', '/agents/agent-1/preferences', () => envelope({ defaultModelId: 'model-fast' })),
            respond('patch', '/agents/agent-1/preferences', () => httpError(500, 'Boom')),
        );

        const { result } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        act(() => {
            result.current.setModel({ label: 'Deep', value: { modelId: 'model-deep', name: 'Deep' } });
        });

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-deep'));
        expect(result.current.model?.value.modelId).toBe('model-deep');
    });
});

// The admin playground and the SDK swap the `agent` prop in place instead of
// remounting per agent, so per-instance state must not leak across the switch.
describe('useAgentComposerOptions agent switch', () => {
    const secondAgent = { ...agent, _id: 'agent-2' } as unknown as ChatAgentType;

    const stubPreferences = () => {
        server.use(
            respond('get', '/agents/agent-1/preferences', () => envelope(null)),
            respond('get', '/agents/agent-2/preferences', () => envelope(null)),
        );
    };

    it('drops the in-session pick when the agent prop is swapped in place', async () => {
        stubPreferences();
        server.use(
            http.patch(apiUrl('/agents/:agentId/preferences'), async ({ request }) => envelope(await request.json())),
        );

        const { result, rerender } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        act(() => {
            result.current.setModel({ label: 'Deep', value: { modelId: 'model-deep', name: 'Deep' } });
        });
        expect(result.current.model?.value.modelId).toBe('model-deep');

        rerender({ composerAgent: secondAgent });

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));
    });

    it('persists the first pick on the next agent even when it matches the previous pick', async () => {
        stubPreferences();

        const writes: [string, unknown][] = [];

        server.use(
            http.patch(apiUrl('/agents/:agentId/preferences'), async ({ request, params }) => {
                const body = await request.json();

                writes.push([String(params.agentId), body]);

                return envelope(body);
            }),
        );

        const { result, rerender } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        act(() => {
            result.current.setModel({ label: 'Deep', value: { modelId: 'model-deep', name: 'Deep' } });
        });
        await waitFor(() => expect(writes).toHaveLength(1));

        rerender({ composerAgent: secondAgent });

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        act(() => {
            result.current.setModel({ label: 'Deep', value: { modelId: 'model-deep', name: 'Deep' } });
        });

        await waitFor(() =>
            expect(writes).toEqual([
                ['agent-1', { defaultModelId: 'model-deep' }],
                ['agent-2', { defaultModelId: 'model-deep' }],
            ]),
        );
    });

    it('lands an in-flight write in the cache of the agent it was written for', async () => {
        stubPreferences();

        let releasePatch = () => {};
        const patchHeld = new Promise<void>((resolve) => {
            releasePatch = resolve;
        });

        server.use(
            http.patch(apiUrl('/agents/agent-1/preferences'), async ({ request }) => {
                const body = await request.json();

                await patchHeld;

                return envelope(body);
            }),
        );

        const { result, rerender } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        act(() => {
            result.current.setModel({ label: 'Deep', value: { modelId: 'model-deep', name: 'Deep' } });
        });

        rerender({ composerAgent: secondAgent });

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        releasePatch();

        // Switching back proves the write settled into agent-1's cache entry: a
        // write that had targeted the current agent would leave agent-1 on its
        // default and flip agent-2 instead.
        rerender({ composerAgent: agent });

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-deep'));
        expect(result.current.model?.value.modelId).toBe('model-deep');

        rerender({ composerAgent: secondAgent });

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));
    });
});

describe('useAgentComposerOptions parameters', () => {
    it('keeps a parameter the user set while the preferences request was in flight', async () => {
        const releaseGet = holdPreferencesGet({ defaultModelId: 'model-deep' });

        const { result } = renderComposer(agentWithParameters);

        act(() => {
            result.current.setParameter('tone', { label: 'Playful', value: 'playful' });
        });

        releaseGet();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-deep'));
        expect(result.current.parameters.tone).toEqual({ label: 'Playful', value: 'playful' });
    });

    it('resets a user-set parameter on a real model switch', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => envelope(null)));
        collectPatchBodies();

        const { result } = renderComposer(agentWithParameters);

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        act(() => {
            result.current.setParameter('tone', { label: 'Playful', value: 'playful' });
        });
        expect(result.current.parameters.tone).toEqual({ label: 'Playful', value: 'playful' });

        act(() => {
            result.current.setModel({ label: 'Deep', value: { modelId: 'model-deep', name: 'Deep' } });
        });

        await waitFor(() => expect(result.current.parameters.tone).toEqual({ label: 'Neutral', value: 'neutral' }));
    });
});

describe('useAgentComposerOptions deep search', () => {
    const stubPreferences = () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => envelope(null)));
    };

    // Web Search's shape: the plus dropdown offers the mode only while it is off, and the entry
    // retires once it is on, because from then on the chip in the toolbar owns turning it off.
    it('offers the mode in the plus dropdown until it is on', async () => {
        stubPreferences();

        const { result } = renderComposer(agentWithDeepSearch);

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        expect(result.current.showDeepSearch).toBe(true);
        expect(result.current.isDeepSearchEnabled).toBe(false);
        expect(result.current.plusDropdownOptions.map((option) => option.value)).toContain('deepsearch');

        act(() => {
            result.current.setIsDeepSearchEnabled(true);
        });

        expect(result.current.isDeepSearchEnabled).toBe(true);
        expect(result.current.plusDropdownOptions.map((option) => option.value)).not.toContain('deepsearch');
    });

    it('never offers the mode when the agent does not allow it', async () => {
        stubPreferences();

        const { result } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        expect(result.current.plusDropdownOptions.map((option) => option.value)).not.toContain('deepsearch');
    });

    it('reports the gate as closed when the agent does not show deep search', async () => {
        stubPreferences();

        const { result } = renderComposer();

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        expect(result.current.showDeepSearch).toBe(false);
    });

    it('carries the toggle into the outgoing request flag', async () => {
        stubPreferences();

        const { result } = renderComposer(agentWithDeepSearch);

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        const buildBody = () =>
            buildChatRequestBody({
                agentIdentifier: 'agent-1',
                conversationId: 'conversation-1',
                model: result.current.model,
                parameters: {},
                isWebSearchEnabled: false,
                isDeepSearchEnabled: result.current.isDeepSearchEnabled,
                isRelatedQuestionsEnabled: false,
                isIncognitoMode: false,
                isPublic: false,
                fileIds: [],
            });

        expect(buildBody().arguments.deepSearch).toBe(false);

        act(() => {
            result.current.setIsDeepSearchEnabled(true);
        });

        expect(buildBody().arguments.deepSearch).toBe(true);
    });

    it('keeps the toggle while the conversation stays open and resets it on a switch', async () => {
        stubPreferences();

        const { result, rerender } = renderComposer(agentWithDeepSearch, 'conversation-1');

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        act(() => {
            result.current.setIsDeepSearchEnabled(true);
        });

        rerender({ composerAgent: agentWithDeepSearch, conversationId: 'conversation-1' });
        expect(result.current.isDeepSearchEnabled).toBe(true);

        rerender({ composerAgent: agentWithDeepSearch, conversationId: 'conversation-2' });
        await waitFor(() => expect(result.current.isDeepSearchEnabled).toBe(false));
    });

    it('keeps the toggle when a new conversation mints its id mid-turn', async () => {
        stubPreferences();

        const { result, rerender } = renderComposer(agentWithDeepSearch, null);

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        act(() => {
            result.current.setIsDeepSearchEnabled(true);
        });

        rerender({ composerAgent: agentWithDeepSearch, conversationId: 'conversation-3' });

        expect(result.current.isDeepSearchEnabled).toBe(true);
    });

    it('never reports deep search as on while the agent hides the toggle', async () => {
        stubPreferences();

        const agentWithHiddenDefaultOn = {
            ...agent,
            uiConfig: {
                ...agent.uiConfig,
                home: { search: { showDeepSearch: false, isDeepSearchEnabled: true } },
            },
        } as unknown as ChatAgentType;

        const { result } = renderComposer(agentWithHiddenDefaultOn);

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));

        expect(result.current.showDeepSearch).toBe(false);
        expect(result.current.isDeepSearchEnabled).toBe(false);

        act(() => {
            result.current.setIsDeepSearchEnabled(true);
        });

        expect(result.current.isDeepSearchEnabled).toBe(false);
    });

    it('resets to the agent default rather than off when the conversation changes', async () => {
        stubPreferences();

        const agentDeepSearchOnByDefault = {
            ...agent,
            uiConfig: {
                ...agent.uiConfig,
                home: { search: { showDeepSearch: true, isDeepSearchEnabled: true } },
            },
        } as unknown as ChatAgentType;

        const { result, rerender } = renderComposer(agentDeepSearchOnByDefault, 'conversation-1');

        await waitFor(() => expect(result.current.model?.value.modelId).toBe('model-fast'));
        expect(result.current.isDeepSearchEnabled).toBe(true);

        act(() => {
            result.current.setIsDeepSearchEnabled(false);
        });

        rerender({ composerAgent: agentDeepSearchOnByDefault, conversationId: 'conversation-2' });

        await waitFor(() => expect(result.current.isDeepSearchEnabled).toBe(true));
    });
});
