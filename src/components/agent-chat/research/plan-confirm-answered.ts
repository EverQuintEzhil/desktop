/**
 * Tool call ids of research plan gates answered in this page's lifetime.
 *
 * A human tool resumes the paused turn from its result, and the generic collector's only
 * completion signal is "the turn produced text after the tool call". A run that ends on the
 * gate alone — a cancelled plan, or one that failed immediately — leaves a result with no
 * text after it, so every later reopen of that conversation would read the stored answer as
 * a turn still waiting to be resumed and fire a request at a finished run, forever.
 *
 * Only an answer given here can resume anything, so membership of this set is the honest
 * test. Module-level for the same reason as `deep-research-sent.ts`: the writer is a card
 * deep in the transcript and the reader is the runtime's resume predicate.
 */
const answeredHere = new Set<string>();

export const markPlanConfirmAnswered = (toolCallId: string): void => {
    answeredHere.add(toolCallId);
};

export const wasPlanConfirmAnsweredHere = (toolCallId: string): boolean => answeredHere.has(toolCallId);

/** Called when the thread is replaced, alongside the runtime's other per-thread resets. */
export const clearPlanConfirmAnswered = (): void => {
    answeredHere.clear();
};
