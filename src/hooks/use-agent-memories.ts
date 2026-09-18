import { useQuery } from '@tanstack/react-query';

import { appAgentApi } from '@/lib/api/app/agent';
import type { AgentType, LauncherType, MemoryType } from '@/types/admin';

const resolveEmbeddedAgent = (selectedAgent: AgentType | LauncherType | null): AgentType | null => {
    if (!selectedAgent) return null;
    if ('agent' in selectedAgent && selectedAgent.agent) return selectedAgent.agent;

    return selectedAgent as AgentType;
};

export const useAgentMemories = (selectedAgent: AgentType | LauncherType | null, enabled: boolean) => {
    const embeddedAgent = resolveEmbeddedAgent(selectedAgent);
    const agentId = embeddedAgent?._id;
    const hasMemories = Array.isArray(embeddedAgent?.memories);

    const { data, isLoading } = useQuery({
        queryKey: ['agent', agentId, 'memories'],
        queryFn: () => appAgentApi.getFullAgent<AgentType>(agentId!),
        enabled: enabled && Boolean(agentId) && !hasMemories,
    });

    const memories: MemoryType[] = hasMemories ? (embeddedAgent!.memories as MemoryType[]) : (data?.memories ?? []);

    return { memories, isLoading: enabled && !hasMemories && isLoading };
};
