import type { ConversationStatus } from '@/types/chat';

import type { ConversationStatusMark, ConversationStatusMarkStyle } from './types';

// Motionless dots on purpose — these rows sit in dense lists, and anything animated per
// row turns the sidebar into a fairground.
//
// The palette is picked for the dark sidebar as well as the light space list: the
// `--primary` and `--destructive` tokens are both close to the sidebar's own purple.
export const CONVERSATION_STATUS_MARKS: Record<ConversationStatusMark, ConversationStatusMarkStyle> = {
    awaiting: {
        label: 'Awaiting your input',
        className: 'bg-amber-400',
    },
    failed: {
        label: 'Generation failed',
        className: 'bg-red-400',
    },
    unread: {
        label: 'New response ready',
        className: 'bg-sky-400',
    },
    settled: {
        label: 'Response generated',
        className: 'bg-current opacity-40',
    },
};

/**
 * Resolves what a row should mark.
 *
 * Blue and red are news — they say something happened while the reader was elsewhere, so
 * opening the conversation clears them. Amber is a live state rather than news: the agent
 * stays blocked on the reader until they actually answer, so opening does not clear it.
 * A conversation that is merely generating is deliberately left unmarked.
 */
export const resolveConversationStatusMark = ({
    status,
    isUnread,
    showSettled,
}: {
    status?: ConversationStatus;
    isUnread?: boolean;
    showSettled?: boolean;
}): ConversationStatusMark | null => {
    if (status === 'awaiting_input') {
        return 'awaiting';
    }

    if (status === 'generating') {
        return null;
    }

    const isFailed = status === 'failed';

    if (isUnread) {
        return isFailed ? 'failed' : 'unread';
    }

    if (!showSettled || !status) {
        return null;
    }

    return isFailed ? 'failed' : 'settled';
};
