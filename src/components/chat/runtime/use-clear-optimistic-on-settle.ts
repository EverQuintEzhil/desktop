import type { UIMessage } from 'ai';
import { useEffect, useRef } from 'react';

interface SettleChat<TMsg extends UIMessage> {
    status: string;
    setMessages: (updater: (messages: TMsg[]) => TMsg[]) => void;
}

/**
 * Clears the stale `metadata.isOptimistic` flag the AI SDK message converter
 * freezes onto the streaming assistant message.
 *
 * The converter caches conversions keyed on the message object identity and
 * never recomputes once the run settles, so a message first seen while
 * `isRunning` was true stays `isOptimistic: true` forever. assistant-ui then
 * evicts that finished answer as an off-branch "optimistic" node on the next
 * edit/regenerate fork, silently dropping the branch.
 *
 * When the run settles (`status` transitions to `ready`), bust the last
 * assistant message's object identity so the converter re-runs with
 * `isRunning=false` and drops the flag. Workaround for an upstream assistant-ui
 * bug; safe to remove once their converter re-keys on metadata.
 *
 * NOTE: the repo disables `react-hooks/exhaustive-deps`, so the `[chat]`
 * dependency is not lint-enforced — keep it correct by hand.
 */
export function useClearOptimisticOnSettle<TMsg extends UIMessage>(chat: SettleChat<TMsg>): void {
    const previousStatusRef = useRef(chat.status);

    useEffect(() => {
        const previousStatus = previousStatusRef.current;

        previousStatusRef.current = chat.status;

        if (chat.status !== 'ready') return;
        if (previousStatus !== 'streaming' && previousStatus !== 'submitted') return;

        chat.setMessages((messages) => {
            const lastMessage = messages.at(-1);

            if (!lastMessage || lastMessage.role !== 'assistant') return messages;

            return [...messages.slice(0, -1), { ...lastMessage }];
        });
    }, [chat]);
}
