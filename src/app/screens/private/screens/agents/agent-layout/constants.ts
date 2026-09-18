/**
 * Per-tab cap on pinned agents. Must stay in lockstep with `AGENT_PIN_LIMIT` in
 * `api/api/schemas/AgentLayout/helpers.js`, which feeds the endpoint's per-list `.max()`.
 */
export const AGENT_PIN_LIMIT = 10;

/** Interim, pending an admin-editable `isDefaultPinned` flag on the launcher payload. */
export const DEFAULT_PINNED_COUNT = 4;
