import { FileTextIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { ChatAgentType } from '@/types/admin';

import { useChatSidePanel } from './chat-files-panel-context';

interface Props {
    agent: ChatAgentType;
    conversationId: string;
}

const ChatFilesToggleButton = ({ agent: _agent, conversationId: _conversationId }: Props) => {
    const { activePane, toggle } = useChatSidePanel();
    const isOpen = activePane === 'files';

    return (
        <SimpleTooltip content="Files">
            <Button
                variant={isOpen ? 'secondary' : 'outline'}
                size="icon-xs"
                className="shrink-0 rounded-full"
                aria-label="Toggle files"
                onClick={() => toggle('files')}
            >
                <FileTextIcon className="size-3.5" />
            </Button>
        </SimpleTooltip>
    );
};

export default ChatFilesToggleButton;
