/**
 * The composer's pending space selection (the space chip next to "Ask anything"
 * on the agent home). It lives as local state inside agent-chat-composer.tsx
 * and reaches chat-agent only at submit time (`payload.projectId`) — too late
 * for the local-tools gating, which must attach clientTools to the FIRST
 * request of a new space chat and drive the status chip while the user is
 * still typing. Module store, same dependency-free pattern as approval.ts.
 */

let composerSpaceId: string | null = null;
const listeners = new Set<() => void>();

const emit = (): void => {
    listeners.forEach((listener) => listener());
};

export const subscribeToComposerSpace = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

export const getComposerSpaceId = (): string | null => composerSpaceId;

export const setComposerSpaceId = (id: string | null): void => {
    if (composerSpaceId === id) {
        return;
    }

    composerSpaceId = id;
    emit();
};
