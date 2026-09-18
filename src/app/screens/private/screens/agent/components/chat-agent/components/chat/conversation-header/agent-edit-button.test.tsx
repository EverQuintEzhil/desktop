import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { chatAgent } from '@/test/fixtures/agents';
import { authenticatedUser } from '@/test/fixtures/auth';
import { renderWithProviders, screen } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import AgentEditButton from './agent-edit-button';

const agent = chatAgent as unknown as ChatAgentType;

const renderWithUser = (node: ReactElement, userId: string) =>
    renderWithProviders(node, {
        preloadedState: { user: { ...authenticatedUser, _id: userId, role: 'user' } },
    });

describe('AgentEditButton', () => {
    it('links straight to the agent builder', () => {
        renderWithUser(<AgentEditButton agent={agent} />, 'user-1');

        expect(screen.getByRole('link', { name: 'Edit agent' })).toHaveAttribute('href', '/agent-builder/agent-1');
    });

    it('renders nothing when the viewer cannot edit the agent', () => {
        renderWithUser(<AgentEditButton agent={agent} />, 'user-9');

        expect(screen.queryByRole('link', { name: 'Edit agent' })).toBeNull();
    });
});
