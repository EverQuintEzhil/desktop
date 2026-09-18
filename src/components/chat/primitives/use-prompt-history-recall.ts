import { useAui, useAuiState } from '@assistant-ui/react';
import { useCallback, useEffect, useRef } from 'react';

import type { TextAreaRef } from '@/components/text-area';
import { getSerializedTextOffset, serializeDirectiveEditableText } from '@/lib/chat/directives';

interface UsePromptHistoryRecallOptions {
    textAreaRef: React.RefObject<TextAreaRef | null>;
    value: string;
    applyValue: (text: string, caret: 'start' | 'end') => void;
    enabled?: boolean;
}

interface UsePromptHistoryRecallResult {
    handleKeyDown: (event: React.KeyboardEvent) => boolean;
    notifyValueChange: (nextValue: string) => void;
    hasHistory: boolean;
}

/**
 * Shell-style prompt history recall: from an empty composer ArrowUp walks back
 * through prior user messages (newest first), ArrowDown walks forward and
 * finally restores the in-progress draft. History only opens from an empty
 * composer, so a manually typed message is never clobbered. Consumers supply how
 * to write text into their own composer via `applyValue`; the state machine
 * (cursor, draft, recalled marker) lives here so every surface shares one copy.
 *
 * Ownership notes:
 * - The hook owns `recalledValueRef` and sets it BEFORE calling `applyValue`, so
 *   a consumer whose `applyValue` synchronously funnels through `notifyValueChange`
 *   sees the value as a recall (not a manual edit) and does not reset the cursor.
 * - ArrowUp places the caret at the start so the next ArrowUp still reads
 *   `caret-at-start` and recalls the message before it.
 */
export const usePromptHistoryRecall = ({
    textAreaRef,
    value,
    applyValue,
    enabled = true,
}: UsePromptHistoryRecallOptions): UsePromptHistoryRecallResult => {
    const aui = useAui();

    // Cursor into the reversed user-message list (-1 = live draft, not in history).
    const historyIndexRef = useRef(-1);
    // Whatever the user had typed before entering history, so ArrowDown can restore it.
    const historyDraftRef = useRef('');
    // The last value we pushed via recall, so notifyValueChange can tell a manual edit apart.
    const recalledValueRef = useRef<string | null>(null);
    // Latest value, read inside callbacks without widening their dependency lists.
    const valueRef = useRef(value);

    valueRef.current = value;

    const messageCount = useAuiState((s) => s.thread.messages.length);
    const threadIdentity = useAuiState((s) => s.thread.messages[0]?.id);

    // The composer persists across conversation switches and new turns, so reset
    // the cursor whenever the thread changes to avoid a stale index leaking in.
    useEffect(() => {
        historyIndexRef.current = -1;
        historyDraftRef.current = '';
        recalledValueRef.current = null;
    }, [messageCount, threadIdentity]);

    const getReversedUserTexts = useCallback((): string[] => {
        const messages = aui.thread.getState().messages;
        const texts = messages
            .filter((message) => message.role === 'user')
            .map((message) =>
                message.content
                    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                    .map((part) => part.text)
                    .join('')
                    .trim(),
            )
            .filter((text) => text.length > 0);

        return texts.reverse();
    }, [aui]);

    const recallPrevious = useCallback((): boolean => {
        const element = textAreaRef.current?.element;
        const offset = element ? getSerializedTextOffset(element) : null;
        const isCaretAtStart = offset === null || offset === 0;

        if (!isCaretAtStart) return false;

        // Only ENTER history from an empty composer, matching Claude: if the user
        // has typed anything, ArrowUp must not replace it. Once navigating
        // (index > -1) keep cycling even though the recalled text fills the box.
        if (historyIndexRef.current === -1 && valueRef.current.trim().length !== 0) return false;

        const reversed = getReversedUserTexts();

        if (historyIndexRef.current >= reversed.length - 1) return false;

        if (historyIndexRef.current === -1) {
            historyDraftRef.current = valueRef.current;
        }

        const nextIndex = historyIndexRef.current + 1;
        const text = reversed[nextIndex];

        if (text === undefined) return false;

        historyIndexRef.current = nextIndex;
        recalledValueRef.current = text;
        applyValue(text, 'start');

        return true;
    }, [applyValue, getReversedUserTexts, textAreaRef]);

    const recallNext = useCallback((): boolean => {
        if (historyIndexRef.current <= -1) return false;

        const element = textAreaRef.current?.element;
        const offset = element ? getSerializedTextOffset(element) : null;
        const length = element ? serializeDirectiveEditableText(element).length : valueRef.current.length;
        const isCaretAtEnd = offset === null || offset === length;

        if (!isCaretAtEnd) return false;

        const nextIndex = historyIndexRef.current - 1;

        if (nextIndex === -1) {
            historyIndexRef.current = -1;
            recalledValueRef.current = historyDraftRef.current;
            applyValue(historyDraftRef.current, 'end');
            recalledValueRef.current = null;

            return true;
        }

        const reversed = getReversedUserTexts();
        const text = reversed[nextIndex];

        if (text === undefined) {
            historyIndexRef.current = -1;
            recalledValueRef.current = null;

            return false;
        }

        historyIndexRef.current = nextIndex;
        recalledValueRef.current = text;
        applyValue(text, 'end');

        return true;
    }, [applyValue, getReversedUserTexts, textAreaRef]);

    const notifyValueChange = useCallback((nextValue: string) => {
        if (recalledValueRef.current !== null && nextValue !== recalledValueRef.current) {
            historyIndexRef.current = -1;
            recalledValueRef.current = null;
        }
    }, []);

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent): boolean => {
            if (!enabled || event.defaultPrevented) return false;

            const hasArrowModifier = event.shiftKey || event.altKey || event.metaKey || event.ctrlKey;

            if (event.key === 'ArrowUp' && !hasArrowModifier && recallPrevious()) {
                event.preventDefault();

                return true;
            }

            if (event.key === 'ArrowDown' && !hasArrowModifier && recallNext()) {
                event.preventDefault();

                return true;
            }

            return false;
        },
        [enabled, recallNext, recallPrevious],
    );

    return { handleKeyDown, notifyValueChange, hasHistory: messageCount > 0 };
};
