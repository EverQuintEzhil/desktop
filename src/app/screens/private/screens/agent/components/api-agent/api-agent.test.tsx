import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { apiAgent } from '@/test/fixtures/agents';
import { apiUrl, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ApiAgentType } from '@/types/admin';
import type { FieldType } from '@/types/ui';

import APIAgent from './api-agent';

// The multiselect control is a Radix popover wrapping a cmdk list.
installPointerCaptureShims();
installScrollIntoViewShim();

// Heavy, network-backed header widget with nothing to do with this screen.
vi.mock('@/components/avatar-menu', () => ({
    default: () => <div>Avatar menu</div>,
}));

const CHAT_PATH = '/ai/chat';

const field = (overrides: Partial<FieldType> & Pick<FieldType, 'name' | 'label' | 'inputType'>): FieldType => ({
    values: [],
    ...overrides,
});

interface AgentOverrides {
    formSpec?: FieldType[];
    type?: string;
    responsePath?: string;
}

const agentWith = ({ formSpec = [], type = 'jsonviewer', responsePath }: AgentOverrides = {}): ApiAgentType =>
    ({
        ...apiAgent,
        identifier: 'com.fluentmind.api-agent',
        uiConfig: {
            componentType: 'api',
            type,
            formSpec,
            ...(responsePath ? { responsePath } : {}),
        },
    }) as unknown as ApiAgentType;

const renderAgent = (agent: ApiAgentType = agentWith()) =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/:agentSlug" element={<APIAgent agent={agent} />} />
            <Route path="/" element={<div>Agents home</div>} />
        </Routes>,
        { route: '/agent/api-agent' },
    );

/** `/ai/chat` goes through `uiAxios` directly, so it is not enveloped. */
const stubChat = (body: unknown = { answer: 'done' }) => {
    server.use(respond('post', CHAT_PATH, () => Response.json(body)));
};

/** Records every chat request body and answers with `body`. */
const recordChat = (bodies: Record<string, unknown>[], body: unknown = { answer: 'done' }) => {
    server.use(
        http.post(apiUrl(CHAT_PATH), async ({ request }) => {
            bodies.push((await request.json()) as Record<string, unknown>);

            return Response.json(body);
        }),
    );
};

/** Captures the `download` attribute of every anchor the screen clicks. */
const captureDownloads = (): string[] => {
    const clicked: string[] = [];
    const realCreate = document.createElement.bind(document);

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const element = realCreate(tag) as HTMLElement;

        if (tag === 'a') {
            element.click = () => clicked.push((element as HTMLAnchorElement).getAttribute('download') ?? '');
        }

        return element;
    });

    return clicked;
};

const send = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /Send/ }));
};

describe('APIAgent', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the agent name and the empty response state', () => {
        renderAgent();

        expect(screen.getByText('API Agent')).toBeInTheDocument();
        expect(screen.getByText('Response')).toBeInTheDocument();
        expect(screen.getByText(/Upload your files using the panel on the left/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
    });

    it('goes back to the agents home from the header', async () => {
        const user = userEvent.setup();

        renderAgent();

        await user.click(screen.getByRole('button', { name: 'Go back' }));

        expect(await screen.findByText('Agents home')).toBeInTheDocument();
    });

    it('renders a control for every field in the spec', () => {
        renderAgent(
            agentWith({
                formSpec: [
                    field({ name: 'topic', label: 'Topic', inputType: 'text' }),
                    field({ name: 'count', label: 'Count', inputType: 'number' }),
                    field({ name: 'notes', label: 'Notes', inputType: 'textbox' }),
                    field({
                        name: 'formats',
                        label: 'Formats',
                        inputType: 'checkbox',
                        values: ['pdf', 'docx'],
                    }),
                    field({
                        name: 'tone',
                        label: 'Tone',
                        inputType: 'radio',
                        values: ['formal', 'casual'],
                    }),
                ],
            }),
        );

        expect(screen.getByText('Topic')).toBeInTheDocument();
        expect(screen.getByText('Count')).toBeInTheDocument();
        expect(screen.getByText('Notes')).toBeInTheDocument();
        expect(screen.getByLabelText('pdf')).toBeInTheDocument();
        expect(screen.getAllByRole('radio')).toHaveLength(2);
    });

    it('posts the typed values under the agent identifier with no fileIds', async () => {
        const user = userEvent.setup();
        const bodies: Record<string, unknown>[] = [];

        recordChat(bodies);
        renderAgent(agentWith({ formSpec: [field({ name: 'topic', label: 'Topic', inputType: 'text' })] }));

        await user.type(screen.getByRole('textbox'), 'launch plan');
        await send(user);

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].agentIdOrIdentifier).toBe('com.fluentmind.api-agent');
        expect(bodies[0].conversationId).toBeNull();
        expect(bodies[0].arguments).toEqual({ topic: 'launch plan' });
        expect(bodies[0].options).toEqual({ stream: false });
        expect(bodies[0]).not.toHaveProperty('fileIds');
    });

    it('flattens a select to its bare value and a multiselect to an array', async () => {
        const user = userEvent.setup();
        const bodies: Record<string, unknown>[] = [];

        recordChat(bodies);
        renderAgent(
            agentWith({
                formSpec: [
                    field({
                        name: 'tone',
                        label: 'Tone',
                        inputType: 'select',
                        values: ['formal', 'casual'],
                    }),
                    field({
                        name: 'tags',
                        label: 'Tags',
                        inputType: 'multiselect',
                        values: ['alpha', 'beta'],
                    }),
                ],
            }),
        );

        await user.click(screen.getAllByRole('combobox')[1]);
        await user.click(await screen.findByRole('option', { name: 'alpha' }));
        await send(user);

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].arguments).toEqual({ tone: '', tags: ['alpha'] });
    });

    it('shows a processing state while the request is in flight', async () => {
        const user = userEvent.setup();

        server.use(http.post(apiUrl(CHAT_PATH), () => new Promise<Response>(() => {})));
        renderAgent();

        await send(user);

        expect(await screen.findByText('Processing request...')).toBeInTheDocument();
        expect(screen.getByText('Our AI agent is analyzing your files')).toBeInTheDocument();
    });

    it('flags a completed request a success and renders its payload', async () => {
        const user = userEvent.setup();

        stubChat({ answer: '42' });
        renderAgent();

        await send(user);

        expect(await screen.findByText('Success')).toBeInTheDocument();
        expect(screen.getByText(/"answer": "42"/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Download/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: /Retry/ })).toBeEnabled();
    });

    it('flags a 503 an error and reports its message and status', async () => {
        const user = userEvent.setup();

        server.use(respond('post', CHAT_PATH, () => Response.json({ message: 'Agent exploded' }, { status: 503 })));
        renderAgent();

        await send(user);

        expect(await screen.findByText('Error')).toBeInTheDocument();
        expect(screen.getByText(/"error": "Agent exploded"/)).toBeInTheDocument();
        expect(screen.getByText(/"status": 503/)).toBeInTheDocument();
    });

    it('falls back to a generic failure when the transport gives no message', async () => {
        const user = userEvent.setup();

        server.use(http.post(apiUrl(CHAT_PATH), () => Response.error()));
        renderAgent();

        await send(user);

        expect(await screen.findByText('Error')).toBeInTheDocument();
        expect(screen.getByText(/"error": "Failed to send request"/)).toBeInTheDocument();
        expect(screen.getByText(/"status": 500/)).toBeInTheDocument();
    });

    it('recovers on Retry after a failed request', async () => {
        const user = userEvent.setup();
        let calls = 0;

        server.use(
            http.post(apiUrl(CHAT_PATH), () => {
                calls += 1;

                return calls === 1
                    ? Response.json({ message: 'Agent exploded' }, { status: 503 })
                    : Response.json({ answer: 'recovered' });
            }),
        );

        renderAgent();

        await send(user);
        expect(await screen.findByText('Error')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Retry/ }));

        expect(await screen.findByText('Success')).toBeInTheDocument();
        expect(screen.getByText(/"answer": "recovered"/)).toBeInTheDocument();
        expect(calls).toBe(2);
    });

    it('reads the configured response path out of the payload', async () => {
        const user = userEvent.setup();

        stubChat({ data: { result: { summary: 'nested answer' } } });
        renderAgent(agentWith({ type: 'plaintextviewer', responsePath: '$data.data.result.summary' }));

        await send(user);

        expect(await screen.findByText('nested answer')).toBeInTheDocument();
    });

    it('downloads the response with the extension its viewer type implies', async () => {
        const cases: [string, RegExp][] = [
            ['jsonviewer', /^api-response-.*\.json$/],
            ['markdownviewer', /^api-response-.*\.md$/],
            ['htmlviewer', /^api-response-.*\.html$/],
            ['plaintextviewer', /^api-response-.*\.txt$/],
        ];

        for (const [type, pattern] of cases) {
            const user = userEvent.setup();
            const clicked = captureDownloads();

            stubChat({ answer: '42' });

            const view = renderAgent(agentWith({ type }));

            await send(user);
            await user.click(await screen.findByRole('button', { name: /Download/ }));

            expect(clicked).toHaveLength(1);
            expect(clicked[0]).toMatch(pattern);

            vi.restoreAllMocks();
            view.unmount();
        }
    });

    it('parses a JSON-string response before writing the downloaded file', async () => {
        const user = userEvent.setup();
        const written: string[] = [];
        const realCreate = document.createElement.bind(document);

        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const element = realCreate(tag) as HTMLElement;

            if (tag === 'a') {
                element.click = () =>
                    written.push(decodeURIComponent((element as HTMLAnchorElement).getAttribute('href') ?? ''));
            }

            return element;
        });

        stubChat({ payload: '{"nested":true}' });
        renderAgent(agentWith({ responsePath: '$data.payload' }));

        await send(user);
        await user.click(await screen.findByRole('button', { name: /Download/ }));

        expect(written).toHaveLength(1);
        expect(written[0]).toContain('"nested": true');
    });

    it('keeps Send disabled and sends nothing while a required file field is empty', async () => {
        const user = userEvent.setup();
        const bodies: Record<string, unknown>[] = [];

        recordChat(bodies);
        renderAgent(
            agentWith({
                formSpec: [
                    field({
                        name: 'doc',
                        label: 'Document',
                        inputType: 'filesupload',
                        required: true,
                    }),
                    field({ name: 'topic', label: 'Topic', inputType: 'text' }),
                ],
            }),
        );

        const sendButton = screen.getByRole('button', { name: /Send/ });

        expect(sendButton).toBeDisabled();

        await user.click(sendButton);

        expect(bodies).toEqual([]);
    });

    it('leaves Send enabled when the file field is optional', async () => {
        const user = userEvent.setup();
        const bodies: Record<string, unknown>[] = [];

        recordChat(bodies);
        renderAgent(
            agentWith({
                formSpec: [field({ name: 'doc', label: 'Document', inputType: 'filesupload' })],
            }),
        );

        expect(screen.getByRole('button', { name: /Send/ })).toBeEnabled();

        await send(user);

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].arguments).toEqual({});
    });
});
