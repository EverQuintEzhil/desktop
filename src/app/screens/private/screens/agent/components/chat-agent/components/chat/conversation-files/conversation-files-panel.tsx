import type { ChatAgentType } from '@/types/admin';

import { useConversationMeta } from '../../../hooks/use-conversation-meta';

import { useChatSidePanel } from './chat-files-panel-context';
import ChatSidePaneShell from './chat-side-pane-shell';
import ConversationFilesContentSection from './conversation-files-content-section';
import ConversationFilesProjectSection from './conversation-files-project-section';

interface Props {
    agent: ChatAgentType;
    conversationId: string;
}

const ConversationFilesPanel = ({ agent, conversationId }: Props) => {
    const { activePane, close } = useChatSidePanel();
    const { projectId } = useConversationMeta(agent._id, conversationId);

    const isOpen = activePane === 'files';
    const showProjectSection = Boolean(agent.uiConfig.spaces?.enabled && projectId);

    return (
        <ChatSidePaneShell isOpen={isOpen} title="Files" onClose={close}>
            {showProjectSection && projectId ? (
                <ConversationFilesProjectSection agent={agent} projectId={projectId} />
            ) : null}
            <ConversationFilesContentSection agent={agent} conversationId={conversationId} />
        </ChatSidePaneShell>
    );
};

export default ConversationFilesPanel;
