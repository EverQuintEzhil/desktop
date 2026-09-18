import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { envelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';
import type { Role } from '@/types/store';
import type { UiUsageConfigType } from '@/types/ui';

import { useConversationMeta } from '../../../hooks/use-conversation-meta';

import ConversationUsageDialogProvider, { useConversationUsageDialog } from './conversation-usage-dialog-context';

const AGENT_ID = 'agent-1';
const CONVERSATION_ID = 'chat-1';

const agentWith = (usage?: UiUsageConfigType) =>
    ({
        _id: AGENT_ID,
        slug: 'test-agent',
        uiConfig: { componentType: 'chat', type: 'chat', home: {}, usage },
    }) as unknown as ChatAgentType;

const UsageOpener = () => {
    const dialog = useConversationUsageDialog();

    return (
        <button
            type="button"
            onClick={() => dialog?.openConversationUsage({ agentId: AGENT_ID, conversationId: CONVERSATION_ID })}
        >
            open usage
        </button>
    );
};

/** The dialog's absence proves nothing until the meta query behind it has settled. */
const MetaProbe = () => {
    const { aiInfo } = useConversationMeta(AGENT_ID, CONVERSATION_ID);

    return <div>{aiInfo?.token_usage ? `meta ${aiInfo.token_usage.total_tokens}` : 'no meta'}</div>;
};

const renderProvider = (agent: ChatAgentType, role: Role) =>
    renderWithProviders(
        <ConversationUsageDialogProvider agent={agent}>
            <UsageOpener />
            <MetaProbe />
        </ConversationUsageDialogProvider>,
        { preloadedState: { user: { role } } },
    );

describe('ConversationUsageDialogProvider usage visibility', () => {
    beforeEach(() => {
        server.use(
            respond('get', `/conversations/${CONVERSATION_ID}`, () =>
                envelope({
                    title: 'Costed chat',
                    ai_info: {
                        model: 'gpt-4o',
                        token_usage: { input_tokens: 60, output_tokens: 40, total_tokens: 100 },
                    },
                }),
            ),
        );
    });

    it('opens the dialog when the agent carries no usage config', async () => {
        renderProvider(agentWith(), 'user');

        await userEvent.click(screen.getByRole('button', { name: 'open usage' }));

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('keeps the dialog closed when the agent hides usage', async () => {
        renderProvider(agentWith({ hidden: true }), 'owner');

        await userEvent.click(screen.getByRole('button', { name: 'open usage' }));

        expect(await screen.findByText('meta 100')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps the dialog closed for a role the agent does not list', async () => {
        renderProvider(agentWith({ visibleToRoles: ['admin', 'owner'] }), 'user');

        await userEvent.click(screen.getByRole('button', { name: 'open usage' }));

        expect(await screen.findByText('meta 100')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens the dialog for a listed role', async () => {
        renderProvider(agentWith({ visibleToRoles: ['admin', 'owner'] }), 'admin');

        await userEvent.click(screen.getByRole('button', { name: 'open usage' }));

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });
});
