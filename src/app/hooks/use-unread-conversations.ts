import { useEffect, useState } from 'react';

import { safeJsonParse, safeLocalStorageGetItem, safeLocalStorageSetItem } from '@/utils';

const STORAGE_PREFIX = 'unreadConversations';
// Same-tab writes do not raise `storage`, so the store announces its own changes.
const CHANGE_EVENT = 'fm:unread-conversations';
// A reader who never opens the answers should not grow the entry without bound.
const MAX_TRACKED = 200;

const getStorageKey = (agentId: string) => `${STORAGE_PREFIX}:${agentId}`;

const readIds = (agentId: string): string[] => {
    const stored = safeLocalStorageGetItem(getStorageKey(agentId));
    const parsed = safeJsonParse<unknown>(stored, []);

    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
};

const writeIds = (agentId: string, ids: string[]) => {
    safeLocalStorageSetItem(getStorageKey(agentId), JSON.stringify(ids.slice(0, MAX_TRACKED)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
};

/** Marks a conversation as answered-but-unopened. Newest first, so the cap drops the stalest. */
export const markConversationUnread = (agentId: string, conversationId: string) => {
    const ids = readIds(agentId);

    if (ids[0] === conversationId) return;

    writeIds(agentId, [conversationId, ...ids.filter((id) => id !== conversationId)]);
};

export const markConversationRead = (agentId: string, conversationId: string) => {
    const ids = readIds(agentId);

    if (!ids.includes(conversationId)) return;

    writeIds(
        agentId,
        ids.filter((id) => id !== conversationId),
    );
};

export const useUnreadConversations = (agentId: string): ReadonlySet<string> => {
    const [unreadIds, setUnreadIds] = useState<ReadonlySet<string>>(() => new Set(readIds(agentId)));

    useEffect(() => {
        const sync = () => setUnreadIds(new Set(readIds(agentId)));

        sync();

        const handleStorage = (event: StorageEvent) => {
            if (event.key === getStorageKey(agentId)) sync();
        };

        window.addEventListener(CHANGE_EVENT, sync);
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener(CHANGE_EVENT, sync);
            window.removeEventListener('storage', handleStorage);
        };
    }, [agentId]);

    return unreadIds;
};
