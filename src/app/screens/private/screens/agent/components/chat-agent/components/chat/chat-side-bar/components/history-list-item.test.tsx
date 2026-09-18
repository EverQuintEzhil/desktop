import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';
import type { ConversationStatus, HistoryType } from '@/types/chat';

import HistoryListItem from './history-list-item';

const history = (status?: ConversationStatus) =>
    ({
        _id: 'chat-1',
        title: 'Naming ideas',
        favorited: false,
        chat_project_id: null,
        status,
    }) as unknown as HistoryType;

const renderItem = (status?: ConversationStatus, isUnread = false) =>
    renderWithProviders(
        <HistoryListItem
            history={history(status)}
            agentId="agent-1"
            agentSlug="test-agent"
            spacesEnabled={false}
            isActive={false}
            isMoving={false}
            isUnread={isUnread}
            isRenaming={false}
            renameValue=""
            isRenameSubmitting={false}
            onRenameValueChange={() => {}}
            onRenameSubmit={() => {}}
            onRenameCancel={() => {}}
            onStartRename={() => {}}
            onToggleFavorite={() => {}}
            onAddToProject={() => {}}
            onDelete={() => {}}
            onHistoryClick={() => {}}
        />,
    );

describe('HistoryListItem status indicator', () => {
    it('marks nothing while a conversation is generating', () => {
        renderItem('generating');

        expect(screen.getByText('Naming ideas')).toBeInTheDocument();
        expect(screen.queryByLabelText('New response ready')).not.toBeInTheDocument();
    });

    it('labels a finished conversation the reader has not opened yet', () => {
        renderItem('ready', true);

        expect(screen.getByLabelText('New response ready')).toBeInTheDocument();
    });

    it('marks nothing while a turn runs, even when the conversation is unread', () => {
        renderItem('generating', true);

        expect(screen.queryByLabelText('New response ready')).not.toBeInTheDocument();
    });

    it('labels a conversation awaiting input', () => {
        renderItem('awaiting_input');

        expect(screen.getByLabelText('Awaiting your input')).toBeInTheDocument();
    });

    it('labels a failed conversation the reader has not opened yet', () => {
        renderItem('failed', true);

        expect(screen.getByLabelText('Generation failed')).toBeInTheDocument();
    });

    it('drops the failure mark once the reader has opened it', () => {
        renderItem('failed');

        expect(screen.queryByLabelText('Generation failed')).not.toBeInTheDocument();
    });

    it('renders no indicator for a ready conversation', () => {
        renderItem('ready');

        expect(screen.getByText('Naming ideas')).toBeInTheDocument();
        expect(screen.queryByLabelText('Response generated')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('New response ready')).not.toBeInTheDocument();
    });

    it('renders no indicator when the status is unknown', () => {
        renderItem();

        expect(screen.queryByLabelText('New response ready')).not.toBeInTheDocument();
    });
});
