import type { ChatAgentType } from '@/types/admin';

import ChatToolsPanel from '../../project-detail/chat-tools-panel';
import { useChatSidePanel } from '../conversation-files/chat-files-panel-context';
import ChatSidePaneShell from '../conversation-files/chat-side-pane-shell';

interface Props {
    agent: ChatAgentType;
    conversationId?: string;
}

const ConversationToolsPane = ({ agent }: Props) => {
    const { activePane, close } = useChatSidePanel();
    const isOpen = activePane === 'tools';

    return (
        <ChatSidePaneShell isOpen={isOpen} title="Connectors & skills" onClose={close}>
            <ChatToolsPanel agent={agent} />
        </ChatSidePaneShell>
    );
};

export default ConversationToolsPane;
