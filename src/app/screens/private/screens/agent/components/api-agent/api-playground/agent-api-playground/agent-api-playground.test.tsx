import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { apiAgent } from '@/test/fixtures/agents';
import { apiUrl, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ApiAgentType } from '@/types/admin';
import type { FieldType } from '@/types/ui';

import AgentAPIPlayground from './agent-api-playground';

// The multiselect control is a Radix popover wrapping a cmdk list.
installPointerCaptureShims();
installScrollIntoViewShim();

const CHAT_PATH = '/ai/chat';

const field = (overrides: Partial<FieldType> & Pick<FieldType, 'name' | 'label' | 'inputType'>): FieldType => ({
    values: [],
    ...overrides,
});

const agentWith = (formSpec: FieldType[]): ApiAgentType =>
    ({
        ...apiAgent,
        identifier: 'com.fluentmind.api-agent',
        uiConfig: { componentType: 'api', type: 'jsonviewer', formSpec },
    }) as unknown as ApiAgentType;

const renderPlayground = (formSpec: FieldType[]) =>
    renderWithProviders(<AgentAPIPlayground agent={agentWith(formSpec)} />);

/** `/ai/chat` goes through `uiAxios` directly, so it is not enveloped. */
const stubChat = (body: unknown = { answer: 'done' }) => {
    server.use(respond('post', CHAT_PATH, () => Response.json(body)));
};

describe('AgentAPIPlayground', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts on the empty response state', () => {
        renderPlayground([]);

        expect(screen.getByText('Response')).toBeInTheDocument();
        expect(screen.getByText(/Upload your files using the panel on the left/)).toBeInTheDocument();
    });

    it('renders a labelled control for each text-ish field in the spec', () => {
        renderPlayground([
            field({ name: 'topic', label: 'Topic', inputType: 'text' }),
            field({ name: 'count', label: 'Count', inputType: 'number' }),
            field({ name: 'notes', label: 'Notes', inputType: 'textbox' }),
        ]);

        expect(screen.getByText('Topic')).toBeInTheDocument();
        expect(screen.getByText('Count')).toBeInTheDocument();
        expect(screen.getByText('Notes')).toBeInTheDocument();
    });

    it('renders one checkbox per configured value', () => {
        renderPlayground([
            field({
                name: 'formats',
                label: 'Formats',
                inputType: 'checkbox',
                values: ['pdf', 'docx'],
            }),
        ]);

        expect(screen.getByLabelText('pdf')).toBeInTheDocument();
        expect(screen.getByLabelText('docx')).toBeInTheDocument();
    });

    it('renders one radio per configured value', () => {
        renderPlayground([
            field({
                name: 'tone',
                label: 'Tone',
                inputType: 'radio',
                values: ['formal', 'casual'],
            }),
        ]);

        expect(screen.getAllByRole('radio')).toHaveLength(2);
    });

    it('posts the typed values to the chat endpoint under the agent identifier', async () => {
        const user = userEvent.setup();
        let body: Record<string, unknown> = {};

        server.use(
            http.post(apiUrl(CHAT_PATH), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return Response.json({ answer: 'done' });
            }),
        );

        renderPlayground([field({ name: 'topic', label: 'Topic', inputType: 'text' })]);

        await user.type(screen.getByRole('textbox'), 'launch plan');
        await user.click(screen.getByRole('button', { name: /Send/ }));

        await waitFor(() => {
            expect(body.agentIdOrIdentifier).toBe('com.fluentmind.api-agent');
        });
        expect(body.conversationId).toBeNull();
        expect(body.arguments).toEqual({ topic: 'launch plan' });
        expect(body.options).toEqual({ stream: false });
        expect(body).not.toHaveProperty('fileIds');
    });

    it('flattens a select to its value', async () => {
        const user = userEvent.setup();
        let body: Record<string, unknown> = {};

        server.use(
            http.post(apiUrl(CHAT_PATH), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return Response.json({ answer: 'done' });
            }),
        );

        renderPlayground([
            field({
                name: 'tone',
                label: 'Tone',
                inputType: 'select',
                values: ['formal', 'casual'],
            }),
        ]);

        await user.click(screen.getByRole('button', { name: /Send/ }));

        await waitFor(() => {
            expect(body.arguments).toBeDefined();
        });
        expect((body.arguments as Record<string, unknown>).tone).toBe('');
    });

    it('flattens a multiselect to an array of values', async () => {
        const user = userEvent.setup();
        let body: Record<string, unknown> = {};

        server.use(
            http.post(apiUrl(CHAT_PATH), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return Response.json({ answer: 'done' });
            }),
        );

        renderPlayground([
            field({
                name: 'tags',
                label: 'Tags',
                inputType: 'multiselect',
                values: ['alpha', 'beta'],
            }),
        ]);

        await user.click(screen.getByRole('combobox'));
        await user.click(await screen.findByRole('option', { name: 'alpha' }));
        await user.click(screen.getByRole('button', { name: /Send/ }));

        await waitFor(() => {
            expect(body.arguments).toBeDefined();
        });
        expect((body.arguments as Record<string, unknown>).tags).toEqual(['alpha']);
    });

    it('shows the response and flags it a success', async () => {
        const user = userEvent.setup();

        stubChat({ answer: '42' });
        renderPlayground([]);

        await user.click(screen.getByRole('button', { name: /Send/ }));

        expect(await screen.findByText('Success')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    });

    it('renders the API error message and status when the request fails', async () => {
        const user = userEvent.setup();

        server.use(respond('post', CHAT_PATH, () => Response.json({ message: 'Agent exploded' }, { status: 503 })));
        renderPlayground([]);

        await user.click(screen.getByRole('button', { name: /Send/ }));

        expect(await screen.findByText('Error')).toBeInTheDocument();
    });

    it('re-sends the same payload from the Retry button', async () => {
        const user = userEvent.setup();
        let calls = 0;

        server.use(
            http.post(apiUrl(CHAT_PATH), () => {
                calls += 1;

                return Response.json({ answer: 'done' });
            }),
        );

        renderPlayground([]);

        await user.click(screen.getByRole('button', { name: /Send/ }));
        await screen.findByRole('button', { name: /Retry/ });
        await user.click(screen.getByRole('button', { name: /Retry/ }));

        await waitFor(() => {
            expect(calls).toBe(2);
        });
    });

    it('downloads the response as a JSON file', async () => {
        const user = userEvent.setup();
        const clicked: string[] = [];
        const realCreate = document.createElement.bind(document);

        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const element = realCreate(tag) as HTMLElement;

            if (tag === 'a') {
                element.click = () => clicked.push((element as HTMLAnchorElement).getAttribute('download') ?? '');
            }

            return element;
        });

        stubChat({ answer: '42' });
        renderPlayground([]);

        await user.click(screen.getByRole('button', { name: /Send/ }));
        await user.click(await screen.findByRole('button', { name: /Download/ }));

        expect(clicked).toHaveLength(1);
        expect(clicked[0]).toMatch(/^api-response-.*\.json$/);
    });

    it('blocks the send while a required file field has no upload', async () => {
        const user = userEvent.setup();
        let calls = 0;

        server.use(
            http.post(apiUrl(CHAT_PATH), () => {
                calls += 1;

                return Response.json({ answer: 'done' });
            }),
        );

        renderPlayground([
            field({
                name: 'doc',
                label: 'Document',
                inputType: 'filesupload',
                required: true,
            }),
        ]);

        const send = screen.getByRole('button', { name: /Send/ });

        expect(send).toBeDisabled();

        await user.click(send);

        expect(calls).toBe(0);
    });

    it('leaves the send enabled when the file field is optional', () => {
        renderPlayground([field({ name: 'doc', label: 'Document', inputType: 'filesupload' })]);

        expect(screen.getByRole('button', { name: /Send/ })).toBeEnabled();
    });
});
