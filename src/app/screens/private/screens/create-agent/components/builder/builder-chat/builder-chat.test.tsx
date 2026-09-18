import type { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BUILDER_AGENT_MODELS_ABOUT_KEY } from '@/lib/api/app/about';
import {
    installEmptyElementFromPointShim,
    installGalleryDomShims,
    installPointerCaptureShims,
    installRichTextDomShims,
    installScrollIntoViewShim,
} from '@/test/dom-shims';
import { apiUrl, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import { MY_AGENTS_QUERY_KEY } from '../../../../agents/hooks/use-agents-queries';

import BuilderChat from './builder-chat';

/**
 * Mounted against the real assistant-ui runtime — nothing in the chat stack is
 * stubbed. MSW answers `POST /assistant/agent-builder` with a hand-driven SSE
 * stream, so the composer, the empty state, the recents panel and the top bar
 * are all exercised through the production runtime.
 */
vi.setConfig({ testTimeout: 30_000 });

installGalleryDomShims();
installScrollIntoViewShim();
installRichTextDomShims();
installEmptyElementFromPointShim();
installPointerCaptureShims();

// jsdom implements neither; the thread viewport calls both on every append.
Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: () => {} });

const BUILDER_PATH = '/assistant/agent-builder';

interface SseStream {
    stream: ReadableStream<Uint8Array>;
    push: (event: Record<string, unknown>) => void;
    close: () => void;
}

const createSseStream = (): SseStream => {
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
        start: (c) => {
            controller = c;
        },
    });

    return {
        stream,
        push: (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
        close: () => {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
        },
    };
};

interface BuilderEndpoint {
    bodies: {
        agentId?: string;
        conversationId?: string | null;
        message?: string;
        modelId?: string;
    }[];
    streams: SseStream[];
}

const stubBuilderEndpoint = (): BuilderEndpoint => {
    const endpoint: BuilderEndpoint = { bodies: [], streams: [] };

    server.use(
        http.post(apiUrl(BUILDER_PATH), async ({ request }) => {
            endpoint.bodies.push((await request.json()) as BuilderEndpoint['bodies'][number]);
            const sse = createSseStream();

            endpoint.streams.push(sse);

            return new Response(sse.stream, { headers: { 'content-type': 'text/event-stream' } });
        }),
    );

    return endpoint;
};

const stubBuilderAgentModels = (
    models: { modelId: string; modelName: string }[] = [
        { modelId: 'model-gpt', modelName: 'gpt-5.5' },
        { modelId: 'model-claude', modelName: 'claude-sonnet-4-6' },
    ],
) => {
    server.use(
        respond('get', '/abouts', () => pagedEnvelope([{ key: BUILDER_AGENT_MODELS_ABOUT_KEY, value: models }])),
    );
};

beforeEach(() => {
    // BuilderChat always queries About for model options; keep a quiet default for unrelated suites.
    stubBuilderAgentModels([]);
});

const answerWith = (sse: SseStream, text: string) => {
    sse.push({ type: 'start' });
    sse.push({ type: 'text-start', id: '0' });
    sse.push({ type: 'text-delta', id: '0', delta: text });
    sse.push({ type: 'text-end', id: '0' });
    sse.push({ type: 'finish' });
    sse.close();
};

const conversations = [
    { _id: 'conv-1', title: 'Build a support bot' },
    { _id: 'conv-2', title: 'Add a skill' },
];

interface RenderOptions {
    initialPrompt?: string;
    activeConversationId?: string | null;
    messagesError?: boolean;
}

const renderBuilderChat = async (options: RenderOptions = {}) => {
    const handlers = {
        onAgentConfig: vi.fn(),
        onConversationId: vi.fn(),
        onNewChat: vi.fn(),
        onSelectConversation: vi.fn(),
        onLoadMoreConversations: vi.fn(),
        onRetryConversations: vi.fn(),
        onRetryMessages: vi.fn(),
        onBack: vi.fn(),
        onOpenPreview: vi.fn(),
        onClosePreview: vi.fn(),
        onOpenSettings: vi.fn(),
    };

    const { queryClient } = renderWithProviders(
        <BuilderChat
            {...handlers}
            agentId="agent-1"
            activeConversationId={options.activeConversationId ?? null}
            conversations={conversations}
            conversationsHasMore={false}
            conversationsLoadingMore={false}
            conversationsError={false}
            conversationsLoadMoreError={false}
            messagesError={options.messagesError ?? false}
            {...(options.initialPrompt ? { initialPrompt: options.initialPrompt } : {})}
        />,
    );

    // Settle the About models query so it cannot finish after MSW handlers are reset.
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    return { ...handlers, queryClient };
};

// A cached my-agents page proves the invalidation is observable: `isInvalidated` flips only if the
// refresh reached the same QueryClient the agents list reads.
const seedMyAgentsCache = (queryClient: QueryClient) => {
    const queryKey = [...MY_AGENTS_QUERY_KEY, 'user-1', ''];

    // The test QueryClient sets `gcTime: 0`, which would evict an observer-less cache entry before
    // the assertion runs.
    queryClient.setQueryDefaults(MY_AGENTS_QUERY_KEY, { gcTime: Infinity });
    queryClient.setQueryData(queryKey, { values: [], pageInfo: { page: 0, totalPages: 1 } });

    return () => queryClient.getQueryState(queryKey)?.isInvalidated ?? false;
};

/** The composer is the TipTap contenteditable, which carries no accessible role. */
const getComposer = async (): Promise<HTMLElement> => {
    await waitFor(() => expect(document.querySelector('.chat-editor__content')).toBeTruthy());

    return document.querySelector('.chat-editor__content') as HTMLElement;
};

const user = userEvent.setup({ delay: null });

const sendMessage = async (text: string) => {
    await user.type(await getComposer(), text);

    const send = screen.getByLabelText('Send message');

    // The composer text round-trips through the aui store, so the button enables a render later.
    await waitFor(() => expect(send).toBeEnabled());
    await user.click(send);
};

describe('BuilderChat — empty state', () => {
    it('shows the improvement prompt and its three suggestions', async () => {
        await renderBuilderChat();

        expect(await screen.findByText('How should we improve this agent?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add advanced logic' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Configure when the agent runs' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Improve this agent' })).toBeInTheDocument();
    });

    it('sends the suggestion message rather than its label', async () => {
        const builder = stubBuilderEndpoint();

        await renderBuilderChat();

        await user.click(await screen.findByRole('button', { name: 'Add advanced logic' }));

        await waitFor(() => expect(builder.streams).toHaveLength(1));
        expect(builder.bodies[0].message).toBe('Create a skill that makes this agent more effective.');
        expect(builder.bodies[0].agentId).toBe('agent-1');

        act(() => answerWith(builder.streams[0], 'Sure.'));
        expect(await screen.findByText('Sure.')).toBeInTheDocument();
    });

    it('hides the empty state once the thread has a message', async () => {
        const builder = stubBuilderEndpoint();

        await renderBuilderChat();

        await sendMessage('hello there');

        await waitFor(() => expect(builder.streams).toHaveLength(1));
        act(() => answerWith(builder.streams[0], 'Hi!'));

        await waitFor(() => {
            expect(screen.queryByText('How should we improve this agent?')).not.toBeInTheDocument();
        });
    });
});

describe('BuilderChat — sending', () => {
    it('posts the typed message with the agent id and a null conversation id', async () => {
        const builder = stubBuilderEndpoint();

        await renderBuilderChat();

        await sendMessage('rename the agent');

        await waitFor(() => expect(builder.streams).toHaveLength(1));
        expect(builder.bodies[0]).toMatchObject({
            agentId: 'agent-1',
            conversationId: null,
            message: 'rename the agent',
        });

        act(() => answerWith(builder.streams[0], 'Renamed.'));
        expect(await screen.findByText('Renamed.')).toBeInTheDocument();
    });

    it('sends the active conversation id when one is selected', async () => {
        const builder = stubBuilderEndpoint();

        await renderBuilderChat({ activeConversationId: 'conv-1' });

        await sendMessage('carry on');

        await waitFor(() => expect(builder.streams).toHaveLength(1));
        expect(builder.bodies[0].conversationId).toBe('conv-1');

        act(() => answerWith(builder.streams[0], 'Done.'));
        await screen.findByText('Done.');
    });

    it('sends the initial prompt on mount without any user interaction', async () => {
        const builder = stubBuilderEndpoint();

        await renderBuilderChat({ initialPrompt: 'make me a research assistant' });

        await waitFor(() => expect(builder.streams).toHaveLength(1));
        expect(builder.bodies[0].message).toBe('make me a research assistant');

        act(() => answerWith(builder.streams[0], 'On it.'));
        await screen.findByText('On it.');
    });

    it('includes modelId on the initial prompt once About models have loaded', async () => {
        stubBuilderAgentModels();
        const builder = stubBuilderEndpoint();

        await renderBuilderChat({ initialPrompt: 'make me a research assistant' });

        await waitFor(() => expect(builder.streams).toHaveLength(1));
        expect(builder.bodies[0]).toMatchObject({
            message: 'make me a research assistant',
            modelId: 'model-gpt',
        });

        act(() => answerWith(builder.streams[0], 'On it.'));
        await screen.findByText('On it.');
    });

    it('reports a streamed agent config and conversation id back to the caller', async () => {
        const builder = stubBuilderEndpoint();
        const { onAgentConfig, onConversationId } = await renderBuilderChat();

        await sendMessage('call it Helper');
        await waitFor(() => expect(builder.streams).toHaveLength(1));

        const sse = builder.streams[0];

        act(() => {
            sse.push({ type: 'start' });
            sse.push({ type: 'data-conversation', data: { conversation_id: 'conv-minted' } });
            sse.push({ type: 'data-agent-config', data: { name: 'Helper' } });
            sse.push({ type: 'text-start', id: '0' });
            sse.push({ type: 'text-delta', id: '0', delta: 'Named it Helper.' });
            sse.push({ type: 'text-end', id: '0' });
            sse.push({ type: 'finish' });
            sse.close();
        });

        expect(await screen.findByText('Named it Helper.')).toBeInTheDocument();
        expect(onConversationId).toHaveBeenCalledWith('conv-minted');
        expect(onAgentConfig).toHaveBeenCalledWith({ name: 'Helper' });
    });

    it('keeps the composer usable after the endpoint fails', async () => {
        server.use(http.post(apiUrl(BUILDER_PATH), () => httpError(500)));

        await renderBuilderChat();

        await sendMessage('this will fail');

        await waitFor(() => {
            expect(screen.getByLabelText('Send message')).toBeInTheDocument();
        });
    });
});

describe('BuilderChat — top bar and recents', () => {
    it('labels the back action with the tenant name and calls back', async () => {
        const { onBack } = await renderBuilderChat();

        await user.click(await screen.findByRole('button', { name: 'Back to Fluent Mind' }));

        expect(onBack).toHaveBeenCalled();
    });

    it('offers no new-chat action while the thread is empty', async () => {
        await renderBuilderChat();

        await screen.findByLabelText('Recents');

        expect(screen.queryByLabelText('New chat')).not.toBeInTheDocument();
    });

    it('offers a new-chat action once the thread has a message', async () => {
        const builder = stubBuilderEndpoint();
        const { onNewChat } = await renderBuilderChat();

        await sendMessage('hello');
        await waitFor(() => expect(builder.streams).toHaveLength(1));
        act(() => answerWith(builder.streams[0], 'Hi.'));

        await user.click(await screen.findByLabelText('New chat'));

        expect(onNewChat).toHaveBeenCalled();
    });

    it('swaps the body for the recents list and back again', async () => {
        await renderBuilderChat();

        await user.click(await screen.findByLabelText('Recents'));

        expect(await screen.findByRole('button', { name: 'Build a support bot' })).toBeInTheDocument();
        expect(screen.queryByText('How should we improve this agent?')).not.toBeInTheDocument();
        expect(document.querySelector('p.textarea')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Back to chat' }));

        expect(await screen.findByText('How should we improve this agent?')).toBeInTheDocument();
    });

    it('selects a conversation from the recents list and returns to the chat', async () => {
        const { onSelectConversation } = await renderBuilderChat();

        await user.click(await screen.findByLabelText('Recents'));
        await user.click(await screen.findByRole('button', { name: 'Add a skill' }));

        expect(onSelectConversation).toHaveBeenCalledWith('conv-2');
        expect(await screen.findByText('How should we improve this agent?')).toBeInTheDocument();
    });
});

describe('BuilderChat — messages failed to load', () => {
    it('shows a failure state in the thread rather than a blank one', async () => {
        await renderBuilderChat({ activeConversationId: 'conv-1', messagesError: true });

        expect(await screen.findByText('Could not load this conversation')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('is distinguishable from a conversation that simply has no messages', async () => {
        await renderBuilderChat({ activeConversationId: 'conv-1', messagesError: true });

        await screen.findByText('Could not load this conversation');

        expect(screen.queryByText('How should we improve this agent?')).not.toBeInTheDocument();
    });

    it('shows the empty state, not the failure state, when the messages loaded and there are none', async () => {
        await renderBuilderChat({ activeConversationId: 'conv-1' });

        expect(await screen.findByText('How should we improve this agent?')).toBeInTheDocument();
        expect(screen.queryByText('Could not load this conversation')).not.toBeInTheDocument();
    });

    it('hides the composer so no message is sent into a conversation with no history', async () => {
        await renderBuilderChat({ activeConversationId: 'conv-1', messagesError: true });

        await screen.findByText('Could not load this conversation');

        expect(document.querySelector('p.textarea')).toBeNull();
        expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument();
    });

    it('asks the caller to reload the messages when Retry is pressed', async () => {
        const { onRetryMessages } = await renderBuilderChat({ activeConversationId: 'conv-1', messagesError: true });

        await user.click(await screen.findByRole('button', { name: 'Retry' }));

        expect(onRetryMessages).toHaveBeenCalled();
    });

    it('offers a way out of a conversation whose messages will never load', async () => {
        const { onNewChat } = await renderBuilderChat({ activeConversationId: 'conv-1', messagesError: true });

        // The top bar's New chat button is hidden while the thread is empty, which it always
        // is in this state, so the panel has to carry the escape hatch itself.
        expect(screen.queryByLabelText('New chat')).not.toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Start a new chat' }));

        expect(onNewChat).toHaveBeenCalled();
    });

    it('still lets the user reach another conversation from the failure state', async () => {
        const { onSelectConversation } = await renderBuilderChat({
            activeConversationId: 'conv-1',
            messagesError: true,
        });

        await user.click(await screen.findByLabelText('Recents'));
        await user.click(await screen.findByRole('button', { name: 'Add a skill' }));

        expect(onSelectConversation).toHaveBeenCalledWith('conv-2');
    });
});

describe('BuilderChat — refresh_agent', () => {
    it('invalidates the my-agents list so a rename by the builder does not leave a stale card', async () => {
        const builder = stubBuilderEndpoint();
        const { queryClient } = await renderBuilderChat();
        const isInvalidated = seedMyAgentsCache(queryClient);

        await sendMessage('rename it to Billing bot');
        await waitFor(() => expect(builder.streams).toHaveLength(1));

        expect(isInvalidated()).toBe(false);

        act(() => {
            const sse = builder.streams[0];

            sse.push({ type: 'start' });
            sse.push({
                type: 'tool-input-available',
                toolCallId: 'call-1',
                toolName: 'refresh_agent',
                input: {},
            });
            sse.push({ type: 'finish' });
            sse.close();
        });

        await waitFor(() => expect(isInvalidated()).toBe(true));
    });
});

describe('BuilderChat — model switcher', () => {
    it('hides the model selector when fewer than two About models are configured', async () => {
        stubBuilderAgentModels([{ modelId: 'model-gpt', modelName: 'gpt-5.5' }]);
        await renderBuilderChat();

        await screen.findByText('How should we improve this agent?');

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('renders the selector and sends the chosen modelId with the next turn', async () => {
        stubBuilderAgentModels();
        const builder = stubBuilderEndpoint();

        await renderBuilderChat();

        const combobox = await screen.findByRole('combobox');

        expect(combobox).toHaveTextContent('gpt-5.5');

        await user.click(combobox);
        await user.click(await screen.findByText('claude-sonnet-4-6'));

        await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('claude-sonnet-4-6'));

        await sendMessage('switch models');

        await waitFor(() => expect(builder.streams).toHaveLength(1));
        expect(builder.bodies[0]).toMatchObject({
            message: 'switch models',
            modelId: 'model-claude',
        });

        act(() => answerWith(builder.streams[0], 'Switched.'));
        expect(await screen.findByText('Switched.')).toBeInTheDocument();
    });
});

describe('BuilderChat — @ mentions', () => {
    const CATALOG_PATHS = ['/datastores', '/skills', '/mcpservers', '/tools', '/agents'] as const;

    const stubCatalog = (values: Partial<Record<(typeof CATALOG_PATHS)[number], unknown[]>> = {}) => {
        CATALOG_PATHS.forEach((path) => {
            server.use(respond('get', path, () => pagedEnvelope(values[path] ?? [])));
        });
    };

    it('offers the catalog under its section once "@" is typed', async () => {
        stubCatalog({ '/skills': [{ _id: 'skill-1', name: 'Summarise' }] });

        await renderBuilderChat();

        await user.type(await getComposer(), '@');

        expect(await screen.findByText('Summarise')).toBeInTheDocument();
        expect(screen.getByText('Skills')).toBeInTheDocument();
        expect(screen.getByText('Web search')).toBeInTheDocument();
    });

    it('sends the chosen mention as a directive rather than the typed text', async () => {
        stubCatalog({ '/skills': [{ _id: 'skill-1', name: 'Summarise' }] });
        const builder = stubBuilderEndpoint();

        await renderBuilderChat();

        await user.type(await getComposer(), '@Summ');
        await user.click(await screen.findByText('Summarise'));

        const send = screen.getByLabelText('Send message');

        await waitFor(() => expect(send).toBeEnabled());
        await user.click(send);

        await waitFor(() => expect(builder.streams).toHaveLength(1));
        expect(builder.bodies[0]).toMatchObject({ message: ':skill[Summarise]{name=skill-skill-1}' });

        act(() => answerWith(builder.streams[0], 'Done.'));
    });

    it('sends once the mention menu has settled on nothing, rather than swallowing Enter', async () => {
        stubCatalog();
        const builder = stubBuilderEndpoint();

        await renderBuilderChat();

        await user.type(await getComposer(), 'ping @zzzz');

        expect(await screen.findByText('No mentions found')).toBeInTheDocument();

        await user.keyboard('{Enter}');

        await waitFor(() => expect(builder.streams).toHaveLength(1));
        expect(builder.bodies[0]).toMatchObject({ message: 'ping @zzzz' });

        act(() => answerWith(builder.streams[0], 'Done.'));
    });

    it('holds Enter while the mention list is still loading', async () => {
        let releaseCatalog = () => {};
        const catalogGate = new Promise<void>((resolve) => {
            releaseCatalog = resolve;
        });

        CATALOG_PATHS.forEach((path) => {
            server.use(
                respond('get', path, async () => {
                    await catalogGate;

                    return pagedEnvelope([]);
                }),
            );
        });

        const builder = stubBuilderEndpoint();

        await renderBuilderChat();

        await user.type(await getComposer(), 'ping @zzzz');

        expect(await screen.findByText('Searching…')).toBeInTheDocument();

        await user.keyboard('{Enter}');

        releaseCatalog();
        await screen.findByText('No mentions found');

        expect(builder.streams).toHaveLength(0);
    });

    it('leaves Shift+Enter to the editor while the mention list is still loading', async () => {
        let releaseCatalog = () => {};
        const catalogGate = new Promise<void>((resolve) => {
            releaseCatalog = resolve;
        });

        CATALOG_PATHS.forEach((path) => {
            server.use(
                respond('get', path, async () => {
                    await catalogGate;

                    return pagedEnvelope([]);
                }),
            );
        });

        stubBuilderEndpoint();

        await renderBuilderChat();

        const composer = await getComposer();

        await user.type(composer, 'ping @zzzz');

        expect(await screen.findByText('Searching…')).toBeInTheDocument();

        await user.keyboard('{Shift>}{Enter}{/Shift}');

        // The break also moves the caret off the trigger, so the menu closes rather than settling.
        await waitFor(() => expect(composer.querySelectorAll('br')).not.toHaveLength(0));
        await waitFor(() => expect(screen.queryByText('Searching…')).not.toBeInTheDocument());

        releaseCatalog();
    });
});
