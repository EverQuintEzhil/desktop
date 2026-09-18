import type { ModelValueType } from '@/types/ui';

import { resolveModelName } from '../../../lib/create-agent-api';
import type { AgentConfigDraft, AgentConfigItem } from '../../../types';
import type { PersistedSnapshot } from '../types';

export const sameIds = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) {
        return false;
    }

    const sortedA = [...a].sort();
    const sortedB = [...b].sort();

    return sortedA.every((id, index) => id === sortedB[index]);
};

export const sameOrderedIds = (a: string[], b: string[]): boolean =>
    a.length === b.length && a.every((id, i) => id === b[i]);

// Matched by id rather than by position: the skills list is compared with `sameIds`, so two
// snapshots can hold the same skills in a different order.
export const sameRecommendedFlags = (a: AgentConfigItem[], b: AgentConfigItem[]): boolean => {
    const previous = new Map(b.map((item) => [item._id, !!item.isRecommended]));

    return a.every((item) => previous.get(item._id) === !!item.isRecommended);
};

export const buildModels = async (items: AgentConfigItem[], existing: ModelValueType[]): Promise<ModelValueType[]> => {
    const byId = new Map(existing.map((m) => [m.modelId, m]));

    return Promise.all(
        items.map(async (item) => {
            const current = byId.get(item._id);

            if (current) {
                return current;
            }

            const name = item.name && item.name !== item._id ? item.name : await resolveModelName(item._id);

            return { name, modelId: item._id };
        }),
    );
};

export const toSnapshot = (config: AgentConfigDraft): PersistedSnapshot => ({
    name: config.name ?? '',
    instructions: config.instructions ?? '',
    models: config.models ?? [],
    mcpServers: config.mcpServers ?? [],
    agentIds: (config.agents ?? []).map((item) => item._id),
    toolIds: (config.tools ?? []).map((item) => item._id),
    dataStoreIds: (config.files ?? []).map((item) => item._id),
    skills: config.skills ?? [],
    memoryIds: (config.memories ?? []).map((item) => item._id),
});
