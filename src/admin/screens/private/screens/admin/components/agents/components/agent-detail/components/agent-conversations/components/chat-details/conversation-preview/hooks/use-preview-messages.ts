import { useCallback, useEffect, useRef, useState } from 'react';

import { appConversationApi } from '@/lib/api/app/conversation';

import type { AdminConversationMessage } from '../../chat-details';

const PREVIEW_PAGE_SIZE = 20;

export interface PreviewMessagesState {
    messages: AdminConversationMessage[];
    /** Active leaf of the conversation tree, so branch pickers open on the live branch. */
    headId: string | null;
    isLoading: boolean;
    isError: boolean;
    hasMoreNewerMessages: boolean;
    isLoadingNewerMessages: boolean;
    loadNewerMessages: () => void;
}

interface UsePreviewMessagesOptions {
    agentId: string;
    conversationId: string;
}

/**
 * The admin messages endpoint pages oldest-first, and the preview opens on the very
 * first turn, so page 0 is the initial page and each later page is appended as the
 * reader scrolls down.
 */
export const usePreviewMessages = (options: UsePreviewMessagesOptions): PreviewMessagesState => {
    const { agentId, conversationId } = options;

    const [messages, setMessages] = useState<AdminConversationMessage[]>([]);
    const [headId, setHeadId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [highestLoadedPage, setHighestLoadedPage] = useState<number | null>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoadingNewerMessages, setIsLoadingNewerMessages] = useState(false);

    const requestEpochRef = useRef(0);
    const highestLoadedPageRef = useRef<number | null>(null);
    const totalPagesRef = useRef(0);
    const isLoadingNewerRef = useRef(false);

    const fetchPage = useCallback(
        (page: number) =>
            appConversationApi.getAdminConversationMessages<AdminConversationMessage>(conversationId, {
                agentId,
                size: PREVIEW_PAGE_SIZE,
                page,
            }),
        [agentId, conversationId],
    );

    useEffect(() => {
        requestEpochRef.current += 1;

        const epoch = requestEpochRef.current;

        highestLoadedPageRef.current = null;
        totalPagesRef.current = 0;
        isLoadingNewerRef.current = false;
        setMessages([]);
        setHeadId(null);
        setHighestLoadedPage(null);
        setTotalPages(0);
        setIsLoadingNewerMessages(false);
        setIsError(false);
        setIsLoading(true);

        const loadOldestPage = async () => {
            try {
                const oldest = await fetchPage(0);

                if (epoch !== requestEpochRef.current) return;

                highestLoadedPageRef.current = 0;
                totalPagesRef.current = oldest.pageInfo.totalPages;
                setMessages(oldest.values);
                setHeadId(oldest.headId ?? null);
                setHighestLoadedPage(0);
                setTotalPages(oldest.pageInfo.totalPages);
                setIsLoading(false);
            } catch (error) {
                console.error('Failed to fetch conversation messages for preview:', error);

                if (epoch !== requestEpochRef.current) return;

                setIsError(true);
                setIsLoading(false);
            }
        };

        void loadOldestPage();
    }, [fetchPage]);

    const loadNewerMessages = useCallback(() => {
        const currentPage = highestLoadedPageRef.current;

        if (currentPage === null || isLoadingNewerRef.current) return;
        if (currentPage >= totalPagesRef.current - 1) return;

        const epoch = requestEpochRef.current;
        const nextPage = currentPage + 1;

        isLoadingNewerRef.current = true;
        setIsLoadingNewerMessages(true);

        const loadNewerPage = async () => {
            try {
                const newer = await fetchPage(nextPage);

                if (epoch !== requestEpochRef.current) return;

                highestLoadedPageRef.current = nextPage;
                totalPagesRef.current = newer.pageInfo.totalPages;
                setMessages((prev) => [...prev, ...newer.values]);
                setHighestLoadedPage(nextPage);
                setTotalPages(newer.pageInfo.totalPages);
            } catch (error) {
                console.error('Failed to fetch newer conversation messages for preview:', error);
            } finally {
                if (epoch === requestEpochRef.current) {
                    isLoadingNewerRef.current = false;
                    setIsLoadingNewerMessages(false);
                }
            }
        };

        void loadNewerPage();
    }, [fetchPage]);

    return {
        messages,
        headId,
        isLoading,
        isError,
        hasMoreNewerMessages: highestLoadedPage !== null && highestLoadedPage < totalPages - 1,
        isLoadingNewerMessages,
        loadNewerMessages,
    };
};
