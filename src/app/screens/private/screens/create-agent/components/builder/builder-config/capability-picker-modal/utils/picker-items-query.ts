import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { type PickerItem, type PickerItemKind } from '@/app/components/picker/picker-shared';
import { adminAgentsApi } from '@/lib/api/admin/agents';
import { ATTACHABLE_MEMORY_KINDS } from '@/lib/api/admin/capabilities';
import { adminMcpsApi } from '@/lib/api/admin/mcps';
import { adminMemoriesApi } from '@/lib/api/admin/memories';
import { adminToolsApi } from '@/lib/api/admin/tools';
import type { PageInfo, PagedList } from '@/types/api-types';

const APPS_PAGE_SIZE = 50;

const SEARCH_DEBOUNCE_MS = 300;

export interface PickerGroup {
    label: string;
    items: PickerItem[];
}

interface PickerPage {
    values: PickerItem[];
    pageInfo: PageInfo;
}

const emptyPage: PickerPage = {
    values: [],
    pageInfo: { page: 0, totalPages: 0, totalCount: 0 },
};

const toPickerPage = (
    paged: PagedList<{
        _id: string;
        name: string;
        description?: string;
        serverUrl?: string;
        creator?: { _id: string } | null;
    }>,
    kind: PickerItemKind,
): PickerPage => ({
    values: paged.values.map((v) => ({
        _id: v._id,
        name: v.name,
        description: v.description,
        serverUrl: v.serverUrl,
        creatorId: v.creator?._id,
        kind,
    })),
    pageInfo: paged.pageInfo,
});

const fetchPickerPage = async (
    kind: PickerItemKind | undefined,
    search: string,
    agentId: string,
    page: number,
): Promise<PickerPage> => {
    const trimmedSearch = search || undefined;
    const params = { page, size: APPS_PAGE_SIZE, search: trimmedSearch };

    if (kind === 'mcp') {
        return toPickerPage(await adminMcpsApi.list(params), 'mcp');
    }

    if (kind === 'tool') {
        return toPickerPage(await adminToolsApi.list(params), 'tool');
    }

    if (kind === 'agent') {
        const agents = await adminAgentsApi.list(params);

        return toPickerPage({ ...agents, values: agents.values.filter((a) => a._id !== agentId) }, 'agent');
    }

    if (kind === 'memory') {
        return toPickerPage(
            await adminMemoriesApi.list({
                ...params,
                kind: ATTACHABLE_MEMORY_KINDS,
                isShareable: true,
            }),
            'memory',
        );
    }

    return emptyPage;
};

export const usePickerItemsQuery = (kind: PickerItemKind | undefined, search: string, agentId: string, open: boolean) =>
    useInfiniteQuery({
        queryKey: ['create-agent', 'picker-items', { kind, search, agentId }],
        queryFn: ({ pageParam }) => fetchPickerPage(kind, search, agentId, pageParam),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
        enabled: open,
        placeholderData: keepPreviousData,
    });

export { SEARCH_DEBOUNCE_MS };
