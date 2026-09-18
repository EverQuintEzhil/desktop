import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ChatSlots } from '@/components/chat-host';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { MeProfile } from '@/lib/api';
import { chatAgent } from '@/test/fixtures/agents';
import { envelope, respond, server } from '@/test/msw';
import { renderWithProviders, screen } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import { ChatShellContext } from '../../../context/chat-shell-context';
import { FindProvider } from '../../chat-find-bar';

import ChatViewHeader from './chat-view-header';

const agent = chatAgent as unknown as ChatAgentType;

const agentItemSlots: ChatSlots = {
    useAgentMenuItems: () => <DropdownMenuItem>Edit agent</DropdownMenuItem>,
};

const fullSlots: ChatSlots = {
    ...agentItemSlots,
    renderConversationMenuItems: () => <DropdownMenuItem>Rename</DropdownMenuItem>,
};

const renderHeader = (canManageConversation: boolean, slots?: ChatSlots) =>
    renderWithProviders(
        <ChatViewHeader
            agent={agent}
            conversationId="conversation-1"
            slots={slots}
            launcher={{ launcherName: 'Smoke Agent' }}
            canManageConversation={canManageConversation}
            isForeignConversation={!canManageConversation}
            onShare={() => {}}
            onDeleteClick={() => {}}
        />,
    );

describe('ChatViewHeader overflow menu', () => {
    it('shows the menu on a conversation the viewer cannot manage when agent items exist', async () => {
        const user = userEvent.setup();

        renderHeader(false, agentItemSlots);
        await user.click(screen.getByRole('button', { name: 'More' }));

        expect(await screen.findByRole('menuitem', { name: 'Edit agent' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
        expect(screen.queryByRole('separator')).toBeNull();
        expect(screen.queryByRole('button', { name: /Share/ })).toBeNull();
    });

    it('hides the menu entirely when there are neither agent items nor manage rights', () => {
        renderHeader(false);

        expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    });

    it('orders conversation items, then agent items, then delete last', async () => {
        const user = userEvent.setup();

        renderHeader(true, fullSlots);
        await user.click(screen.getByRole('button', { name: 'More' }));

        expect(await screen.findByRole('menuitem', { name: 'Edit agent' })).toBeInTheDocument();
        expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
            'Rename',
            'Edit agent',
            'Delete',
        ]);
        expect(screen.getAllByRole('separator')).toHaveLength(2);
    });

    it('omits the leading separator when the host supplies no conversation items', async () => {
        const user = userEvent.setup();

        renderHeader(true, agentItemSlots);
        await user.click(screen.getByRole('button', { name: 'More' }));

        expect(await screen.findByRole('menuitem', { name: 'Edit agent' })).toBeInTheDocument();
        expect(screen.getAllByRole('separator')).toHaveLength(1);
    });

    it('keeps the menu free of separators when only conversation items are present', async () => {
        const user = userEvent.setup();

        renderHeader(true);
        await user.click(screen.getByRole('button', { name: 'More' }));

        expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
        expect(screen.queryByRole('separator')).toBeNull();
    });
});

/** The shortcut registry behind the find control resolves bindings from the profile. */
const stubProfile = () => {
    const profile = {
        _id: 'user-1',
        name: { first: 'Jane', last: 'Doe' },
        role: 'user',
        email: 'jane.doe@example.com',
        preferences: null,
    } as MeProfile;

    server.use(respond('get', '/users/me', () => envelope(profile)));
};

describe('ChatViewHeader find takeover', () => {
    beforeEach(stubProfile);

    it('replaces the header actions with the bar, keeps the name, and restores them on close', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <FindProvider isEnabled>
                <ChatViewHeader
                    agent={agent}
                    conversationId="conversation-1"
                    launcher={{ launcherName: 'Smoke Agent' }}
                    canManageConversation
                    isForeignConversation={false}
                    onShare={() => {}}
                    onDeleteClick={() => {}}
                />
            </FindProvider>,
        );

        await user.click(await screen.findByRole('button', { name: 'Find in chat' }));

        await waitFor(() => expect(screen.getByRole('search')).toBeInTheDocument());
        expect(screen.getByText('Smoke Agent')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Share/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Find in chat' })).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Close find' }));

        expect(await screen.findByRole('button', { name: /Share/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
        expect(screen.queryByRole('search')).toBeNull();
    });
});

describe('ChatViewHeader in the assistant panel', () => {
    beforeEach(stubProfile);

    const renderPanelHeader = (slots?: ChatSlots) =>
        renderWithProviders(
            <ChatShellContext.Provider value={{ isPreview: false, variant: 'panel' }}>
                <FindProvider isEnabled>
                    <ChatViewHeader
                        agent={agent}
                        conversationId="conversation-1"
                        slots={slots}
                        launcher={{ launcherName: 'Smoke Agent', renderInfoIcon: () => <button>Info</button> }}
                        canManageConversation
                        isForeignConversation={false}
                        onShare={() => {}}
                        onDeleteClick={() => {}}
                    />
                </FindProvider>
            </ChatShellContext.Provider>,
        );

    it('drops the agent name and info icon, which the panel chrome row above carries', async () => {
        renderPanelHeader();

        expect(await screen.findByRole('button', { name: 'More' })).toBeInTheDocument();
        expect(screen.queryByText('Smoke Agent')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Info' })).toBeNull();
    });

    it('keeps the conversation badge, which is what this row now names', async () => {
        renderPanelHeader({ ...fullSlots, renderConversationBadge: () => <span>Pipeline overview</span> });

        expect(await screen.findByText('Pipeline overview')).toBeInTheDocument();
    });

    it('keeps Find reachable but drops its label, which is the widest thing in the row', async () => {
        renderPanelHeader();

        const find = await screen.findByRole('button', { name: 'Find in chat' });

        expect(find).toBeInTheDocument();
        expect(find).not.toHaveTextContent('Find in chat');
    });

    it('moves Share off the row and into the overflow menu', async () => {
        const user = userEvent.setup();

        renderPanelHeader(fullSlots);

        expect(screen.queryByRole('button', { name: /Share/ })).toBeNull();

        await user.click(await screen.findByRole('button', { name: 'More' }));

        expect(await screen.findByRole('menuitem', { name: 'Share' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    });

    it('keeps Share on the row in the full variant', async () => {
        renderHeader(true, fullSlots);

        expect(await screen.findByRole('button', { name: /Share/ })).toBeInTheDocument();
    });
});
