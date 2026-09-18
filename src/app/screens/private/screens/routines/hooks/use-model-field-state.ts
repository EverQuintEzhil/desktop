import { agentDefaultModel, agentModelOptions, useAgentDetail } from './use-agent-detail';

export const AGENT_DEFAULT_MODEL_VALUE = '';

export const useModelFieldState = (agentId: string, value: string) => {
    const { data: agent, isPending, isError } = useAgentDetail(agentId);
    const options = agent ? agentModelOptions(agent) : [];

    return {
        agent,
        isPending,
        isError,
        options,
        defaultModel: agent ? agentDefaultModel(agent) : undefined,
        isStale: Boolean(agent) && value !== AGENT_DEFAULT_MODEL_VALUE && !options.some((o) => o.value === value),
    };
};
