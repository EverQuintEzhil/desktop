import type { ConversationStatus, HistoryType } from '@/types/chat';

export type ConversationHistory = Omit<HistoryType, 'created_at' | 'updated_at' | 'generation_status' | 'status'> & {
    created_at: string | number;
    updated_at: string | number;
    favorited?: boolean;
    favorited_at?: string | number | null;
    status?: ConversationStatus;
};

export interface UseConversationHistoryOptions {
    includeAll?: boolean;
    search?: string;
    enabled?: boolean;
}
