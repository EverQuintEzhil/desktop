import { act, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, rawPaged, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import CreateAgentEditor from './create-agent-editor';
import type { AgentConfigDraft, AgentConfigItem } from './types';

/**
 * Every uncovered branch in this screen hangs off a `Builder` callback, so the
 * stub records the props it was handed and the tests drive those callbacks and
 * assert the observable consequence — a request, `sessionStorage`, navigation,
 * or the props of the next render.
 */
const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));

vi.mock('./components/builder/builder', () => ({
    default: (props: Record<string, unknown>) => {
        captured.props = props;

        return <div data-testid="builder-stub" />;
    },
}));

vi.mock('./components/settings-modal', () => ({
    SettingsModal: ({ open }: { open: boolean }) => <div>{open ? 'Settings modal open' : 'Settings modal closed'}</div>,
}));

interface BuilderStubProps {
    config: AgentConfigDraft;
    agentName: string;
    initialPrompt?: string;
    conversations: { _id: string; title: string }[];
    conversationsHasMore: boolean;
    conversationsError: boolean;
    conversationsLoadMoreError: boolean;
    onRetryConversations: () => void;
    initialMessages: { id: string; role: string; parts: unknown[] }[];
    messagesLoading: boolean;
    messagesError: boolean;
    onRetryMessages: () => void;
    skillIdInView?: string;
    dataStoreIdInView?: string;
    channelInView: boolean;
    advancedSettingsInView: boolean;
    onNewChat: () => void;
    onSelectConversation: (id: string) => void;
    onConversationId: (id: string) => void;
    onConfigChange: (config: AgentConfigDraft) => void;
    onAgentConfig: (config: AgentConfigDraft) => void;
    onSkillDeleted: (id: string) => void;
    onSkillUpdated: (skill: { _id: string; name: string }) => void;
    onDataStoreDeleted: (id: string) => void;
    onDataStoreUpdated: (dataStore: { _id: string; name: string }) => void;
    onLoadMoreConversations: () => void;
    onDelete: () => void;
    onBack: () => void;
    onSettings: () => void;
}

const builder = (): BuilderStubProps => captured.props as unknown as BuilderStubProps;

const CONVERSATIONS_PATH = '/assistant/agent-builder/conversations';
const STORAGE_KEY = 'create-agent:agent-1:conversationId';

const promptCode = {
    _id: 'code-prompt',
    type: 'agent_system_prompt',
    lang: 'markdown',
    version: '1.0.0',
    code: 'Be helpful.',
    createdAt: '2026-01-01T00:00:00.000Z',
};

const uiCode = {
    _id: 'code-ui',
    type: 'agent_ui_config',
    lang: 'json',
    version: '1.0.0',
    code: '{"componentType":"chat","home":{"title":"Support bot"}}',
    createdAt: '2026-01-01T00:00:00.000Z',
};

const loadedAgent = (overrides: Record<string, unknown> = {}) => ({
    _id: 'agent-1',
    name: 'Support bot',
    systemPromptCodeId: 'code-prompt',
    uiConfigCodeId: 'code-ui',
    ...overrides,
});

/** The full fan-out `loadAgentConfig` performs, plus the writes autosave may make. */
const stubLoadedAgent = (agentOverrides: Record<string, unknown> = {}) => {
    server.use(respond('get', '/agents/agent-1', () => envelope(loadedAgent(agentOverrides))));
    server.use(respond('get', '/codes', () => envelope(rawPaged([promptCode, uiCode]))));
    server.use(respond('put', '/agents/agent-1', () => envelope(loadedAgent(agentOverrides))));
    server.use(respond('post', '/codes', () => envelope(promptCode)));
};

const stubConversations = (values: Record<string, unknown>[] = [], totalPages = 1) => {
    server.use(respond('get', CONVERSATIONS_PATH, () => envelope(rawPaged(values, { page: 0, totalPages }))));
};

const renderEditorRoute = (route = '/agent-builder/agent-1') =>
    renderWithProviders(
        <Routes>
            <Route path="/" element={<div>Agents home</div>} />
            <Route path="agent-builder/:id/*" element={<CreateAgentEditor />} />
        </Routes>,
        { route },
    );

const SwitchAgentButton = () => {
    const navigate = useNavigate();

    return (
        <button type="button" onClick={() => navigate('/agent-builder/agent-2')}>
            Switch agent
        </button>
    );
};

const SwitchBackButton = () => {
    const navigate = useNavigate();

    return (
        <button type="button" onClick={() => navigate('/agent-builder/agent-1')}>
            Switch back
        </button>
    );
};

const waitForBuilder = async () => {
    await waitFor(() => {
        expect(screen.getByTestId('builder-stub')).toBeInTheDocument();
    });
};

describe('CreateAgentEditor', () => {
    beforeEach(() => {
        captured.props = null;
        window.sessionStorage.clear();
    });

    it('shows the loading shell before the agent config arrives', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute();

        expect(screen.queryByTestId('builder-stub')).not.toBeInTheDocument();

        await waitForBuilder();
    });

    it('shows an error state when the agent config request fails', async () => {
        server.use(respond('get', '/agents/agent-1', () => httpError(500)));
        stubConversations();

        renderEditorRoute();

        await waitFor(() => {
            expect(screen.getByText('Could not load this agent. Please try again.')).toBeInTheDocument();
        });
    });

    it('shows an error state for a success:false envelope', async () => {
        server.use(respond('get', '/agents/agent-1', () => failureEnvelope('No such agent')));
        stubConversations();

        renderEditorRoute();

        await waitFor(() => {
            expect(screen.getByText('Could not load this agent. Please try again.')).toBeInTheDocument();
        });
    });

    it('renders the builder with the loaded agent name and instructions', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute();
        await waitForBuilder();

        expect(builder().agentName).toBe('Support bot');
        expect(builder().config.instructions).toBe('Be helpful.');
        expect(screen.getByText('Settings modal closed')).toBeInTheDocument();
    });

    it('requests the conversations page for this agent and passes them down deduplicated', async () => {
        let requestUrl = '';

        stubLoadedAgent();
        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), ({ request }) => {
                requestUrl = request.url;

                return envelope(
                    rawPaged(
                        [
                            {
                                _id: 'm1',
                                conversation_id: 'conv-1',
                                role: 'user',
                                content: [{ type: 'text', text: 'First chat' }],
                            },
                            {
                                _id: 'm2',
                                conversation_id: 'conv-1',
                                role: 'assistant',
                                content: [{ type: 'text', text: 'Reply' }],
                            },
                        ],
                        { page: 0, totalPages: 1 },
                    ),
                );
            }),
        );

        renderEditorRoute();
        await waitForBuilder();

        const params = new URL(requestUrl).searchParams;

        expect(params.get('agentId')).toBe('agent-1');
        expect(params.get('size')).toBe('30');
        expect(builder().conversations).toHaveLength(1);
        expect(builder().conversations[0].title).toBe('First chat');
        expect(builder().conversationsHasMore).toBe(false);
    });

    it('flags a failed conversations load instead of reporting an empty list', async () => {
        stubLoadedAgent();
        server.use(respond('get', CONVERSATIONS_PATH, () => httpError(500)));

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().conversationsError).toBe(true);
        });
        expect(builder().conversations).toEqual([]);
    });

    it('flags a success:false conversations envelope as a failure', async () => {
        stubLoadedAgent();
        server.use(respond('get', CONVERSATIONS_PATH, () => failureEnvelope('Builder unavailable')));

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().conversationsError).toBe(true);
        });
    });

    it('reloads the conversations list when the builder retries after a failure', async () => {
        let attempt = 0;

        stubLoadedAgent();
        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), () => {
                attempt += 1;

                return attempt === 1
                    ? httpError(500)
                    : envelope(
                          rawPaged(
                              [
                                  {
                                      _id: 'm1',
                                      conversation_id: 'conv-1',
                                      role: 'user',
                                      content: [{ type: 'text', text: 'Recovered chat' }],
                                  },
                              ],
                              { page: 0, totalPages: 1 },
                          ),
                      );
            }),
        );

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().conversationsError).toBe(true);
        });

        await act(async () => {
            builder().onRetryConversations();
        });

        await waitFor(() => {
            expect(builder().conversations).toHaveLength(1);
        });
        expect(builder().conversations[0].title).toBe('Recovered chat');
        expect(builder().conversationsError).toBe(false);
    });

    it('asks for the next conversations page when the builder requests more', async () => {
        const pages: string[] = [];

        stubLoadedAgent();
        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), ({ request }) => {
                const page = new URL(request.url).searchParams.get('page') ?? '';

                pages.push(page);

                return envelope(
                    rawPaged(
                        [
                            {
                                _id: `m-${page}`,
                                conversation_id: `conv-${page}`,
                                role: 'user',
                                content: [{ type: 'text', text: `Chat ${page}` }],
                            },
                        ],
                        { page: Number(page), totalPages: 2 },
                    ),
                );
            }),
        );

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().conversationsHasMore).toBe(true);
        });

        await act(async () => {
            builder().onLoadMoreConversations();
        });

        await waitFor(() => {
            expect(builder().conversations).toHaveLength(2);
        });
        expect(pages).toEqual(['0', '1']);
    });

    it('stops offering more pages once a load-more fails, and resumes after a retry', async () => {
        let attempt = 0;

        stubLoadedAgent();
        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), ({ request }) => {
                attempt += 1;
                const page = new URL(request.url).searchParams.get('page') ?? '';

                if (attempt === 2) return httpError(500);

                return envelope(
                    rawPaged(
                        [
                            {
                                _id: `m-${page}`,
                                conversation_id: `conv-${page}`,
                                role: 'user',
                                content: [{ type: 'text', text: `Chat ${page}` }],
                            },
                        ],
                        { page: Number(page), totalPages: 2 },
                    ),
                );
            }),
        );

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().conversationsHasMore).toBe(true);
        });

        await act(async () => {
            builder().onLoadMoreConversations();
        });

        // The sentinel must unmount, otherwise it re-arms and re-requests the failing page forever.
        await waitFor(() => {
            expect(builder().conversationsHasMore).toBe(false);
        });
        expect(builder().conversationsLoadMoreError).toBe(true);
        expect(builder().conversations).toHaveLength(1);

        const attemptsAfterFailure = attempt;

        await act(async () => {
            builder().onLoadMoreConversations();
        });

        expect(attempt).toBe(attemptsAfterFailure);

        await act(async () => {
            builder().onRetryConversations();
        });

        await waitFor(() => {
            expect(builder().conversationsLoadMoreError).toBe(false);
        });
        expect(builder().conversationsHasMore).toBe(true);
    });

    it('keeps the load-more latch set when the retry itself fails', async () => {
        let endpointDown = false;
        let requests = 0;

        stubLoadedAgent();
        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), ({ request }) => {
                requests += 1;

                if (endpointDown) return httpError(500);

                const page = new URL(request.url).searchParams.get('page') ?? '';

                return envelope(
                    rawPaged(
                        [
                            {
                                _id: `m-${page}`,
                                conversation_id: `conv-${page}`,
                                role: 'user',
                                content: [{ type: 'text', text: `Chat ${page}` }],
                            },
                        ],
                        { page: Number(page), totalPages: 2 },
                    ),
                );
            }),
        );

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().conversationsHasMore).toBe(true);
        });

        endpointDown = true;

        await act(async () => {
            builder().onLoadMoreConversations();
        });

        await waitFor(() => {
            expect(builder().conversationsLoadMoreError).toBe(true);
        });

        await act(async () => {
            builder().onRetryConversations();
        });

        // `refetch()` resolves with an `error` field instead of rejecting, so a retry against a
        // still-broken endpoint must leave the latch closed rather than re-arming the sentinel.
        await waitFor(() => {
            expect(builder().conversationsLoadMoreError).toBe(true);
        });
        expect(builder().conversationsHasMore).toBe(false);

        const requestsAfterFailedRetry = requests;

        await act(async () => {
            builder().onLoadMoreConversations();
        });

        expect(requests).toBe(requestsAfterFailedRetry);

        endpointDown = false;

        await act(async () => {
            builder().onRetryConversations();
        });

        await waitFor(() => {
            expect(builder().conversationsLoadMoreError).toBe(false);
        });
        expect(builder().conversationsHasMore).toBe(true);

        await act(async () => {
            builder().onLoadMoreConversations();
        });

        await waitFor(() => {
            expect(builder().conversations).toHaveLength(2);
        });
    });

    it('clears a load-more failure when the user switches to another agent', async () => {
        const failingPageFor = new Set(['agent-1']);

        stubLoadedAgent();
        server.use(
            respond('get', '/agents/agent-2', () => envelope(loadedAgent({ _id: 'agent-2', name: 'Other bot' }))),
        );
        server.use(respond('put', '/agents/agent-2', () => envelope(loadedAgent({ _id: 'agent-2' }))));
        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), ({ request }) => {
                const params = new URL(request.url).searchParams;
                const page = params.get('page') ?? '';
                const agent = params.get('agentId') ?? '';

                if (page !== '0' && failingPageFor.has(agent)) return httpError(500);

                return envelope(
                    rawPaged(
                        [
                            {
                                _id: `m-${agent}-${page}`,
                                conversation_id: `conv-${agent}-${page}`,
                                role: 'user',
                                content: [{ type: 'text', text: `Chat ${agent} ${page}` }],
                            },
                        ],
                        { page: Number(page), totalPages: 2 },
                    ),
                );
            }),
        );

        renderWithProviders(
            <Routes>
                <Route
                    path="agent-builder/:id/*"
                    element={
                        <>
                            <SwitchAgentButton />
                            <CreateAgentEditor />
                        </>
                    }
                />
            </Routes>,
            { route: '/agent-builder/agent-1' },
        );
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().conversationsHasMore).toBe(true);
        });

        await act(async () => {
            builder().onLoadMoreConversations();
        });

        await waitFor(() => {
            expect(builder().conversationsLoadMoreError).toBe(true);
        });

        // Same route, different param: CreateAgentEditor never unmounts, so a latch held in its
        // own state would follow the user onto the healthy agent.
        await act(async () => {
            screen.getByRole('button', { name: 'Switch agent' }).click();
        });

        await waitFor(() => {
            expect(builder().conversationsLoadMoreError).toBe(false);
        });
        expect(builder().conversationsHasMore).toBe(true);
    });

    it('writes an unsaved draft to the agent it was edited on, not the one switched to', async () => {
        const writes: { agentId: string; name: unknown }[] = [];
        const capture = (agentId: string) =>
            http.put(apiUrl(`/agents/${agentId}`), async ({ request }) => {
                const body = (await request.json()) as Record<string, unknown>;

                writes.push({ agentId, name: body.name });

                return envelope(loadedAgent({ _id: agentId }));
            });

        stubLoadedAgent();
        stubConversations();
        server.use(
            respond('get', '/agents/agent-2', () => envelope(loadedAgent({ _id: 'agent-2', name: 'Other bot' }))),
        );
        server.use(capture('agent-1'), capture('agent-2'));

        renderWithProviders(
            <Routes>
                <Route
                    path="agent-builder/:id/*"
                    element={
                        <>
                            <SwitchAgentButton />
                            <SwitchBackButton />
                            <CreateAgentEditor />
                        </>
                    }
                />
            </Routes>,
            { route: '/agent-builder/agent-1' },
        );
        await waitForBuilder();

        await act(async () => {
            screen.getByRole('button', { name: 'Switch agent' }).click();
        });
        await waitFor(() => {
            expect(builder().agentName).toBe('Other bot');
        });

        await act(async () => {
            builder().onConfigChange({ name: 'Renamed while on agent-2', instructions: '' });
        });

        await act(async () => {
            screen.getByRole('button', { name: 'Switch back' }).click();
        });

        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 900);
            });
        });

        const renames = writes.filter((write) => write.name === 'Renamed while on agent-2');

        expect(renames).not.toEqual([]);
        expect(renames.every((write) => write.agentId === 'agent-2')).toBe(true);
        expect(builder().agentName).toBe('Support bot');
    });

    it('loads the messages of a conversation the user selects and remembers it in sessionStorage', async () => {
        let messagesUrl = '';

        stubLoadedAgent();
        stubConversations();
        server.use(
            http.get(apiUrl(`${CONVERSATIONS_PATH}/conv-7/messages`), ({ request }) => {
                messagesUrl = request.url;

                return envelope(
                    rawPaged([
                        {
                            _id: 'm1',
                            conversation_id: 'conv-7',
                            role: 'user',
                            content: [{ type: 'text', text: 'Restored' }],
                        },
                    ]),
                );
            }),
        );

        renderEditorRoute();
        await waitForBuilder();

        act(() => {
            builder().onSelectConversation('conv-7');
        });

        await waitFor(() => {
            expect(messagesUrl).not.toBe('');
        });
        expect(new URL(messagesUrl).searchParams.get('agentId')).toBe('agent-1');
        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('conv-7');
    });

    it('clears the remembered conversation when a new chat is started', async () => {
        stubLoadedAgent();
        stubConversations();
        server.use(respond('get', `${CONVERSATIONS_PATH}/conv-7/messages`, () => envelope(rawPaged([]))));

        renderEditorRoute();
        await waitForBuilder();

        act(() => {
            builder().onSelectConversation('conv-7');
        });

        await waitFor(() => {
            expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('conv-7');
        });

        act(() => {
            builder().onNewChat();
        });

        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('remembers a conversation id minted mid-stream and refetches the conversations list', async () => {
        let listCalls = 0;

        stubLoadedAgent();
        server.use(
            http.get(apiUrl(CONVERSATIONS_PATH), () => {
                listCalls += 1;

                return envelope(rawPaged([], { page: 0, totalPages: 1 }));
            }),
        );

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(listCalls).toBe(1);
        });

        act(() => {
            builder().onConversationId('conv-new');
        });

        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('conv-new');
        await waitFor(() => {
            expect(listCalls).toBe(2);
        });
    });

    it('restores the conversation remembered from a previous visit', async () => {
        let messagesUrl = '';

        window.sessionStorage.setItem(STORAGE_KEY, 'conv-stored');
        stubLoadedAgent();
        stubConversations();
        server.use(
            http.get(apiUrl(`${CONVERSATIONS_PATH}/conv-stored/messages`), ({ request }) => {
                messagesUrl = request.url;

                return envelope(rawPaged([]));
            }),
        );

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(messagesUrl).not.toBe('');
        });
    });

    it('flags a failed messages load instead of handing the chat an empty thread', async () => {
        window.sessionStorage.setItem(STORAGE_KEY, 'conv-stored');
        stubLoadedAgent();
        server.use(respond('get', `${CONVERSATIONS_PATH}/conv-stored/messages`, () => httpError(500)));
        server.use(respond('get', CONVERSATIONS_PATH, () => httpError(500)));

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().messagesError).toBe(true);
        });
        expect(builder().messagesLoading).toBe(false);
        expect(builder().initialMessages).toEqual([]);
    });

    it('leaves the failure behind when the user starts a new chat from it', async () => {
        window.sessionStorage.setItem(STORAGE_KEY, 'conv-stored');
        stubLoadedAgent();
        server.use(respond('get', `${CONVERSATIONS_PATH}/conv-stored/messages`, () => httpError(500)));
        server.use(respond('get', CONVERSATIONS_PATH, () => httpError(500)));

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().messagesError).toBe(true);
        });

        act(() => {
            builder().onNewChat();
        });

        expect(builder().messagesError).toBe(false);
        expect(builder().messagesLoading).toBe(false);
        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('flags a success:false messages envelope as a failure', async () => {
        window.sessionStorage.setItem(STORAGE_KEY, 'conv-stored');
        stubLoadedAgent();
        server.use(
            respond('get', `${CONVERSATIONS_PATH}/conv-stored/messages`, () => failureEnvelope('Messages unavailable')),
        );
        server.use(respond('get', CONVERSATIONS_PATH, () => failureEnvelope('Messages unavailable')));

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().messagesError).toBe(true);
        });
    });

    it('reports no failure for a conversation that genuinely has no messages', async () => {
        window.sessionStorage.setItem(STORAGE_KEY, 'conv-stored');
        stubLoadedAgent();
        stubConversations();
        server.use(respond('get', `${CONVERSATIONS_PATH}/conv-stored/messages`, () => envelope(rawPaged([]))));

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().messagesLoading).toBe(false);
        });
        expect(builder().messagesError).toBe(false);
        expect(builder().initialMessages).toEqual([]);
    });

    it('reloads the conversation messages when the chat retries after a failure', async () => {
        let attempt = 0;

        window.sessionStorage.setItem(STORAGE_KEY, 'conv-stored');
        stubLoadedAgent();
        // The list stands in for a failed detail call, so it has to fail too for the
        // messages query to reach an error at all.
        server.use(respond('get', CONVERSATIONS_PATH, () => httpError(500)));
        server.use(
            http.get(apiUrl(`${CONVERSATIONS_PATH}/conv-stored/messages`), () => {
                attempt += 1;

                return attempt === 1
                    ? httpError(500)
                    : envelope(
                          rawPaged([
                              {
                                  _id: 'm1',
                                  conversation_id: 'conv-stored',
                                  role: 'user',
                                  content: [{ type: 'text', text: 'Recovered message' }],
                              },
                          ]),
                      );
            }),
        );

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().messagesError).toBe(true);
        });

        await act(async () => {
            builder().onRetryMessages();
        });

        await waitFor(() => {
            expect(builder().initialMessages).toHaveLength(1);
        });
        expect(builder().messagesError).toBe(false);
        expect(builder().initialMessages[0].parts).toEqual([{ type: 'text', text: 'Recovered message' }]);
    });

    it('still restores the messages through the conversations list when the detail endpoint fails', async () => {
        window.sessionStorage.setItem(STORAGE_KEY, 'conv-stored');
        stubLoadedAgent();
        server.use(respond('get', `${CONVERSATIONS_PATH}/conv-stored/messages`, () => httpError(500)));
        server.use(
            respond('get', CONVERSATIONS_PATH, () =>
                envelope(
                    rawPaged([
                        {
                            _id: 'm1',
                            conversation_id: 'conv-stored',
                            role: 'assistant',
                            content: [{ type: 'text', text: 'Stood in for the detail call' }],
                        },
                    ]),
                ),
            ),
        );

        renderEditorRoute();
        await waitForBuilder();

        await waitFor(() => {
            expect(builder().initialMessages).toHaveLength(1);
        });
        expect(builder().messagesError).toBe(false);
        expect(builder().initialMessages[0].parts).toEqual([{ type: 'text', text: 'Stood in for the detail call' }]);
    });

    it('merges an AI-produced config, overwriting scalars and appending capabilities without duplicates', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute();
        await waitForBuilder();

        const skill: AgentConfigItem = { _id: 'skill-1', name: 'Summarise' };

        act(() => {
            builder().onAgentConfig({
                name: 'Renamed bot',
                skills: [skill],
                files: [{ _id: 'file-1', name: 'Handbook' }],
            });
        });

        await waitFor(() => {
            expect(builder().agentName).toBe('Renamed bot');
        });
        expect(builder().config.skills).toEqual([skill]);

        act(() => {
            builder().onAgentConfig({ skills: [skill, { _id: 'skill-2', name: 'Translate' }] });
        });

        await waitFor(() => {
            expect(builder().config.skills).toHaveLength(2);
        });
        expect(builder().config.skills?.map((s) => s._id)).toEqual(['skill-1', 'skill-2']);
        expect(builder().config.files).toHaveLength(1);
    });

    it('appends connectors from an AI config without duplicating an existing one', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute();
        await waitForBuilder();

        act(() => {
            builder().onAgentConfig({ mcpServers: [{ _id: 'mcp-1', name: 'GitHub' }] });
        });

        await waitFor(() => {
            expect(builder().config.mcpServers).toHaveLength(1);
        });

        act(() => {
            builder().onAgentConfig({ mcpServers: [{ _id: 'mcp-1', name: 'GitHub' }] });
        });

        await waitFor(() => {
            expect(builder().config.mcpServers).toHaveLength(1);
        });
    });

    it('drops a deleted skill from the config and returns to the builder root', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute('/agent-builder/agent-1/skills/skill-1');
        await waitForBuilder();

        expect(builder().skillIdInView).toBe('skill-1');

        act(() => {
            builder().onAgentConfig({ skills: [{ _id: 'skill-1', name: 'Summarise' }] });
        });

        await waitFor(() => {
            expect(builder().config.skills).toHaveLength(1);
        });

        act(() => {
            builder().onSkillDeleted('skill-1');
        });

        await waitFor(() => {
            expect(builder().skillIdInView).toBeUndefined();
        });
        expect(builder().config.skills).toEqual([]);
    });

    it('renames a skill in the config without leaving the detail view', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute('/agent-builder/agent-1/skills/skill-1');
        await waitForBuilder();

        act(() => {
            builder().onAgentConfig({
                skills: [
                    { _id: 'skill-1', name: 'Summarise' },
                    { _id: 'skill-2', name: 'Translate' },
                ],
            });
        });

        await waitFor(() => {
            expect(builder().config.skills).toHaveLength(2);
        });

        act(() => {
            builder().onSkillUpdated({ _id: 'skill-1', name: 'Summarise thread' });
        });

        await waitFor(() => {
            expect(builder().config.skills).toEqual([
                { _id: 'skill-1', name: 'Summarise thread' },
                { _id: 'skill-2', name: 'Translate' },
            ]);
        });
        expect(builder().skillIdInView).toBe('skill-1');
    });

    it('drops a deleted data store from the config and returns to the builder root', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute('/agent-builder/agent-1/datastores/store-1');
        await waitForBuilder();

        expect(builder().dataStoreIdInView).toBe('store-1');

        act(() => {
            builder().onAgentConfig({ files: [{ _id: 'store-1', name: 'Handbook' }] });
        });

        await waitFor(() => {
            expect(builder().config.files).toHaveLength(1);
        });

        act(() => {
            builder().onDataStoreDeleted('store-1');
        });

        await waitFor(() => {
            expect(builder().dataStoreIdInView).toBeUndefined();
        });
        expect(builder().config.files).toEqual([]);
    });

    it('renames a data store in the config without leaving the detail view', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute('/agent-builder/agent-1/datastores/store-1');
        await waitForBuilder();

        act(() => {
            builder().onAgentConfig({
                files: [
                    { _id: 'store-1', name: 'Handbook' },
                    { _id: 'store-2', name: 'Policies' },
                ],
            });
        });

        await waitFor(() => {
            expect(builder().config.files).toHaveLength(2);
        });

        act(() => {
            builder().onDataStoreUpdated({ _id: 'store-1', name: 'Employee Handbook' });
        });

        await waitFor(() => {
            expect(builder().config.files).toEqual([
                { _id: 'store-1', name: 'Employee Handbook' },
                { _id: 'store-2', name: 'Policies' },
            ]);
        });
        expect(builder().dataStoreIdInView).toBe('store-1');
    });

    it('flags the channel and advanced-settings routes to the builder', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute('/agent-builder/agent-1/channel');
        await waitForBuilder();

        expect(builder().channelInView).toBe(true);
        expect(builder().advancedSettingsInView).toBe(false);
    });

    it('flags the advanced-settings route to the builder', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute('/agent-builder/agent-1/advanced-settings');
        await waitForBuilder();

        expect(builder().advancedSettingsInView).toBe(true);
    });

    it('deletes the agent and navigates home', async () => {
        let deleted = '';

        stubLoadedAgent();
        stubConversations();
        server.use(
            http.delete(apiUrl('/agents/agent-1'), () => {
                deleted = 'agent-1';

                return envelope(null);
            }),
        );

        renderEditorRoute();
        await waitForBuilder();

        await act(async () => {
            builder().onDelete();
        });

        await waitFor(() => {
            expect(screen.getByText('Agents home')).toBeInTheDocument();
        });
        expect(deleted).toBe('agent-1');
    });

    it('stays on the builder when the delete request fails', async () => {
        let attempted = false;

        stubLoadedAgent();
        stubConversations();
        server.use(
            respond('delete', '/agents/agent-1', () => {
                attempted = true;

                return httpError(500);
            }),
        );

        renderEditorRoute();
        await waitForBuilder();

        await act(async () => {
            builder().onDelete();
        });

        // The delete now waits on a launcher lookup first, so staying put only means something
        // once the DELETE has actually been answered — asserted before that, this passes on the
        // in-flight state and would still pass with the failure branch removed.
        await waitFor(() => expect(attempted).toBe(true));

        expect(screen.queryByText('Agents home')).not.toBeInTheDocument();
        expect(screen.getByTestId('builder-stub')).toBeInTheDocument();
    });

    it('navigates home from the back action', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute();
        await waitForBuilder();

        act(() => {
            builder().onBack();
        });

        await waitFor(() => {
            expect(screen.getByText('Agents home')).toBeInTheDocument();
        });
    });

    it('returns to the conversation it was opened from', async () => {
        stubLoadedAgent();
        stubConversations();

        renderWithProviders(
            <Routes>
                <Route path="/" element={<div>Agents home</div>} />
                <Route path="agent/:agentId/chat/:conversationId" element={<div>Conversation</div>} />
                <Route path="agent-builder/:id/*" element={<CreateAgentEditor />} />
            </Routes>,
            {
                routerProps: {
                    initialEntries: [
                        {
                            pathname: '/agent-builder/agent-1',
                            state: { from: '/agent/support-bot/chat/conv-1' },
                        },
                    ],
                },
            },
        );
        await waitForBuilder();

        act(() => {
            builder().onBack();
        });

        await waitFor(() => {
            expect(screen.getByText('Conversation')).toBeInTheDocument();
        });
    });

    it('opens the settings modal from the builder', async () => {
        stubLoadedAgent();
        stubConversations();

        renderEditorRoute();
        await waitForBuilder();

        act(() => {
            builder().onSettings();
        });

        await waitFor(() => {
            expect(screen.getByText('Settings modal open')).toBeInTheDocument();
        });
    });
});
