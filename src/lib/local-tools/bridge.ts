import { invoke, isTauri } from '@tauri-apps/api/core';

/**
 * Bridge to the Rust side of the local coding tools (src-tauri/src/tools/).
 * Rust is the single source of truth: the manifest (names, descriptions, JSON
 * schemas) comes from `agent-core tools`, and every execution is one
 * `agent-core --root <workspace> call <name> '<json>'` subprocess.
 */

export interface LocalToolManifestEntry {
    name: string;
    description: string;
    /** JSON Schema (`type: "object"`) — exactly what the chat API's clientTools contract requires. */
    parameters: Record<string, unknown>;
}

/** True only inside the Tauri shell — in a plain browser there is no bridge. */
export const isDesktopRuntime = (): boolean => {
    try {
        return isTauri();
    } catch {
        return false;
    }
};

let manifestPromise: Promise<LocalToolManifestEntry[]> | null = null;

/** The tool manifest, fetched once per app session (the catalog is frozen per turn anyway). */
export const listLocalTools = (): Promise<LocalToolManifestEntry[]> => {
    if (!manifestPromise) {
        manifestPromise = invoke<LocalToolManifestEntry[]>('list_local_tools').catch((error: unknown) => {
            // A failed probe (e.g. agent-core not installed yet) must not poison the session.
            manifestPromise = null;
            throw error;
        });
    }

    return manifestPromise;
};

/** Executions still running, by call id — what chat Stop cancels. */
const inFlightCallIds = new Set<string>();

const newCallId = (): string =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `call-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const runLocalTool = async (
    name: string,
    args: Record<string, unknown>,
    root: string,
): Promise<unknown> => {
    const callId = newCallId();

    inFlightCallIds.add(callId);
    try {
        return await invoke<unknown>('run_local_tool', { name, args, root, callId });
    } finally {
        inFlightCallIds.delete(callId);
    }
};

/**
 * Chat Stop: flag every in-flight local tool for cancellation. The Rust runner
 * kills each child on its next poll tick and the pending call resolves with a
 * "cancelled" refusal, keeping the paused turn's tool results consistent.
 */
export const cancelInFlightLocalTools = async (): Promise<void> => {
    if (inFlightCallIds.size === 0) {
        return;
    }

    try {
        await invoke('cancel_local_tools', { callIds: [...inFlightCallIds] });
    } catch (error) {
        // Failing to cancel must never break the stop itself.
        console.error('Failed to cancel local tools:', error);
    }
};
