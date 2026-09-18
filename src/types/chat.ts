import type { LucideIcon } from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';

import type { SelectSuggestionItem } from '@/components';

export type ParameterValue = SelectSuggestionItem<string> | number | boolean | string;

// Live v3 conversation statuses plus legacy values still emitted by older code.
export type ConversationStatus =
    | 'generating'
    | 'awaiting_input'
    | 'ready'
    | 'failed'
    | 'cancelled'
    | 'killed'
    | 'completed';

export type HistoryType = {
    agent_id?: string;
    title: string;
    search_text?: string;
    user_id?: string;
    created_at: number;
    updated_at: number;
    usage?: {
        input_tokens: number;
        cached_input_tokens: number;
        output_tokens: number;
        cached_output_tokens: number;
        reasoning_tokens: number;
        cached_reasoning_tokens: number;
        total_tokens: number;
    };
    ai_info?: {
        provider?: string;
        model?: string;
        model_id?: string;
        token_usage?: {
            input_tokens?: number;
            cached_input_tokens?: number;
            cache_write_input_tokens?: number;
            reasoning_tokens?: number;
            output_tokens?: number;
            total_tokens?: number;
            co2_multiplier_per_token?: number | null;
            input_tokens_co2?: number | null;
            cached_input_tokens_co2?: number | null;
            cache_write_input_tokens_co2?: number | null;
            reasoning_tokens_co2?: number | null;
            output_tokens_co2?: number | null;
            total_tokens_co2?: number | null;
            input_tokens_cost?: number | null;
            cached_input_tokens_cost?: number | null;
            cache_write_input_tokens_cost?: number | null;
            reasoning_tokens_cost?: number | null;
            output_tokens_cost?: number | null;
            total_tokens_cost?: number | null;
            input_cost_per_million_tokens?: number | null;
            cached_input_cost_per_million_tokens?: number | null;
            cache_write_input_cost_per_million_tokens?: number | null;
            reasoning_cost_per_million_tokens?: number | null;
            output_cost_per_million_tokens?: number | null;
        };
    };
    is_deleted?: boolean;
    favorited?: boolean;
    favorited_at?: number | null;
    chat_project_id?: string;
    _id: string;
    user?: {
        email: string;
        name: {
            first: string;
            last: string;
        };
    };
    generation_status: 'in_progress' | 'completed' | 'failed' | null;
    status?: ConversationStatus;
};

export type FileType = {
    name: string;
    extension?: string;
    type?: string;
    url: string;
    location?: string;
    _id?: string;
    thumb?: string;
    tempId?: string;
    size?: number;
    groupName?: string | undefined;
    isUploading?: boolean;
    uploadProgress?: number;
    uploadError?: boolean;
    uploadErrorMessage?: string;
};

export type QuestionType = {
    role: 'user';
    content: string;
    files?: FileType[];
    conversationId: string;
};

export interface MessageContentType {
    text?: string;
}

export type AnswerType = {
    _id: string;
    role: 'assistant';
    content: string | MessageContentType[];
    conversationId: string;
    request_id: string;
    isPlaceholder?: boolean;
    relatedQuestions?: string[];
    isError?: boolean;
    statusMessage?: string;
    lastUpdated?: number;
    liked?: boolean;
    disliked?: boolean;
    attachments?: {
        file_ids?: string[];
        sources?: ToolSourcesType[];
    };
    reasoning?: string;
};

export type MessageType = QuestionType | AnswerType;

export interface ToolSourcesType extends Record<string, unknown> {
    title: string;
    url: string;
    description: string;
    favicon?: string;
    site_name?: string;
    thumbnail?: string;
    type: 'url' | 'files';
}

export interface PlusDropdownOption {
    label: string;
    value: string;
    icon: LucideIcon;
    onClick: () => void;
}

export type ConversationDataPart = {
    conversation_id: string;
};

export type MessageMetadataCustom = {
    custom: {
        fileIds: string[];
    };
};

export interface ChatFilesState {
    files: FileType[];
    isUploading: boolean;
    fileInputRef: RefObject<HTMLInputElement | null>;
    setFiles: (files: FileType[]) => void;
    updateFileById: (tempId: string, updates: Partial<FileType>) => void;
    /** Attaches already-validated files (no `accept` check) — used by the paste-to-file path. */
    addFiles: (files: File[]) => void;
    onChangeFile: (event: ChangeEvent<HTMLInputElement> | ClipboardEvent | DragEvent) => void;
    clearFiles: () => void;
    retryUpload: (tempId: string) => void;
}
