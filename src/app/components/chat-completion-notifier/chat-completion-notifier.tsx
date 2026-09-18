import { useCompletionNotification } from '@/app/hooks/use-completion-notification';
import type { ChatAgentType } from '@/types/admin';

interface Props {
    agent: ChatAgentType;
}

const ChatCompletionNotifier = ({ agent }: Props) => {
    useCompletionNotification(agent.name);

    return null;
};

export default ChatCompletionNotifier;
