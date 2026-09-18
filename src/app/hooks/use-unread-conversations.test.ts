import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { markConversationRead, markConversationUnread, useUnreadConversations } from './use-unread-conversations';

const AGENT_ID = 'agent-1';
const OTHER_AGENT_ID = 'agent-2';

const storageKey = (agentId: string) => `unreadConversations:${agentId}`;

const seed = (agentId: string, ids: unknown) => {
    window.localStorage.setItem(storageKey(agentId), JSON.stringify(ids));
};

const seedRaw = (agentId: string, value: string) => {
    window.localStorage.setItem(storageKey(agentId), value);
};

const emitStorageEvent = (key: string) => {
    act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key }));
    });
};

const renderUnread = (agentId = AGENT_ID) => renderHook(() => useUnreadConversations(agentId));

describe('useUnreadConversations', () => {
    afterEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('reports a conversation marked unread', () => {
        markConversationUnread(AGENT_ID, 'conversation-1');

        const { result } = renderUnread();

        expect([...result.current]).toEqual(['conversation-1']);
    });

    it('drops a conversation marked read', () => {
        markConversationUnread(AGENT_ID, 'conversation-1');
        markConversationUnread(AGENT_ID, 'conversation-2');

        const { result } = renderUnread();

        act(() => {
            markConversationRead(AGENT_ID, 'conversation-1');
        });

        expect([...result.current]).toEqual(['conversation-2']);
    });

    it('keeps the newest conversation first', () => {
        markConversationUnread(AGENT_ID, 'conversation-1');
        markConversationUnread(AGENT_ID, 'conversation-2');
        markConversationUnread(AGENT_ID, 'conversation-3');
        markConversationUnread(AGENT_ID, 'conversation-1');

        const { result } = renderUnread();

        expect([...result.current]).toEqual(['conversation-1', 'conversation-3', 'conversation-2']);
    });

    it('caps the tracked ids at 200 and drops the stalest', () => {
        for (let index = 0; index < 205; index += 1) {
            markConversationUnread(AGENT_ID, `conversation-${index}`);
        }

        const { result } = renderUnread();

        expect(result.current.size).toBe(200);
        expect(result.current.has('conversation-204')).toBe(true);
        expect(result.current.has('conversation-5')).toBe(true);
        expect(result.current.has('conversation-4')).toBe(false);
        expect(result.current.has('conversation-0')).toBe(false);
    });

    it('does not write again when the head is already the marked conversation', () => {
        markConversationUnread(AGENT_ID, 'conversation-1');

        const { result } = renderUnread();
        const initial = result.current;
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        act(() => {
            markConversationUnread(AGENT_ID, 'conversation-1');
        });

        expect(setItem).not.toHaveBeenCalled();
        expect(result.current).toBe(initial);
    });

    it('does not write when marking an untracked conversation read', () => {
        markConversationUnread(AGENT_ID, 'conversation-1');

        const { result } = renderUnread();
        const initial = result.current;
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        act(() => {
            markConversationRead(AGENT_ID, 'conversation-missing');
        });

        expect(setItem).not.toHaveBeenCalled();
        expect(result.current).toBe(initial);
    });

    it('picks up a same-tab write while mounted', () => {
        const { result } = renderUnread();

        expect(result.current.size).toBe(0);

        act(() => {
            markConversationUnread(AGENT_ID, 'conversation-1');
        });

        expect([...result.current]).toEqual(['conversation-1']);
    });

    it('re-reads on a storage event for its own key', () => {
        const { result } = renderUnread();

        seed(AGENT_ID, ['conversation-1']);
        emitStorageEvent(storageKey(AGENT_ID));

        expect([...result.current]).toEqual(['conversation-1']);
    });

    it('ignores a storage event for an unrelated key', () => {
        const { result } = renderUnread();

        seed(AGENT_ID, ['conversation-1']);
        emitStorageEvent('someOtherKey');

        expect(result.current.size).toBe(0);
    });

    it('keeps agents isolated from each other', () => {
        markConversationUnread(AGENT_ID, 'conversation-1');
        markConversationUnread(OTHER_AGENT_ID, 'conversation-2');

        const { result } = renderUnread();
        const other = renderUnread(OTHER_AGENT_ID);

        expect([...result.current]).toEqual(['conversation-1']);
        expect([...other.result.current]).toEqual(['conversation-2']);
    });

    it('degrades to an empty set when the stored value is not an array', () => {
        seed(AGENT_ID, { conversationId: 'conversation-1' });

        const { result } = renderUnread();

        expect(result.current.size).toBe(0);
    });

    it('degrades to an empty set when the stored value is not JSON', () => {
        seedRaw(AGENT_ID, 'not json at all');

        const { result } = renderUnread();

        expect(result.current.size).toBe(0);
    });

    it('drops non-string members of the stored array', () => {
        seed(AGENT_ID, ['conversation-1', 42, null, { _id: 'conversation-2' }]);

        const { result } = renderUnread();

        expect([...result.current]).toEqual(['conversation-1']);
    });
});
