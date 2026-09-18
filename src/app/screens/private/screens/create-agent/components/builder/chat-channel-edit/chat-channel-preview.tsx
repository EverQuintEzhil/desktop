import { memo } from 'react';

import ChatPreview, { type ChatPreviewValue } from '@/components/agent-ui-preview/chat-preview';
import type { ChatAgentUiType } from '@/types/ui';

interface ChatChannelPreviewProps {
    uiConfig: ChatAgentUiType;
    agentName: string;
}

const ChatChannelPreview = ({ uiConfig, agentName }: ChatChannelPreviewProps) => (
    <div className="h-full w-full overflow-hidden rounded-2xl">
        <ChatPreview value={uiConfig as unknown as ChatPreviewValue} agentName={agentName} />
    </div>
);

export default memo(ChatChannelPreview);
