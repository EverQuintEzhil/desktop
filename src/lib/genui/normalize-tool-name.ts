/**
 * Normalizes an app `refName` to its AI SDK tool name (spec §16, D12).
 *
 * MUST match the `ai` repo's registration rule exactly:
 * `refName.replace(/[^a-zA-Z0-9_]/g, '_')` — every character outside
 * [A-Za-z0-9_] becomes `_`, 1:1, no collapsing. e.g. `hello-card` →
 * `hello_card`. The `app` loader keys on this identical normalized name so the
 * tool-call part and its `data-genui` part correlate by `toolCallId`.
 */
export const normalizeToolName = (refName: string): string => refName.replace(/[^a-zA-Z0-9_]/g, '_');
