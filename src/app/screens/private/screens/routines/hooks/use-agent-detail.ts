import { useQuery } from '@tanstack/react-query';

import { appAgentApi } from '@/lib/api/app/agent';
import { modelDisplayName } from '@/types/admin';
import type { UiRoutinesConfigType } from '@/types/ui';

export interface AgentModel {
    _id: string;
    label?: string | null;
    model?: string | null;
}

export interface AgentDetail {
    _id: string;
    name: string;
    defaultModelId?: string;
    models?: AgentModel[];
    uiConfig?: {
        /** Routines are chat-only, and this is the one request that carries the agent's surface kind. */
        componentType?: string;
        routines?: UiRoutinesConfigType;
        spaces?: { enabled?: boolean };
        models?: { name: string; modelId: string }[];
    };
}

export interface AgentModelOption {
    value: string;
    label: string;
}

/**
 * The paged `/agents` list carries neither `models` nor `defaultModelId`, and neither does the
 * launcher payload — only the full single-agent record does, which is why the model field costs
 * one extra request per agent chosen.
 */
export const useAgentDetail = (agentId: string) =>
    useQuery({
        queryKey: ['agent', 'detail', agentId],
        enabled: Boolean(agentId),
        queryFn: () => appAgentApi.getFullAgent<AgentDetail>(agentId),
    });

export const agentDefaultModel = (agent: AgentDetail): AgentModel | undefined =>
    agent.models?.find((model) => model._id === agent.defaultModelId);

/**
 * The chat composer offers `uiConfig.models`, whose `modelId` is a model `_id`, so a routine's
 * `modelId` comes from the same list. The agent's assigned models cover agents whose ui-config
 * lists none, which would otherwise offer nothing but the default.
 */
export const agentModelOptions = (agent: AgentDetail): AgentModelOption[] => {
    const configured = agent.uiConfig?.models ?? [];

    if (configured.length > 0) return configured.map((model) => ({ value: model.modelId, label: model.name }));

    return (agent.models ?? []).map((model) => ({
        value: model._id,
        label: modelDisplayName(model) || model._id,
    }));
};

export const hasSelectableModels = (agent: AgentDetail): boolean =>
    Boolean(agentDefaultModel(agent)) || agentModelOptions(agent).length > 0;
