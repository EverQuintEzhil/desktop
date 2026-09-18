import { useCanSeeRoutines } from '@/app/screens/private/screens/routines/routines-visibility';
import { useChatShell } from '@/components/agent-chat/context/chat-shell-context';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';

import { useConversationMeta } from '../../../hooks/use-conversation-meta';
import { useConversationRoutine } from '../conversation-routine/use-conversation-routine';

interface Props {
    agent: ChatAgentType;
    conversationId: string;
}

const ConversationTitleCrumb = ({ agent, conversationId }: Props) => {
    const { title } = useConversationMeta(agent._id, conversationId);
    const canSeeRoutines = useCanSeeRoutines(agent.uiConfig);
    const { routine } = useConversationRoutine(conversationId, { enabled: canSeeRoutines });
    const { variant } = useChatShell();
    const isPanel = variant === 'panel';

    if (!title || routine) return null;

    return (
        <span className={cn('flex min-w-0 items-center gap-1.5', !isPanel && 'max-lg:hidden')}>
            {!isPanel && (
                <span aria-hidden className="text-sm font-light text-muted-foreground/45 select-none">
                    /
                </span>
            )}
            <SimpleTooltip content={title} side="bottom">
                <span
                    className={cn(
                        'min-w-0 truncate text-xs font-medium text-muted-foreground',
                        !isPanel && 'max-w-[320px]',
                    )}
                >
                    {title}
                </span>
            </SimpleTooltip>
        </span>
    );
};

export default ConversationTitleCrumb;
