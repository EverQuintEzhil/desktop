import type { SelectSuggestionItem } from '@/components';
import { adminAgentsApi } from '@/lib/api/admin/agents';
import type { AgentType } from '@/types/admin';

export type AgentSuggestion = SelectSuggestionItem<string> & { slug: string };

const PAGE_SIZE = 30;

/**
 * Async loader suitable for `Select` `data` prop — value is the slug so it can
 * be written directly into `ui.editAgentSlug` / `ui.videoAgentSlug`.
 */
export const fetchAgentsSuggestion = async (search: string): Promise<AgentSuggestion[]> => {
    const result = await adminAgentsApi.list({ page: 0, size: PAGE_SIZE, search });

    const values = (result?.values ?? []) as AgentType[];

    return values
        .filter((agent) => Boolean(agent.slug))
        .map((agent) => ({
            value: agent.slug,
            label: `${agent.name} (${agent.slug})`,
            slug: agent.slug,
        }));
};
