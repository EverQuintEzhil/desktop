import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ConversationMessage } from '@/components/agent-chat/types';

import { buildConversationRepository } from './build-conversation-repository';

const message = (
    overrides: Partial<ConversationMessage> & Pick<ConversationMessage, '_id' | 'role'>,
): ConversationMessage => ({
    conversation_id: 'c1',
    content: [{ type: 'text', text: `body ${overrides._id}` }] as ConversationMessage['content'],
    parent_id: null,
    ...overrides,
});

const pendingPlaceholderTree = (): ConversationMessage[] => [
    message({ _id: 'u1', role: 'user', created_at: '2026-01-01T00:00:00Z' }),
    message({
        _id: 'a1',
        role: 'assistant',
        parent_id: 'u1',
        created_at: '2026-01-01T00:00:01Z',
        content: [] as ConversationMessage['content'],
        metadata: { pending: true },
    }),
    message({
        _id: 'u2',
        role: 'user',
        parent_id: 'a1',
        created_at: '2026-01-01T00:00:02Z',
    }),
    message({
        _id: 'a2',
        role: 'assistant',
        parent_id: 'u2',
        created_at: '2026-01-01T00:00:03Z',
    }),
];

describe('buildConversationRepository', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('keeps the descendants of a dropped placeholder, re-parented to its own parent', () => {
        const repository = buildConversationRepository({ messages: pendingPlaceholderTree() });

        expect(repository.messages.map(({ message: uiMessage }) => uiMessage.id)).toEqual(['u1', 'u2', 'a2']);
        expect(repository.messages.map(({ parentId }) => parentId)).toEqual([null, 'u1', 'u2']);
    });

    it('leaves every parentId pointing at an emitted message', () => {
        const repository = buildConversationRepository({ messages: pendingPlaceholderTree() });
        const emittedIds = new Set(repository.messages.map(({ message: uiMessage }) => uiMessage.id));

        repository.messages.forEach(({ parentId }) => {
            if (parentId !== null) expect(emittedIds.has(parentId)).toBe(true);
        });
    });

    it('resolves the head to the deepest surviving leaf', () => {
        const repository = buildConversationRepository({ messages: pendingPlaceholderTree() });

        expect(repository.headId).toBe('a2');
    });

    it('does not report the surviving descendants as unreachable', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        buildConversationRepository({ messages: pendingPlaceholderTree() });

        expect(consoleError).not.toHaveBeenCalled();
    });

    it('keeps both branches when a dropped placeholder has several children', () => {
        const messages: ConversationMessage[] = [
            message({ _id: 'u1', role: 'user', created_at: '2026-01-01T00:00:00Z' }),
            message({
                _id: 'a1',
                role: 'assistant',
                parent_id: 'u1',
                created_at: '2026-01-01T00:00:01Z',
                content: [] as ConversationMessage['content'],
                metadata: { pending: true },
            }),
            message({
                _id: 'b1',
                role: 'user',
                parent_id: 'a1',
                created_at: '2026-01-01T00:00:02Z',
            }),
            message({
                _id: 'b2',
                role: 'user',
                parent_id: 'a1',
                created_at: '2026-01-01T00:00:03Z',
            }),
        ];

        const repository = buildConversationRepository({ messages });

        expect(repository.messages.map(({ message: uiMessage }) => uiMessage.id)).toEqual(['u1', 'b1', 'b2']);
        expect(repository.messages.map(({ parentId }) => parentId)).toEqual([null, 'u1', 'u1']);
    });

    it('keeps an aborted zero-part assistant leaf and its children', () => {
        const messages: ConversationMessage[] = [
            message({ _id: 'u1', role: 'user', created_at: '2026-01-01T00:00:00Z' }),
            message({
                _id: 'a1',
                role: 'assistant',
                parent_id: 'u1',
                created_at: '2026-01-01T00:00:01Z',
                content: [] as ConversationMessage['content'],
                metadata: { partial: true },
            }),
            message({
                _id: 'u2',
                role: 'user',
                parent_id: 'a1',
                created_at: '2026-01-01T00:00:02Z',
            }),
        ];

        const repository = buildConversationRepository({ messages });

        expect(repository.messages.map(({ message: uiMessage }) => uiMessage.id)).toEqual(['u1', 'a1', 'u2']);
        expect(repository.messages.map(({ parentId }) => parentId)).toEqual([null, 'u1', 'a1']);
    });
});
