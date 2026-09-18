import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import PromptDetail from './prompt-detail';

vi.mock('@/components/instructions-editor', () => ({
    InstructionsEditor: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
        <textarea
            aria-label="Instructions editor"
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
        />
    ),
}));

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
    relatedPrompts: ['prompt-0'],
    creator: { _id: 'user-1', name: { first: 'Test', last: 'User' } },
    updatedAt: '2026-03-04T10:00:00.000Z',
    ...overrides,
});

const LocationProbe = () => {
    const location = useLocation();

    return <div>{`at ${location.pathname}`}</div>;
};

const renderPromptDetail = (route = '/agent/test-agent/prompt-library/prompt-1') =>
    renderWithProviders(
        <>
            <LocationProbe />
            <Routes>
                <Route path="/agent/:agentSlug/prompt-library/:promptId" element={<PromptDetail agent={agent} />} />
                <Route path="/agent/:agentSlug/prompt-library" element={<div>Prompt library screen</div>} />
                <Route path="/agent/:agentSlug" element={<div>Chat home screen</div>} />
            </Routes>
        </>,
        { route },
    );

describe('PromptDetail', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
    });

    it('shows the loading state while the prompt is in flight', async () => {
        server.use(
            respond('get', '/prompts/prompt-1', async () => {
                await delay('infinite');

                return envelope(rawPrompt());
            }),
        );

        renderPromptDetail();

        expect(await screen.findByText('Loading Prompt Details')).toBeInTheDocument();
    });

    it('renders the prompt with its creator, published badge and content', async () => {
        server.use(respond('get', '/prompts/prompt-1', () => envelope(rawPrompt())));

        renderPromptDetail();

        expect(await screen.findByRole('heading', { name: 'Weekly summary' })).toBeInTheDocument();
        expect(screen.getByText('by Test User')).toBeInTheDocument();
        expect(screen.getByText('Published')).toBeInTheDocument();
        expect(screen.getByText('Summarises the week')).toBeInTheDocument();
        expect(screen.getAllByText('Summarise my week in five bullets').length).toBeGreaterThan(0);
        expect(screen.getByRole('link', { name: 'All prompts' })).toHaveAttribute(
            'href',
            '/agent/test-agent/prompt-library',
        );
    });

    it('marks an unpublished private prompt as Draft and Private', async () => {
        server.use(
            respond('get', '/prompts/prompt-1', () =>
                envelope(
                    rawPrompt({
                        isPublished: false,
                        isPrivate: true,
                    }),
                ),
            ),
        );

        renderPromptDetail();

        expect(await screen.findByText('Draft')).toBeInTheDocument();
        expect(screen.getByText('Private')).toBeInTheDocument();
        expect(screen.queryByText('Published')).not.toBeInTheDocument();
    });

    it('shows the failure state for a 500', async () => {
        server.use(respond('get', '/prompts/prompt-1', () => httpError(500)));

        renderPromptDetail();

        expect(await screen.findByText('Failed to Load Prompt')).toBeInTheDocument();
    });

    it('shows the failure state when the API answers success:false', async () => {
        server.use(respond('get', '/prompts/prompt-1', () => failureEnvelope('There is no such prompt')));

        renderPromptDetail();

        expect(await screen.findByText('Failed to Load Prompt')).toBeInTheDocument();
    });

    it('refetches the prompt when Retry is clicked', async () => {
        let attempts = 0;

        server.use(
            respond('get', '/prompts/prompt-1', () => {
                attempts += 1;

                return attempts === 1 ? httpError(500) : envelope(rawPrompt());
            }),
        );

        renderPromptDetail();

        await screen.findByText('Failed to Load Prompt');
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(await screen.findByRole('heading', { name: 'Weekly summary' })).toBeInTheDocument();
        expect(attempts).toBe(2);
    });

    it('offers Edit to the creator of the prompt', async () => {
        server.use(respond('get', '/prompts/prompt-1', () => envelope(rawPrompt())));

        renderPromptDetail();

        expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clone' })).toBeInTheDocument();
    });

    it('hides Edit but keeps Clone for a prompt owned by someone else', async () => {
        server.use(
            respond('get', '/prompts/prompt-1', () =>
                envelope(
                    rawPrompt({
                        creator: { _id: 'user-2', name: { first: 'Ada', last: 'Lovelace' } },
                    }),
                ),
            ),
        );

        renderPromptDetail();

        expect(await screen.findByRole('button', { name: 'Clone' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
        expect(screen.getByText('by Ada Lovelace')).toBeInTheDocument();
    });

    it('copies the prompt body to the clipboard and confirms it', async () => {
        server.use(respond('get', '/prompts/prompt-1', () => envelope(rawPrompt())));

        renderPromptDetail();

        await userEvent.click(await screen.findByRole('button', { name: 'Copy' }));

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Summarise my week in five bullets');
        expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });

    it('navigates to the chat home when Use Prompt is clicked', async () => {
        server.use(respond('get', '/prompts/prompt-1', () => envelope(rawPrompt())));

        renderPromptDetail();

        await userEvent.click(await screen.findByRole('button', { name: 'Use Prompt' }));

        expect(await screen.findByText('Chat home screen')).toBeInTheDocument();
    });

    it('shows the raw prompt on the Source tab', async () => {
        server.use(
            respond('get', '/prompts/prompt-1', () =>
                envelope(
                    rawPrompt({
                        prompt: '# Heading\n\nBody text',
                    }),
                ),
            ),
        );

        renderPromptDetail();

        await screen.findByRole('heading', { name: 'Weekly summary' });
        await userEvent.click(screen.getByRole('tab', { name: 'Source' }));

        expect(await screen.findByText(/# Heading/)).toBeInTheDocument();
    });

    it('saves an edit with the whole prompt payload in the request body', async () => {
        let putBody: unknown;

        server.use(
            respond('get', '/prompts/prompt-1', () => envelope(rawPrompt())),
            http.put(apiUrl('/prompts/prompt-1'), async ({ request }) => {
                putBody = await request.json();

                return envelope(rawPrompt({ name: 'Renamed prompt' }));
            }),
        );

        renderPromptDetail();

        await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));

        const nameInput = await screen.findByRole('textbox', { name: 'Prompt name' });

        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Renamed prompt');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(putBody).toEqual({
                name: 'Renamed prompt',
                description: 'Summarises the week',
                prompt: 'Summarise my week in five bullets',
                isPrivate: false,
                isPublished: true,
            });
        });

        expect(await screen.findByRole('heading', { name: 'Renamed prompt' })).toBeInTheDocument();
    });

    it('leaves edit mode without saving when Back is used', async () => {
        server.use(respond('get', '/prompts/prompt-1', () => envelope(rawPrompt())));

        renderPromptDetail();

        await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
        await userEvent.clear(await screen.findByRole('textbox', { name: 'Prompt name' }));
        await userEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(await screen.findByRole('heading', { name: 'Weekly summary' })).toBeInTheDocument();
    });

    it('clones the prompt, appending the source id to relatedPrompts', async () => {
        let postBody: unknown;

        server.use(
            respond('get', '/prompts/prompt-1', () => envelope(rawPrompt())),
            http.post(apiUrl('/prompts'), async ({ request }) => {
                postBody = await request.json();

                return envelope({ _id: 'prompt-2' });
            }),
        );

        renderPromptDetail();

        await userEvent.click(await screen.findByRole('button', { name: 'Clone' }));

        const dialog = await screen.findByRole('alertdialog');

        expect(within(dialog).getByText('Clone Confirmation')).toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await userEvent.click(await screen.findByRole('button', { name: 'Save copy' }));

        await waitFor(() => {
            expect(postBody).toEqual({
                name: 'Weekly summary',
                description: 'Summarises the week',
                prompt: 'Summarise my week in five bullets',
                isPrivate: false,
                isPublished: true,
                agentIds: [],
                aimodelIds: [],
                relatedPrompts: ['prompt-0', 'prompt-1'],
            });
        });

        expect(await screen.findByText('at /agent/test-agent/prompt-library/prompt-2')).toBeInTheDocument();
    });
});
