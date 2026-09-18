import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installGalleryDomShims, installRichTextDomShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { installWidthAwareMatchMedia } from '@/test/match-media';
import { apiUrl, envelope, pagedEnvelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { AppAgentType, ChatAgentType } from '@/types/admin';

import ChatAgent from '../chat-agent';

import AppAgent from './app-agent';

/**
 * Real-runtime coverage of the browser-executed `navigate_app` tool: nothing in
 * the assistant-ui stack is stubbed, so the tool schema really rides the request,
 * the browser really executes the call, and the result really resumes the turn
 * over MSW.
 */
vi.setConfig({ testTimeout: 30_000 });

installGalleryDomShims();
installRichTextDomShims();
installScrollIntoViewShim();
// The assistant panel docks beside the app only from 1364px up; these tests are about the docked layout.
installWidthAwareMatchMedia(1600);

Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: () => {} });

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

const COMPOSER_SELECTOR = '.chat-editor__content[contenteditable="true"]';
const FORM_PREFILL_KEY = 'scout-app.form.prefill';

const appAgent = {
    _id: 'app-agent-1',
    slug: 'app-agent-1',
    identifier: 'app-agent-identifier-1',
    name: 'Scout',
    type: 'chat',
    apps: [],
    tools: [],
    uiConfig: {
        componentType: 'app',
        type: 'chat',
        app: { assistantDefaultOpen: true, assistantSide: 'right' },
        home: { title: 'Scout', search: { placeholder: 'Ask anything' } },
    },
} as unknown as AppAgentType;

const chatAgent = {
    ...appAgent,
    uiConfig: { ...appAgent.uiConfig, componentType: 'chat', app: undefined },
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
    clientTools?: Record<string, { description: string; parameters: unknown }>;
    genuiResults?: Array<{ toolCallId: string; output: unknown }>;
}

interface ChatEndpoint {
    bodies: ChatRequestBody[];
    streams: SseStream[];
}

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

const user = userEvent.setup({ delay: null });

const sendMessage = async (text: string) => {
    await waitFor(() => expect(document.querySelector(COMPOSER_SELECTOR)).toBeTruthy());
    const composer = document.querySelector<HTMLElement>(COMPOSER_SELECTOR);

    if (!composer) throw new Error('composer not mounted');

    await user.click(composer);
    await user.paste(text);
    await user.keyboard('{Enter}');
};

/** Streams a `navigate_app` call the browser must execute, then ends the step. */
const callNavigateApp = (sse: SseStream, toolCallId: string, input: Record<string, unknown>) => {
    sse.push({ type: 'start' });
    sse.push({ type: 'start-step' });
    sse.push({ type: 'tool-input-start', toolCallId, toolName: 'navigate_app' });
    sse.push({ type: 'tool-input-available', toolCallId, toolName: 'navigate_app', input });
    sse.push({ type: 'finish-step' });
    sse.push({ type: 'finish' });
    sse.close();
};

const renderAppAgent = (agent: AppAgentType = appAgent) =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/:agentId/*" element={<AppAgent agent={agent} />} />
        </Routes>,
        { route: '/agent/app-agent-1' },
    );

const renderChatAgent = () =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/:agentId/*" element={<ChatAgent agent={chatAgent} />} />
        </Routes>,
        { route: '/agent/app-agent-1/chat' },
    );

beforeEach(() => {
    window.location.hash = '';
    sessionStorage.clear();
    server.use(
        http.get(apiUrl('/users/me'), () => envelope({})),
        http.get(apiUrl('/conversations'), () => pagedEnvelope([])),
        http.get(apiUrl('/mcpservers'), () => pagedEnvelope([])),
        http.get(apiUrl('/skills'), () => pagedEnvelope([])),
        http.get(apiUrl('/routines'), () => pagedEnvelope([])),
        http.get(apiUrl('/routines/runs'), () => pagedEnvelope([])),
        http.get(apiUrl('/agents/:agentId/preferences'), () => envelope(null)),
        http.get(apiUrl('/agents/:agentId'), () => envelope(appAgent)),
        http.get(apiUrl('/ai/chat/attach'), () => new Response(null, { status: 204 })),
    );
});

describe('AppAgent client tools — request', () => {
    it('sends the mounted browser tool schema as `clientTools`', async () => {
        const chat = stubChatEndpoint();

        renderAppAgent();
        await sendMessage('open the pipeline');

        await waitFor(() => expect(chat.bodies).toHaveLength(1));
        // Order is the serializer's, not the contract's — assert the set.
        expect(Object.keys(chat.bodies[0].clientTools ?? {}).sort()).toEqual([
            'get_app_view',
            'navigate_app',
            'set_app_view',
        ]);
        expect(chat.bodies[0].clientTools?.navigate_app.parameters).toBeDefined();
        expect(chat.bodies[0].clientTools?.set_app_view.parameters).toBeDefined();
        expect(chat.bodies[0].clientTools?.get_app_view.parameters).toBeDefined();
    });

    it('sends no `clientTools` key at all for a chat agent with no toolkit', async () => {
        const chat = stubChatEndpoint();

        renderChatAgent();
        await sendMessage('hello');

        await waitFor(() => expect(chat.bodies).toHaveLength(1));
        expect(chat.bodies[0]).not.toHaveProperty('clientTools');
    });
});

describe('AppAgent client tools — resume', () => {
    it('routes the app pane and resumes the turn with the result on `genuiResults`', async () => {
        const chat = stubChatEndpoint();

        renderAppAgent();
        await sendMessage('open the pipeline');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        callNavigateApp(chat.streams[0], 'call-1', { hash: '#/pipeline?market=Healthcare' });

        await waitFor(() => expect(chat.bodies).toHaveLength(2));
        expect(chat.bodies[1].genuiResults).toEqual([{ toolCallId: 'call-1', output: { ok: true, actions: [] } }]);
        expect(window.location.hash).toBe('#/pipeline?market=Healthcare');
    });

    it('stringifies a non-string prefill instead of failing validation', async () => {
        const chat = stubChatEndpoint();

        renderAppAgent();
        await sendMessage('start a pursuit');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        callNavigateApp(chat.streams[0], 'call-2', {
            hash: '#/new',
            prefill: { name: 'Acme HQ', budget: 50000, active: true },
        });

        await waitFor(() => expect(chat.bodies).toHaveLength(2));
        expect(chat.bodies[1].genuiResults).toEqual([{ toolCallId: 'call-2', output: { ok: true, actions: [] } }]);
        expect(JSON.parse(sessionStorage.getItem(FORM_PREFILL_KEY) ?? 'null')).toEqual({
            name: 'Acme HQ',
            budget: '50000',
            active: 'true',
        });
    });

    it('drops a nested or null prefill value instead of stalling the turn', async () => {
        const chat = stubChatEndpoint();

        renderAppAgent();
        await sendMessage('start a pursuit');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        callNavigateApp(chat.streams[0], 'call-3', {
            hash: '#/new',
            prefill: { name: 'Acme HQ', contact: { email: 'a@b.c' }, client: null },
        });

        await waitFor(() => expect(chat.bodies).toHaveLength(2));
        expect(chat.bodies[1].genuiResults).toEqual([{ toolCallId: 'call-3', output: { ok: true, actions: [] } }]);
        expect(JSON.parse(sessionStorage.getItem(FORM_PREFILL_KEY) ?? 'null')).toEqual({ name: 'Acme HQ' });
    });

    it('refuses a bad hash, keeps a pending prefill and still resumes the turn', async () => {
        const chat = stubChatEndpoint();

        sessionStorage.setItem(FORM_PREFILL_KEY, JSON.stringify({ name: 'Acme HQ' }));

        renderAppAgent();
        await sendMessage('open pipeline');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        callNavigateApp(chat.streams[0], 'call-3', { hash: 'pipeline' });

        await waitFor(() => expect(chat.bodies).toHaveLength(2));
        expect(chat.bodies[1].genuiResults).toHaveLength(1);
        expect(chat.bodies[1].genuiResults?.[0]).toMatchObject({
            toolCallId: 'call-3',
            output: { ok: false },
        });
        expect(window.location.hash).toBe('');
        expect(sessionStorage.getItem(FORM_PREFILL_KEY)).toBe(JSON.stringify({ name: 'Acme HQ' }));
    });

    it('drops a stale prefill once a navigation without one is accepted', async () => {
        const chat = stubChatEndpoint();

        sessionStorage.setItem(FORM_PREFILL_KEY, JSON.stringify({ name: 'Acme HQ' }));

        renderAppAgent();
        await sendMessage('open pipeline');

        await waitFor(() => expect(chat.streams).toHaveLength(1));
        callNavigateApp(chat.streams[0], 'call-4', { hash: '#/pipeline' });

        await waitFor(() => expect(chat.bodies).toHaveLength(2));
        expect(sessionStorage.getItem(FORM_PREFILL_KEY)).toBeNull();
    });
});
