import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { TextAreaRef } from '@/components/text-area';
import { safeLocalStorageGetItem, safeLocalStorageRemoveItem, safeLocalStorageSetItem } from '@/utils/safe-storage';

const DRAFT_SAVE_DEBOUNCE_MS = 300;

interface UseChatDraftParams {
    agentId: string;
    conversationId: string | null;
    userId: string | null;
    isIncognito: boolean;
    textAreaRef?: RefObject<TextAreaRef | null>;
}

interface UseChatDraftResult {
    draft: string;
    onDraftChange: (text: string) => void;
    clearDraft: () => void;
}

const getDraftKey = (userId: string | null, agentId: string, conversationId: string | null): string => {
    return `chat-draft:${userId ?? 'anon'}:${agentId}:${conversationId ?? 'new'}`;
};

export const useChatDraft = ({
    agentId,
    conversationId,
    userId,
    isIncognito,
    textAreaRef,
}: UseChatDraftParams): UseChatDraftResult => {
    const key = getDraftKey(userId, agentId, conversationId);
    const [draft, setDraft] = useState('');
    const saveTimerRef = useRef<number | undefined>(undefined);
    const draftRef = useRef('');
    const previousKeyRef = useRef<string | null>(null);

    draftRef.current = draft;

    useEffect(() => {
        const previousKey = previousKeyRef.current;

        previousKeyRef.current = key;

        if (isIncognito) {
            window.clearTimeout(saveTimerRef.current);
            setDraft('');

            return;
        }

        if (previousKey === key) return;

        const element = textAreaRef?.current?.element;
        const isComposerFocused = Boolean(element && document.activeElement === element);

        if (previousKey !== null && isComposerFocused) {
            window.clearTimeout(saveTimerRef.current);
            safeLocalStorageRemoveItem(previousKey);
            if (draftRef.current.trim()) {
                safeLocalStorageSetItem(key, draftRef.current);
            }

            return;
        }

        setDraft(safeLocalStorageGetItem(key) ?? '');
    }, [key, isIncognito, textAreaRef]);

    const onDraftChange = useCallback(
        (text: string) => {
            setDraft(text);

            if (isIncognito) return;

            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = window.setTimeout(() => {
                if (text.trim()) {
                    safeLocalStorageSetItem(key, text);
                } else {
                    safeLocalStorageRemoveItem(key);
                }
            }, DRAFT_SAVE_DEBOUNCE_MS);
        },
        [key, isIncognito],
    );

    const clearDraft = useCallback(() => {
        window.clearTimeout(saveTimerRef.current);
        setDraft('');
        safeLocalStorageRemoveItem(key);
    }, [key]);

    useEffect(() => {
        return () => {
            window.clearTimeout(saveTimerRef.current);
        };
    }, []);

    return { draft, onDraftChange, clearDraft };
};
