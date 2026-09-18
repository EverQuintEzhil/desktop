import { describe, expect, it } from 'vitest';

import { chatAgent } from '@/test/fixtures/agents';
import { authenticatedUser } from '@/test/fixtures/auth';
import { renderHookWithProviders } from '@/test/test-utils';
import type { AgentType } from '@/types/admin';
import type { Role } from '@/types/store';

import useCanEditAgent from './use-can-edit-agent';

const agent = chatAgent as unknown as AgentType;

const renderGate = (targetAgent: AgentType, user: { _id: string; role: Role }) =>
    renderHookWithProviders(() => useCanEditAgent(targetAgent), {
        preloadedState: { user: { ...authenticatedUser, _id: user._id, role: user.role } },
    });

describe('useCanEditAgent', () => {
    it('allows the agent creator', () => {
        const { result } = renderGate(agent, { _id: 'user-1', role: 'user' });

        expect(result.current).toBe(true);
    });

    it('denies another regular user', () => {
        const { result } = renderGate(agent, { _id: 'user-9', role: 'user' });

        expect(result.current).toBe(false);
    });

    it('allows an admin who is not the creator', () => {
        const { result } = renderGate(agent, { _id: 'user-9', role: 'admin' });

        expect(result.current).toBe(true);
    });

    it('allows a developer listed in the agent admins', () => {
        const agentWithAdmins = { ...chatAgent, admins: ['user-9'] } as unknown as AgentType;
        const { result } = renderGate(agentWithAdmins, { _id: 'user-9', role: 'developer' });

        expect(result.current).toBe(true);
    });

    it('denies a developer not listed in the agent admins', () => {
        const { result } = renderGate(agent, { _id: 'user-9', role: 'developer' });

        expect(result.current).toBe(false);
    });

    it('does not throw when an admin entry is null', () => {
        const agentWithNullAdmin = { ...chatAgent, admins: [null] } as unknown as AgentType;

        expect(() => renderGate(agentWithNullAdmin, { _id: 'user-9', role: 'developer' })).not.toThrow();
    });
});
