import { invoke } from '@tauri-apps/api/core';

/**
 * Shared state for the Space terminal — ONE live PTY session per app, used by
 * both lanes: the visible panel (user types) and the agent's `terminal` tool
 * (`runInTerminal`). Dependency-free module store (cf. lib/local-tools/approval.ts)
 * so the toolkit can drive it without React context.
 */

export interface TerminalState {
    sessionId: string | null;
    folderPath: string | null;
    isOpen: boolean;
}

let state: TerminalState = { sessionId: null, folderPath: null, isOpen: false };
const listeners = new Set<() => void>();

const emit = (): void => {
    listeners.forEach((listener) => listener());
};

export const subscribeToTerminal = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

export const getTerminalState = (): TerminalState => state;

export const openTerminalPanel = (folderPath: string): void => {
    state = { ...state, isOpen: true, folderPath: state.folderPath ?? folderPath };
    emit();
};

/** Hides the panel only — the session stays alive for the agent. */
export const closeTerminalPanel = (): void => {
    state = { ...state, isOpen: false };
    emit();
};

/** The reader thread saw EOF (user typed `exit`, or the shell died). */
export const markSessionExited = (id: string): void => {
    if (state.sessionId === id) {
        state = { ...state, sessionId: null };
        emit();
    }
};

/**
 * One live session per app, re-rooted when the Space folder changes. Opening
 * also shows the panel, so the user always sees what the agent is doing.
 */
export const ensureTerminalSession = async (folderPath: string): Promise<string> => {
    if (state.sessionId && state.folderPath === folderPath) {
        return state.sessionId;
    }

    if (state.sessionId) {
        await invoke('terminal_close', { id: state.sessionId }).catch(() => undefined);
    }

    const id = await invoke<string>('terminal_open', { root: folderPath, cols: 80, rows: 24 });

    state = { sessionId: id, folderPath, isOpen: true };
    emit();

    return id;
};

/** Agent lane: run one command in the shared session (opens it if needed). */
export const runInTerminal = async (folderPath: string, command: string, timeoutMs?: number): Promise<unknown> => {
    const id = await ensureTerminalSession(folderPath);

    return invoke<unknown>('terminal_run', { id, command, timeoutMs });
};

/** Test hook: forget the session without touching the backend. */
export const resetTerminalStateForTests = (): void => {
    state = { sessionId: null, folderPath: null, isOpen: false };
    emit();
};
