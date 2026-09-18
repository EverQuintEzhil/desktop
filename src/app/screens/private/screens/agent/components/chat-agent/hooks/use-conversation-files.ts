import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { toLibraryItem, type LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import { appMediaApi } from '@/lib/api/app/media';
import { selectUser } from '@/store/selectors';
import type { FileApiResponse } from '@/types/gallery';

const PAGE_SIZE = 25;

interface ConversationFilesPage {
    files: LibraryItem[];
    page: number;
    totalPages: number;
}

export const useConversationFiles = (agentId: string, conversationId: string | null) => {
    const user = useSelector(selectUser);
    const userId = user?._id ?? '';

    const query = useInfiniteQuery<ConversationFilesPage, Error>({
        queryKey: ['conversation-files', agentId, conversationId],
        enabled: Boolean(agentId) && Boolean(conversationId),
        initialPageParam: 0,
        queryFn: async ({ pageParam, signal }) => {
            const raw = await appMediaApi.listFiles<FileApiResponse>(
                {
                    conversationId,
                    resolveAgent: true,
                    agentId,
                    page: pageParam,
                    size: PAGE_SIZE,
                },
                { signal },
            );

            // Defensive: keep only files that actually belong to this conversation,
            // in case the backend ignores the `conversationId` param.
            const files = (raw.values ?? [])
                .map((value) => toLibraryItem(value, userId))
                .filter((item) => item.conversationId === conversationId);

            return {
                files,
                page: raw.pageInfo.page,
                totalPages: raw.pageInfo.totalPages,
            };
        },
        getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined),
    });

    const files = useMemo(() => (query.data?.pages ?? []).flatMap((page) => page.files), [query.data]);

    return {
        files,
        isLoading: query.isLoading,
        hasNextPage: Boolean(query.hasNextPage),
        fetchNextPage: query.fetchNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
    };
};

export default useConversationFiles;
