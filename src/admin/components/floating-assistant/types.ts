import type { UIMessage } from 'ai';

import type { ConversationDataPart } from '@/types/chat';

export interface FloatingAssistantConfig {
    /** Full URL of the AI streaming endpoint */
    api: string;
    /** Mode sent in the request body — server uses this to pick the system prompt */
    mode: string;
    /** Display label shown in the panel header */
    label?: string;
    /** Optional tool ID (24-char hex) for the tool-builder endpoint */
    toolId?: string;
}

export type FloatingAssistantDataParts = {
    conversation: ConversationDataPart;
};

export type FloatingAssistantUIMessage = UIMessage<unknown, FloatingAssistantDataParts>;
