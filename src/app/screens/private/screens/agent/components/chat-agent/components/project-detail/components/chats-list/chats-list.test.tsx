import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { routinesVisibleTenant } from '@/test/fixtures/auth';
import { pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';
import type { ProjectChatType } from '@/types/project';

import ChatsList from './chats-list';

// Routines are chat-only, so the surface has to be part of the fixture.
const agent = {
    _id: 'agent-1',
    name: 'Research',
    slug: 'research',
    uiConfig: { componentType: 'chat' },
} as unknown as ChatAgentType;

const chats: ProjectChatType[] = [
    {
        _id: 'chat-1',
        title: 'Scheduled report',
        updatedAt: '2026-08-01T09:00:00.000Z',
        favorited: false,
        isPublic: false,
    },
    {
        _id: 'chat-2',
        title: 'Hand written chat',
        updatedAt: '2026-08-01T09:00:00.000Z',
        favorited: false,
        isPublic: false,
    },
];

const stubRuns = () =>
    server.use(
        respond('get', '/routines/runs', () =>
            pagedEnvelope([
                {
                    _id: 'run-1',
                    routineId: 'routine-1',
                    status: 'completed',
                    trigger: 'schedule',
                    conversationId: 'chat-1',
                    error: '',
                    startedAt: '2026-08-01T09:00:00.000Z',
                    finishedAt: '2026-08-01T09:05:00.000Z',
                    isRead: true,
                    createdAt: '2026-08-01T09:00:00.000Z',
                    updatedAt: '2026-08-01T09:05:00.000Z',
                },
            ]),
        ),
    );

const renderList = (listAgent = agent) =>
    renderWithProviders(
        <ChatsList
            agent={listAgent}
            projectId="project-1"
            chats={chats}
            search=""
            onSearchChange={vi.fn()}
            isLoading={false}
            hasNextPage={false}
            isFetchingNextPage={false}
            loadMoreRef={{ current: null }}
            pendingPin={null}
            pendingVisibility={null}
            openMenuChatId={null}
            changingChatSpaceId={null}
            onOpenMenuChange={vi.fn()}
            onTogglePin={vi.fn()}
            onOpenRename={vi.fn()}
            onToggleVisibility={vi.fn()}
            onChangeSpace={vi.fn()}
            onRemove={vi.fn()}
            onDelete={vi.fn()}
        />,
        { preloadedState: { tenant: routinesVisibleTenant } },
    );

describe('ChatsList routine marking', () => {
    it('marks only the conversation a routine run wrote', async () => {
        stubRuns();

        renderList();

        expect(await screen.findByLabelText('Routine run')).toBeInTheDocument();
        expect(screen.getAllByLabelText('Routine run')).toHaveLength(1);
    });

    it('marks nothing for an agent with routines turned off', async () => {
        stubRuns();

        renderList({
            ...agent,
            uiConfig: { componentType: 'chat', routines: { enabled: false } },
        } as unknown as ChatAgentType);

        expect(await screen.findByText('Scheduled report')).toBeInTheDocument();
        expect(screen.queryByLabelText('Routine run')).not.toBeInTheDocument();
    });
});
