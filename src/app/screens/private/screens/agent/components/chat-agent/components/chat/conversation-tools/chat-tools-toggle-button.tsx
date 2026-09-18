import { BlocksIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { ChatAgentType } from '@/types/admin';

import { useChatSidePanel } from '../conversation-files/chat-files-panel-context';

interface Props {
    agent: ChatAgentType;
    conversationId?: string;
    /** Home header sizes to match the incognito button; chat header stays compact (matches files). */
    isHome?: boolean;
}

const ChatToolsToggleButton = ({ agent: _agent, conversationId: _conversationId, isHome = false }: Props) => {
    const { activePane, toggle } = useChatSidePanel();
    const isOpen = activePane === 'tools';

    return (
        <SimpleTooltip content="Connectors & skills">
            <Button
                variant={isOpen ? 'secondary' : 'outline'}
                size={isHome ? 'icon-lg' : 'icon-xs'}
                className={`shrink-0 rounded-full ${isHome ? 'size-8 lg:size-10' : ''}`}
                aria-label="Connectors and skills"
                onClick={() => toggle('tools')}
            >
                <BlocksIcon className={isHome ? 'size-5' : 'size-3.5'} />
            </Button>
        </SimpleTooltip>
    );
};

export default ChatToolsToggleButton;
