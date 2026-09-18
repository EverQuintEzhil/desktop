import type { ConversationHistoryQueryData } from '@/components/agent-chat/types';
import type { HistoryType } from '@/types/chat';

import { PAGE_SIZE } from '../constants';

export const createConversationHistoryData = (
    histories: HistoryType[],
    loadedPagesCount: number,
    totalCount: number,
    pageSize: number = PAGE_SIZE,
): ConversationHistoryQueryData => {
    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
    const pageCount = totalPages === 0 ? 1 : Math.min(Math.max(loadedPagesCount, 1), totalPages);
    const visibleHistories = histories.slice(0, pageCount * pageSize);
    const pages =
        totalPages === 0
            ? [
                  {
                      values: [],
                      pageInfo: {
                          page: 0,
                          totalPages: 0,
                          totalCount: 0,
                      },
                  },
              ]
            : Array.from({ length: pageCount }, (_, page) => ({
                  values: visibleHistories.slice(page * pageSize, (page + 1) * pageSize),
                  pageInfo: {
                      page,
                      totalPages,
                      totalCount,
                  },
              }));

    return {
        pages,
        pageParams: pages.map((_, page) => page),
    };
};

export const getLoadedHistories = (currentData?: ConversationHistoryQueryData): HistoryType[] =>
    currentData?.pages.flatMap((page) => page.values) || [];

export const getKnownTotalCount = (currentData?: ConversationHistoryQueryData): number =>
    currentData?.pages[0]?.pageInfo.totalCount || getLoadedHistories(currentData).length;

export const prependConversationHistoryData = (
    currentData: ConversationHistoryQueryData | undefined,
    history: HistoryType,
): ConversationHistoryQueryData => {
    const loadedHistories = getLoadedHistories(currentData);
    const historyExists = loadedHistories.some((item) => item._id === history._id);
    const nextHistories = [history, ...loadedHistories.filter((item) => item._id !== history._id)];
    const nextTotalCount = historyExists ? getKnownTotalCount(currentData) : getKnownTotalCount(currentData) + 1;

    return createConversationHistoryData(
        nextHistories,
        currentData?.pages.length || 1,
        Math.max(nextTotalCount, nextHistories.length),
    );
};

export const updateConversationHistoryData = (
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
        nextHistories,
        currentData.pages.length,
        Math.max(getKnownTotalCount(currentData), nextHistories.length),
    );
};

export const removeConversationHistoryData = (
    currentData: ConversationHistoryQueryData | undefined,
    historyId: string,
): ConversationHistoryQueryData | undefined => {
    if (!currentData) {
        return currentData;
    }

    const nextHistories = getLoadedHistories(currentData).filter((history) => history._id !== historyId);
    const nextTotalCount = Math.max(getKnownTotalCount(currentData) - 1, nextHistories.length);

    return createConversationHistoryData(nextHistories, currentData.pages.length, nextTotalCount);
};
