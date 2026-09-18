import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { appAgentApi } from '@/lib/api/app/agent';
import type { ChatAgentType, PromptType } from '@/types/admin';
import type { PagedList } from '@/types/api-types';

const PAGE_SIZE = 50;

interface UsePromptLibraryOptions {
    agent: ChatAgentType;
    searchQuery: string;
    isMineOnly: boolean;
}

interface PromptLibraryState {
    data: PromptType[];
    loading: boolean;
    error: Error | null;
    page: number;
    pages: number;
    showMoreLoading: boolean;
}

type PromptLibraryQueryData = InfiniteData<PagedList<PromptType>, number>;

const getPromptLibraryQueryKey = (agent: ChatAgentType, searchQuery: string, isMineOnly: boolean) =>
    [
        'prompt-library',
        agent._id,
        agent.uiConfig.promptLibrary?.filters.aimodelIds || [],
        searchQuery.trim(),
        isMineOnly,
    ] as const;

const appendPromptToQueryData = (
    currentData: PromptLibraryQueryData | undefined,
    prompt: PromptType,
): PromptLibraryQueryData | undefined => {
    if (!currentData) return currentData;

    const [firstPage, ...restPages] = currentData.pages;

    if (!firstPage) return currentData;

    return {
        ...currentData,
        pages: [
            {
                ...firstPage,
                values: [prompt, ...firstPage.values],
                pageInfo: {
                    ...firstPage.pageInfo,
                    totalCount: firstPage.pageInfo.totalCount + 1,
                },
            },
            ...restPages,
        ],
    };
};

const usePromptLibrary = ({ agent, searchQuery, isMineOnly }: UsePromptLibraryOptions) => {
    const queryClient = useQueryClient();
    const queryKey = getPromptLibraryQueryKey(agent, searchQuery, isMineOnly);

    const { data, error, isError, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam = 0, signal }) =>
            appAgentApi.listPrompts<PromptType>(
                {
                    page: pageParam as number,
                    size: PAGE_SIZE,
                    aimodelIds: agent.uiConfig.promptLibrary?.filters.aimodelIds || [],
                    agentIds: agent._id,
                    mineOnly: isMineOnly,
                    search: searchQuery.trim() || undefined,
                },
                {
                    signal,
                },
            ),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });

    const prompts = useMemo(() => data?.pages.flatMap((page) => page.values) || [], [data]);

    const lastPageInfo = data?.pages.at(-1)?.pageInfo;

    const addPrompt = useCallback(
        (prompt: PromptType) => {
            queryClient.setQueryData<PromptLibraryQueryData>(queryKey, (currentData) =>
                appendPromptToQueryData(currentData, prompt),
            );
        },
        [queryClient, queryKey],
    );

    return {
        state: {
            data: prompts,
            loading: isLoading,
            error: isError ? error : null,
            page: lastPageInfo?.page || 0,
            pages: lastPageInfo?.totalPages || 0,
            showMoreLoading: isFetchingNextPage,
        } satisfies PromptLibraryState,
        fetchNextPage,
        hasNextPage,
        addPrompt,
    };
};

export default usePromptLibrary;
