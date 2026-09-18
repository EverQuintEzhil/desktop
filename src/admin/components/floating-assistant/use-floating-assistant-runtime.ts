import type { ChatOnFinishCallback } from 'ai';
import { useRef } from 'react';

import { useChatRuntimeFromConfig } from '@/components/chat/runtime/create-chat-runtime';
import { getMessageFileIds } from '@/lib/chat/file-attachments';
import { extractMessageText, findLastUserMessage } from '@/lib/chat/message-text';

import type { FloatingAssistantConfig, FloatingAssistantUIMessage } from './types';

interface FloatingAssistantRuntimeOptions {
    config: FloatingAssistantConfig;
    onFinish?: () => void;
}

export const useFloatingAssistantRuntime = (options: FloatingAssistantRuntimeOptions) => {
    const configRef = useRef(options.config);

    configRef.current = options.config;

    const onFinishRef = useRef(options.onFinish);

    onFinishRef.current = options.onFinish;

    const handleFinish: ChatOnFinishCallback<FloatingAssistantUIMessage> = ({ isError }) => {
        if (!isError) {
            onFinishRef.current?.();
        }
    };

    const { runtime, conversationIdRef } = useChatRuntimeFromConfig<FloatingAssistantUIMessage>({
        api: options.config.api,
        onFinish: handleFinish,
        prepareRequestBody: ({ messages, conversationId }) => {
            const lastUserMessage = findLastUserMessage(messages);
            const messageText = extractMessageText(lastUserMessage);
            const fileIds = getMessageFileIds(lastUserMessage?.metadata);
            const currentConfig = configRef.current;

            return {
                body: {
                    ...(conversationId ? { conversationId } : {}),
                    ...(currentConfig.toolId ? { toolId: currentConfig.toolId } : {}),
                    message: {
                        role: 'user' as const,
                        content: messageText,
                    },
                    ...(fileIds.length > 0 ? { fileIds } : {}),
                },
            };
        },
    });

    const startNewThread = () => {
        conversationIdRef.current = undefined;
        runtime.threads.switchToNewThread();
    };

    return { runtime, startNewThread };
};
