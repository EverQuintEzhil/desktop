import { useCallback, useRef } from 'react';

const BIND_RETRY_ATTEMPTS = 40;
const BIND_RETRY_DELAY_MS = 50;

interface ResumableChat {
    status: string;
    resumeStream: () => Promise<void>;
    stop: () => Promise<void>;
}

interface StreamResumeControllerOptions {
    conversationIdRef: { current: string | null | undefined };
    resetAssistantMessage: (messageId: string) => void;
    abortAttach: () => void;
    isSendInFlight: () => boolean;
}

export const useStreamResumeController = ({
    conversationIdRef,
    resetAssistantMessage,
    abortAttach,
    isSendInFlight,
}: StreamResumeControllerOptions) => {
    const resumeStreamRef = useRef<(() => Promise<void>) | null>(null);
    const stopStreamRef = useRef<(() => Promise<void>) | null>(null);
    const chatStatusRef = useRef<(() => string) | null>(null);
    const resumeStreamInFlightRef = useRef(new Map<string, Promise<void>>());

    const bindChat = useCallback((chat: ResumableChat) => {
        resumeStreamRef.current = () => chat.resumeStream();
        stopStreamRef.current = () => chat.stop();
        chatStatusRef.current = () => chat.status;
    }, []);

    const resumeStream = useCallback(
        async (options?: { force?: boolean }) => {
            const force = options?.force === true;
            const inFlightKey = conversationIdRef.current ?? '';

            if (!force) {
                const inFlight = resumeStreamInFlightRef.current.get(inFlightKey);

                if (inFlight) {
                    await inFlight;

                    return;
                }
            }

            // Same RuntimeHook binding race as resumeSend (e.g. called right after mount).
            const pending = (async () => {
                for (let attempt = 0; attempt < BIND_RETRY_ATTEMPTS; attempt += 1) {
                    const resume = resumeStreamRef.current;

                    if (resume) {
                        const status = chatStatusRef.current?.();

                        if (!force && (isSendInFlight() || status === 'submitted' || status === 'streaming')) return;

                        await resume();

                        return;
                    }

                    await new Promise<void>((resolve) => {
                        window.setTimeout(resolve, BIND_RETRY_DELAY_MS);
                    });
                }

                // eslint-disable-next-line no-console
                console.warn(
                    `[chat] resumeStream gave up: the chat runtime never bound within ${
                        BIND_RETRY_ATTEMPTS * BIND_RETRY_DELAY_MS
                    }ms for conversation "${inFlightKey || '(none)'}"`,
                );
            })();

            resumeStreamInFlightRef.current.set(inFlightKey, pending);

            try {
                await pending;
            } finally {
                if (resumeStreamInFlightRef.current.get(inFlightKey) === pending) {
                    resumeStreamInFlightRef.current.delete(inFlightKey);
                }
            }
        },
        [conversationIdRef, isSendInFlight],
    );

    // Temporal attempt reset. A surgical setMessages alone loses to the active
    // stream job (its internal state.message is authoritative and rewrites the
    // message on every chunk), and a fresh stream job CONTINUES the last
    // assistant message's parts. So: stop the current consumption, clear the
    // message, then re-attach — the replay from the new attempt's start marker
    // rebuilds the message from scratch.
    const reattachAfterAttemptBump = useCallback(
        async (messageId: string) => {
            abortAttach();
            await stopStreamRef.current?.();
            resetAssistantMessage(messageId);
            await resumeStream({ force: true });
        },
        [abortAttach, resetAssistantMessage, resumeStream],
    );

    return { bindChat, resumeStream, reattachAfterAttemptBump };
};
