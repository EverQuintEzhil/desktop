/**
 * Ids of user messages sent with Deep Research on, for the life of this page.
 *
 * The composer never constructs the user message — the runtime appends it — so there is no
 * metadata to stamp at send time, and the persisted `deep_research` flag only arrives on the
 * next history load. Without this the user's own bubble stays unlabelled for the whole run
 * and only gains its tag after a reload.
 *
 * Module-level rather than React state because the writer is the transport's request builder
 * and the reader is a message component, with no shared owner between them.
 */
const sentWithDeepResearch = new Set<string>();

export const markSentWithDeepResearch = (messageId: string): void => {
    sentWithDeepResearch.add(messageId);
};

export const wasSentWithDeepResearch = (messageId: string): boolean => sentWithDeepResearch.has(messageId);

/** Called when the thread is replaced, alongside the runtime's own id-alias reset. */
export const clearSentWithDeepResearch = (): void => {
    sentWithDeepResearch.clear();
};
