import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import PromptLibrary from './prompt-library';

const agent = {
    _id: 'agent-1',
    slug: 'test-agent',
    name: 'Test Agent',
    uiConfig: {},
} as unknown as ChatAgentType;

const rawPrompt = (overrides: Record<string, unknown> = {}) => ({
    _id: 'prompt-1',
    name: 'Weekly summary',
    description: 'Summarises the week',
    prompt: 'Summarise my week in five bullets',
    isPublished: true,
    isPrivate: false,
    creator: { _id: 'user-1', name: { first: 'Test', last: 'User' } },
    ...overrides,
});

/** Reads the router state `Use Prompt` hands to the chat home route. */
const ChatHomeProbe = () => {
    const location = useLocation();
    const state = location.state as { prompt?: string } | null;

    return <div>{`Chat home with: ${state?.prompt ?? 'nothing'}`}</div>;
};

const renderPromptLibrary = (route = '/agent/test-agent/prompt-library') =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/:agentSlug/prompt-library/*" element={<PromptLibrary agent={agent} />} />
            <Route path="/agent/:agentSlug" element={<ChatHomeProbe />} />
        </Routes>,
        { route },
    );

describe('PromptLibrary', () => {
    it('prefixes the title with the agent it belongs to', async () => {
        server.use(respond('get', '/prompts', () => pagedEnvelope([])));

        renderPromptLibrary();

        expect(await screen.findByRole('heading', { name: 'Prompt Library' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Agent: Test Agent' })).toHaveAttribute('href', '/agent/test-agent');
    });

    it('shows skeleton placeholders while the first page is in flight', async () => {
        server.use(
            respond('get', '/prompts', async () => {
                await delay('infinite');

                return pagedEnvelope([]);
            }),
        );

        const { container } = renderPromptLibrary();

        await waitFor(() => {
            expect(container.querySelectorAll('.prompt-item').length).toBe(3);
        });
        expect(screen.queryByText('No prompts yet')).not.toBeInTheDocument();
    });

    it('shows the empty state when the library has no prompts', async () => {
        server.use(respond('get', '/prompts', () => pagedEnvelope([])));

        renderPromptLibrary();

        expect(await screen.findByText('No prompts yet')).toBeInTheDocument();
    });

    it('lists prompts with creator, draft marker and a link to the detail page', async () => {
        server.use(
            respond('get', '/prompts', () =>
                pagedEnvelope([
                    rawPrompt(),
                    rawPrompt({
                        _id: 'prompt-2',
                        name: 'Draft idea',
                        description: 'Not published yet',
                        isPublished: false,
                        creator: { _id: 'user-2', name: { first: 'Ada', last: 'Lovelace' } },
                    }),
                ]),
            ),
        );

        renderPromptLibrary();

        expect(await screen.findByRole('heading', { name: 'Weekly summary' })).toBeInTheDocument();
        expect(screen.getByText('Summarises the week')).toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.getByText('Draft')).toBeInTheDocument();

        expect(screen.getByRole('link', { name: /Weekly summary/ })).toHaveAttribute(
            'href',
            '/agent/test-agent/prompt-library/prompt-1',
        );
    });

    it('requests only the first page, scoped to the agent and to all prompts', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/prompts'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([rawPrompt()], { page: 0, totalPages: 4, totalCount: 200 });
            }),
        );

        renderPromptLibrary();

        await screen.findByRole('heading', { name: 'Weekly summary' });

        expect(requests).toHaveLength(1);
        expect(requests[0].searchParams.get('page')).toBe('0');
        expect(requests[0].searchParams.get('size')).toBe('50');
        expect(requests[0].searchParams.get('agentIds')).toBe('agent-1');
        expect(requests[0].searchParams.get('mineOnly')).toBe('false');
        expect(requests[0].searchParams.get('search')).toBeNull();
    });

    it('shows the error branch when the prompts request fails with a 500', async () => {
        server.use(respond('get', '/prompts', () => httpError(500)));

        renderPromptLibrary();

        expect(await screen.findByText('Error Occurred')).toBeInTheDocument();
    });

    it('shows the error branch when the API answers success:false', async () => {
        server.use(respond('get', '/prompts', () => failureEnvelope('Prompts are unavailable')));

        renderPromptLibrary();

        expect(await screen.findByText('Error Occurred')).toBeInTheDocument();
    });

    it('refetches with mineOnly=true when the My filter is selected', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/prompts'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([rawPrompt()]);
            }),
        );

        renderPromptLibrary();

        await screen.findByRole('heading', { name: 'Weekly summary' });
        await userEvent.click(screen.getByRole('radio', { name: 'My' }));

        await waitFor(() => {
            expect(requests[requests.length - 1].searchParams.get('mineOnly')).toBe('true');
        });
    });

    it('passes the debounced search term to the prompts request', async () => {
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/prompts'), ({ request }) => {
                requests.push(new URL(request.url));

                return pagedEnvelope([]);
            }),
        );

        renderPromptLibrary();

        await screen.findByText('No prompts yet');
        await userEvent.type(screen.getByPlaceholderText('Search prompts...'), 'weekly');

        await waitFor(
            () => {
                expect(requests[requests.length - 1].searchParams.get('search')).toBe('weekly');
            },
            { timeout: 3000 },
        );

        expect(await screen.findByText('No prompts found')).toBeInTheDocument();
    });

    it('navigates to the chat home carrying the prompt text when Use Prompt is clicked', async () => {
        server.use(respond('get', '/prompts', () => pagedEnvelope([rawPrompt()])));

        renderPromptLibrary();

        await userEvent.click(await screen.findByRole('button', { name: /Use Prompt/ }));

        expect(await screen.findByText('Chat home with: Summarise my week in five bullets')).toBeInTheDocument();
    });

    it('creates a prompt from the side sheet and shows it in the list', async () => {
        let postBody: unknown;

        server.use(
            respond('get', '/prompts', () => pagedEnvelope([])),
            http.post(apiUrl('/prompts'), async ({ request }) => {
                postBody = await request.json();

                return envelope(rawPrompt({ _id: 'prompt-new', name: 'Standup notes' }));
            }),
        );

        renderPromptLibrary();

        await screen.findByText('No prompts yet');
        await userEvent.click(screen.getByRole('button', { name: /Create a New Prompt/ }));

        const sheet = await screen.findByRole('dialog');

        expect(within(sheet).getByText('Create a New Prompt')).toBeInTheDocument();

        await userEvent.type(within(sheet).getByRole('textbox'), 'Standup notes');
        await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(postBody).toEqual({
                name: 'Standup notes',
                agentIds: ['agent-1'],
                isPrivate: true,
                isPublished: false,
            });
        });

        expect(await screen.findByRole('heading', { name: 'Standup notes' })).toBeInTheDocument();
    });
});
