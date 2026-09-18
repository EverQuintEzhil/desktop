import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import type { CreateAgentConversation } from '../../../lib/builder-conversations-api';

import { RecentsPanel } from './recents-panel';

const conversation = (id: string, title: string): CreateAgentConversation => ({ _id: id, title });

interface PanelOverrides {
    activeConversationId?: string;
    isError?: boolean;
    loadMoreError?: boolean;
}

const renderPanel = (conversations: CreateAgentConversation[], overrides: PanelOverrides = {}) => {
    const onLoadMore = vi.fn();
    const onSelectConversation = vi.fn();
    const onRetry = vi.fn();

    const view = renderWithProviders(
        <RecentsPanel
            conversations={conversations}
            activeConversationId={overrides.activeConversationId ?? ''}
            hasMore={false}
            loadingMore={false}
            isError={overrides.isError ?? false}
            loadMoreError={overrides.loadMoreError ?? false}
            onRetry={onRetry}
            onLoadMore={onLoadMore}
            onSelectConversation={onSelectConversation}
        />,
    );

    return {
        ...view,
        onLoadMore,
        onSelectConversation,
        onRetry,
    };
};

describe('RecentsPanel', () => {
    it('shows an empty state with no conversations', () => {
        renderPanel([]);

        expect(screen.getByText('Recents')).toBeInTheDocument();
        expect(screen.getByText('No conversations yet.')).toBeInTheDocument();
    });

    it('lists one button per conversation', () => {
        renderPanel([conversation('c1', 'First thread'), conversation('c2', 'Second thread')]);

        expect(screen.getByRole('button', { name: 'First thread' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Second thread' })).toBeInTheDocument();
    });

    it('marks the active conversation with aria-current', () => {
        renderPanel([conversation('c1', 'First thread'), conversation('c2', 'Second thread')], {
            activeConversationId: 'c2',
        });

        expect(screen.getByRole('button', { name: 'First thread' })).not.toHaveAttribute('aria-current');
        expect(screen.getByRole('button', { name: 'Second thread' })).toHaveAttribute('aria-current', 'true');
    });

    it('strips remark-directive mention markup out of the title', () => {
        renderPanel([conversation('c1', 'Use :skill[Weekly report]{name=weekly} on Monday')]);

        expect(screen.getByRole('button', { name: 'Use Weekly report on Monday' })).toBeInTheDocument();
    });

    it('decodes percent-encoded titles', () => {
        renderPanel([conversation('c1', 'Draft%20the%20memo')]);

        expect(screen.getByRole('button', { name: 'Draft the memo' })).toBeInTheDocument();
    });

    it('leaves a malformed percent sequence alone', () => {
        renderPanel([conversation('c1', '100% done')]);

        expect(screen.getByRole('button', { name: '100% done' })).toBeInTheDocument();
    });

    it('falls back to "New chat" for a blank title', () => {
        renderPanel([conversation('c1', '   ')]);

        expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();
    });

    it('reports the picked conversation id', async () => {
        const user = userEvent.setup();
        const { onSelectConversation } = renderPanel([conversation('c1', 'First thread')]);

        await user.click(screen.getByRole('button', { name: 'First thread' }));

        expect(onSelectConversation).toHaveBeenCalledWith('c1');
    });

    it('shows a failure state instead of the empty state when the list could not load', () => {
        renderPanel([], { isError: true });

        expect(screen.getByText('Could not load conversations')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(screen.queryByText('No conversations yet.')).not.toBeInTheDocument();
    });

    it('asks the caller to reload when Retry is pressed', async () => {
        const user = userEvent.setup();
        const { onRetry } = renderPanel([], { isError: true });

        await user.click(screen.getByRole('button', { name: 'Retry' }));

        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('keeps the already-loaded conversations visible when a later page fails', () => {
        renderPanel([conversation('c1', 'First thread')], { loadMoreError: true });

        expect(screen.getByRole('button', { name: 'First thread' })).toBeInTheDocument();
        expect(screen.queryByText('Could not load conversations')).not.toBeInTheDocument();
    });

    it('does not blame pagination when a whole-list reload fails behind a populated list', () => {
        renderPanel([conversation('c1', 'First thread')], { isError: true });

        expect(screen.getByRole('button', { name: 'First thread' })).toBeInTheDocument();
        expect(screen.queryByText('Could not load more conversations.')).not.toBeInTheDocument();
    });

    it('offers a Retry beneath the list when a later page fails', async () => {
        const user = userEvent.setup();
        const { onRetry } = renderPanel([conversation('c1', 'First thread')], { loadMoreError: true });

        expect(screen.getByText('Could not load more conversations.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Retry' }));

        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});
