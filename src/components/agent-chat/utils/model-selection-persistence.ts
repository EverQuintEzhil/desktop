export const getModelSelectionStorageKey = (userId: string, agentId: string): string => {
    return `agent-chat-model:${userId || 'anonymous'}:${agentId}`;
};

export const readPersistedModelId = (storageKey: string): string | null => {
    try {
        const raw = window.localStorage.getItem(storageKey);

        if (typeof raw !== 'string' || raw.length === 0) {
            return null;
        }

        return raw;
    } catch {
        return null;
    }
};

export const writePersistedModelId = (storageKey: string, modelId: string): void => {
    try {
        window.localStorage.setItem(storageKey, modelId);
    } catch {
        return;
    }
};
