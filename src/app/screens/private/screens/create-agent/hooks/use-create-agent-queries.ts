import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminAgentsApi } from '@/lib/api/admin/agents';
import { PREVIEW_AGENT_DETAIL_KEY } from '@/lib/api/common/agent-cache';

import {
    getCreateAgentConversationMessages,
    getCreateAgentConversationsPage,
    getSkill,
    updateSkill,
} from '../lib/builder-conversations-api';
import type { SkillUpdatePatch } from '../lib/builder-conversations-api';
import { loadAgentConfig } from '../lib/create-agent-api';

export const SKILLS_PICKER_KEY = ['create-agent', 'skills-picker'];

export const usePreviewAgentQuery = (agentId: string, previewOpen: boolean) =>
    useQuery({
        queryKey: [...PREVIEW_AGENT_DETAIL_KEY, agentId],
        queryFn: () => adminAgentsApi.getBySlugOrId(agentId),
        enabled: previewOpen,
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 0,
        gcTime: 0,
    });

export const useConversationMessagesQuery = (conversationId: string, agentId?: string, enabled = true) =>
    useQuery({
        queryKey: ['create-agent-conversation-messages', conversationId, agentId],
        queryFn: () => getCreateAgentConversationMessages(conversationId, agentId),
        enabled: enabled && !!conversationId,
        retry: false,
        refetchOnWindowFocus: false,
    });

export const useAgentConfigQuery = (agentId: string | undefined) =>
    useQuery({
        queryKey: ['create-agent-agent', agentId],
        queryFn: () => loadAgentConfig(agentId!),
        enabled: !!agentId,
        retry: false,
        refetchOnWindowFocus: false,
    });

export const useConversationsQuery = (agentId: string | undefined) =>
    useInfiniteQuery({
        queryKey: ['create-agent-conversations', agentId],
        queryFn: ({ pageParam }) => getCreateAgentConversationsPage(agentId!, pageParam),
        enabled: !!agentId,
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
        retry: false,
        refetchOnWindowFocus: false,
    });

export const useSkillQuery = (skillId: string) =>
    useQuery({
        queryKey: ['create-agent', 'skill', skillId],
        queryFn: () => getSkill(skillId),
        enabled: !!skillId,
    });

export const useUpdateSkillMutation = (skillId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (patch: SkillUpdatePatch) => updateSkill(skillId, patch),
        onSuccess: (updated) => {
            queryClient.setQueryData(['create-agent', 'skill', skillId], updated);
            queryClient.invalidateQueries({ queryKey: SKILLS_PICKER_KEY });
        },
    });
};
