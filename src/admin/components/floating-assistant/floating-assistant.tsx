import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';

import { FloatingShell } from '@/components/agent-chat/floating/floating-shell';
import {
    ChatHostProvider,
    createFluentMindSession,
    createUnsupportedConversationAdapter,
    type ChatHost,
} from '@/components/chat-host';
import { authAwareFetch } from '@/lib/auth-aware-fetch';
import { getFilesBaseUrl } from '@/lib/axios';
import { selectTenant } from '@/store/selectors';

import { Thread } from './thread';
import type { FloatingAssistantConfig } from './types';
import { useFloatingAssistantRuntime } from './use-floating-assistant-runtime';

interface FloatingAssistantProps {
    config: FloatingAssistantConfig;
    onFinish?: () => void;
}

const FloatingAssistant = memo(({ config, onFinish }: FloatingAssistantProps) => {
    const { runtime, startNewThread } = useFloatingAssistantRuntime({ config, onFinish });
    const tenant = useSelector(selectTenant);

    const host = useMemo<ChatHost>(
        () => ({
            session: createFluentMindSession(null, tenant),
            transport: {
                endpoint: config.api,
                baseUrl: config.api.replace(/\/ai\/chat$/, ''),
                filesBaseUrl: getFilesBaseUrl(),
                fetch: authAwareFetch,
                credentials: 'include',
            },
            navigation: {
                setConversationId: () => {},
                startNewConversation: startNewThread,
            },
            conversations: createUnsupportedConversationAdapter(),
        }),
        [config.api, startNewThread, tenant],
    );

    const label = config.label ?? 'AI Assistant';

    return (
        <ChatHostProvider value={host}>
            <AssistantRuntimeProvider runtime={runtime}>
                <FloatingShell label={label} onNewChat={startNewThread}>
                    <Thread />
                </FloatingShell>
            </AssistantRuntimeProvider>
        </ChatHostProvider>
    );
});

FloatingAssistant.displayName = 'FloatingAssistant';

export default FloatingAssistant;
