import type { appConversationApi } from '@/lib/api/app/conversation';

import type { ConversationAdapter } from '../types';

export const createFluentMindConversationAdapter = (
    api: typeof appConversationApi,
    opts: { agentId: string },
): ConversationAdapter => ({
    list: (p, signal) => api.listConversations({ agentId: opts.agentId, ...p }, { signal }),
    loadMessages: async (id, p) => {
        const res = await api.getConversationMessages(id, { agentId: opts.agentId, ...(p as object) });

        return { messages: res.values, headId: res.headId };
    },
    loadConversation: (id) => api.getConversation(id, { agentId: opts.agentId }),
    delete: async (id) => {
        await api.deleteConversation(id, { agentId: opts.agentId });
    },
    deleteAll: async ({ force }) => {
        await api.deleteAllConversations({ force }, { agentId: opts.agentId });
    },
    rename: async (id, title) => {
        await api.updateConversation(id, { title }, { agentId: opts.agentId });
    },
    toggleFavorite: (id) =>
        api.toggleConversationFavorite<{ favorited: boolean; favoritedAt: number | null }>(id, {
            agentId: opts.agentId,
        }),
    branch: (id, p) => api.branchConversation(id, (p as { messageId: string }).messageId, { agentId: opts.agentId }),
    updateMessage: (id, messageId, p) => api.updateMessage(id, messageId, p, { agentId: opts.agentId }),
    updateConversation: (id, p) => api.updateConversation(id, p, { agentId: opts.agentId }),
    moveToProject: (id, projectId) => api.updateConversation(id, { projectId }, { agentId: opts.agentId }),
    getConversation: (id) => api.getConversation(id, { agentId: opts.agentId }),
    getConversationMessages: (id, p) => api.getConversationMessages(id, { agentId: opts.agentId, ...(p as object) }),
});
