import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installGalleryDomShims, installRichTextDomShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { apiUrl, envelope, httpError, pagedEnvelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import ChatAgent from './chat-agent';

/**
 * Real-runtime integration tests: nothing in the assistant-ui stack is stubbed.
 * `POST /ai/chat` is answered by MSW with a hand-driven AI SDK UI-message SSE
 * stream, so streaming, the request body, tool parts, the queue, stop and the
 * error path all run through the production runtime.
 *
 * `chat-agent.test.tsx` (runtime stubbed) covers route wiring; this file covers
 * everything that only exists once the runtime is real.
 */

// These mount the entire chat app against a live runtime and drive a real SSE
// stream; 5s is a CI/loaded-machine flake, not a genuine hang.
vi.setConfig({ testTimeout: 30_000 });

installGalleryDomShims();
installRichTextDomShims();
installScrollIntoViewShim();

// jsdom implements neither this nor `scrollIntoView`; the thread viewport calls
// both on every message append, and an unhandled throw there unmounts the whole
// tree.
Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: () => {} });

const COMPOSER_SELECTOR = '.chat-editor__content[contenteditable="true"]';

const ATTACH_ERROR_PATTERN =
    /Something went wrong|could not be resumed|attach relay exploded|conversationId is required/;

// v2.3's composer triggers ProseMirror scrollToSelection on mount, which walks
// getClientRects/getBoundingClientRect on elements AND ranges — none of which
// jsdom implements; the throw unmounts the whole tree.
const zeroRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
});
const emptyRectList = () => Object.assign([] as DOMRect[], { item: () => null }) as unknown as DOMRectList;

Object.defineProperty(Element.prototype, 'getClientRects', { configurable: true, value: emptyRectList });
Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: emptyRectList });
Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: zeroRect });
Object.defineProperty(Document.prototype, 'elementFromPoint', { configurable: true, value: () => null });

const agent = {
    _id: 'agent-1',
    slug: 'agent-1',
    identifier: 'agent-identifier-1',
    name: 'Smoke Test Agent',
    type: 'chat',
    apps: [],
    tools: [],
    uiConfig: {
        componentType: 'chat',
        type: 'chat',
        home: { title: 'Chat home', search: { placeholder: 'Ask anything' } },
    },
} as unknown as ChatAgentType;

interface SseStream {
    stream: ReadableStream<Uint8Array>;
    push: (event: Record<string, unknown>) => void;
    close: () => void;
}

const createSseStream = (): SseStream => {
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array>;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
        start: (c) => {
            controller = c;
        },
        cancel: () => {
            cancelled = true;
        },
    });

    return {
        stream,
        push: (event) => {
            if (cancelled) return;

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        },
        close: () => {
            if (cancelled) return;

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
        },
    };
};

interface ChatRequestBody {
    agentIdOrIdentifier?: string;
    conversationId?: string | null;
    parentMessageId?: string | null;
    clientMessageId?: string;
    trigger?: string;
    fileIds?: string[];
    arguments?: { message?: string; webSearch?: boolean; deepSearch?: boolean; mcpServers?: unknown[] };
    options?: { stream?: boolean; incognito?: boolean; public?: boolean };
}

interface ChatEndpoint {
    bodies: ChatRequestBody[];
    streams: SseStream[];
}

/**
 * Every `POST /ai/chat` records its body and hands back a stream the test keeps
 * open, so assertions can run mid-turn (`isRunning` true) instead of only after
 * the response has already completed.
 */
const stubChatEndpoint = (): ChatEndpoint => {
    const endpoint: ChatEndpoint = { bodies: [], streams: [] };

    server.use(
        http.post(apiUrl('/ai/chat'), async ({ request }) => {
            endpoint.bodies.push((await request.json()) as ChatRequestBody);
            const sse = createSseStream();

            endpoint.streams.push(sse);

            return new Response(sse.stream, { headers: { 'content-type': 'text/event-stream' } });
        }),
    );

    return endpoint;
};

const streamText = (sse: SseStream, text: string, id = '0') => {
    sse.push({ type: 'start' });
    sse.push({ type: 'text-start', id });
    sse.push({ type: 'text-delta', id, delta: text });
};

const finishText = (sse: SseStream, id = '0') => {
    sse.push({ type: 'text-end', id });
    sse.push({ type: 'finish' });
    sse.close();
};

const getComposer = (): HTMLElement => {
    const composer = document.querySelector<HTMLElement>(COMPOSER_SELECTOR);

    if (!composer) throw new Error('composer not mounted');

    return composer;
};

const renderChatAgent = (route = '/agent/agent-1/chat', renderedAgent: ChatAgentType = agent) =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/:agentId/*" element={<ChatAgent agent={renderedAgent} />} />
        </Routes>,
        { route },
    );

/**
 * Mounts the agent home already seeded with a prompt and a library file, the
 * router state `RootRoute` forwards to `ChatHome` as `initialPrompt` /
 * `initialFiles`.
 */
const renderChatHomeWithState = (state: Record<string, unknown>) =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/:agentId/*" element={<ChatAgent agent={agent} />} />
        </Routes>,
        { routerProps: { initialEntries: [{ pathname: '/agent/agent-1', state }] } },
    );

/**
 * `delay: null` matters: the default per-keystroke delay re-renders the whole
 * chat tree on every character and is what pushed these tests past the timeout
 * on a loaded machine.
 */
const user = userEvent.setup({ delay: null });

const sendMessage = async (text: string) => {
    await waitFor(() => expect(document.querySelector(COMPOSER_SELECTOR)).toBeTruthy());
    await user.type(getComposer(), text);
    await user.click(screen.getByLabelText('Send message'));
};

beforeEach(() => {
    server.use(
        http.get(apiUrl('/users/me'), () => envelope({})),
        http.get(apiUrl('/conversations'), () => pagedEnvelope([])),
        http.get(apiUrl('/mcpservers'), () => pagedEnvelope([])),
        http.get(apiUrl('/skills'), () => pagedEnvelope([])),
        http.get(apiUrl('/agents/:agentId/preferences'), () => envelope(null)),
        http.get(apiUrl('/agents/:agentId'), () => envelope(agent)),
        http.get(apiUrl('/routines'), () => pagedEnvelope([])),
        http.get(apiUrl('/routines/runs'), () => pagedEnvelope([])),
        // Opening a conversation always probes for an in-flight turn; 204 is
        // the "nothing to resume" answer and must be a silent no-op.
        http.get(apiUrl('/ai/chat/attach'), () => new Response(null, { status: 204 })),
    );
});

describe('ChatAgent runtime — sending', () => {
    it('posts the composed message to the chat endpoint with the agent identifier and new-conversation anchors', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('what is the weather');

        // `streams` is pushed last in the handler, so it is the safe sentinel:
        // waiting on `bodies` can win the race before the stream exists.
        await waitFor(() => expect(chat.streams).toHaveLength(1));

        const body = chat.bodies[0];

        expect(body.agentIdOrIdentifier).toBe('agent-identifier-1');
        expect(body.arguments?.message).toBe('what is the weather');
        expect(body.conversationId).toBeNull();
        expect(body.parentMessageId).toBeNull();
        expect(body.clientMessageId).toEqual(expect.any(String));
        expect(body.options).toMatchObject({ stream: true, incognito: false, public: false });
        expect(body.fileIds).toBeUndefined();
    });

    /**
     * assistant-ui drops custom message metadata that is not nested under
     * `metadata.custom`. The home submit writes the picked file ids there and
     * `prepareRequestBody` reads them back out, so a body carrying `fileIds` is
     * proof the nesting survived the append/convert round trip.
     */
    it('carries file ids picked on the home screen through message metadata into the request body', async () => {
        const chat = stubChatEndpoint();

        renderChatHomeWithState({
            prompt: 'summarise these',
            files: [
                {
                    _id: 'file-1',
                    name: 'report.pdf',
                    extension: 'pdf',
                    url: 'https://files.example.com/report.pdf',
                },
            ],
        });

        await waitFor(() => expect(document.querySelector(COMPOSER_SELECTOR)).toBeTruthy());
        await user.click(screen.getByLabelText('Send message'));

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        expect(chat.bodies[0].fileIds).toEqual(['file-1']);
        expect(chat.bodies[0].arguments?.message).toBe('summarise these');
    });

    /**
     * The chat run treats the request `mcpServers` list as a conditional strict
     * whitelist, so a connector attached to the agent must always appear in it.
     */
    it('includes the agent connectors in the request as an enabled whitelist entry', async () => {
        const chat = stubChatEndpoint();
        const agentWithConnector = {
            ...agent,
            mcpServers: [
                {
                    _id: 'mcp-1',
                    name: 'Jira',
                    authType: 'none',
                    effectiveEnabled: true,
                },
            ],
        } as unknown as ChatAgentType;

        renderChatAgent('/agent/agent-1/chat', agentWithConnector);
        await sendMessage('open the ticket');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        expect(chat.bodies[0].arguments?.mcpServers).toEqual([{ _id: 'mcp-1', isEnabled: true }]);
    });

    it('renders the user message and the streamed assistant text', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('hello there');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        streamText(chat.streams[0], 'Hello from the model');

        expect(await screen.findByText('Hello from the model')).toBeInTheDocument();
        expect(await screen.findByText('hello there')).toBeInTheDocument();

        finishText(chat.streams[0]);
    });

    it('shows the stop control only while a turn is in flight', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('hello there');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        streamText(chat.streams[0], 'partial');

        expect(await screen.findByLabelText('Stop generating')).toBeInTheDocument();

        finishText(chat.streams[0]);

        await waitFor(() => expect(screen.queryByLabelText('Stop generating')).not.toBeInTheDocument());
        expect(screen.getByLabelText('Send message')).toBeInTheDocument();
    });

    it('shows a visible generating label until the first text delta lands', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('hello there');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });

        const indicator = await screen.findByText('Generating');

        expect(indicator).toBeVisible();
        expect(indicator).not.toHaveClass('sr-only');

        chat.streams[0].push({ type: 'text-start', id: '0' });
        chat.streams[0].push({ type: 'text-delta', id: '0', delta: 'Hello from the model' });

        expect(await screen.findByText('Hello from the model')).toBeInTheDocument();
        // The label is only the pre-content cue: once real content streams it unmounts.
        await waitFor(() => expect(screen.queryByText('Generating')).not.toBeInTheDocument());

        finishText(chat.streams[0]);
    });

    it('adopts the conversation id minted mid-stream and sends it on the next turn', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('first');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({
            type: 'data-conversation',
            data: { conversation_id: 'conversation-99', message_id: 'server-assistant-1' },
        });
        streamText(chat.streams[0], 'first answer');
        await screen.findByText('first answer');
        finishText(chat.streams[0]);

        await waitFor(() => expect(screen.queryByLabelText('Stop generating')).not.toBeInTheDocument());
        await sendMessage('second');

        await waitFor(() => expect(chat.bodies).toHaveLength(2));
        expect(chat.bodies[1].conversationId).toBe('conversation-99');
    });
});

describe('ChatAgent runtime — deep research marker', () => {
    it('tags only the answer whose metadata marks it as deep research', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        streamText(chat.streams[0], 'researched answer');
        chat.streams[0].push({ type: 'message-metadata', messageMetadata: { custom: { deepResearch: true } } });
        finishText(chat.streams[0]);

        expect(await screen.findByText('Deep Research')).toBeInTheDocument();
    });

    it('keeps the tag on an earlier answer that is neither last nor hovered', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        streamText(chat.streams[0], 'researched answer');
        chat.streams[0].push({ type: 'message-metadata', messageMetadata: { custom: { deepResearch: true } } });
        finishText(chat.streams[0]);

        await screen.findByText('Deep Research');

        await sendMessage('and now a plain follow-up');

        streamText(chat.streams[1], 'plain answer', '1');
        finishText(chat.streams[1], '1');

        await screen.findByText('plain answer');
        await waitFor(() => expect(screen.queryByLabelText('Stop generating')).not.toBeInTheDocument());

        // The action bar of a non-last, non-hovered message is unmounted; the tag must not be.
        expect(screen.getAllByLabelText('Copy answer')).toHaveLength(1);
        expect(screen.getByText('Deep Research')).toBeInTheDocument();
    });

    it('leaves an ordinary answer untagged', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('just answer');

        streamText(chat.streams[0], 'plain answer');
        finishText(chat.streams[0]);

        await screen.findByText('plain answer');
        await waitFor(() => expect(screen.queryByLabelText('Stop generating')).not.toBeInTheDocument());

        expect(screen.queryByText('Deep Research')).not.toBeInTheDocument();
    });
});

describe('ChatAgent runtime — deep research card', () => {
    const pushPlan = (sse: SseStream, queries: string[]) =>
        sse.push({ type: 'data-research-plan', id: 'plan', data: { queries } });

    const pushRound = (
        sse: SseStream,
        round: number,
        queries: string[],
        summary: string,
        sources?: Record<string, unknown>[],
    ) => sse.push({ type: 'data-research-round', id: `round-${round}`, data: { round, queries, summary, sources } });

    const getResearchCards = () => document.querySelectorAll('[data-slot="research-card"]');
    const getResearchCard = (): HTMLElement | null => document.querySelector('[data-slot="research-card"]');

    // The pane opens on the phase timeline; a round's queries and sources are one level down.
    const drillIntoSources = async (pane: HTMLElement) => {
        await user.click(within(pane).getAllByRole('button', { name: /Show sources for/ })[0]);
    };

    const persistedResearchConversation = (metadata: Record<string, unknown>) =>
        server.use(
            http.get(apiUrl('/conversations/conversation-42'), () =>
                envelope({
                    _id: 'conversation-42',
                    title: 'Research',
                    user_id: 'user-1',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-42/messages'), () =>
                envelope({
                    // Newest first: the loader asks for `sort: 'desc'` and reverses the page,
                    // so an ascending stub would build the tree with the answer as its root.
                    values: [
                        {
                            _id: 'message-2',
                            conversation_id: 'conversation-42',
                            role: 'assistant',
                            content: [{ type: 'text', text: 'the persisted report' }],
                            metadata,
                        },
                        {
                            _id: 'message-1',
                            conversation_id: 'conversation-42',
                            role: 'user',
                            content: [{ type: 'text', text: 'research this' }],
                        },
                    ],
                    page_info: { page: 1, total_pages: 1, total_count: 2 },
                    head_id: 'message-2',
                }),
            ),
        );

    it('renders exactly one card for a run and leaves the report outside it', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });
        pushPlan(chat.streams[0], ['what is amp', 'who uses amp']);
        pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs');
        pushRound(chat.streams[0], 2, ['amp changelog'], 'read the changelog');
        chat.streams[0].push({ type: 'text-start', id: '0' });
        chat.streams[0].push({ type: 'text-delta', id: '0', delta: 'the report body' });
        chat.streams[0].push({ type: 'message-metadata', messageMetadata: { custom: { deepResearch: true } } });
        finishText(chat.streams[0]);

        const report = await screen.findByText('the report body', { ignore: '.research-report-thumb' });

        await waitFor(() => expect(getResearchCards()).toHaveLength(1));
        expect(getResearchCard()?.contains(report)).toBe(false);
        // Rounds are an internal backend concept and must never surface.
        expect(getResearchCard()?.textContent).not.toMatch(/round/i);
    });

    it('keeps one card when a reasoning part and a tool call are interleaved', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });
        pushPlan(chat.streams[0], ['what is amp']);
        pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs');
        chat.streams[0].push({ type: 'reasoning-start', id: 'r0' });
        chat.streams[0].push({ type: 'reasoning-delta', id: 'r0', delta: 'weighing the sources' });
        chat.streams[0].push({ type: 'reasoning-end', id: 'r0' });
        chat.streams[0].push({ type: 'tool-input-available', toolCallId: 't1', toolName: 'web_search', input: {} });
        chat.streams[0].push({ type: 'tool-output-available', toolCallId: 't1', output: { web: [] } });
        pushRound(chat.streams[0], 2, ['amp changelog'], 'read the changelog');
        chat.streams[0].push({ type: 'text-start', id: '0' });
        chat.streams[0].push({ type: 'text-delta', id: '0', delta: 'the report body' });
        finishText(chat.streams[0]);

        await screen.findByText('the report body', { ignore: '.research-report-thumb' });
        await waitFor(() => expect(getResearchCards()).toHaveLength(1));
    });

    it('keeps one card when a tool call the grouping excludes lands between two rounds', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });
        pushPlan(chat.streams[0], ['what is amp']);
        pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs');
        // A reconnect-gate result is grouped as its own card, so it breaks the run in two.
        chat.streams[0].push({ type: 'tool-input-available', toolCallId: 't1', toolName: 'jira_search', input: {} });
        chat.streams[0].push({
            type: 'tool-output-available',
            toolCallId: 't1',
            output: { status: 'reconnect_required', server: 'Jira' },
        });
        pushRound(chat.streams[0], 2, ['amp changelog'], 'read the changelog');
        chat.streams[0].push({ type: 'text-start', id: '0' });
        chat.streams[0].push({ type: 'text-delta', id: '0', delta: 'the report body' });
        finishText(chat.streams[0]);

        await screen.findByText('the report body', { ignore: '.research-report-thumb' });
        await waitFor(() => expect(getResearchCards()).toHaveLength(1));
        // The split second half must still be described by the single surviving card.
        expect(getResearchCard()?.textContent).toMatch(/Research complete/);
    });

    it('keeps rendering a tool subtree that an ungrouped part split away from the run', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });
        pushPlan(chat.streams[0], ['what is amp']);
        pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs');
        // Ungrouped, so it breaks group adjacency and forces a second research group.
        chat.streams[0].push({ type: 'data-status', id: 's1', data: { message: 'Working on it' } });
        chat.streams[0].push({ type: 'tool-input-start', toolCallId: 'call-1', toolName: 'web_search' });
        chat.streams[0].push({
            type: 'tool-input-available',
            toolCallId: 'call-1',
            toolName: 'web_search',
            input: { query: 'amp' },
        });
        pushRound(chat.streams[0], 2, ['amp changelog'], 'read the changelog');
        chat.streams[0].push({ type: 'tool-output-available', toolCallId: 'call-1', output: { results: [] } });
        chat.streams[0].push({ type: 'text-start', id: '0' });
        chat.streams[0].push({ type: 'text-delta', id: '0', delta: 'the report body' });
        finishText(chat.streams[0]);

        await screen.findByText('the report body', { ignore: '.research-report-thumb' });
        await waitFor(() => expect(getResearchCards()).toHaveLength(1));
        // The split-off group holds a real tool subtree; dropping it can hide an approval.
        expect(await screen.findByText('Searched the Web')).toBeInTheDocument();
    });

    it('stays running when an ungrouped part lands after the first phase', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });
        pushPlan(chat.streams[0], ['what is amp']);
        pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs', [
            { title: 'Amp docs', url: 'https://amp.example.com/docs' },
        ]);
        chat.streams[0].push({ type: 'data-status', id: 's1', data: { message: 'Working on it' } });

        await waitFor(() => expect(getResearchCard()?.textContent).toMatch(/and counting/));

        // The part group settled, but the run has not: a later phase still arrives.
        pushRound(chat.streams[0], 2, ['amp changelog'], 'read the changelog', [
            { title: 'Amp changelog', url: 'https://amp.example.com/changelog' },
        ]);

        await waitFor(() => expect(getResearchCard()?.textContent).toMatch(/2 sources and counting/));

        finishText(chat.streams[0]);
    });

    it('keeps one receipt when the backend reports a source count the trace cannot show', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });
        pushPlan(chat.streams[0], ['what is amp']);
        chat.streams[0].push({
            type: 'data-research-status',
            id: 'st',
            data: { label: 'Reading sources', sourceCount: 40 },
        });
        pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs', [
            { title: 'Amp docs', url: 'https://amp.example.com/docs' },
            { title: 'Amp guide', url: 'https://amp.example.com/guide' },
        ]);
        chat.streams[0].push({ type: 'text-start', id: '0' });
        chat.streams[0].push({ type: 'text-delta', id: '0', delta: 'the report body' });
        finishText(chat.streams[0]);

        await screen.findByText('the report body', { ignore: '.research-report-thumb' });
        // The settled receipt must equal what a reload can rebuild, which is the trace itself.
        await waitFor(() => expect(getResearchCard()?.textContent).toMatch(/2 sources/));
        expect(getResearchCard()?.textContent).not.toMatch(/40 sources/);
    });

    it('ticks the elapsed time and shows the running source count while the turn is in flight', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });
        pushPlan(chat.streams[0], ['what is amp']);
        chat.streams[0].push({
            type: 'data-research-status',
            id: 'st',
            data: { label: 'Reading sources', sourceCount: 8 },
        });

        await waitFor(() => expect(getResearchCard()?.textContent).toMatch(/8 sources and counting/));
        expect(getResearchCard()?.textContent).toMatch(/0s/);

        // Real elapsed, not a mocked clock: the tick has to survive the runtime's re-renders.
        await waitFor(() => expect(getResearchCard()?.textContent).toMatch(/• [1-9]\d*s/), { timeout: 8000 });

        finishText(chat.streams[0]);
    });

    it('replaces the running line with the permanent receipt once the turn settles', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });
        pushPlan(chat.streams[0], ['what is amp']);
        pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs', [
            { title: 'Amp docs', url: 'https://amp.example.com/docs' },
            { title: 'Amp guide', url: 'https://amp.example.com/guide' },
        ]);
        chat.streams[0].push({ type: 'text-start', id: '0' });
        chat.streams[0].push({ type: 'text-delta', id: '0', delta: 'the report body' });
        finishText(chat.streams[0]);

        await screen.findByText('the report body', { ignore: '.research-report-thumb' });
        await waitFor(() => expect(getResearchCard()?.textContent).toMatch(/2 sources/));
        expect(getResearchCard()?.textContent).not.toMatch(/and counting/);
    });

    it('lets the card carry the receipt instead of the answer tag', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });
        pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs');
        chat.streams[0].push({ type: 'text-start', id: '0' });
        chat.streams[0].push({ type: 'text-delta', id: '0', delta: 'the report body' });
        chat.streams[0].push({ type: 'message-metadata', messageMetadata: { custom: { deepResearch: true } } });
        finishText(chat.streams[0]);

        await screen.findByText('the report body', { ignore: '.research-report-thumb' });
        await waitFor(() => expect(getResearchCards()).toHaveLength(1));
        expect(screen.queryByText('Deep Research')).not.toBeInTheDocument();
    });

    it('does not count sources the research phases did not report', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });
        pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs', [
            { title: 'Amp docs', url: 'https://amp.example.com/docs' },
        ]);
        chat.streams[0].push({
            type: 'data-sources',
            id: 'src',
            data: [
                { url: 'https://one.example.com', title: 'One' },
                { url: 'https://two.example.com', title: 'Two' },
            ],
        });
        chat.streams[0].push({ type: 'text-start', id: '0' });
        chat.streams[0].push({ type: 'text-delta', id: '0', delta: 'the report body' });
        finishText(chat.streams[0]);

        await screen.findByText('the report body', { ignore: '.research-report-thumb' });
        await waitFor(() => expect(getResearchCard()?.textContent).toMatch(/1 source(?!s)/));
    });

    it('renders no card and does not fail the turn when the phase payloads are malformed', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('research this');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({ type: 'start' });
        chat.streams[0].push({ type: 'data-research-plan', id: 'plan', data: { queries: 'not an array' } });
        chat.streams[0].push({ type: 'data-research-round', id: 'round-1', data: { round: 'one' } });
        chat.streams[0].push({ type: 'text-start', id: '0' });
        chat.streams[0].push({ type: 'text-delta', id: '0', delta: 'the report body' });
        chat.streams[0].push({ type: 'message-metadata', messageMetadata: { custom: { deepResearch: true } } });
        finishText(chat.streams[0]);

        expect(await screen.findByText('the report body', { ignore: '.research-report-thumb' })).toBeInTheDocument();
        expect(getResearchCard()).toBeNull();
        expect(screen.queryByText(ATTACH_ERROR_PATTERN)).not.toBeInTheDocument();
        // With no card to carry it, the provenance falls back to the answer tag.
        expect(await screen.findByText('Deep Research')).toBeInTheDocument();
    });

    it('rebuilds the card and its persisted receipt after a reload', async () => {
        persistedResearchConversation({
            research_plan: { queries: ['what is amp'] },
            research_rounds: [
                {
                    round: 1,
                    queries: ['amp docs'],
                    summary: 'read the docs',
                    sources: [
                        { title: 'Amp docs', url: 'https://amp.example.com/docs' },
                        { title: 'Amp guide', url: 'https://amp.example.com/guide' },
                    ],
                },
            ],
            deep_research: { durationMs: 92_000 },
        });

        renderChatAgent('/agent/agent-1/chat/conversation-42');

        expect(
            await screen.findByText('the persisted report', { ignore: '.research-report-thumb' }),
        ).toBeInTheDocument();
        await waitFor(() => expect(getResearchCards()).toHaveLength(1));
        expect(getResearchCard()?.textContent).toMatch(/2 sources/);
        expect(getResearchCard()?.textContent).toMatch(/1m 32s/);
    });

    describe('side panel', () => {
        const originalWidth = window.innerWidth;

        // Below 1280 every pane is a modal dialog whose overlay swallows clicks on the
        // card behind it, so the single-active-pane assertion needs the docked layout.
        beforeEach(() => {
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
        });

        afterEach(() => {
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
        });

        const openPersistedResearchPane = async () => {
            persistedResearchConversation({
                research_plan: { queries: ['what is amp', 'who uses amp'] },
                research_rounds: [
                    {
                        round: 1,
                        queries: ['amp docs', 'amp changelog'],
                        summary: 'read the docs',
                        sources: [
                            { title: 'Amp docs', url: 'https://amp.example.com/docs', query: 'amp docs' },
                            { title: 'Amp guide', url: 'https://guide.example.com/amp', query: 'amp docs' },
                            {
                                title: 'Amp changelog',
                                url: 'https://amp.example.com/changelog',
                                query: 'amp changelog',
                            },
                        ],
                    },
                ],
                deep_research: true,
            });

            renderChatAgent('/agent/agent-1/chat/conversation-42');
            await screen.findByText('the persisted report', { ignore: '.research-report-thumb' });
            await waitFor(() => expect(getResearchCards()).toHaveLength(1));
        };

        const getResearchPaneState = () =>
            document.querySelector('[data-slot="research-pane"]')?.getAttribute('data-state');

        const countOpenHostPanes = () =>
            document.querySelectorAll('[data-slot="chat-side-pane"][data-state="open"]').length;

        it('opens the research pane on click and closes whichever pane was open', async () => {
            await openPersistedResearchPane();

            await user.click(screen.getByLabelText('Connectors and skills'));
            await waitFor(() => expect(countOpenHostPanes()).toBe(1));

            await user.click(screen.getByRole('button', { name: /Open research trace/ }));

            await waitFor(() => expect(getResearchPaneState()).toBe('open'));
            expect(countOpenHostPanes()).toBe(0);
        });

        it('keeps an already-open pane in step with the phases still streaming in', async () => {
            const chat = stubChatEndpoint();

            renderChatAgent();
            await sendMessage('research this');

            await waitFor(() => expect(chat.streams).toHaveLength(1));
            chat.streams[0].push({ type: 'start' });
            pushPlan(chat.streams[0], ['what is amp']);
            pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs', [
                { title: 'Amp docs', url: 'https://amp.example.com/docs' },
            ]);

            await waitFor(() => expect(getResearchCards()).toHaveLength(1));
            await user.click(screen.getByRole('button', { name: /Open research trace/ }));
            await waitFor(() =>
                expect(document.querySelector('[data-slot="research-pane"]')?.getAttribute('data-state')).toBe('open'),
            );

            pushRound(chat.streams[0], 2, ['amp changelog'], 'read the changelog', [
                { title: 'Amp changelog', url: 'https://amp.example.com/changelog' },
            ]);

            const pane = document.querySelector<HTMLElement>('[data-slot="research-pane"]');

            await waitFor(() =>
                expect(within(pane as HTMLElement).getAllByRole('button', { name: /Show sources for/ })).toHaveLength(
                    2,
                ),
            );
            await user.click(within(pane as HTMLElement).getAllByRole('button', { name: /Show sources for/ })[1]);
            expect(within(pane as HTMLElement).getByText('amp changelog')).toBeInTheDocument();

            finishText(chat.streams[0]);
        });

        it('lists a re-emitted round once, with its latest sources', async () => {
            const chat = stubChatEndpoint();

            renderChatAgent();
            await sendMessage('research this');

            await waitFor(() => expect(chat.streams).toHaveLength(1));
            chat.streams[0].push({ type: 'start' });
            pushPlan(chat.streams[0], ['what is amp']);
            pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs', [
                { title: 'Amp docs', url: 'https://amp.example.com/docs' },
            ]);
            // The same round re-emitted as its sources accumulate, as a stream naturally would.
            pushRound(chat.streams[0], 1, ['amp docs'], 'read the docs', [
                { title: 'Amp docs', url: 'https://amp.example.com/docs' },
                { title: 'Amp guide', url: 'https://amp.example.com/guide' },
                { title: 'Amp blog', url: 'https://amp.example.com/blog' },
            ]);
            chat.streams[0].push({ type: 'text-start', id: '0' });
            chat.streams[0].push({ type: 'text-delta', id: '0', delta: 'the report body' });
            finishText(chat.streams[0]);

            await screen.findByText('the report body', { ignore: '.research-report-thumb' });
            await waitFor(() => expect(getResearchCards()).toHaveLength(1));
            expect(getResearchCard()?.textContent).toMatch(/3 sources/);

            await user.click(screen.getByRole('button', { name: /Open research trace/ }));

            const pane = await waitFor(() => {
                const node = document.querySelector<HTMLElement>('[data-slot="research-pane"]');

                if (node?.getAttribute('data-state') !== 'open') throw new Error('research pane not open');

                return node;
            });

            await drillIntoSources(pane);

            expect(within(pane).getAllByText('amp docs')).toHaveLength(1);
            expect(pane.textContent).toMatch(/3 results/);
        });

        it('closes the pane when the message it describes leaves the thread', async () => {
            const chat = stubChatEndpoint();

            await openPersistedResearchPane();
            await user.click(screen.getByRole('button', { name: /Open research trace/ }));
            await waitFor(() => expect(getResearchPaneState()).toBe('open'));

            await user.hover(screen.getByText('research this'));
            await user.click(await screen.findByLabelText('Edit message'));
            await user.click(await screen.findByRole('button', { name: 'Update' }));

            await waitFor(() => expect(chat.streams.length).toBeGreaterThan(0));
            streamText(chat.streams[0], 'a different branch answer');
            finishText(chat.streams[0]);

            await screen.findByText('a different branch answer');
            await waitFor(() => expect(getResearchPaneState()).toBe('closed'));
        });

        it('groups the sources under the query that produced them', async () => {
            await openPersistedResearchPane();

            await user.click(screen.getByRole('button', { name: /Open research trace/ }));

            const pane = await waitFor(() => {
                const node = document.querySelector<HTMLElement>('[data-slot="research-pane"]');

                if (node?.getAttribute('data-state') !== 'open') throw new Error('research pane not open');

                return node;
            });

            expect(within(pane).getByText('who uses amp')).toBeInTheDocument();

            await drillIntoSources(pane);

            const docsGroup = within(pane).getByText('amp docs').closest('[data-slot="collapsible"]');
            const changelogGroup = within(pane).getByText('amp changelog').closest('[data-slot="collapsible"]');

            expect(docsGroup?.textContent).toMatch(/2 results/);
            expect(within(docsGroup as HTMLElement).getByText('Amp guide')).toBeInTheDocument();
            expect(changelogGroup?.textContent).toMatch(/1 result(?!s)/);
            expect(within(changelogGroup as HTMLElement).queryByText('Amp guide')).toBeNull();
        });
    });
});

describe('ChatAgent runtime — tools and errors', () => {
    it('renders a tool call streamed inside the assistant turn', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('search the web');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        const sse = chat.streams[0];

        sse.push({ type: 'start' });
        sse.push({ type: 'tool-input-start', toolCallId: 'call-1', toolName: 'web_search' });
        sse.push({
            type: 'tool-input-available',
            toolCallId: 'call-1',
            toolName: 'web_search',
            input: { query: 'weather' },
        });

        expect(await screen.findByText('Using tools')).toBeInTheDocument();

        await user.click(screen.getByText('Using tools'));
        expect(await screen.findByText('Searching the Web')).toBeInTheDocument();

        sse.push({
            type: 'tool-output-available',
            toolCallId: 'call-1',
            output: { results: [] },
        });
        sse.push({ type: 'finish' });
        sse.close();

        await waitFor(() => expect(screen.getAllByText('Searched the Web').length).toBeGreaterThan(0));
    });

    it('surfaces a failed turn as an error message in the thread', async () => {
        server.use(http.post(apiUrl('/ai/chat'), () => httpError(500, 'model unavailable')));

        renderChatAgent();
        await sendMessage('this will fail');

        expect(await screen.findByText(/model unavailable/)).toBeInTheDocument();
    });

    it('does not claim no response was generated on a turn that failed with an error', async () => {
        server.use(http.post(apiUrl('/ai/chat'), () => httpError(500, 'model unavailable')));

        renderChatAgent();
        await sendMessage('this will fail');

        await screen.findByText(/model unavailable/);

        expect(screen.queryByText('No response was generated.')).not.toBeInTheDocument();
    });
});

describe('ChatAgent runtime — message queue', () => {
    it('queues a message sent mid-stream and drains it when the turn settles', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('first question');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        streamText(chat.streams[0], 'answering');
        await screen.findByText('answering');

        await user.type(getComposer(), 'follow up question');
        await user.click(screen.getByLabelText('Send message'));

        expect(await screen.findByText('1 Queued')).toBeInTheDocument();
        expect(chat.bodies).toHaveLength(1);

        finishText(chat.streams[0]);

        await waitFor(() => expect(chat.bodies).toHaveLength(2));
        expect(chat.bodies[1].arguments?.message).toBe('follow up question');
        expect(screen.queryByText('1 Queued')).not.toBeInTheDocument();
    });

    it('removes a queued message before it is sent', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('first question');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        streamText(chat.streams[0], 'answering');
        await screen.findByText('answering');

        await user.type(getComposer(), 'never mind');
        await user.click(screen.getByLabelText('Send message'));

        const panel = await screen.findByText('1 Queued');

        expect(panel).toBeInTheDocument();
        await user.click(screen.getByLabelText('Remove queued message'));

        await waitFor(() => expect(screen.queryByText('1 Queued')).not.toBeInTheDocument());

        finishText(chat.streams[0]);

        await waitFor(() => expect(screen.queryByLabelText('Stop generating')).not.toBeInTheDocument());
        expect(chat.bodies).toHaveLength(1);
    });
});

describe('ChatAgent runtime — stopping', () => {
    /**
     * Only the server-side half of stop is assertable here. Aborting the
     * in-flight fetch never settles the run under MSW + jsdom (the reader on the
     * mocked response body is not rejected), so the thread stays `isRunning`,
     * the assistant action bar never mounts and the "Interrupted" tag is not
     * reachable below E2E.
     */
    it('posts the active conversation to the stop endpoint when the user stops generation', async () => {
        const chat = stubChatEndpoint();
        const stopCalls: string[] = [];

        server.use(
            http.post(apiUrl('/ai/chat/stop'), async ({ request }) => {
                stopCalls.push(await request.text());

                return envelope({});
            }),
        );

        renderChatAgent();
        await sendMessage('long answer please');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        chat.streams[0].push({
            type: 'data-conversation',
            data: { conversation_id: 'conversation-77' },
        });
        streamText(chat.streams[0], 'half an ans');
        await screen.findByText('half an ans');

        await user.click(screen.getByLabelText('Stop generating'));

        await waitFor(() => expect(stopCalls).toHaveLength(1));
        expect(JSON.parse(stopCalls[0])).toEqual({ agentId: 'agent-1', conversationId: 'conversation-77' });
    });
});

describe('ChatAgent runtime — reopening a conversation', () => {
    it('renders the persisted turns of an existing conversation', async () => {
        server.use(
            http.get(apiUrl('/conversations/conversation-5'), () =>
                envelope({
                    _id: 'conversation-5',
                    title: 'Persisted conversation',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-5/messages'), () =>
                envelope({
                    values: [
                        {
                            _id: 'message-1',
                            conversation_id: 'conversation-5',
                            role: 'user',
                            content: [{ type: 'text', text: 'persisted question' }],
                        },
                        {
                            _id: 'message-2',
                            conversation_id: 'conversation-5',
                            role: 'assistant',
                            content: [{ type: 'text', text: 'persisted answer' }],
                        },
                    ],
                    page_info: { page: 1, total_pages: 1, total_count: 2 },
                    head_id: 'message-2',
                }),
            ),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-5');

        expect(await screen.findByText('persisted question')).toBeInTheDocument();
        expect(screen.getByText('persisted answer')).toBeInTheDocument();
    });
});

describe('ChatAgent runtime — Temporal attach path', () => {
    it('discards partial assistant content when a turn-attempt bump arrives, keeping only the re-streamed answer', async () => {
        const chat = stubChatEndpoint();

        // On a bump the client abandons the doomed stream and re-attaches; the
        // attempt-2 replay is served by the attach endpoint (as in production,
        // where the relay replays from the new attempt's start marker).
        const replay = createSseStream();

        server.use(
            http.get(
                apiUrl('/ai/chat/attach'),
                () => new Response(replay.stream, { headers: { 'content-type': 'text/event-stream' } }),
            ),
        );

        renderChatAgent();
        await sendMessage('flaky question');
        await waitFor(() => expect(chat.streams).toHaveLength(1));

        const sse = chat.streams[0];

        // Attempt 1 streams a doomed partial…
        sse.push({ type: 'data-conversation', data: { conversation_id: 'conv-1', status: 'generating' } });
        sse.push({ type: 'data-turn-attempt', data: { attempt: 1, assistantMessageId: 'm-1' }, transient: true });
        sse.push({ type: 'start', messageId: 'm-1' });
        sse.push({ type: 'text-start', id: '0' });
        sse.push({ type: 'text-delta', id: '0', delta: 'PARTIAL DOOMED' });
        await screen.findByText(/PARTIAL DOOMED/);

        // …the activity re-runs: the relay emits the attempt-2 marker, the
        // client stops this stream, clears the message and re-attaches.
        sse.push({ type: 'data-turn-attempt', data: { attempt: 2, assistantMessageId: 'm-1' }, transient: true });

        replay.push({ type: 'data-turn-attempt', data: { attempt: 2, assistantMessageId: 'm-1' }, transient: true });
        replay.push({ type: 'start', messageId: 'm-1' });
        replay.push({ type: 'text-start', id: '1' });
        replay.push({ type: 'text-delta', id: '1', delta: 'Recovered answer' });
        replay.push({ type: 'text-end', id: '1' });
        replay.push({ type: 'finish' });
        replay.close();

        await screen.findByText('Recovered answer');
        await waitFor(() => expect(screen.queryByText(/PARTIAL DOOMED/)).not.toBeInTheDocument());
    });

    it('rescues a 409 in_flight response by attaching to the in-flight stream', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('first question');
        await waitFor(() => expect(chat.streams).toHaveLength(1));

        // Turn 1 pins the conversation id via the data-conversation part.
        const first = chat.streams[0];

        first.push({ type: 'data-conversation', data: { conversation_id: 'conv-9', status: 'generating' } });
        streamText(first, 'first answer');
        finishText(first);
        await screen.findByText('first answer');

        // Turn 2: the POST is refused (a turn is already running) and the
        // client attaches to the in-flight stream instead of erroring.
        const attach = createSseStream();

        server.use(
            http.post(
                apiUrl('/ai/chat'),
                () =>
                    new Response(
                        JSON.stringify({ success: false, value: { in_flight: true, conversation_id: 'conv-9' } }),
                        { status: 409, headers: { 'content-type': 'application/json' } },
                    ),
            ),
            http.get(
                apiUrl('/ai/chat/attach'),
                () => new Response(attach.stream, { headers: { 'content-type': 'text/event-stream' } }),
            ),
        );

        await sendMessage('second question');

        attach.push({ type: 'start', messageId: 'm-attached' });
        attach.push({ type: 'text-start', id: '0' });
        attach.push({ type: 'text-delta', id: '0', delta: 'attached continuation' });
        attach.push({ type: 'text-end', id: '0' });
        attach.push({ type: 'finish' });
        attach.close();

        await screen.findByText('attached continuation');
    });

    it('re-attaches to a generating conversation after hydration and streams the live turn', async () => {
        const attach = createSseStream();

        server.use(
            http.get(apiUrl('/conversations/conversation-7'), () =>
                envelope({
                    _id: 'conversation-7',
                    title: 'Mid-turn conversation',
                    status: 'generating',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-7/messages'), () =>
                envelope({
                    values: [
                        {
                            _id: 'message-1',
                            conversation_id: 'conversation-7',
                            role: 'user',
                            content: [{ type: 'text', text: 'question before refresh' }],
                        },
                    ],
                    page_info: { page: 1, total_pages: 1, total_count: 1 },
                    head_id: 'message-1',
                }),
            ),
            http.get(
                apiUrl('/ai/chat/attach'),
                () => new Response(attach.stream, { headers: { 'content-type': 'text/event-stream' } }),
            ),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await screen.findByText('question before refresh');

        attach.push({ type: 'start', messageId: 'm-live' });
        attach.push({ type: 'text-start', id: '0' });
        attach.push({ type: 'text-delta', id: '0', delta: 'live continuation after refresh' });
        attach.push({ type: 'text-end', id: '0' });
        attach.push({ type: 'finish' });
        attach.close();

        await screen.findByText('live continuation after refresh');
    });

    it('hides the pending-generation placeholder while the re-attached stream is live', async () => {
        const attach = createSseStream();

        server.use(
            http.get(apiUrl('/conversations/conversation-7'), () =>
                envelope({
                    _id: 'conversation-7',
                    title: 'Mid-turn conversation',
                    status: 'generating',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-7/messages'), () =>
                envelope({
                    values: [
                        {
                            _id: 'message-1',
                            conversation_id: 'conversation-7',
                            role: 'user',
                            content: [{ type: 'text', text: 'question before refresh' }],
                        },
                    ],
                    page_info: { page: 1, total_pages: 1, total_count: 1 },
                    head_id: 'message-1',
                }),
            ),
            http.get(
                apiUrl('/ai/chat/attach'),
                () => new Response(attach.stream, { headers: { 'content-type': 'text/event-stream' } }),
            ),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await screen.findByText('question before refresh');

        attach.push({ type: 'start', messageId: 'm-live' });
        attach.push({ type: 'text-start', id: '0' });
        attach.push({ type: 'text-delta', id: '0', delta: 'live continuation after refresh' });

        await screen.findByText('live continuation after refresh');
        expect(screen.queryByText('Generating your answer')).not.toBeInTheDocument();

        attach.push({ type: 'text-end', id: '0' });
        attach.push({ type: 'finish' });
        attach.close();
    });

    it('keeps the pending-generation placeholder hidden after the re-attached stream finishes', async () => {
        const attach = createSseStream();

        server.use(
            http.get(apiUrl('/conversations/conversation-7'), () =>
                envelope({
                    _id: 'conversation-7',
                    title: 'Mid-turn conversation',
                    status: 'generating',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-7/messages'), () =>
                envelope({
                    values: [
                        {
                            _id: 'message-1',
                            conversation_id: 'conversation-7',
                            role: 'user',
                            content: [{ type: 'text', text: 'question before refresh' }],
                        },
                    ],
                    page_info: { page: 1, total_pages: 1, total_count: 1 },
                    head_id: 'message-1',
                }),
            ),
            http.get(
                apiUrl('/ai/chat/attach'),
                () => new Response(attach.stream, { headers: { 'content-type': 'text/event-stream' } }),
            ),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await screen.findByText('question before refresh');

        attach.push({ type: 'start', messageId: 'm-live' });
        attach.push({ type: 'text-start', id: '0' });
        attach.push({ type: 'text-delta', id: '0', delta: 'live continuation after refresh' });

        await screen.findByText('live continuation after refresh');

        attach.push({ type: 'text-end', id: '0' });
        attach.push({ type: 'finish' });
        attach.close();

        await waitFor(() => expect(document.querySelector('[data-status="complete"]')).toBeTruthy());

        expect(screen.queryByText('Generating your answer')).not.toBeInTheDocument();
        expect(screen.getByText('live continuation after refresh')).toBeInTheDocument();
    });

    it('still re-imports the persisted message when the envelope flips to ready after the re-attached stream finished', async () => {
        const attach = createSseStream();
        let status = 'generating';
        let hasPersistedAnswer = false;

        server.use(
            http.get(apiUrl('/conversations/conversation-7'), () =>
                envelope({
                    _id: 'conversation-7',
                    title: 'Mid-turn conversation',
                    status,
                    active_leaf_message_id: hasPersistedAnswer ? 'message-2' : 'message-1',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-7/messages'), () =>
                envelope({
                    values: hasPersistedAnswer
                        ? [
                              {
                                  _id: 'message-1',
                                  conversation_id: 'conversation-7',
                                  role: 'user',
                                  content: [{ type: 'text', text: 'question before refresh' }],
                              },
                              {
                                  _id: 'message-2',
                                  conversation_id: 'conversation-7',
                                  role: 'assistant',
                                  content: [{ type: 'text', text: 'persisted answer with server metadata' }],
                              },
                          ]
                        : [
                              {
                                  _id: 'message-1',
                                  conversation_id: 'conversation-7',
                                  role: 'user',
                                  content: [{ type: 'text', text: 'question before refresh' }],
                              },
                          ],
                    page_info: { page: 1, total_pages: 1, total_count: hasPersistedAnswer ? 2 : 1 },
                    head_id: hasPersistedAnswer ? 'message-2' : 'message-1',
                }),
            ),
            http.get(
                apiUrl('/ai/chat/attach'),
                () => new Response(attach.stream, { headers: { 'content-type': 'text/event-stream' } }),
            ),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await screen.findByText('question before refresh');

        attach.push({ type: 'start', messageId: 'm-live' });
        attach.push({ type: 'text-start', id: '0' });
        attach.push({ type: 'text-delta', id: '0', delta: 'live continuation after refresh' });
        attach.push({ type: 'text-end', id: '0' });
        attach.push({ type: 'finish' });
        attach.close();

        await waitFor(() => expect(document.querySelector('[data-status="complete"]')).toBeTruthy());

        status = 'ready';
        hasPersistedAnswer = true;

        await waitFor(() => expect(screen.getByText('persisted answer with server metadata')).toBeInTheDocument(), {
            timeout: 15_000,
        });
    });

    it('re-attaches once per hydration when the same conversation is opened again, without duplicating the replayed turn', async () => {
        const attachedConversationIds: string[] = [];
        const attachStreams: SseStream[] = [];

        const conversationEnvelope = (id: string, status: string) =>
            envelope({
                _id: id,
                title: `Conversation ${id}`,
                status,
                user: { email: 'test@example.com' },
            });

        const messagesEnvelope = (conversationId: string, messageId: string, text: string) =>
            envelope({
                values: [
                    {
                        _id: messageId,
                        conversation_id: conversationId,
                        role: 'user',
                        content: [{ type: 'text', text }],
                    },
                ],
                page_info: { page: 1, total_pages: 1, total_count: 1 },
                head_id: messageId,
            });

        server.use(
            http.get(apiUrl('/conversations/conversation-7'), () =>
                conversationEnvelope('conversation-7', 'generating'),
            ),
            http.get(apiUrl('/conversations/conversation-8'), () =>
                conversationEnvelope('conversation-8', 'generating'),
            ),
            http.get(apiUrl('/conversations/conversation-7/messages'), () =>
                messagesEnvelope('conversation-7', 'message-1', 'question before refresh'),
            ),
            http.get(apiUrl('/conversations/conversation-8/messages'), () =>
                messagesEnvelope('conversation-8', 'message-9', 'other conversation question'),
            ),
            http.get(apiUrl('/ai/chat/attach'), ({ request }) => {
                const conversationId = new URL(request.url).searchParams.get('conversationId') ?? '';

                attachedConversationIds.push(conversationId);

                if (conversationId !== 'conversation-7') return new Response(null, { status: 204 });

                const sse = createSseStream();

                attachStreams.push(sse);
                sse.push({ type: 'start', messageId: 'm-live' });
                sse.push({ type: 'text-start', id: '0' });
                sse.push({ type: 'text-delta', id: '0', delta: 'live continuation after refresh' });

                return new Response(sse.stream, { headers: { 'content-type': 'text/event-stream' } });
            }),
        );

        const ConversationSwitcher = () => {
            const navigate = useNavigate();

            return (
                <>
                    <button type="button" onClick={() => navigate('/agent/agent-1/chat/conversation-8')}>
                        switch away
                    </button>
                    <button type="button" onClick={() => navigate('/agent/agent-1/chat/conversation-7')}>
                        switch back
                    </button>
                </>
            );
        };

        renderWithProviders(
            <>
                <ConversationSwitcher />
                <Routes>
                    <Route path="/agent/:agentId/*" element={<ChatAgent agent={agent} />} />
                </Routes>
            </>,
            { route: '/agent/agent-1/chat/conversation-7' },
        );

        await screen.findByText('question before refresh');
        await screen.findByText('live continuation after refresh');

        expect(screen.getAllByText('live continuation after refresh')).toHaveLength(1);

        await user.click(screen.getByText('switch away'));
        await screen.findByText('other conversation question');

        await user.click(screen.getByText('switch back'));
        await screen.findByText('question before refresh');

        await waitFor(() => expect(attachedConversationIds).toContain('conversation-8'));

        await waitFor(() => expect(attachedConversationIds.filter((id) => id === 'conversation-7')).toHaveLength(2));
        await waitFor(() => expect(screen.getAllByText('live continuation after refresh')).toHaveLength(1));

        expect(screen.getAllByText('question before refresh')).toHaveLength(1);

        attachStreams.forEach((sse) => {
            sse.push({ type: 'text-end', id: '0' });
            sse.push({ type: 'finish' });
            sse.close();
        });
    });

    it('does not replay a finished turn into the hydrated answer when the relay still holds the stream', async () => {
        const attachRequests: string[] = [];
        let resolveProbe: VoidFunction = () => {};
        const probed = new Promise<void>((resolve) => {
            resolveProbe = resolve;
        });

        server.use(
            http.get(apiUrl('/conversations/conversation-7'), () =>
                envelope({
                    _id: 'conversation-7',
                    title: 'Finished conversation',
                    status: 'ready',
                    active_leaf_message_id: 'message-2',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-7/messages'), () =>
                envelope({
                    values: [
                        {
                            _id: 'message-2',
                            conversation_id: 'conversation-7',
                            role: 'assistant',
                            content: [{ type: 'text', text: 'ZEBRAMARKER' }],
                        },
                        {
                            _id: 'message-1',
                            conversation_id: 'conversation-7',
                            role: 'user',
                            content: [{ type: 'text', text: 'say the marker' }],
                        },
                    ],
                    page_info: { page: 1, total_pages: 1, total_count: 2 },
                    head_id: 'message-2',
                }),
            ),
            http.get(apiUrl('/ai/chat/attach'), ({ request }) => {
                attachRequests.push(new URL(request.url).searchParams.get('conversationId') ?? '');
                resolveProbe();

                const replay = createSseStream();

                replay.push({ type: 'start', messageId: 'message-2' });
                replay.push({ type: 'text-start', id: '0' });
                replay.push({ type: 'text-delta', id: '0', delta: 'ZEBRAMARKER' });
                replay.push({ type: 'text-end', id: '0' });
                replay.push({ type: 'finish' });
                replay.close();

                return new Response(replay.stream, { headers: { 'content-type': 'text/event-stream' } });
            }),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await screen.findByText('say the marker');
        await screen.findAllByText('ZEBRAMARKER');

        await Promise.race([
            probed,
            new Promise((resolve) => {
                setTimeout(resolve, 1_000);
            }),
        ]);
        await waitFor(() => expect(document.querySelector('[data-status="running"]')).toBeNull());

        expect(screen.getAllByText('ZEBRAMARKER')).toHaveLength(1);
    });

    it('does not request the attach probe at all for a finished conversation', async () => {
        const attachRequests: string[] = [];

        server.use(
            http.get(apiUrl('/conversations/conversation-7'), () =>
                envelope({
                    _id: 'conversation-7',
                    title: 'Finished conversation',
                    status: 'ready',
                    active_leaf_message_id: 'message-2',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-7/messages'), () =>
                envelope({
                    values: [
                        {
                            _id: 'message-2',
                            conversation_id: 'conversation-7',
                            role: 'assistant',
                            content: [{ type: 'text', text: 'the finished answer' }],
                            metadata: { rating: null },
                        },
                        {
                            _id: 'message-1',
                            conversation_id: 'conversation-7',
                            role: 'user',
                            content: [{ type: 'text', text: 'the finished question' }],
                        },
                    ],
                    page_info: { page: 1, total_pages: 1, total_count: 2 },
                    head_id: 'message-2',
                }),
            ),
            http.get(apiUrl('/ai/chat/attach'), ({ request }) => {
                attachRequests.push(new URL(request.url).searchParams.get('conversationId') ?? '');

                return new Response(null, { status: 204 });
            }),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await screen.findByText('the finished question');
        await screen.findByText('the finished answer');

        await waitFor(() => expect(attachRequests).toHaveLength(0), { timeout: 2_000 });
    });

    it('probes for an in-flight turn when the persisted assistant tail is still pending even though the envelope reads ready', async () => {
        const attachRequests: string[] = [];
        const attach = createSseStream();

        server.use(
            http.get(apiUrl('/conversations/conversation-7'), () =>
                envelope({
                    _id: 'conversation-7',
                    title: 'Stale envelope conversation',
                    status: 'ready',
                    active_leaf_message_id: 'message-2',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-7/messages'), () =>
                envelope({
                    values: [
                        {
                            _id: 'message-2',
                            conversation_id: 'conversation-7',
                            role: 'assistant',
                            content: [],
                            metadata: { pending: true },
                        },
                        {
                            _id: 'message-1',
                            conversation_id: 'conversation-7',
                            role: 'user',
                            content: [{ type: 'text', text: 'question before refresh' }],
                        },
                    ],
                    page_info: { page: 1, total_pages: 1, total_count: 2 },
                    head_id: 'message-2',
                }),
            ),
            http.get(apiUrl('/ai/chat/attach'), ({ request }) => {
                attachRequests.push(new URL(request.url).searchParams.get('conversationId') ?? '');

                return new Response(attach.stream, { headers: { 'content-type': 'text/event-stream' } });
            }),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await screen.findByText('question before refresh');

        await waitFor(() => expect(attachRequests).toEqual(['conversation-7']));

        attach.push({ type: 'start', messageId: 'message-2' });
        attach.push({ type: 'text-start', id: '0' });
        attach.push({ type: 'text-delta', id: '0', delta: 'live continuation after refresh' });
        attach.push({ type: 'text-end', id: '0' });
        attach.push({ type: 'finish' });
        attach.close();

        await screen.findByText('live continuation after refresh');
    });

    it('still probes for an in-flight turn when the envelope reads generating', async () => {
        const attachRequests: string[] = [];
        const attach = createSseStream();

        server.use(
            http.get(apiUrl('/conversations/conversation-7'), () =>
                envelope({
                    _id: 'conversation-7',
                    title: 'Mid-turn conversation',
                    status: 'generating',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-7/messages'), () =>
                envelope({
                    values: [
                        {
                            _id: 'message-1',
                            conversation_id: 'conversation-7',
                            role: 'user',
                            content: [{ type: 'text', text: 'question before refresh' }],
                        },
                    ],
                    page_info: { page: 1, total_pages: 1, total_count: 1 },
                    head_id: 'message-1',
                }),
            ),
            http.get(apiUrl('/ai/chat/attach'), ({ request }) => {
                attachRequests.push(new URL(request.url).searchParams.get('conversationId') ?? '');

                return new Response(attach.stream, { headers: { 'content-type': 'text/event-stream' } });
            }),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await screen.findByText('question before refresh');

        await waitFor(() => expect(attachRequests).toEqual(['conversation-7']));

        attach.push({ type: 'start', messageId: 'm-live' });
        attach.push({ type: 'text-start', id: '0' });
        attach.push({ type: 'text-delta', id: '0', delta: 'live continuation after refresh' });
        attach.push({ type: 'text-end', id: '0' });
        attach.push({ type: 'finish' });
        attach.close();

        await screen.findByText('live continuation after refresh');
    });

    it('surfaces an error instead of a stuck placeholder when the attach probe answers a JSON error on a mid-turn hydration', async () => {
        server.use(
            http.get(apiUrl('/conversations/conversation-7'), () =>
                envelope({
                    _id: 'conversation-7',
                    title: 'Mid-turn conversation',
                    status: 'generating',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-7/messages'), () =>
                envelope({
                    values: [
                        {
                            _id: 'message-1',
                            conversation_id: 'conversation-7',
                            role: 'user',
                            content: [{ type: 'text', text: 'question before refresh' }],
                        },
                    ],
                    page_info: { page: 1, total_pages: 1, total_count: 1 },
                    head_id: 'message-1',
                }),
            ),
            http.get(apiUrl('/ai/chat/attach'), () => httpError(500, 'attach relay exploded')),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await screen.findByText('question before refresh');

        await waitFor(() => expect(screen.getByText(ATTACH_ERROR_PATTERN)).toBeInTheDocument(), { timeout: 10_000 });
    });

    it('surfaces an error when the attach probe answers a JSON 400 for a missing conversation id', async () => {
        server.use(
            http.get(apiUrl('/conversations/conversation-7'), () =>
                envelope({
                    _id: 'conversation-7',
                    title: 'Mid-turn conversation',
                    status: 'generating',
                    user: { email: 'test@example.com' },
                }),
            ),
            http.get(apiUrl('/conversations/conversation-7/messages'), () =>
                envelope({
                    values: [
                        {
                            _id: 'message-1',
                            conversation_id: 'conversation-7',
                            role: 'user',
                            content: [{ type: 'text', text: 'question before refresh' }],
                        },
                    ],
                    page_info: { page: 1, total_pages: 1, total_count: 1 },
                    head_id: 'message-1',
                }),
            ),
            http.get(apiUrl('/ai/chat/attach'), () => httpError(400, 'conversationId is required.')),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await screen.findByText('question before refresh');

        await waitFor(() => expect(screen.getByText(ATTACH_ERROR_PATTERN)).toBeInTheDocument(), { timeout: 10_000 });
    });

    it('surfaces an error when the 409 rescue attach answers a JSON error instead of a stream', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('first question');
        await waitFor(() => expect(chat.streams).toHaveLength(1));

        const first = chat.streams[0];

        first.push({ type: 'data-conversation', data: { conversation_id: 'conv-9', status: 'generating' } });
        streamText(first, 'first answer');
        finishText(first);
        await screen.findByText('first answer');

        server.use(
            http.post(
                apiUrl('/ai/chat'),
                () =>
                    new Response(
                        JSON.stringify({ success: false, value: { in_flight: true, conversation_id: 'conv-9' } }),
                        { status: 409, headers: { 'content-type': 'application/json' } },
                    ),
            ),
            http.get(apiUrl('/ai/chat/attach'), () => httpError(500, 'attach relay exploded')),
        );

        await sendMessage('second question');

        await waitFor(() => expect(screen.getByText(ATTACH_ERROR_PATTERN)).toBeInTheDocument(), { timeout: 10_000 });

        expect(screen.queryByText(/"success"/)).not.toBeInTheDocument();
    });

    it('stops consuming an attached stream once the turn is stopped, so no later delta renders', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('first question');
        await waitFor(() => expect(chat.streams).toHaveLength(1));

        const first = chat.streams[0];

        first.push({ type: 'data-conversation', data: { conversation_id: 'conv-9', status: 'generating' } });
        streamText(first, 'first answer');
        finishText(first);
        await screen.findByText('first answer');

        const rescue = createSseStream();

        server.use(
            http.post(
                apiUrl('/ai/chat'),
                () =>
                    new Response(
                        JSON.stringify({ success: false, value: { in_flight: true, conversation_id: 'conv-9' } }),
                        { status: 409, headers: { 'content-type': 'application/json' } },
                    ),
            ),
            http.get(
                apiUrl('/ai/chat/attach'),
                () => new Response(rescue.stream, { headers: { 'content-type': 'text/event-stream' } }),
            ),
            http.post(apiUrl('/ai/chat/stop'), () => envelope({ stopped: true })),
        );

        await sendMessage('second question');

        rescue.push({ type: 'start', messageId: 'm-attached' });
        rescue.push({ type: 'text-start', id: '0' });
        rescue.push({ type: 'text-delta', id: '0', delta: 'attached continuation' });
        await screen.findByText('attached continuation');

        await user.click(await screen.findByLabelText('Stop generating'));
        await waitFor(() => expect(screen.queryByLabelText('Stop generating')).not.toBeInTheDocument());

        rescue.push({ type: 'text-delta', id: '0', delta: ' TEXTAFTERSTOP' });

        await expect(screen.findByText(/TEXTAFTERSTOP/, {}, { timeout: 1000 })).rejects.toThrow();
        expect(screen.queryByText(ATTACH_ERROR_PATTERN)).not.toBeInTheDocument();
    });

    it('aborts the 409 rescue attach request when the turn is stopped', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('first question');
        await waitFor(() => expect(chat.streams).toHaveLength(1));

        const first = chat.streams[0];

        first.push({ type: 'data-conversation', data: { conversation_id: 'conv-9', status: 'generating' } });
        streamText(first, 'first answer');
        finishText(first);
        await screen.findByText('first answer');

        const rescue = createSseStream();
        let rescueAborted = false;

        server.use(
            http.post(
                apiUrl('/ai/chat'),
                () =>
                    new Response(
                        JSON.stringify({ success: false, value: { in_flight: true, conversation_id: 'conv-9' } }),
                        { status: 409, headers: { 'content-type': 'application/json' } },
                    ),
            ),
            http.get(apiUrl('/ai/chat/attach'), ({ request }) => {
                request.signal.addEventListener('abort', () => {
                    rescueAborted = true;
                });

                return new Response(rescue.stream, { headers: { 'content-type': 'text/event-stream' } });
            }),
            http.post(apiUrl('/ai/chat/stop'), () => envelope({ stopped: true })),
        );

        await sendMessage('second question');

        rescue.push({ type: 'start', messageId: 'm-attached' });
        rescue.push({ type: 'text-start', id: '0' });
        rescue.push({ type: 'text-delta', id: '0', delta: 'attached continuation' });
        await screen.findByText('attached continuation');

        await user.click(await screen.findByLabelText('Stop generating'));

        await waitFor(() => expect(rescueAborted).toBe(true), { timeout: 10_000 });
    });

    const midTurnConversationHandlers = () => [
        http.get(apiUrl('/conversations/conversation-7'), () =>
            envelope({
                _id: 'conversation-7',
                title: 'Mid-turn conversation',
                status: 'generating',
                user: { email: 'test@example.com' },
            }),
        ),
        http.get(apiUrl('/conversations/conversation-7/messages'), () =>
            envelope({
                values: [
                    {
                        _id: 'message-1',
                        conversation_id: 'conversation-7',
                        role: 'user',
                        content: [{ type: 'text', text: 'question before refresh' }],
                    },
                ],
                page_info: { page: 1, total_pages: 1, total_count: 1 },
                head_id: 'message-1',
            }),
        ),
    ];

    const finishedConversationHandlers = () => [
        http.get(apiUrl('/conversations/conversation-8'), () =>
            envelope({
                _id: 'conversation-8',
                title: 'Finished conversation',
                status: 'ready',
                active_leaf_message_id: 'message-9',
                user: { email: 'test@example.com' },
            }),
        ),
        http.get(apiUrl('/conversations/conversation-8/messages'), () =>
            envelope({
                values: [
                    {
                        _id: 'message-9',
                        conversation_id: 'conversation-8',
                        role: 'assistant',
                        content: [{ type: 'text', text: 'other conversation answer' }],
                        metadata: { rating: null },
                    },
                    {
                        _id: 'message-8',
                        conversation_id: 'conversation-8',
                        role: 'user',
                        content: [{ type: 'text', text: 'other conversation question' }],
                    },
                ],
                page_info: { page: 1, total_pages: 1, total_count: 2 },
                head_id: 'message-9',
            }),
        ),
    ];

    const renderWithConversationSwitcher = () => {
        const ConversationSwitcher = () => {
            const navigate = useNavigate();

            return (
                <>
                    <button type="button" onClick={() => navigate('/agent/agent-1/chat/conversation-8')}>
                        switch away
                    </button>
                    <button type="button" onClick={() => navigate('/agent/agent-1/chat/conversation-7')}>
                        switch back
                    </button>
                </>
            );
        };

        return renderWithProviders(
            <>
                <ConversationSwitcher />
                <Routes>
                    <Route path="/agent/:agentId/*" element={<ChatAgent agent={agent} />} />
                </Routes>
            </>,
            { route: '/agent/agent-1/chat/conversation-7' },
        );
    };

    const startLiveAttach = async (attach: SseStream) => {
        await screen.findByText('question before refresh');

        attach.push({ type: 'start', messageId: 'm-live' });
        attach.push({ type: 'text-start', id: '0' });
        attach.push({ type: 'text-delta', id: '0', delta: 'live continuation after refresh' });

        await screen.findByText('live continuation after refresh');
    };

    it('aborts the live attach request when the user stops a resumed turn, so it stops writing', async () => {
        const attach = createSseStream();
        let attachAborted = false;

        server.use(
            // A foreign conversation renders the fork CTA instead of the composer,
            // leaving no stop control.
            http.get(apiUrl('/conversations/conversation-7'), () =>
                envelope({
                    _id: 'conversation-7',
                    title: 'Mid-turn conversation',
                    status: 'generating',
                    user_id: 'user-1',
                    user: { email: 'test@example.com' },
                }),
            ),
            ...midTurnConversationHandlers().slice(1),
            http.post(apiUrl('/ai/chat/stop'), () => envelope({ stopped: true })),
            http.get(apiUrl('/ai/chat/attach'), ({ request }) => {
                request.signal.addEventListener('abort', () => {
                    attachAborted = true;
                });

                return new Response(attach.stream, { headers: { 'content-type': 'text/event-stream' } });
            }),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await startLiveAttach(attach);

        await user.click(await screen.findByLabelText('Stop generating'));

        await waitFor(() => expect(attachAborted).toBe(true), { timeout: 10_000 });

        attach.push({ type: 'text-delta', id: '0', delta: ' TEXTAFTERSTOP' });

        await expect(screen.findByText(/TEXTAFTERSTOP/, {}, { timeout: 1000 })).rejects.toThrow();
        expect(screen.queryByText(ATTACH_ERROR_PATTERN)).not.toBeInTheDocument();
    });

    it('aborts the live attach request when the conversation is switched away', async () => {
        const attach = createSseStream();
        let attachAborted = false;

        server.use(
            ...midTurnConversationHandlers(),
            ...finishedConversationHandlers(),
            http.get(apiUrl('/ai/chat/attach'), ({ request }) => {
                if (new URL(request.url).searchParams.get('conversationId') !== 'conversation-7') {
                    return new Response(null, { status: 204 });
                }

                request.signal.addEventListener('abort', () => {
                    attachAborted = true;
                });

                return new Response(attach.stream, { headers: { 'content-type': 'text/event-stream' } });
            }),
        );

        renderWithConversationSwitcher();
        await startLiveAttach(attach);

        await user.click(screen.getByText('switch away'));
        await screen.findByText('other conversation question');

        await waitFor(() => expect(attachAborted).toBe(true), { timeout: 10_000 });
    });

    it('does not surface an error in the thread when the live attach is aborted by a conversation switch', async () => {
        const attach = createSseStream();
        let attachAborted = false;

        server.use(
            ...midTurnConversationHandlers(),
            ...finishedConversationHandlers(),
            http.get(apiUrl('/ai/chat/attach'), ({ request }) => {
                if (new URL(request.url).searchParams.get('conversationId') !== 'conversation-7') {
                    return new Response(null, { status: 204 });
                }

                request.signal.addEventListener('abort', () => {
                    attachAborted = true;
                });

                return new Response(attach.stream, { headers: { 'content-type': 'text/event-stream' } });
            }),
        );

        renderWithConversationSwitcher();
        await startLiveAttach(attach);

        await user.click(screen.getByText('switch away'));
        await screen.findByText('other conversation question');
        await waitFor(() => expect(attachAborted).toBe(true), { timeout: 10_000 });

        expect(screen.queryByText(ATTACH_ERROR_PATTERN)).not.toBeInTheDocument();

        await user.click(screen.getByText('switch back'));
        await screen.findByText('question before refresh');

        expect(screen.queryByText(ATTACH_ERROR_PATTERN)).not.toBeInTheDocument();
    });

    it('closes the superseded attach before re-attaching, so an attempt bump mid-attach leaves no interleaved content', async () => {
        const attachStreams: SseStream[] = [];
        const events: string[] = [];

        server.use(
            ...midTurnConversationHandlers(),
            http.get(apiUrl('/ai/chat/attach'), ({ request }) => {
                const sse = createSseStream();

                attachStreams.push(sse);

                const label = `attach-${attachStreams.length}`;

                events.push(label);
                request.signal.addEventListener('abort', () => {
                    events.push(`abort-${label}`);
                });

                return new Response(sse.stream, { headers: { 'content-type': 'text/event-stream' } });
            }),
        );

        renderChatAgent('/agent/agent-1/chat/conversation-7');
        await screen.findByText('question before refresh');
        await waitFor(() => expect(attachStreams).toHaveLength(1));

        const doomed = attachStreams[0];

        doomed.push({ type: 'data-turn-attempt', data: { attempt: 1, assistantMessageId: 'm-1' }, transient: true });
        doomed.push({ type: 'start', messageId: 'm-1' });
        doomed.push({ type: 'text-start', id: '0' });
        doomed.push({ type: 'text-delta', id: '0', delta: 'DOOMEDHEAD' });
        await screen.findByText(/DOOMEDHEAD/);

        doomed.push({ type: 'data-turn-attempt', data: { attempt: 2, assistantMessageId: 'm-1' }, transient: true });

        await waitFor(() => expect(attachStreams).toHaveLength(2), { timeout: 10_000 });

        const replay = attachStreams[1];

        replay.push({ type: 'data-turn-attempt', data: { attempt: 2, assistantMessageId: 'm-1' }, transient: true });
        replay.push({ type: 'start', messageId: 'm-1' });
        replay.push({ type: 'text-start', id: '1' });
        replay.push({ type: 'text-delta', id: '1', delta: 'RECOVEREDANSWER' });
        replay.push({ type: 'text-end', id: '1' });
        replay.push({ type: 'finish' });
        replay.close();

        await screen.findByText('RECOVEREDANSWER');

        doomed.push({ type: 'text-delta', id: '0', delta: ' DOOMEDTAIL' });

        await expect(screen.findByText(/DOOMED/, {}, { timeout: 2_000 })).rejects.toThrow();

        expect(screen.getByText('RECOVEREDANSWER')).toBeInTheDocument();

        expect(events).toEqual(['attach-1', 'abort-attach-1', 'attach-2']);
    });
});

describe('notifying about a conversation the reader left', () => {
    const stubNotifications = () => {
        const shown: { title: string; tag?: string }[] = [];

        class StubNotification {
            static permission = 'granted';
            static requestPermission = async () => 'granted';
            onclick: (() => void) | null = null;
            constructor(title: string, options?: NotificationOptions) {
                shown.push({ title, tag: options?.tag });
            }
            close() {}
        }

        // Assigned rather than stubbed: unstubbing globals would also tear out the DOM shims
        // this file installs for every test.
        (window as unknown as { Notification?: unknown }).Notification = StubNotification;

        return shown;
    };

    afterEach(() => {
        delete (window as unknown as { Notification?: unknown }).Notification;
    });

    it('notifies when a turn finishes in a conversation the reader is no longer on', async () => {
        const shown = stubNotifications();
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('first question');
        await waitFor(() => expect(chat.streams).toHaveLength(1));

        const stream = chat.streams[0];

        // This turn pins the route's conversation…
        stream.push({ type: 'data-conversation', data: { conversation_id: 'conv-here', status: 'generating' } });
        streamText(stream, 'answer here');
        await screen.findByText('answer here');

        // …so a different conversation settling is one the reader walked away from. Pushed
        // before the turn finishes, because finishing closes the stream.
        stream.push({ type: 'data-conversation', data: { conversation_id: 'conv-elsewhere', status: 'completed' } });
        finishText(stream);

        await waitFor(() => expect(shown).toHaveLength(1));
        expect(shown[0].tag).toBe('fluentmind-conversation-conv-elsewhere');
    });

    // `awaiting_input` is a paused turn waiting on this reader, not an answer to come back to.
    it('stays quiet when the conversation it left is only paused for input', async () => {
        const shown = stubNotifications();
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('first question');
        await waitFor(() => expect(chat.streams).toHaveLength(1));

        const stream = chat.streams[0];

        stream.push({ type: 'data-conversation', data: { conversation_id: 'conv-here', status: 'generating' } });
        streamText(stream, 'answer here');
        await screen.findByText('answer here');

        stream.push({
            type: 'data-conversation',
            data: { conversation_id: 'conv-elsewhere', status: 'awaiting_input' },
        });
        finishText(stream);

        await waitFor(() => expect(screen.getByText('answer here')).toBeInTheDocument());
        expect(shown).toHaveLength(0);
    });

    it('stays quiet for the conversation the reader is looking at', async () => {
        const shown = stubNotifications();
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('first question');
        await waitFor(() => expect(chat.streams).toHaveLength(1));

        const stream = chat.streams[0];

        stream.push({ type: 'data-conversation', data: { conversation_id: 'conv-here', status: 'generating' } });
        streamText(stream, 'answer here');
        await screen.findByText('answer here');

        stream.push({ type: 'data-conversation', data: { conversation_id: 'conv-here', status: 'completed' } });
        finishText(stream);

        await waitFor(() => expect(screen.getByText('answer here')).toBeInTheDocument());
        expect(shown).toHaveLength(0);
    });
});
