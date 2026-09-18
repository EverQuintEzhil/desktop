import type { ConversationAdapter } from './types';

const unsupported = (): Promise<never> => Promise.reject(new Error('conversations not supported in this surface'));

export const createUnsupportedConversationAdapter = (): ConversationAdapter => ({
    list: unsupported,
    loadMessages: unsupported,
    loadConversation: unsupported,
    delete: unsupported,
    deleteAll: unsupported,
    rename: unsupported,
    toggleFavorite: unsupported,
    branch: unsupported,
    updateMessage: unsupported,
    updateConversation: unsupported,
    moveToProject: unsupported,
    getConversation: unsupported,
    getConversationMessages: unsupported,
});
