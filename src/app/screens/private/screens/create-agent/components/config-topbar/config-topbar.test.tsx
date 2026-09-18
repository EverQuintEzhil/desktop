import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { envelope, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentUiType } from '@/types/ui';

import ConfigTopbar from './config-topbar';

const uiConfig = (overrides: Partial<ChatAgentUiType> = {}): ChatAgentUiType =>
    ({
        componentType: 'chat',
        type: 'chat',
        models: [],
        home: {
            title: 'Your agent',
            startPage: 'chat',
            search: {
                placeholder: 'Ask anything…',
                files: true,
                showWebSearch: false,
                isWebSearchEnabled: false,
                isRelatedQuestionsEnabled: false,
                isIncognitoEnabled: false,
            },
            questions: [],
        },
        promptLibrary: { enabled: false, filters: { aimodelIds: [] } },
        spaces: { enabled: false },
        ...overrides,
    }) as ChatAgentUiType;

type Props = Parameters<typeof ConfigTopbar>[0];

/** Renders the current path so navigation is assertable. */
const LocationProbe = () => <span>{useLocation().pathname}</span>;

const renderTopbar = (overrides: Partial<Props> = {}) => {
    const handlers = {
        onPublish: vi.fn().mockResolvedValue(undefined),
        onDiscardPending: vi.fn().mockResolvedValue(undefined),
        onDiscardModel: vi.fn(),
        onDiscardAppearance: vi.fn(),
        onPreview: vi.fn(),
        onDelete: vi.fn(),
        onViewAdvancedSettings: vi.fn(),
    };

    const view = renderWithProviders(
        <>
            <LocationProbe />
            <Routes>
                <Route
                    path="/agent-builder/:id"
                    element={
                        <ConfigTopbar
                            agentName="Support bot"
                            isLoading={false}
                            isSaving={false}
                            isSaved={false}
                            {...handlers}
                            {...overrides}
                        />
                    }
                />
            </Routes>
        </>,
        { route: '/agent-builder/agent-1' },
    );

    return { ...view, ...handlers };
};

describe('ConfigTopbar', () => {
    it('shows no status chip when idle', () => {
        renderTopbar();

        expect(screen.queryByRole('heading', { name: 'Support bot' })).not.toBeInTheDocument();
        expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
        expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    });

    it.each([
        [{ isLoading: true }, 'Loading…'],
        [{ isSaving: true }, 'Saving…'],
        [{ isSaved: true }, 'Saved'],
    ])('renders the %o status', (props, label) => {
        renderTopbar(props);

        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('prefers the loading status over saving and saved', () => {
        renderTopbar({ isLoading: true, isSaving: true, isSaved: true });

        expect(screen.getByText('Loading…')).toBeInTheDocument();
        expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
    });

    it('shows when the agent was created and last updated', () => {
        const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        renderTopbar({ createdAt: daysAgo(19), updatedAt: daysAgo(2) });

        expect(screen.getByText('Created 19 days ago')).toBeInTheDocument();
        expect(screen.getByText('Updated 2 days ago')).toBeInTheDocument();
    });

    it('holds the timestamps back while the agent is still loading', () => {
        renderTopbar({ isLoading: true, createdAt: new Date().toISOString() });

        expect(screen.queryByText(/Created/)).not.toBeInTheDocument();
    });

    it('hides the pending-changes controls when nothing is pending', () => {
        renderTopbar();

        expect(screen.queryByRole('button', { name: /Pending change/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Update/ })).not.toBeInTheDocument();
    });

    it('counts instruction changes and shows the added/removed line badge', async () => {
        const user = userEvent.setup();

        renderTopbar({
            hasPendingChanges: true,
            originalInstructions: 'one\ntwo\n',
            currentInstructions: 'one\ntwo\nthree\n',
        });

        await user.click(screen.getByRole('button', { name: '1 Pending change' }));

        const item = await screen.findByRole('button', { name: /Instructions/ });

        expect(within(item).getByText('+1')).toBeInTheDocument();
        expect(within(item).getByText('-0')).toBeInTheDocument();
    });

    it('pluralises the pending count across several kinds of change', async () => {
        renderTopbar({
            hasPendingChanges: true,
            originalInstructions: 'one\n',
            currentInstructions: 'two\n',
            hasPendingUiConfig: true,
            getPublishedUiConfig: () => uiConfig({ models: [{ name: 'gpt-5', modelId: 'm1' }] }),
            getCurrentUiConfig: () =>
                uiConfig({
                    models: [{ name: 'claude-5', modelId: 'm2' }],
                    home: { ...uiConfig().home, title: 'Renamed' },
                } as Partial<ChatAgentUiType>),
        });

        expect(screen.getByRole('button', { name: '3 Pending changes' })).toBeInTheDocument();
    });

    it('opens the instruction diff and discards from it', async () => {
        const user = userEvent.setup();

        const { onDiscardPending } = renderTopbar({
            hasPendingChanges: true,
            originalInstructions: 'one\n',
            currentInstructions: 'one\ntwo\n',
        });

        await user.click(screen.getByRole('button', { name: '1 Pending change' }));
        await user.click(await screen.findByRole('button', { name: /Instructions/ }));

        expect(await screen.findByText('Instruction changes')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Discard changes' }));
        await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }));

        expect(onDiscardPending).toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.queryByText('Instruction changes')).not.toBeInTheDocument();
        });
    });

    it('opens the model diff listing the added and removed models', async () => {
        const user = userEvent.setup();

        const { onDiscardModel } = renderTopbar({
            hasPendingUiConfig: true,
            getPublishedUiConfig: () =>
                uiConfig({
                    models: [{ name: 'gpt-5', modelId: 'm1' }],
                    defaultModel: { name: 'gpt-5', modelId: 'm1' },
                } as Partial<ChatAgentUiType>),
            getCurrentUiConfig: () =>
                uiConfig({
                    models: [{ name: 'claude-5', modelId: 'm2' }],
                    defaultModel: { name: 'claude-5', modelId: 'm2' },
                } as Partial<ChatAgentUiType>),
        });

        await user.click(screen.getByRole('button', { name: '1 Pending change' }));
        await user.click(await screen.findByRole('button', { name: /Model/ }));

        expect(await screen.findByText('Model changes')).toBeInTheDocument();
        expect(screen.getByText('Default model')).toBeInTheDocument();
        expect(screen.getByText('Removed')).toBeInTheDocument();
        expect(screen.getByText('Added')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Discard changes' }));
        await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }));

        expect(onDiscardModel).toHaveBeenCalled();
    });

    it('opens the appearance diff listing the scalar and question changes', async () => {
        const user = userEvent.setup();

        const base = uiConfig();

        const { onDiscardAppearance } = renderTopbar({
            hasPendingUiConfig: true,
            getPublishedUiConfig: () => base,
            getCurrentUiConfig: () =>
                uiConfig({
                    home: {
                        ...base.home,
                        title: 'Renamed home',
                        questions: ['What can you do?'],
                        search: { ...base.home!.search, showWebSearch: true },
                    },
                } as Partial<ChatAgentUiType>),
        });

        await user.click(screen.getByRole('button', { name: '1 Pending change' }));
        await user.click(await screen.findByRole('button', { name: /Chat appearance/ }));

        expect(await screen.findByText('Chat appearance changes')).toBeInTheDocument();
        expect(screen.getByText('Home title')).toBeInTheDocument();
        expect(screen.getByText('Renamed home')).toBeInTheDocument();
        expect(screen.getByText('Starter questions')).toBeInTheDocument();
        expect(screen.getByText(/What can you do\?/)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Discard changes' }));
        await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }));

        expect(onDiscardAppearance).toHaveBeenCalled();
    });

    it('publishes from the Update button', async () => {
        const user = userEvent.setup();

        const { onPublish } = renderTopbar({
            hasPendingChanges: true,
            originalInstructions: 'one\n',
            currentInstructions: 'two\n',
        });

        await user.click(screen.getByRole('button', { name: /Update/ }));

        expect(onPublish).toHaveBeenCalled();
    });

    it('disables Update while publishing or saving', () => {
        renderTopbar({
            hasPendingChanges: true,
            originalInstructions: 'one\n',
            currentInstructions: 'two\n',
            isPublishing: true,
        });

        expect(screen.getByRole('button', { name: /Update/ })).toBeDisabled();
    });

    it('runs the preview handler from Try it out', async () => {
        const user = userEvent.setup();
        const { onPreview } = renderTopbar();

        await user.click(screen.getByRole('button', { name: /Try it out/ }));

        expect(onPreview).toHaveBeenCalled();
    });

    it('opens advanced settings from the overflow menu', async () => {
        const user = userEvent.setup();
        const { onViewAdvancedSettings } = renderTopbar();

        await user.click(screen.getByRole('button', { name: 'More agent actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Advanced settings/ }));

        expect(onViewAdvancedSettings).toHaveBeenCalled();
    });

    it('confirms before deleting the agent', async () => {
        const user = userEvent.setup();
        const { onDelete } = renderTopbar();

        await user.click(screen.getByRole('button', { name: 'More agent actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Delete agent/ }));

        expect(await screen.findByText('Delete agent')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Delete' }));

        expect(onDelete).toHaveBeenCalled();
    });

    it('clones the agent and navigates to the copy', async () => {
        const user = userEvent.setup();

        server.use(
            respond('post', '/agents/agent-1/clone', () => envelope({ _id: 'agent-2', name: 'Support bot copy' })),
        );

        renderTopbar();

        await user.click(screen.getByRole('button', { name: 'More agent actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Clone agent/ }));
        await user.click(await screen.findByRole('button', { name: 'Clone' }));

        expect(await screen.findByText('/agent-builder/agent-2')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.queryByText(/Are you sure you want to clone/)).not.toBeInTheDocument();
        });
    });

    it('keeps the clone dialog open when the clone request fails', async () => {
        const user = userEvent.setup();

        server.use(respond('post', '/agents/agent-1/clone', () => httpError(500)));

        renderTopbar();

        await user.click(screen.getByRole('button', { name: 'More agent actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Clone agent/ }));
        await user.click(await screen.findByRole('button', { name: 'Clone' }));

        expect(await screen.findByText(/Are you sure you want to clone/)).toBeInTheDocument();
    });
});
