import { CalendarClockIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';

import { useChatSidePanel } from '../conversation-files/chat-files-panel-context';

import { useConversationRoutine } from './use-conversation-routine';

interface Props {
    conversationId?: string;
}

const ConversationRoutineToggleButton = ({ conversationId }: Props) => {
    const { activePane, toggle } = useChatSidePanel();
    const { routine } = useConversationRoutine(conversationId);
    const isOpen = activePane === 'routine';

    if (!routine) return null;

    return (
        <SimpleTooltip content={`Runs of ${routine.routineName}`}>
            <Button
                variant={isOpen ? 'secondary' : 'outline'}
                size="icon-xs"
                className="shrink-0 rounded-full"
                aria-label={`Runs of ${routine.routineName}`}
                onClick={() => toggle('routine')}
            >
                <CalendarClockIcon className="size-3.5" />
            </Button>
        </SimpleTooltip>
    );
};

export default ConversationRoutineToggleButton;
