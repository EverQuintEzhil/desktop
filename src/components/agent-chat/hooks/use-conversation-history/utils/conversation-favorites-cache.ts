import type { ConversationHistoryQueryData } from '@/components/agent-chat/types';
import type { HistoryType } from '@/types/chat';

import { FAVORITES_PAGE_SIZE } from '../constants';

import { createConversationHistoryData, getKnownTotalCount, getLoadedHistories } from './conversation-history-cache';

export const sortFavoritesByDate = (histories: HistoryType[]): HistoryType[] =>
    histories.slice().sort((a, b) => (b.favorited_at ?? 0) - (a.favorited_at ?? 0));

export const prependFavoritesData = (
    currentData: ConversationHistoryQueryData | undefined,
    history: HistoryType,
): ConversationHistoryQueryData => {
    const loadedHistories = getLoadedHistories(currentData);
    const historyExists = loadedHistories.some((item) => item._id === history._id);
    const nextHistories = sortFavoritesByDate([history, ...loadedHistories.filter((item) => item._id !== history._id)]);
    const nextTotalCount = historyExists ? getKnownTotalCount(currentData) : getKnownTotalCount(currentData) + 1;

    return createConversationHistoryData(
        nextHistories,
        currentData?.pages.length || 1,
        Math.max(nextTotalCount, nextHistories.length),
        FAVORITES_PAGE_SIZE,
    );
};

export const updateFavoritesData = (
    currentData: ConversationHistoryQueryData | undefined,
    history: Partial<HistoryType> & Pick<HistoryType, '_id'>,
): ConversationHistoryQueryData | undefined => {
    if (!currentData) {
        return currentData;
    }

    let hasUpdated = false;
    const nextHistories = getLoadedHistories(currentData).map((item) => {
        if (item._id !== history._id) {
            return item;
        }

        hasUpdated = true;

        return { ...item, ...history };
    });

    if (!hasUpdated) {
        return currentData;
    }

    return createConversationHistoryData(
        sortFavoritesByDate(nextHistories),
        currentData.pages.length,
        Math.max(getKnownTotalCount(currentData), nextHistories.length),
        FAVORITES_PAGE_SIZE,
    );
};

export const removeFavoritesData = (
    currentData: ConversationHistoryQueryData | undefined,
    historyId: string,
): ConversationHistoryQueryData | undefined => {
    if (!currentData) {
        return currentData;
    }

    const loadedHistories = getLoadedHistories(currentData);

    if (!loadedHistories.some((history) => history._id === historyId)) {
        return currentData;
    }

    const nextHistories = loadedHistories.filter((history) => history._id !== historyId);
    const nextTotalCount = Math.max(getKnownTotalCount(currentData) - 1, nextHistories.length);

    return createConversationHistoryData(nextHistories, currentData.pages.length, nextTotalCount, FAVORITES_PAGE_SIZE);
};
