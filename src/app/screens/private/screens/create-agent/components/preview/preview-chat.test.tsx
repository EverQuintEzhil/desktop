import { screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ChatShellContext, type ChatShellValue } from '@/components/agent-chat/context/chat-shell-context';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import PreviewChat from './preview-chat';

/**
 * The real `ChatAgentNew` is the whole chat surface — five endpoints, a live
 * assistant-ui runtime and three jsdom shims, none of which this six-line
 * wrapper is responsible for. It is stubbed (an app component, not a
 * `src/lib/api/` module) so the isolation contract this file exists to provide
 * — a nested router that matches from the root, the agent, and the shell
 * context — is what gets asserted.
 */
const chatAgentProps = vi.hoisted(() => ({ agent: null as ChatAgentType | null }));

vi.mock('@/app/screens/private/screens/agent/components/chat-agent', () => ({
    default: ({ agent }: { agent: ChatAgentType }) => {
        chatAgentProps.agent = agent;

        return <ChatAgentProbe />;
    },
}));

let observedShell: ChatShellValue | null = null;
let observedPath = '';

const ChatAgentProbe = () => {
    const location = useLocation();

    observedPath = location.pathname;

    return (
        <ChatShellContext.Consumer>
            {(value) => {
                observedShell = value;

                return <div data-testid="chat-agent-stub">chat agent</div>;
            }}
        </ChatShellContext.Consumer>
    );
};

const agent = { _id: 'agent-1', slug: 'research-bot', name: 'Research Bot' } as unknown as ChatAgentType;

describe('PreviewChat', () => {
    it('mounts the chat agent inside its own router', async () => {
        renderWithProviders(<PreviewChat agent={agent} onClose={vi.fn()} />, { route: '/agent-builder/agent-1' });

        expect(await screen.findByTestId('chat-agent-stub')).toBeInTheDocument();
    });

    it('resolves the inner route from the root, not from the outer builder route', async () => {
        renderWithProviders(<PreviewChat agent={agent} onClose={vi.fn()} />, {
            route: '/agent-builder/agent-1/deep/path',
        });

        await screen.findByTestId('chat-agent-stub');

        expect(observedPath).toBe('/agent/research-bot');
    });

    it('hands the agent to the chat surface', async () => {
        renderWithProviders(<PreviewChat agent={agent} onClose={vi.fn()} />);

        await screen.findByTestId('chat-agent-stub');

        expect(chatAgentProps.agent).toBe(agent);
    });

    it('marks the shell as a preview and routes exit through onClose', async () => {
        const onClose = vi.fn();

        renderWithProviders(<PreviewChat agent={agent} onClose={onClose} />);

        await screen.findByTestId('chat-agent-stub');

        expect(observedShell?.isPreview).toBe(true);

        observedShell?.onExit?.();

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
