import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { DropdownMenuContent, DropdownMenuRoot, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { chatAgent } from '@/test/fixtures/agents';
import { authenticatedUser } from '@/test/fixtures/auth';
import { renderWithProviders, screen } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import useAgentMenuItems from './use-agent-menu-items';

const agent = chatAgent as unknown as ChatAgentType;

const ItemsHarness = () => {
    const items = useAgentMenuItems({ agent });

    return (
        <DropdownMenuRoot open>
            <DropdownMenuTrigger aria-label="open" />
            <DropdownMenuContent>{items ?? <span>no agent items</span>}</DropdownMenuContent>
        </DropdownMenuRoot>
    );
};

const renderWithUser = (node: ReactElement, userId: string) =>
    renderWithProviders(node, {
        preloadedState: { user: { ...authenticatedUser, _id: userId, role: 'user' } },
    });

describe('useAgentMenuItems', () => {
    it('gives the agent creator an agent-builder link', async () => {
        renderWithUser(<ItemsHarness />, 'user-1');

        // Radix `DropdownMenuItem asChild` overrides the anchor's role with `menuitem`.
        expect(await screen.findByRole('menuitem', { name: 'Edit agent' })).toHaveAttribute(
            'href',
            '/agent-builder/agent-1',
        );
    });

    it('returns nothing for a user who cannot edit the agent', async () => {
        renderWithUser(<ItemsHarness />, 'user-9');

        expect(await screen.findByText('no agent items')).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Edit agent' })).toBeNull();
    });
});
