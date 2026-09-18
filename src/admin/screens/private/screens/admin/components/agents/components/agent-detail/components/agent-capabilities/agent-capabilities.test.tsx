import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { authenticatedUser } from '@/test/fixtures/auth';
import { apiUrl, envelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { AgentType } from '@/types/admin';
import type { UserState } from '@/types/store';

import AgentCapabilities from './agent-capabilities';

const AGENT_ID = 'agent-1';

const agentWith = (overrides: Partial<AgentType>): AgentType =>
    ({
        _id: AGENT_ID,
        name: 'Support bot',
        ...overrides,
    }) as AgentType;

const captureAgentPut = () => {
    const bodies: Record<string, unknown>[] = [];

    server.use(
        http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
            bodies.push((await request.json()) as Record<string, unknown>);

            return envelope({ _id: AGENT_ID });
        }),
    );

    return bodies;
};

const sectionFor = (title: string): HTMLElement =>
    screen.getByRole('heading', { name: title }).closest('.security-group-row') as HTMLElement;

const openEditor = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    const section = sectionFor(title);

    await user.click(within(section).getByRole('button'));

    return section;
};

const submitEditor = async (user: ReturnType<typeof userEvent.setup>, section: HTMLElement) => {
    const [, submit] = within(section).getAllByRole('button');

    await user.click(submit);
};

const renderCapabilities = (agent: AgentType, role: UserState['role'] = 'user') => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const rendered = renderWithProviders(<AgentCapabilities agent={agent} canUserEdit={true} onSubmit={onSubmit} />, {
        preloadedState: { user: { ...authenticatedUser, role } },
    });

    return { ...rendered, onSubmit, user };
};

describe('AgentCapabilities — recommended skills', () => {
    it('submits the skill attachment with isRecommended when a skill is starred', async () => {
        const bodies = captureAgentPut();
        const { user } = renderCapabilities(
            agentWith({
                skills: [{ _id: 'skill-1', name: 'Report writing' }],
            } as Partial<AgentType>),
        );

        const section = await openEditor(user, 'Skills');

        await user.click(within(section).getByRole('option', { name: /Report writing/ }));
        await submitEditor(user, section);

        await waitFor(() => {
            expect(bodies).toEqual([{ skills: [{ skillId: 'skill-1', isRecommended: true }] }]);
        });
    });

    it('leaves an untouched skill unrecommended', async () => {
        const bodies = captureAgentPut();
        const { user } = renderCapabilities(
            agentWith({
                skills: [
                    { _id: 'skill-1', name: 'Report writing', isRecommended: true },
                    { _id: 'skill-2', name: 'Summarising' },
                ],
            } as Partial<AgentType>),
        );

        const section = await openEditor(user, 'Skills');

        await user.click(within(section).getByRole('option', { name: /Report writing/ }));
        await submitEditor(user, section);

        await waitFor(() => {
            expect(bodies).toEqual([
                {
                    skills: [
                        { skillId: 'skill-1', isRecommended: false },
                        { skillId: 'skill-2', isRecommended: false },
                    ],
                },
            ]);
        });
    });

    it('keeps the connector payload on its own mcpServers shape', async () => {
        const bodies = captureAgentPut();
        const { user } = renderCapabilities(
            agentWith({
                mcpServers: [{ _id: 'mcp-1', name: 'Jira' }],
            } as Partial<AgentType>),
        );

        const section = await openEditor(user, 'Connectors');

        await user.click(within(section).getByRole('option', { name: /Jira/ }));
        await submitEditor(user, section);

        await waitFor(() => {
            expect(bodies).toEqual([{ mcpServers: [{ mcpServerId: 'mcp-1', isRecommended: true }] }]);
        });
    });
});

describe('AgentCapabilities — admin deep links', () => {
    const toolAgent = agentWith({ tools: [{ _id: 'tool-1', name: 'Web search' }] } as Partial<AgentType>);

    it('links a capability tag into the admin console for a role with admin access', () => {
        renderCapabilities(toolAgent, 'developer');

        expect(within(sectionFor('Tools')).getByRole('link', { name: /Web search/ })).toHaveAttribute(
            'href',
            '/admin/tools/tool-1',
        );
    });

    it('renders the tag without a link for the user role, which cannot reach the admin console', () => {
        renderCapabilities(toolAgent, 'user');

        const section = sectionFor('Tools');

        expect(within(section).queryByRole('link')).not.toBeInTheDocument();
        expect(within(section).getByText('Web search')).toBeInTheDocument();
    });
});
