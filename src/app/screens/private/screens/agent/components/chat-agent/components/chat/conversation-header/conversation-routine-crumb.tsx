import { ArrowUpRightIcon, CalendarClockIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useChatShell } from '@/components/agent-chat/context/chat-shell-context';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';

import { useConversationRoutine } from '../conversation-routine/use-conversation-routine';

interface Props {
    agent: ChatAgentType;
    conversationId: string;
}

const ConversationRoutineCrumb = ({ agent, conversationId }: Props) => {
    const { routine } = useConversationRoutine(conversationId);

    const { variant } = useChatShell();

    if (!routine || variant === 'panel') return null;

    return (
        <span className="flex min-w-0 items-center gap-1.5 max-lg:hidden">
            <span aria-hidden className="text-sm font-light text-muted-foreground/45 select-none">
                /
            </span>
            <SimpleTooltip content="Open routines" side="bottom">
                <Link
                    to={`/agent/${agent.slug}/routines`}
                    aria-label="Open routines"
                    className={cn(
                        'group flex max-w-[220px] min-w-0 items-center gap-1.5 rounded-full',
                        'border border-border/80 bg-background py-0.5 pr-2 pl-0.5',
                        'text-xs font-medium text-foreground',
                        'transition-colors hover:border-primary/35 hover:bg-primary/5 hover:text-primary',
                        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    )}
                >
                    <span
                        className={cn(
                            'flex size-5 shrink-0 items-center justify-center rounded-full',
                            'bg-primary/10 text-primary transition-colors',
                            'group-hover:bg-primary group-hover:text-primary-foreground',
                        )}
                    >
                        <CalendarClockIcon className="size-3 group-hover:hidden" />
                        <ArrowUpRightIcon className="hidden size-3 group-hover:block" />
                    </span>
                    <span className="truncate">Routines</span>
                </Link>
            </SimpleTooltip>
            <span aria-hidden className="text-sm font-light text-muted-foreground/45 select-none">
                /
            </span>
            <SimpleTooltip content={`Open ${routine.routineName}`} side="bottom">
                <Link
                    to={`/agent/${agent.slug}/routines/${routine.routineId}`}
                    className={cn(
                        'max-w-[320px] min-w-0 truncate rounded text-xs font-medium text-muted-foreground',
                        'transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    )}
                >
                    {routine.routineName}
                </Link>
            </SimpleTooltip>
        </span>
    );
};

export default ConversationRoutineCrumb;
