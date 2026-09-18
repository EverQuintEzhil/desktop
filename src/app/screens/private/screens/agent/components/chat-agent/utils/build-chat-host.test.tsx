import { describe, expect, it, vi } from 'vitest';

import { ChatShellContext } from '@/components/agent-chat/context/chat-shell-context';
import { DropdownMenuContent, DropdownMenuRoot, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { chatAgent } from '@/test/fixtures/agents';
import { authenticatedUser, testTenant } from '@/test/fixtures/auth';
import { renderWithProviders, screen } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';
import type { Role } from '@/types/store';
import type { UiUsageConfigType } from '@/types/ui';

import { buildChatHost } from './build-chat-host';

const agent = chatAgent as unknown as ChatAgentType;

const buildHost = (isPreview: boolean) =>
    buildChatHost({
        agent,
        user: authenticatedUser,
        tenant: testTenant,
        isPreview,
        getFrom: () => '/agent/smoke-test-agent',
        navigate: vi.fn(),
        onStartNewConversation: vi.fn(),
    });

describe('buildChatHost useAgentMenuItems', () => {
    it('wires agent menu items that link to the agent builder', async () => {
        const host = buildHost(false);
        const Harness = () => (
            <DropdownMenuRoot open>
                <DropdownMenuTrigger aria-label="open" />
                <DropdownMenuContent>{host.slots?.useAgentMenuItems?.({ agent })}</DropdownMenuContent>
            </DropdownMenuRoot>
        );

        renderWithProviders(<Harness />);

        // Radix `DropdownMenuItem asChild` overrides the anchor's role with `menuitem`.
        expect(await screen.findByRole('menuitem', { name: 'Edit agent' })).toHaveAttribute(
            'href',
            '/agent-builder/agent-1',
        );
    });

    it('always supplies the slot, so the header hook count never varies', () => {
        expect(buildHost(true).slots?.useAgentMenuItems).toBeTypeOf('function');
        expect(buildHost(false).slots?.useAgentMenuItems).toBeTypeOf('function');
    });

    it('yields no items in preview, which has no /agent-builder route', async () => {
        const host = buildHost(true);
        const Items = () => (
            <DropdownMenuRoot open>
                <DropdownMenuTrigger aria-label="open" />
                <DropdownMenuContent>
                    {host.slots?.useAgentMenuItems?.({ agent }) ?? <span>no agent items</span>}
                </DropdownMenuContent>
            </DropdownMenuRoot>
        );

        renderWithProviders(
            <ChatShellContext.Provider value={{ isPreview: true }}>
                <Items />
            </ChatShellContext.Provider>,
        );

        expect(await screen.findByText('no agent items')).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Edit agent' })).toBeNull();
    });
});

describe('buildChatHost usage visibility', () => {
    const hostFor = (usage: UiUsageConfigType | undefined, role: Role) =>
        buildChatHost({
            agent: { ...agent, uiConfig: { ...agent.uiConfig, usage } } as ChatAgentType,
            user: { ...authenticatedUser, role },
            tenant: testTenant,
            isPreview: false,
            getFrom: () => '/agent/smoke-test-agent',
            navigate: vi.fn(),
            onStartNewConversation: vi.fn(),
        });

    it('supplies the usage dialog slot when the agent has no usage config', () => {
        expect(buildHost(false).slots?.renderTokenUsageDialog).toBeTypeOf('function');
        expect(hostFor(undefined, 'user').slots?.renderTokenUsageDialog).toBeTypeOf('function');
    });

    it('omits the usage dialog slot for an agent that hides usage', () => {
        expect(hostFor({ hidden: true }, 'owner').slots?.renderTokenUsageDialog).toBeUndefined();
    });

    it('omits the usage dialog slot for a role the agent does not list', () => {
        const usage: UiUsageConfigType = { visibleToRoles: ['admin', 'owner'] };

        expect(hostFor(usage, 'user').slots?.renderTokenUsageDialog).toBeUndefined();
        expect(hostFor(usage, 'developer').slots?.renderTokenUsageDialog).toBeUndefined();
    });

    it('keeps the usage dialog slot for a listed role', () => {
        const usage: UiUsageConfigType = { visibleToRoles: ['admin', 'owner'] };

        expect(hostFor(usage, 'admin').slots?.renderTokenUsageDialog).toBeTypeOf('function');
        expect(hostFor(usage, 'owner').slots?.renderTokenUsageDialog).toBeTypeOf('function');
    });
});
