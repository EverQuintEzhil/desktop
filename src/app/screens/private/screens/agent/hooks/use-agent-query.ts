import { useQuery } from '@tanstack/react-query';

import { appAgentApi } from '@/lib/api/app/agent';
import type { AgentType } from '@/types/admin';

export const useAgentQuery = (agentId: string | undefined) =>
    useQuery<AgentType>({
        queryKey: ['agent', agentId],
        queryFn: ({ signal }) => appAgentApi.getAgent<AgentType>(agentId!, { signal }),
        enabled: Boolean(agentId),
    });
