import { useQueryClient } from '@tanstack/react-query';
import { BlocksIcon, BotIcon, FileTextIcon, GlobeIcon, PackageIcon, WrenchIcon } from 'lucide-react';
import { useCallback } from 'react';

import type { MentionItemsProvider } from '@/components/agent-chat/view/agent-chat-composer/chat-editor';
import { adminAgentsApi } from '@/lib/api/admin/agents';
import { adminDataStoresApi } from '@/lib/api/admin/data-stores';
import { adminMcpsApi } from '@/lib/api/admin/mcps';
import { adminToolsApi } from '@/lib/api/admin/tools';
import { skillsApi } from '@/lib/api/common/skills';
import type { DirectiveSuggestionBase } from '@/lib/chat/directives';

const BROWSE_LIMIT = 5;
const SEARCH_LIMIT = 20;
const CACHE_MS = 30_000;

const STATIC_TOOLS: DirectiveSuggestionBase[] = [
    { id: 'tool-web-search', label: 'Web search', type: 'tool', icon: GlobeIcon },
];

interface NamedRecord {
    _id: string;
    name: string;
}

interface Catalog {
    key: string;
    idPrefix: string;
    type: string;
    icon: DirectiveSuggestionBase['icon'];
    list: (params: { size: number; search?: string }) => Promise<{ values: NamedRecord[] }>;
}

const CATALOGS: Catalog[] = [
    { key: 'datastores', idPrefix: 'ds-', type: 'datastore', icon: FileTextIcon, list: adminDataStoresApi.list },
    { key: 'skills', idPrefix: 'skill-', type: 'skill', icon: PackageIcon, list: skillsApi.list },
    { key: 'mcpservers', idPrefix: 'mcp-', type: 'mcp', icon: BlocksIcon, list: adminMcpsApi.list },
    { key: 'tools', idPrefix: 'tool-api-', type: 'tool', icon: WrenchIcon, list: adminToolsApi.list },
    { key: 'agents', idPrefix: 'agent-', type: 'agent', icon: BotIcon, list: adminAgentsApi.list },
];

/**
 * Backs the builder composer's "@" trigger. The five catalogs are searched server-side per query,
 * so this is a provider rather than a static list; TipTap debounces the calls and discards the
 * results a later keystroke supersedes (the requests themselves are not cancelled). A catalog that
 * fails contributes nothing rather than emptying the menu.
 */
export const useBuilderMentionItemsProvider = (): MentionItemsProvider => {
    const queryClient = useQueryClient();

    return useCallback<MentionItemsProvider>(
        async (query) => {
            const size = query ? SEARCH_LIMIT : BROWSE_LIMIT;

            const results = await Promise.all(
                CATALOGS.map(async (catalog) => {
                    try {
                        const page = await queryClient.fetchQuery({
                            queryKey: ['builder-mentions', catalog.key, query],
                            queryFn: () => catalog.list({ size, search: query || undefined }),
                            staleTime: CACHE_MS,
                            // The menu waits on the slowest catalog, so a failing one must drop out at once.
                            retry: false,
                        });

                        return page.values.map((record) => ({
                            id: `${catalog.idPrefix}${record._id}`,
                            label: record.name,
                            type: catalog.type,
                            icon: catalog.icon,
                        }));
                    } catch {
                        return [];
                    }
                }),
            );

            const [dataStores, skills, mcps, tools, agents] = results;
            // Every other row was matched by the server, so the built-in must match the query too.
            const staticTools = STATIC_TOOLS.filter((tool) => tool.label.toLowerCase().includes(query.toLowerCase()));

            return [...dataStores, ...skills, ...mcps, ...staticTools, ...tools, ...agents];
        },
        [queryClient],
    );
};

export default useBuilderMentionItemsProvider;
