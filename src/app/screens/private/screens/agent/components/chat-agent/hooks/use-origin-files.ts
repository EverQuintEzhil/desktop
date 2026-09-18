import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { toLibraryItem, type LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import { appAgentApi } from '@/lib/api/app/agent';
import { selectUser } from '@/store/selectors';
import type { FileApiResponse } from '@/types/gallery';

const PAGE_SIZE = 25;

export type FileOriginType = 'chat' | 'gallery' | 'skill' | 'app' | 'project' | 'user' | 'datastore';

// Space Files tab: chat/activity origins only. Knowledge uploads use `origin.type = 'project'`
// and also stamp `origin.project_id`, so they must be excluded from this list.
export const SPACE_ACTIVITY_ORIGIN_TYPES: FileOriginType[] = ['chat', 'gallery', 'skill', 'app', 'user', 'datastore'];

// `origin.*` — where the file came from (set on first use, then immutable).
export interface OriginFilters {
    originType?: FileOriginType;
    originTypes?: FileOriginType[];
    originAgentId?: string;
    originConversationId?: string;
    originMessageId?: string;
    originSkillId?: string;
    originAppId?: string;
    originAppVersion?: string;
    originProjectId?: string;
    originUserId?: string;
    originDatastoreId?: string;
}

// Not `origin.*` fields — the server resolves these instead of matching them directly:
// `projectChatId` is expanded into the space's chat conversation ids and matched against
// `origin.conversation_id`, which needs `agentId` to find them, so the two only work as a pair.
// `agentId` also filters on the file's own `agent_id`, so it is not a synonym for `originAgentId`.
export interface ProjectChatFilters {
    projectChatId?: string;
    agentId?: string;
}

export interface UsedInFilters {
    usedInType?: FileOriginType;
    usedInTypes?: FileOriginType[];
    usedInAgentId?: string;
    usedInConversationId?: string;
    usedInMessageId?: string;
    usedInSkillId?: string;
    usedInAppId?: string;
    usedInAppVersion?: string;
    usedInProjectId?: string;
    usedInUserId?: string;
    usedInDatastoreId?: string;
}

// Free-text match the server runs over the file name/title, same `search` param the library uses.
export interface FileSearchFilters {
    search?: string;
}

export type OriginFilesFilters = OriginFilters & UsedInFilters & ProjectChatFilters & FileSearchFilters;

interface OriginFilesPage {
    files: LibraryItem[];
    page: number;
    totalPages: number;
}

interface Options {
    enabled?: boolean;
    pageSize?: number;
}

const isSet = (value: unknown) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';

const buildParams = (filters: OriginFilesFilters) =>
    Object.fromEntries(Object.entries(filters).filter(([, value]) => isSet(value)));

// Fetches files by their `origin.*` / `used_in[].*` fields, in any combination.
// Chat uploads carry their agent and conversation on `origin.*` only (see
// use-chat-files.ts), which the top-level `conversationId` filter of
// use-conversation-files.ts cannot see.
export const useOriginFiles = (filters: OriginFilesFilters, options?: Options) => {
    const user = useSelector(selectUser);
    const userId = user?._id ?? '';
    const pageSize = options?.pageSize ?? PAGE_SIZE;
    const params = buildParams(filters);
    // Only `origin.conversation_id` is comparable to the mapped `conversationId`;
    // a `usedIn` match can sit on a file that originated elsewhere.
    const originConversationId = filters.originConversationId ?? null;

    const query = useInfiniteQuery<OriginFilesPage, Error>({
        queryKey: ['origin-files', params, pageSize],
        enabled: options?.enabled ?? Object.keys(params).length > 0,
        initialPageParam: 0,
        queryFn: async ({ pageParam, signal }) => {
            const raw = await appAgentApi.listFiles<FileApiResponse>(
                {
                    ...params,
                    resolveAgent: true,
                    page: pageParam,
                    size: pageSize,
                },
                { signal },
            );

            const files = (raw.values ?? [])
                .map((value) => ({ ...toLibraryItem(value, userId), isGenerated: Boolean(value.ai) }))
                .filter((item) => !originConversationId || item.conversationId === originConversationId);

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

export default useOriginFiles;
