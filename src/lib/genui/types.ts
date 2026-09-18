/**
 * Client-side types for the GenUI native surface (spec §9.2, §9.4, §12).
 *
 * The `ai` repo emits the ui ref as a `data-genui` UI-message part
 * (`transient:false`, spec D10) correlated to its tool call by `toolCallId`.
 */

/** Payload carried by the `data-genui` stream part (spec §9.2 / D10). */
export interface GenUIDataPayload {
    toolCallId: string;
    appId: string;
    refName: string;
    version: string;
    bundleUrl: string;
    props: Record<string, unknown>;
    display?: { framed?: boolean; maxWidth?: string };
}

/** A GenUI app linked to an agent (carried on the agent detail; spec §11/§12). */
export interface AgentApp {
    appId: string;
    refName: string;
    version: string;
    bundleUrl: string;
    description?: string;
}

/**
 * Per-widget persisted state (spec D5). Stored on the message record keyed by
 * `toolCallId` so a re-opened conversation restores each widget's state.
 */
export type GenUIMessageState = Record<string, unknown>;
