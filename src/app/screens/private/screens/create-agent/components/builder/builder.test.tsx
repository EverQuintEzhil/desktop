import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UIMessage } from 'ai';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import Builder from './builder';

/**
 * `Builder` is a pure layout/precedence shell: it issues no requests of its own,
 * every network call belongs to one of its seven children, and each of those
 * children already has its own test file. The children are therefore stubbed
 * (none is a `src/lib/api/` module, so the MSW-only rule stands) and the 7-point
 * network checklist is adapted the way the ledger already does for non-network
 * units — exhaustive coverage of the sub-view precedence chain, the mobile tab
 * state machine and the imperative skill-generation bridge.
 */
const captured = vi.hoisted(() => ({
    chat: null as Record<string, unknown> | null,
    config: null as Record<string, unknown> | null,
    topbar: null as Record<string, unknown> | null,
    channel: null as Record<string, unknown> | null,
    dataStore: null as Record<string, unknown> | null,
    skill: null as Record<string, unknown> | null,
    advanced: null as Record<string, unknown> | null,
    preview: null as Record<string, unknown> | null,
    sentMessages: [] as string[],
    chatMounts: 0,
    previewMounts: 0,
}));

vi.mock('./builder-chat', () => ({
    default: forwardRef((props: Record<string, unknown>, ref) => {
        captured.chat = props;
        useEffect(() => {
            captured.chatMounts += 1;
        }, []);
        useImperativeHandle(ref, () => ({
            sendMessage: (message: string) => captured.sentMessages.push(message),
        }));

        return <div data-testid="builder-chat-stub">builder chat</div>;
    }),
}));

vi.mock('./builder-config', () => ({
    default: (props: Record<string, unknown>) => {
        captured.config = props;

        return <div data-testid="builder-config-stub">builder config</div>;
    },
}));

vi.mock('../config-topbar/config-topbar', () => ({
    default: (props: Record<string, unknown>) => {
        captured.topbar = props;

        return (
            <div data-testid="config-topbar-stub">
                <button onClick={props.onPreview as () => void}>Try it out</button>
            </div>
        );
    },
}));

vi.mock('./chat-channel-edit', () => ({
    ChatChannelEdit: (props: Record<string, unknown>) => {
        captured.channel = props;

        return <div data-testid="chat-channel-edit-stub">channel edit</div>;
    },
}));

vi.mock('./data-store-edit', () => ({
    DataStoreEdit: (props: Record<string, unknown>) => {
        captured.dataStore = props;

        return <div data-testid="data-store-edit-stub">data store edit</div>;
    },
}));

vi.mock('../../../skills', () => ({
    SkillEdit: (props: Record<string, unknown>) => {
        captured.skill = props;

        return <div data-testid="skill-edit-stub">skill edit</div>;
    },
}));

vi.mock('../../agent-advanced-settings', () => ({
    default: (props: Record<string, unknown>) => {
        captured.advanced = props;

        return <div data-testid="advanced-settings-stub">advanced settings</div>;
    },
}));

vi.mock('../preview/preview-chat', () => {
    const PreviewChatStub = (props: Record<string, unknown>) => {
        captured.preview = props;
        useEffect(() => {
            captured.previewMounts += 1;
        }, []);

        return <div data-testid="preview-chat-stub">preview chat</div>;
    };

    return { default: PreviewChatStub };
});

const previewAgent = { _id: 'agent-1', slug: 'research-bot', name: 'Research Bot' } as unknown as ChatAgentType;

type BuilderProps = Parameters<typeof Builder>[0];

const baseProps = (): BuilderProps => ({
    config: { name: 'Research Bot' } as BuilderProps['config'],
    initialMessages: [] as UIMessage[],
    agentId: 'agent-1',
    activeConversationId: null,
    chatKey: 0,
    conversations: [],
    conversationsHasMore: false,
    conversationsError: false,
    conversationsLoadMoreError: false,
    onRetryConversations: vi.fn(),
    conversationsLoadingMore: false,
    onLoadMoreConversations: vi.fn(),
    messagesLoading: false,
    messagesError: false,
    onRetryMessages: vi.fn(),
    onNewChat: vi.fn(),
    onSelectConversation: vi.fn(),
    onConversationId: vi.fn(),
    onViewSkill: vi.fn(),
    onCloseSkill: vi.fn(),
    onSkillDeleted: vi.fn(),
    onSkillUpdated: vi.fn(),
    onViewDataStore: vi.fn(),
    onCloseDataStore: vi.fn(),
    onDataStoreDeleted: vi.fn(),
    onDataStoreUpdated: vi.fn(),
    onViewChannel: vi.fn(),
    onCloseChannel: vi.fn(),
    onViewAdvancedSettings: vi.fn(),
    onCloseAdvancedSettings: vi.fn(),
    getChannelUiConfig: vi.fn(() => undefined),
    getChannelDescription: vi.fn(() => 'A research assistant'),
    onSaveChannelUiConfig: vi.fn(async () => {}),
    onSaveChannelDescription: vi.fn(async () => {}),
    onConfigChange: vi.fn(),
    onAgentConfig: vi.fn(),
    onBack: vi.fn(),
    agentName: 'Research Bot',
    agentLoading: false,
    agentSaving: false,
    agentSaved: true,
    onPreview: vi.fn(),
    onSettings: vi.fn(),
    onDelete: vi.fn(),
    previewOpen: false,
    onClosePreview: vi.fn(),
});

const renderBuilder = (overrides: Partial<BuilderProps> = {}) => {
    const props = { ...baseProps(), ...overrides };

    return { props, ...renderWithProviders(<Builder {...props} />) };
};

describe('Builder', () => {
    beforeEach(() => {
        captured.sentMessages.length = 0;
        captured.chatMounts = 0;
        captured.previewMounts = 0;
    });

    it('shows the chat pane alongside the default config pane', () => {
        renderBuilder();

        expect(screen.getByTestId('builder-chat-stub')).toBeInTheDocument();
        expect(screen.getByTestId('config-topbar-stub')).toBeInTheDocument();
        expect(screen.getByTestId('builder-config-stub')).toBeInTheDocument();
    });

    it('renders a chat skeleton instead of the chat while messages load', () => {
        renderBuilder({ messagesLoading: true });

        expect(screen.queryByTestId('builder-chat-stub')).not.toBeInTheDocument();
        expect(screen.getByTestId('config-topbar-stub')).toBeInTheDocument();
    });

    it('opens the skill editor over the config pane', () => {
        const { props } = renderBuilder({ skillIdInView: 'skill-1' });

        expect(screen.getByTestId('skill-edit-stub')).toBeInTheDocument();
        expect(screen.queryByTestId('builder-config-stub')).not.toBeInTheDocument();
        expect(captured.skill?.skillId).toBe('skill-1');
        expect(captured.skill?.showTitleBackButton).toBe(false);
        expect(captured.skill?.onDeleted).toBe(props.onSkillDeleted);
        expect(captured.skill?.onUpdated).toBe(props.onSkillUpdated);
        expect(screen.getByText('Skills')).toBeInTheDocument();
    });

    it('closes the skill editor from its own header back button', async () => {
        const user = userEvent.setup();
        const { props } = renderBuilder({ skillIdInView: 'skill-1' });

        await user.click(screen.getByRole('button', { name: 'Back to builder' }));

        expect(props.onCloseSkill).toHaveBeenCalledTimes(1);
    });

    it('opens the data-store editor with the agent name', () => {
        const { props } = renderBuilder({ dataStoreIdInView: 'ds-1' });

        expect(screen.getByTestId('data-store-edit-stub')).toBeInTheDocument();
        expect(captured.dataStore?.dataStoreId).toBe('ds-1');
        expect(captured.dataStore?.agentName).toBe('Research Bot');
        expect(captured.dataStore?.onDeleted).toBe(props.onDataStoreDeleted);
        expect(captured.dataStore?.onUpdated).toBe(props.onDataStoreUpdated);
    });

    it('opens the chat-channel editor seeded from the channel getters', () => {
        const { props } = renderBuilder({ channelInView: true });

        expect(screen.getByTestId('chat-channel-edit-stub')).toBeInTheDocument();
        expect(props.getChannelDescription).toHaveBeenCalled();
        expect(captured.channel?.initialDescription).toBe('A research assistant');
    });

    it('opens the advanced settings pane', () => {
        renderBuilder({ advancedSettingsInView: true });

        expect(screen.getByTestId('advanced-settings-stub')).toBeInTheDocument();
        expect(captured.advanced?.agentName).toBe('Research Bot');
    });

    it('prefers the skill editor over the channel and advanced panes', () => {
        renderBuilder({ skillIdInView: 'skill-1', channelInView: true, advancedSettingsInView: true });

        expect(screen.getByTestId('skill-edit-stub')).toBeInTheDocument();
        expect(screen.queryByTestId('chat-channel-edit-stub')).not.toBeInTheDocument();
        expect(screen.queryByTestId('advanced-settings-stub')).not.toBeInTheDocument();
    });

    it('prefers the data-store editor over the channel and advanced panes', () => {
        renderBuilder({ dataStoreIdInView: 'ds-1', channelInView: true, advancedSettingsInView: true });

        expect(screen.getByTestId('data-store-edit-stub')).toBeInTheDocument();
        expect(screen.queryByTestId('chat-channel-edit-stub')).not.toBeInTheDocument();
    });

    it('prefers the channel editor over the advanced pane', () => {
        renderBuilder({ channelInView: true, advancedSettingsInView: true });

        expect(screen.getByTestId('chat-channel-edit-stub')).toBeInTheDocument();
        expect(screen.queryByTestId('advanced-settings-stub')).not.toBeInTheDocument();
    });

    it('lets the preview win over every other sub-view at once', () => {
        renderBuilder({
            previewOpen: true,
            previewAgent,
            skillIdInView: 'skill-1',
            dataStoreIdInView: 'ds-1',
            channelInView: true,
            advancedSettingsInView: true,
        });

        expect(screen.getByTestId('preview-chat-stub')).toBeInTheDocument();
        expect(screen.queryByTestId('skill-edit-stub')).not.toBeInTheDocument();
        expect(screen.queryByTestId('data-store-edit-stub')).not.toBeInTheDocument();
        expect(screen.queryByTestId('chat-channel-edit-stub')).not.toBeInTheDocument();
        expect(screen.queryByTestId('advanced-settings-stub')).not.toBeInTheDocument();
    });

    it('shows the preview skeleton while the preview agent is still loading', () => {
        renderBuilder({ previewOpen: true, previewLoading: true, previewAgent });

        expect(screen.queryByTestId('preview-chat-stub')).not.toBeInTheDocument();
        expect(screen.queryByTestId('builder-config-stub')).not.toBeInTheDocument();
    });

    it('shows the preview skeleton when the preview is open but no agent arrived', () => {
        renderBuilder({ previewOpen: true, previewAgent: undefined });

        expect(screen.queryByTestId('preview-chat-stub')).not.toBeInTheDocument();
    });

    it('hands the preview agent and the close handler to the preview surface', () => {
        const { props } = renderBuilder({ previewOpen: true, previewAgent });

        expect(captured.preview?.agent).toBe(previewAgent);
        expect(captured.preview?.onClose).toBe(props.onClosePreview);
    });

    it('remounts the preview when the previewed agent changes', () => {
        const { rerender, props } = renderBuilder({ previewOpen: true, previewAgent });

        expect(captured.previewMounts).toBe(1);

        rerender(<Builder {...props} previewOpen previewAgent={previewAgent} />);
        expect(captured.previewMounts).toBe(1);

        rerender(
            <Builder {...props} previewOpen previewAgent={{ ...previewAgent, _id: 'agent-2' } as ChatAgentType} />,
        );
        expect(captured.previewMounts).toBe(2);
    });

    it('remounts the chat when chatKey changes', () => {
        const { rerender, props } = renderBuilder();

        expect(captured.chatMounts).toBe(1);

        rerender(<Builder {...props} chatKey={1} />);

        expect(captured.chatMounts).toBe(2);
    });

    it('forwards a generated skill description to the chat as a literal prompt', async () => {
        renderBuilder();

        (captured.config?.onGenerateSkill as (description: string) => void)('summarize quarterly reports');

        expect(captured.sentMessages).toEqual(['Create a skill using this description: summarize quarterly reports']);
    });

    it('opens the preview and moves the mobile pane to config in one action', async () => {
        const user = userEvent.setup();
        const { props } = renderBuilder();

        const chatPane = screen.getByTestId('builder-chat-stub').parentElement as HTMLElement;

        expect(chatPane).not.toHaveClass('hidden');

        await user.click(screen.getByRole('button', { name: 'Try it out' }));

        expect(props.onPreview).toHaveBeenCalledTimes(1);
        expect(chatPane).toHaveClass('hidden', 'md:block');
    });

    it('brings the chat pane back when the mobile Chat tab is chosen', async () => {
        const user = userEvent.setup();

        renderBuilder();

        const chatPane = screen.getByTestId('builder-chat-stub').parentElement as HTMLElement;
        const nav = screen.getByRole('navigation', { name: 'Panel navigation' });

        await user.click(within(nav).getByRole('button', { name: /Configure/ }));
        expect(chatPane).toHaveClass('hidden');

        await user.click(within(nav).getByRole('button', { name: /Chat/ }));
        expect(chatPane).not.toHaveClass('hidden');
    });

    it('routes the chat pane preview trigger through the same handler', () => {
        const { props } = renderBuilder();

        (captured.chat?.onOpenPreview as () => void)();

        expect(props.onPreview).toHaveBeenCalledTimes(1);
    });

    it('closes any open preview when a mobile nav tab is chosen', async () => {
        const user = userEvent.setup();
        const { props } = renderBuilder({ previewOpen: true, previewAgent });

        const nav = screen.getByRole('navigation', { name: 'Panel navigation' });

        await user.click(within(nav).getByRole('button', { name: /Chat/ }));
        expect(props.onClosePreview).toHaveBeenCalledTimes(1);

        await user.click(within(nav).getByRole('button', { name: /Configure/ }));
        expect(props.onClosePreview).toHaveBeenCalledTimes(2);
    });

    it('passes the conversation list wiring straight through to the chat', () => {
        const { props } = renderBuilder({
            activeConversationId: 'conv-1',
            conversations: [{ id: 'conv-1', title: 'First chat' }] as unknown as BuilderProps['conversations'],
            conversationsHasMore: true,
            conversationsLoadingMore: true,
        });

        expect(captured.chat?.activeConversationId).toBe('conv-1');
        expect(captured.chat?.conversationsHasMore).toBe(true);
        expect(captured.chat?.conversationsLoadingMore).toBe(true);
        expect(captured.chat?.onLoadMoreConversations).toBe(props.onLoadMoreConversations);
        expect(captured.chat?.agentId).toBe('agent-1');
    });

    it('passes the pending-change state through to the topbar', () => {
        const { props } = renderBuilder({
            hasPendingChanges: true,
            hasPendingUiConfig: true,
            isPublishing: true,
            agentDeleting: true,
            originalInstructions: 'old',
            currentInstructions: 'new',
        });

        expect(captured.topbar?.hasPendingChanges).toBe(true);
        expect(captured.topbar?.hasPendingUiConfig).toBe(true);
        expect(captured.topbar?.isPublishing).toBe(true);
        expect(captured.topbar?.isDeleting).toBe(true);
        expect(captured.topbar?.originalInstructions).toBe('old');
        expect(captured.topbar?.currentInstructions).toBe('new');
        expect(captured.topbar?.onViewAdvancedSettings).toBe(props.onViewAdvancedSettings);
    });
});
