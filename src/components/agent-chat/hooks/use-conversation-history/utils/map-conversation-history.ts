import type { HistoryType } from '@/types/chat';

import type { ConversationHistory } from '../types';

function mapGenerationStatus(status: ConversationHistory['status']): HistoryType['generation_status'] {
    if (status === 'generating') return 'in_progress';
    if (status === 'failed') return 'failed';
    if (status === 'ready') return 'completed';

    return null;
}

export function mapConversationHistory(
    history: ConversationHistory & { project_id?: string; projectId?: string },
): HistoryType {
    return {
        ...history,
        chat_project_id: history.project_id || history.projectId || history.chat_project_id,
        created_at: new Date(history.created_at).getTime(),
        updated_at: new Date(history.updated_at).getTime(),
        favorited: history.favorited ?? history.favorited_at != null,
        favorited_at: history.favorited_at != null ? new Date(history.favorited_at).getTime() : null,
        generation_status: mapGenerationStatus(history.status),
        status: history.status,
    };
}
