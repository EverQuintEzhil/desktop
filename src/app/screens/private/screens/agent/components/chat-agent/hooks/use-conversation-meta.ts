import { useQuery } from '@tanstack/react-query';

import { appConversationApi } from '@/lib/api/app/conversation';
import type { HistoryType } from '@/types/chat';

interface RawConversationMeta {
    title?: string;
    project_id?: string | null;
    projectId?: string | null;
    chat_project_id?: string | null;
    favorited?: boolean;
    favorited_at?: string | number | null;
    ai_info?: HistoryType['ai_info'];
}

export interface ConversationMeta {
    title: string;
    favorited: boolean;
    projectId: string | null;
    aiInfo: HistoryType['ai_info'];
}

const normalizeConversationMeta = (raw: RawConversationMeta): ConversationMeta => ({
    title: raw.title ?? '',
    favorited: raw.favorited ?? raw.favorited_at != null,
    projectId: raw.project_id ?? raw.projectId ?? raw.chat_project_id ?? null,
    aiInfo: raw.ai_info,
});

export const getConversationMetaQueryKey = (agentId: string, conversationId: string) =>
    ['conversation-meta', agentId, conversationId] as const;

export const useConversationMeta = (agentId: string, conversationId: string | null) => {
    const query = useQuery({
        queryKey: getConversationMetaQueryKey(agentId, conversationId ?? ''),
        enabled: Boolean(conversationId),
        queryFn: async ({ signal }) => {
            const raw = await appConversationApi.getConversation<RawConversationMeta>(
                conversationId!,
                { agentId },
                { signal },
            );

            return normalizeConversationMeta(raw);
        },
    });

    return {
        ...query,
        title: query.data?.title ?? '',
        favorited: query.data?.favorited ?? false,
        projectId: query.data?.projectId ?? null,
        aiInfo: query.data?.aiInfo,
    };
};

export default useConversationMeta;
