import { apiClient, type ApiRequestConfig } from '../client';

/** The two home-page tabs are backed by different tables: "My" lists `agents._id`, firmwide lists `launchers._id`. */
export type AgentPinScope = 'my' | 'firm';

const AGENT_PIN_SCOPES: AgentPinScope[] = ['my', 'firm'];

/**
 * One stored row per user (`user_agent_layouts`, unique on `user_id`); the user comes from the
 * session and is never sent in the request. An absent key is not an empty list: absent means that
 * tab was never customized and the client applies its own defaults, `[]` means nothing is pinned.
 */
export type AgentLayoutPayload = Partial<Record<AgentPinScope, string[]>>;

const AGENT_LAYOUT_URL = '/users/me/agentlayout';

/**
 * A key held as an explicit `undefined` survives `Object.keys` and is then dropped by
 * `JSON.stringify`, which is how a caller could otherwise send the `{}` the endpoint rejects.
 */
const toPatchBody = (patch: AgentLayoutPayload): AgentLayoutPayload => {
    const body: AgentLayoutPayload = {};

    AGENT_PIN_SCOPES.forEach((scope) => {
        const pinned = patch[scope];

        if (pinned !== undefined) body[scope] = pinned;
    });

    return body;
};

export const appAgentLayoutApi = {
    /** Resolves to `null` when the user has no stored row. */
    get: (config?: ApiRequestConfig): Promise<AgentLayoutPayload | null> =>
        apiClient.get<AgentLayoutPayload | null>(AGENT_LAYOUT_URL, config),

    /**
     * A per-key patch, not a whole-row replace: the endpoint merges the body over the stored jsonb.
     * Its zod `strictObject` demands at least one key, so an unknown key and an empty object are
     * both a 400 — hence the body is rebuilt here rather than forwarded.
     */
    save: async (patch: AgentLayoutPayload, config?: ApiRequestConfig): Promise<AgentLayoutPayload | null> => {
        const body = toPatchBody(patch);

        if (Object.keys(body).length === 0) {
            throw new Error('An agent layout patch must carry at least one scope.');
        }

        return apiClient.put<AgentLayoutPayload | null, AgentLayoutPayload>(AGENT_LAYOUT_URL, body, config);
    },

    /** Deletes the row — "reset to defaults" for both tabs at once. Idempotent server side. */
    remove: async (config?: ApiRequestConfig): Promise<void> => {
        await apiClient.delete<null>(AGENT_LAYOUT_URL, config);
    },
};
