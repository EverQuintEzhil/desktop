import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { envelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';
import type { Role } from '@/types/store';
import type { UiUsageConfigType } from '@/types/ui';

import { useConversationMeta } from '../../../hooks/use-conversation-meta';

import ConversationTokensPill from './conversation-tokens-pill';

const CONVERSATION_ID = 'chat-1';

const agentWith = (usage?: UiUsageConfigType) =>
    ({
        _id: 'agent-1',
        slug: 'test-agent',
        uiConfig: { componentType: 'chat', type: 'chat', home: {}, usage },
    }) as unknown as ChatAgentType;

/**
 * The pill's own absence proves nothing until the meta query has settled, so every
 * hidden case waits on this probe first.
 */
const MetaProbe = ({ agentId }: { agentId: string }) => {
    const { aiInfo } = useConversationMeta(agentId, CONVERSATION_ID);

    return <div>{aiInfo?.token_usage ? `meta ${aiInfo.token_usage.total_tokens}` : 'no meta'}</div>;
};

const renderPill = (agent: ChatAgentType, role: Role) =>
    renderWithProviders(
        <>
            <ConversationTokensPill agent={agent} conversationId={CONVERSATION_ID} />
            <MetaProbe agentId={agent._id} />
        </>,
        { preloadedState: { user: { role } } },
    );

const pillQuery = { name: /View AI usage/ } as const;

describe('ConversationTokensPill usage visibility', () => {
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

    it('renders the pill when the agent carries no usage config', async () => {
        renderPill(agentWith(), 'user');

        expect(await screen.findByRole('button', pillQuery)).toHaveTextContent('100');
    });

    it('renders nothing when the agent hides usage', async () => {
        renderPill(agentWith({ hidden: true }), 'owner');

        expect(await screen.findByText('meta 100')).toBeInTheDocument();
        expect(screen.queryByRole('button', pillQuery)).toBeNull();
    });

    it('renders nothing for a role the agent does not list', async () => {
        renderPill(agentWith({ visibleToRoles: ['admin', 'owner'] }), 'user');

        expect(await screen.findByText('meta 100')).toBeInTheDocument();
        expect(screen.queryByRole('button', pillQuery)).toBeNull();
    });

    it('renders the pill for a listed role', async () => {
        renderPill(agentWith({ visibleToRoles: ['admin', 'owner'] }), 'admin');

        expect(await screen.findByRole('button', pillQuery)).toHaveTextContent('100');
    });
});
