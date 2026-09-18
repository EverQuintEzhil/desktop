import type { ProjectScope } from '@/types/project';

export const projectsKeys = {
    list: (agentId: string, scope: ProjectScope, sortBy: string, search: string) =>
        ['projects', agentId, scope, sortBy, search] as const,
    pinned: (agentId: string) => ['projects', agentId, 'pinned'] as const,
    unpinned: (agentId: string) => ['projects', agentId, 'unpinned'] as const,
    detail: (projectId: string) => ['project', projectId] as const,
    // `search` is appended only when set, so the unfiltered list keeps the exact key every
    // existing cache read/write uses, and ['project-files', id] still invalidates both.
    files: (projectId: string, search = '') => ['project-files', projectId, ...(search ? [search] : [])] as const,
    // `search` is appended only when set, for the same reason as `files` above: the unfiltered
    // list keeps the exact key every existing cache read/write uses, and the 3-segment prefix
    // still invalidates the filtered variants alongside it.
    conversations: (agentId: string, projectId: string, search = '') =>
        ['project-conversations', agentId, projectId, ...(search ? [search] : [])] as const,
    sharedConversations: (agentId: string, projectId: string, search = '') =>
        ['project-shared-conversations', agentId, projectId, ...(search ? [search] : [])] as const,
    activities: (projectId: string) => ['project-activities', projectId] as const,
    // Prefixes, for invalidating every space at once when the affected space ids are
    // not reliably known. `allDetails` matches only ['project', id] — ['projects', …]
    // has a different first element.
    allConversations: (agentId: string) => ['project-conversations', agentId] as const,
    allSharedConversations: (agentId: string) => ['project-shared-conversations', agentId] as const,
    allDetails: () => ['project'] as const,
};

/**
 * True for a files key that carries a search segment, i.e. a server-matched list rather than
 * the base one. Optimistic writes belong on the base list only — the server decides what a
 * search term matches, so a filtered list has to be refetched instead of written into.
 */
export const isSearchFilteredFilesKey = (queryKey: readonly unknown[]): boolean =>
    queryKey[0] === 'project-files' && queryKey.length > 2;
