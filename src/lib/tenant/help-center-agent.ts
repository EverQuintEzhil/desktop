import { z } from 'zod';

export interface HelpCenterAgent {
    agentId: string;
    agentName: string;
    agentSlug: string;
}

const helpCenterAgentSchema = z.object({
    agentId: z.string().min(1),
    agentName: z.string().optional(),
    agentSlug: z.string().optional(),
});

export const parseHelpCenterAgent = (value: unknown): HelpCenterAgent | null => {
    const parsed = helpCenterAgentSchema.safeParse(value);

    if (!parsed.success) {
        return null;
    }

    return {
        agentId: parsed.data.agentId,
        agentName: parsed.data.agentName ?? '',
        agentSlug: parsed.data.agentSlug ?? '',
    };
};
