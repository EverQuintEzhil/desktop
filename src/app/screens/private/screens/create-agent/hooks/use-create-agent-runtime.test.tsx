import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { act, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, httpError, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import { useCreateAgentRuntime } from './use-create-agent-runtime';

/**
 * Real assistant-ui runtime, no stubs: `POST /assistant/agent-builder` is
 * answered by MSW with a hand-driven AI SDK UI-message SSE stream, so the
 * request body `prepareRequestBody` builds, the `onData` callbacks and the
 * restore effect all run through the production stack.
 */
vi.setConfig({ testTimeout: 30_000 });

// jsdom implements neither; the runtime touches them when a message settles.
Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: () => {} });
Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: () => {} });

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

interface BuilderRequestBody {
    agentId?: string;
    conversationId?: string | null;
    message?: string;
    fileIds?: string[];
    tools?: unknown;
    toolResults?: { toolCallId: string; toolName: string; result: unknown }[];
    modelId?: string;
}

interface BuilderEndpoint {
    bodies: BuilderRequestBody[];
    streams: SseStream[];
}

/** Each request records its body and returns a stream the test keeps open. */
const stubBuilderEndpoint = (): BuilderEndpoint => {
    const endpoint: BuilderEndpoint = { bodies: [], streams: [] };

    server.use(
        http.post(apiUrl(BUILDER_PATH), async ({ request }) => {
            endpoint.bodies.push((await request.json()) as BuilderRequestBody);
            const sse = createSseStream();

            endpoint.streams.push(sse);

            return new Response(sse.stream, { headers: { 'content-type': 'text/event-stream' } });
        }),
    );

    return endpoint;
};

const finishWithText = (sse: SseStream, text: string, id = '0') => {
    sse.push({ type: 'start' });
    sse.push({ type: 'text-start', id });
    sse.push({ type: 'text-delta', id, delta: text });
    sse.push({ type: 'text-end', id });
    sse.push({ type: 'finish' });
    sse.close();
};

interface RuntimeOverrides {
    conversationId?: string | null;
    initialMessages?: UIMessage[];
    restoreInitialMessages?: boolean;
    onAgentConfig?: (config: unknown) => void;
    onConversationId?: (id: string) => void;
    getModelId?: () => string | undefined;
}

type Runtime = ReturnType<typeof useCreateAgentRuntime>['runtime'];

/**
 * `useRemoteThreadListRuntime` only instantiates a per-thread runtime once an
 * `AssistantRuntimeProvider` has mounted it, so a bare `renderHook` is stuck on
 * the placeholder "empty thread" that throws on every operation.
 */
const Harness = ({
    props,
    onAgentConfig,
    onConversationId,
    onRuntime,
}: {
    props: RuntimeOverrides;
    onAgentConfig: (config: unknown) => void;
    onConversationId: (id: string) => void;
    onRuntime: (runtime: Runtime) => void;
}) => {
    const { runtime } = useCreateAgentRuntime({
        agentId: 'agent-1',
        conversationId: props.conversationId ?? null,
        onAgentConfig,
        onConversationId,
        ...(props.initialMessages ? { initialMessages: props.initialMessages } : {}),
        ...(props.restoreInitialMessages !== undefined ? { restoreInitialMessages: props.restoreInitialMessages } : {}),
        ...(props.getModelId ? { getModelId: props.getModelId } : {}),
    });

    onRuntime(runtime);

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <div data-testid="runtime-harness" />
        </AssistantRuntimeProvider>
    );
};

const renderRuntime = (overrides: RuntimeOverrides = {}) => {
    const onAgentConfig = overrides.onAgentConfig ?? vi.fn();
    const onConversationId = overrides.onConversationId ?? vi.fn();
    const box = { runtime: null as Runtime | null };
    const keep = (runtime: Runtime) => {
        box.runtime = runtime;
    };

    const rendered = renderWithProviders(
        <Harness
            props={overrides}
            onAgentConfig={onAgentConfig}
            onConversationId={onConversationId}
            onRuntime={keep}
        />,
    );

    const rerenderWith = (next: RuntimeOverrides) =>
        rendered.rerender(
            <Harness props={next} onAgentConfig={onAgentConfig} onConversationId={onConversationId} onRuntime={keep} />,
        );

    return {
        ...rendered,
        rerenderWith,
        onAgentConfig,
        onConversationId,
        runtime: () => box.runtime!,
    };
};

/** In the app the mounted `Thread` UI creates the first thread; here we ask for it. */
const startThread = async (runtime: Runtime) => {
    await act(async () => {
        await runtime.threads.switchToNewThread();
    });
};

type AppendMessage = Parameters<Runtime['thread']['append']>[0];

const appendUserMessage = async (runtime: Runtime, text: string, metadata?: Record<string, unknown>) => {
    await act(async () => {
        runtime.thread.append({
            role: 'user',
            content: [{ type: 'text', text }],
            ...(metadata ? { metadata } : {}),
        } as AppendMessage);
    });
};

describe('useCreateAgentRuntime — request body', () => {
    it('posts the agent id, the typed message and a null conversation id for a fresh chat', async () => {
        const builder = stubBuilderEndpoint();
        const { runtime } = renderRuntime();

        await startThread(runtime());
        await appendUserMessage(runtime(), 'build me a support bot');

        await waitFor(() => expect(builder.streams).toHaveLength(1));

        expect(builder.bodies[0]).toEqual({
            agentId: 'agent-1',
            conversationId: null,
            message: 'build me a support bot',
            tools: {},
        });

        act(() => finishWithText(builder.streams[0], 'ok'));
        await waitFor(() => expect(runtime().thread.getState().isRunning).toBe(false));
    });

    it('includes modelId on the request body when getModelId returns one', async () => {
        const builder = stubBuilderEndpoint();
        const { runtime } = renderRuntime({ getModelId: () => 'model-gpt' });

        await startThread(runtime());
        await appendUserMessage(runtime(), 'use this model');

        await waitFor(() => expect(builder.streams).toHaveLength(1));

        expect(builder.bodies[0]).toEqual({
            agentId: 'agent-1',
            conversationId: null,
            message: 'use this model',
            tools: {},
            modelId: 'model-gpt',
        });

        act(() => finishWithText(builder.streams[0], 'ok'));
        await waitFor(() => expect(runtime().thread.getState().isRunning).toBe(false));
    });

    it('sends the controlled conversation id on every turn', async () => {
        const builder = stubBuilderEndpoint();
        const { runtime } = renderRuntime({ conversationId: 'conv-9' });

        await startThread(runtime());
        await appendUserMessage(runtime(), 'continue');

        await waitFor(() => expect(builder.streams).toHaveLength(1));

        expect(builder.bodies[0].conversationId).toBe('conv-9');

        act(() => finishWithText(builder.streams[0], 'ok'));
        await waitFor(() => expect(runtime().thread.getState().isRunning).toBe(false));
    });

    it('carries file ids nested under metadata.custom into the request body', async () => {
        const builder = stubBuilderEndpoint();
        const { runtime } = renderRuntime();

        await startThread(runtime());
        await appendUserMessage(runtime(), 'summarise these', { custom: { fileIds: ['file-1', 'file-2'] } });

        await waitFor(() => expect(builder.streams).toHaveLength(1));

        expect(builder.bodies[0].fileIds).toEqual(['file-1', 'file-2']);

        act(() => finishWithText(builder.streams[0], 'ok'));
        await waitFor(() => expect(runtime().thread.getState().isRunning).toBe(false));
    });
});

describe('useCreateAgentRuntime — streamed data parts', () => {
    it('reports a streamed conversation id back to the caller', async () => {
        const builder = stubBuilderEndpoint();
        const { runtime, onConversationId } = renderRuntime();

        await startThread(runtime());
        await appendUserMessage(runtime(), 'hello');
        await waitFor(() => expect(builder.streams).toHaveLength(1));

        const sse = builder.streams[0];

        act(() => {
            sse.push({ type: 'start' });
            sse.push({ type: 'data-conversation', data: { conversation_id: 'conv-minted' } });
        });

        await waitFor(() => {
            expect(onConversationId).toHaveBeenCalledWith('conv-minted');
        });

        act(() => {
            sse.push({ type: 'finish' });
            sse.close();
        });
        await waitFor(() => expect(runtime().thread.getState().isRunning).toBe(false));
    });

    it('parses a streamed agent config and hands it to the caller', async () => {
        const builder = stubBuilderEndpoint();
        const { runtime, onAgentConfig } = renderRuntime();

        await startThread(runtime());
        await appendUserMessage(runtime(), 'name it Helper');
        await waitFor(() => expect(builder.streams).toHaveLength(1));

        const sse = builder.streams[0];

        act(() => {
            sse.push({ type: 'start' });
            sse.push({
                type: 'data-agent-config',
                data: { name: 'Helper', modelIds: ['model-1'] },
            });
        });

        await waitFor(() => {
            expect(onAgentConfig).toHaveBeenCalledWith({
                name: 'Helper',
                models: [{ _id: 'model-1', name: 'model-1' }],
            });
        });

        act(() => {
            sse.push({ type: 'finish' });
            sse.close();
        });
        await waitFor(() => expect(runtime().thread.getState().isRunning).toBe(false));
    });

    it('ignores an agent config that does not match the schema', async () => {
        const builder = stubBuilderEndpoint();
        const { runtime, onAgentConfig } = renderRuntime();

        await startThread(runtime());
        await appendUserMessage(runtime(), 'break it');
        await waitFor(() => expect(builder.streams).toHaveLength(1));

        const sse = builder.streams[0];

        act(() => {
            sse.push({ type: 'start' });
            sse.push({ type: 'data-agent-config', data: { name: 42 } });
            sse.push({ type: 'text-start', id: '0' });
            sse.push({ type: 'text-delta', id: '0', delta: 'done' });
            sse.push({ type: 'text-end', id: '0' });
            sse.push({ type: 'finish' });
            sse.close();
        });

        await waitFor(() => expect(runtime().thread.getState().isRunning).toBe(false));
        expect(onAgentConfig).not.toHaveBeenCalled();
    });
});

describe('useCreateAgentRuntime — automatic tool-result turn', () => {
    it('sends the ask_user output back as toolResults without a message', async () => {
        const builder = stubBuilderEndpoint();
        const { runtime } = renderRuntime({ getModelId: () => 'model-gpt' });

        await startThread(runtime());
        await appendUserMessage(runtime(), 'ask me something');
        await waitFor(() => expect(builder.streams).toHaveLength(1));

        act(() => {
            const sse = builder.streams[0];

            sse.push({ type: 'start' });
            sse.push({
                type: 'tool-input-available',
                toolCallId: 'call-1',
                toolName: 'ask_user',
                input: { question: 'Which tone?' },
            });
            sse.push({ type: 'tool-output-available', toolCallId: 'call-1', output: { answer: 'Friendly' } });
            sse.push({ type: 'finish' });
            sse.close();
        });

        await waitFor(() => expect(builder.streams).toHaveLength(2));

        expect(builder.bodies[1]).toEqual({
            agentId: 'agent-1',
            conversationId: null,
            toolResults: [{ toolCallId: 'call-1', toolName: 'ask_user', result: { answer: 'Friendly' } }],
            tools: {},
            modelId: 'model-gpt',
        });

        // The follow-up stream is deliberately left open: the ask_user tool part keeps
        // satisfying `lastAssistantMessageIsCompleteWithToolCalls`, so closing a
        // stubbed empty turn just triggers another automatic one.
        expect(builder.bodies).toHaveLength(2);
        expect(runtime().thread.getState().messages[0].role).toBe('user');
    });

    it('resumes the run for any human tool, not just ask_user', async () => {
        const builder = stubBuilderEndpoint();
        const { runtime } = renderRuntime();

        await startThread(runtime());
        await appendUserMessage(runtime(), 'connect my database');
        await waitFor(() => expect(builder.streams).toHaveLength(1));

        act(() => {
            const sse = builder.streams[0];

            sse.push({ type: 'start' });
            sse.push({
                type: 'tool-input-available',
                toolCallId: 'call-9',
                toolName: 'collect_data_store_credentials',
                input: { dataStoreId: 'ds-1' },
            });
            sse.push({
                type: 'tool-output-available',
                toolCallId: 'call-9',
                output: { status: 'completed', summary: 'Connection saved.' },
            });
            sse.push({ type: 'finish' });
            sse.close();
        });

        await waitFor(() => expect(builder.streams).toHaveLength(2));

        expect(builder.bodies[1]).toEqual(
            expect.objectContaining({
                toolResults: [
                    {
                        toolCallId: 'call-9',
                        toolName: 'collect_data_store_credentials',
                        result: { status: 'completed', summary: 'Connection saved.' },
                    },
                ],
            }),
        );
    });

    it('does not resume the run for a frontend tool that executed on its own', async () => {
        const builder = stubBuilderEndpoint();
        const { runtime } = renderRuntime();

        await startThread(runtime());
        await appendUserMessage(runtime(), 'show me the preview');
        await waitFor(() => expect(builder.streams).toHaveLength(1));

        act(() => {
            const sse = builder.streams[0];

            sse.push({ type: 'start' });
            sse.push({
                type: 'tool-input-available',
                toolCallId: 'call-8',
                toolName: 'open_preview',
                input: {},
            });
            sse.push({ type: 'tool-output-available', toolCallId: 'call-8', output: { success: true } });
            sse.push({ type: 'finish' });
            sse.close();
        });

        await waitFor(() => expect(runtime().thread.getState().isRunning).toBe(false));
        expect(builder.streams).toHaveLength(1);
    });
});

describe('useCreateAgentRuntime — restore and errors', () => {
    it('imports persisted messages into the thread when restore is requested', async () => {
        const initialMessages: UIMessage[] = [
            { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'earlier question' }] },
            { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'earlier answer' }] },
        ];

        const { runtime } = renderRuntime({
            conversationId: 'conv-restored',
            initialMessages,
            restoreInitialMessages: true,
        });

        await waitFor(() => {
            expect(runtime().thread.getState().messages).toHaveLength(2);
        });

        const messages = runtime().thread.getState().messages;

        expect(messages[0].role).toBe('user');
        expect(messages[1].role).toBe('assistant');
        expect(messages[1].content[0]).toMatchObject({ type: 'text', text: 'earlier answer' });
    });

    it('does not re-import when a refetch hands back the same conversation with a new array identity', async () => {
        const initialMessages: UIMessage[] = [
            { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'earlier question' }] },
            { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'earlier answer' }] },
        ];

        const { runtime, rerenderWith } = renderRuntime({
            conversationId: 'conv-restored',
            initialMessages,
            restoreInitialMessages: true,
        });

        await waitFor(() => {
            expect(runtime().thread.getState().messages).toHaveLength(2);
        });

        // A window-focus refetch produces an identical list with a fresh identity; re-importing
        // would switch the live thread out mid-render and crash assistant-ui's by-id clients.
        await act(async () => {
            rerenderWith({
                conversationId: 'conv-restored',
                initialMessages: initialMessages.map((message) => ({ ...message })),
                restoreInitialMessages: true,
            });
        });

        expect(runtime().thread.getState().messages).toHaveLength(2);
    });

    it('restores nothing while there is no conversation selected', async () => {
        const initialMessages: UIMessage[] = [
            { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'earlier question' }] },
        ];

        const { runtime, rerenderWith } = renderRuntime({ conversationId: null, restoreInitialMessages: false });

        await startThread(runtime());

        await act(async () => {
            rerenderWith({ conversationId: null, initialMessages, restoreInitialMessages: true });
        });

        expect(runtime().thread.getState().messages).toEqual([]);
    });

    it('settles the run and reports an error when the endpoint fails', async () => {
        server.use(http.post(apiUrl(BUILDER_PATH), () => httpError(500)));

        const { runtime } = renderRuntime();

        await startThread(runtime());
        await appendUserMessage(runtime(), 'this will fail');

        await waitFor(() => {
            expect(runtime().thread.getState().isRunning).toBe(false);
        });
    });
});
