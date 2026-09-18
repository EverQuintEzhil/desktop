import { z } from 'zod';

const namedItemSchema = z.object({
    _id: z.string(),
    name: z.string(),
    provider: z.string().optional(),
    isRecommended: z.boolean().optional(),
});

export type AgentConfigItem = z.infer<typeof namedItemSchema>;

export const agentConfigDraftSchema = z
    .object({
        name: z.string().optional(),
        instructions: z.string().optional(),
        mcpServers: z.array(namedItemSchema).optional(),
        tools: z.array(namedItemSchema).optional(),
        agents: z.array(namedItemSchema).optional(),
        skills: z.array(namedItemSchema).optional(),
        files: z.array(namedItemSchema).optional(),
        memories: z.array(namedItemSchema).optional(),
        modelId: z.string().optional(),
        modelIds: z.array(z.string()).optional(),
        models: z.array(namedItemSchema).optional(),
    })
    .transform(({ modelId, modelIds, models, ...rest }) => {
        const idsToItems = (ids: string[]) => ids.map((id) => ({ _id: id, name: id }));
        const resolved =
            models ?? (modelIds ? idsToItems(modelIds) : undefined) ?? (modelId ? idsToItems([modelId]) : undefined);

        return { ...rest, ...(resolved ? { models: resolved } : {}) };
    });

export type AgentConfigDraft = z.infer<typeof agentConfigDraftSchema>;

export function parseAgentConfigDraft(data: unknown): AgentConfigDraft | null {
    const result = agentConfigDraftSchema.safeParse(data);

    if (!result.success) {
        return null;
    }

    return result.data;
}
