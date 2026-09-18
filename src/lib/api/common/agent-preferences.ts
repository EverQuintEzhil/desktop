import { z } from 'zod';

import { apiClient, type ApiRequestConfig } from '../client';

/**
 * The API validates the PATCH body with a zod `strictObject` that accepts only
 * `defaultModelId` (a 24-character hex ObjectId) and rejects an empty body, so
 * that key is the only thing this module may ever send. The read stays loose
 * because the endpoint merges server-side: a key written by a future client must
 * not make the whole response read as a parse failure.
 */
const agentPreferencesSchema = z.looseObject({
    defaultModelId: z.string().optional(),
});

export type AgentPreferences = z.infer<typeof agentPreferencesSchema>;

export interface AgentPreferencesPatch {
    defaultModelId: string;
}

const parseAgentPreferences = (raw: unknown): AgentPreferences | null => {
    const parsed = agentPreferencesSchema.safeParse(raw);

    return parsed.success ? parsed.data : null;
};

export const agentPreferencesApi = {
    async getPreferences(agentId: string, config?: ApiRequestConfig): Promise<AgentPreferences | null> {
        const raw = await apiClient.get<unknown>(`/agents/${agentId}/preferences`, config);

        return parseAgentPreferences(raw);
    },

    async patchPreferences(
        agentId: string,
        patch: AgentPreferencesPatch,
        config?: ApiRequestConfig,
    ): Promise<AgentPreferences | null> {
        const raw = await apiClient.patch<unknown, AgentPreferencesPatch>(
            `/agents/${agentId}/preferences`,
            patch,
            config,
        );

        return parseAgentPreferences(raw);
    },
};
