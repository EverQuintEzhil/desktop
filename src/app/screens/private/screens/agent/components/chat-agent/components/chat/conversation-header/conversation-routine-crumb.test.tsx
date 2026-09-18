import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { routinesVisibleTenant } from '@/test/fixtures/auth';
import { apiUrl, envelope, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import ConversationRoutineCrumb from './conversation-routine-crumb';
import ConversationTitleCrumb from './conversation-title-crumb';

// Routines are chat-only, so the surface has to be part of the fixture.
const agent = { _id: 'agent-1', slug: 'research', uiConfig: { componentType: 'chat' } } as unknown as ChatAgentType;

const agentWithRoutinesOff = {
    _id: 'agent-1',
    slug: 'research',
    uiConfig: { componentType: 'chat', routines: { enabled: false } },
} as unknown as ChatAgentType;

const run = (conversationId: string) => ({
    _id: 'run-1',
    routineId: 'routine-1',
    status: 'completed',
    trigger: 'schedule',
    conversationId,
    error: '',
    startedAt: '2026-08-22T09:00:00.000Z',
    finishedAt: '2026-08-22T09:05:00.000Z',
    isRead: true,
    routine: { _id: 'routine-1', name: 'Weekly competitor scan', agentId: 'agent-1' },
    createdAt: '2026-08-22T09:00:00.000Z',
    updatedAt: '2026-08-22T09:05:00.000Z',
});

// An absence assertion can pass before the request that would render the crumb resolves, so every
// negative case waits on the request itself having been served first.
// `/routines/runs` filters on `conversationIds` server-side, so the handler has to as well.
const stubRuns = (runs: { conversationId: string }[], served?: () => void) =>
    server.use(
        http.get(apiUrl('/routines/runs'), ({ request }) => {
            served?.();

            const wanted = new URL(request.url).searchParams.get('conversationIds')?.split(',') ?? null;

            return pagedEnvelope(wanted ? runs.filter((row) => wanted.includes(row.conversationId)) : runs);
        }),
        respond('get', '/routines/routine-1/runs', () => pagedEnvelope(runs)),
    );

const stubConversation = (served?: () => void) =>
    server.use(
        respond('get', '/conversations/conv-1', () => {
            served?.();

            return envelope({ title: 'Some auto-generated chat title' });
        }),
    );

describe('ConversationRoutineCrumb', () => {
    it('renders the routines hop and the routine name for a routine conversation', async () => {
        stubRuns([run('conv-1')]);

        renderWithProviders(<ConversationRoutineCrumb agent={agent} conversationId="conv-1" />);

        expect(await screen.findByRole('link', { name: 'Open routines' })).toHaveAttribute(
            'href',
            '/agent/research/routines',
        );
        expect(screen.getByText('Weekly competitor scan')).toBeInTheDocument();
    });

    it('renders nothing for a conversation without a run', async () => {
        const served = vi.fn();

        stubRuns([run('conv-other')], served);

        renderWithProviders(<ConversationRoutineCrumb agent={agent} conversationId="conv-1" />);

        await waitFor(() => expect(served).toHaveBeenCalled());
        expect(screen.queryByRole('link', { name: 'Open routines' })).not.toBeInTheDocument();
    });

    it('replaces the conversation title crumb for a routine conversation', async () => {
        const conversationServed = vi.fn();

        stubRuns([run('conv-1')]);
        stubConversation(conversationServed);

        renderWithProviders(
            <>
                <ConversationRoutineCrumb agent={agent} conversationId="conv-1" />
                <ConversationTitleCrumb agent={agent} conversationId="conv-1" />
            </>,
            { preloadedState: { tenant: routinesVisibleTenant } },
        );

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
        await waitFor(() => expect(conversationServed).toHaveBeenCalled());
        expect(screen.queryByText('Some auto-generated chat title')).not.toBeInTheDocument();
    });

    it('keeps the title crumb on a routine conversation when the agent has routines off', async () => {
        const conversationServed = vi.fn();

        stubRuns([run('conv-1')]);
        stubConversation(conversationServed);

        renderWithProviders(<ConversationTitleCrumb agent={agentWithRoutinesOff} conversationId="conv-1" />, {
            preloadedState: { tenant: routinesVisibleTenant },
        });

        await waitFor(() => expect(conversationServed).toHaveBeenCalled());
        expect(await screen.findByText('Some auto-generated chat title')).toBeInTheDocument();
    });

    it('keeps the title crumb on a routine conversation when the tenant hides routines', async () => {
        const conversationServed = vi.fn();

        stubRuns([run('conv-1')]);
        stubConversation(conversationServed);

        renderWithProviders(<ConversationTitleCrumb agent={agent} conversationId="conv-1" />);

        await waitFor(() => expect(conversationServed).toHaveBeenCalled());
        expect(await screen.findByText('Some auto-generated chat title')).toBeInTheDocument();
    });

    it('keeps the title crumb for an ordinary conversation', async () => {
        const conversationServed = vi.fn();

        stubRuns([]);
        stubConversation(conversationServed);

        renderWithProviders(<ConversationTitleCrumb agent={agent} conversationId="conv-1" />, {
            preloadedState: { tenant: routinesVisibleTenant },
        });

        await waitFor(() => expect(conversationServed).toHaveBeenCalled());
        expect(await screen.findByText('Some auto-generated chat title')).toBeInTheDocument();
    });
});
