export const getConversationHistoryQueryKey = (agentId: string) => ['conversation-history', agentId] as const;

export const getConversationFavoritesQueryKey = (agentId: string) => ['conversation-favorites', agentId] as const;

export const getConversationAllQueryKey = (agentId: string, search = '') =>
    search ? (['conversation-all', agentId, search] as const) : (['conversation-all', agentId] as const);
