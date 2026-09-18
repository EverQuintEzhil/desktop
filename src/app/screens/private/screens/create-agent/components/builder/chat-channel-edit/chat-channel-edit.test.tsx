import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentUiType } from '@/types/ui';

import { ChatChannelEdit } from './chat-channel-edit';

const SAVE_DEBOUNCE_MS = 600;

const uiConfig = (home: Partial<ChatAgentUiType['home']> = {}): ChatAgentUiType =>
    ({
        componentType: 'chat',
        type: 'chat',
        home: { title: 'Your agent', ...home },
    }) as ChatAgentUiType;

const renderEditor = (initialUiConfig?: ChatAgentUiType, initialDescription = '') => {
    const onSaveUiConfig = vi.fn().mockResolvedValue(undefined);
    const onSaveDescription = vi.fn().mockResolvedValue(undefined);
    const onBack = vi.fn();

    const view = renderWithProviders(
        <ChatChannelEdit
            agentName="Support bot"
            initialUiConfig={initialUiConfig}
            initialDescription={initialDescription}
            onSaveUiConfig={onSaveUiConfig}
            onSaveDescription={onSaveDescription}
            onBack={onBack}
        />,
    );

    return {
        ...view,
        onSaveUiConfig,
        onSaveDescription,
        onBack,
    };
};

const flushDebounce = () =>
    act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    });

const lastUiConfig = (mock: ReturnType<typeof vi.fn>): ChatAgentUiType =>
    mock.mock.calls[mock.mock.calls.length - 1][0] as ChatAgentUiType;

describe('ChatChannelEdit', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders every configuration section', () => {
        renderEditor(uiConfig());

        expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Composer' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Responses' })).toBeInTheDocument();
        expect(screen.getByLabelText('Home title')).toHaveValue('Your agent');
    });

    it('shows the agent name in the header and goes back', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onBack } = renderEditor(uiConfig());

        expect(screen.getByRole('heading', { name: 'Support bot' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Back to configuration' }));

        expect(onBack).toHaveBeenCalled();
    });

    it('debounces a home-title edit into one save', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onSaveUiConfig } = renderEditor(uiConfig());

        await user.clear(screen.getByLabelText('Home title'));
        await user.type(screen.getByLabelText('Home title'), 'Hello there');

        expect(onSaveUiConfig).not.toHaveBeenCalled();

        flushDebounce();

        await waitFor(() => {
            expect(onSaveUiConfig).toHaveBeenCalledTimes(1);
        });
        expect(lastUiConfig(onSaveUiConfig).home.title).toBe('Hello there');
    });

    it('debounces the description and reports the character count', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onSaveDescription } = renderEditor(uiConfig(), '');

        await user.type(screen.getByLabelText('Description'), 'Handles billing');

        expect(screen.getByText('15/200')).toBeInTheDocument();

        flushDebounce();

        await waitFor(() => {
            expect(onSaveDescription).toHaveBeenCalledWith('Handles billing');
        });
    });

    it('adds, edits and removes starter prompts', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onSaveUiConfig } = renderEditor(uiConfig({ questions: [] }));

        await user.click(screen.getByRole('button', { name: /Add starter/ }));

        const input = screen.getByPlaceholderText('Write a starter prompt');

        await user.type(input, 'What can you do?');
        flushDebounce();

        await waitFor(() => {
            expect(lastUiConfig(onSaveUiConfig).home.questions).toEqual(['What can you do?']);
        });

        await user.click(screen.getByRole('button', { name: 'Remove starter 1' }));
        flushDebounce();

        await waitFor(() => {
            expect(lastUiConfig(onSaveUiConfig).home.questions).toEqual([]);
        });
    });

    it('caps the starter list and hides the add button at the limit', () => {
        renderEditor(uiConfig({ questions: ['a', 'b', 'c', 'd', 'e', 'f'] }));

        expect(screen.getAllByPlaceholderText('Write a starter prompt')).toHaveLength(6);
        expect(screen.queryByRole('button', { name: /Add starter/ })).not.toBeInTheDocument();
    });

    it('reorders starters by drag and drop', async () => {
        const { onSaveUiConfig } = renderEditor(uiConfig({ questions: ['first', 'second', 'third'] }));
        const rows = screen
            .getAllByPlaceholderText('Write a starter prompt')
            .map((input) => input.closest('[draggable]') as HTMLElement);

        fireEvent.dragStart(rows[0]);
        fireEvent.dragOver(rows[2]);
        fireEvent.drop(rows[2]);
        flushDebounce();

        await waitFor(() => {
            expect(lastUiConfig(onSaveUiConfig).home.questions).toEqual(['second', 'third', 'first']);
        });
    });

    it('edits the composer placeholder', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onSaveUiConfig } = renderEditor(uiConfig());

        await user.type(screen.getByLabelText('Composer placeholder'), 'Ask me');
        flushDebounce();

        await waitFor(() => {
            expect(lastUiConfig(onSaveUiConfig).home.search?.placeholder).toBe('Ask me');
        });
    });

    it('toggles file uploads and incognito', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onSaveUiConfig } = renderEditor(uiConfig());

        await user.click(screen.getByLabelText('Allow file uploads'));
        flushDebounce();

        await waitFor(() => {
            expect(lastUiConfig(onSaveUiConfig).home.search?.files).toBe(true);
        });

        await user.click(screen.getByLabelText('Allow incognito mode'));
        flushDebounce();

        await waitFor(() => {
            expect(lastUiConfig(onSaveUiConfig).home.search?.isIncognitoEnabled).toBe(true);
        });
    });

    it('reveals the default-on switch only once web search is shown', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onSaveUiConfig } = renderEditor(uiConfig());

        expect(screen.queryByLabelText('Web search enabled by default')).not.toBeInTheDocument();

        await user.click(screen.getByLabelText('Show web search'));

        const defaultToggle = await screen.findByLabelText('Web search enabled by default');

        await user.click(defaultToggle);
        flushDebounce();

        await waitFor(() => {
            expect(lastUiConfig(onSaveUiConfig).home.search?.isWebSearchEnabled).toBe(true);
        });
    });

    it('seeds a default follow-up count when related questions are turned on', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onSaveUiConfig } = renderEditor(uiConfig());

        await user.click(screen.getByLabelText('Generate related questions'));
        flushDebounce();

        await waitFor(() => {
            expect(lastUiConfig(onSaveUiConfig).home.search?.relatedQuestionsCount).toBe(3);
        });
        expect(screen.getByLabelText('How many')).toHaveValue(3);
    });

    it('clamps the follow-up count into its allowed range', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onSaveUiConfig } = renderEditor(
            uiConfig({
                search: { isRelatedQuestionsEnabled: true, relatedQuestionsCount: 3 },
            } as Partial<ChatAgentUiType['home']>),
        );

        const input = screen.getByLabelText('How many');

        await user.clear(input);
        await user.type(input, '9');
        flushDebounce();

        await waitFor(() => {
            expect(lastUiConfig(onSaveUiConfig).home.search?.relatedQuestionsCount).toBe(5);
        });
    });

    it('toggles the small-screen preview pane', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        renderEditor(uiConfig());

        const toggle = screen.getByRole('button', { name: 'Show live preview' });

        expect(toggle).toHaveAttribute('aria-pressed', 'false');

        await user.click(toggle);

        expect(await screen.findByRole('button', { name: 'Hide live preview' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('adopts a fresh initial config while the local copy is untouched', async () => {
        const { rerender, onSaveUiConfig } = renderEditor(uiConfig({ title: 'Original' }));

        expect(screen.getByLabelText('Home title')).toHaveValue('Original');

        rerender(
            <ChatChannelEdit
                agentName="Support bot"
                initialUiConfig={uiConfig({ title: 'Reloaded' })}
                initialDescription=""
                onSaveUiConfig={onSaveUiConfig}
                onSaveDescription={vi.fn()}
                onBack={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(screen.getByLabelText('Home title')).toHaveValue('Reloaded');
        });
    });

    it('flushes a pending save when unmounted mid-edit', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onSaveUiConfig, unmount } = renderEditor(uiConfig());

        await user.type(screen.getByLabelText('Home title'), '!');

        expect(onSaveUiConfig).not.toHaveBeenCalled();

        unmount();

        expect(onSaveUiConfig).toHaveBeenCalledTimes(1);
    });
});
