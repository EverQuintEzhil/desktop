import { ArrowUpRightIcon, FolderIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';

import { useConversationMeta } from '../../../hooks/use-conversation-meta';

import { useProjectName } from './use-project-name';

interface Props {
    agent: ChatAgentType;
    conversationId: string;
}

const ConversationSpaceBadge = ({ agent, conversationId }: Props) => {
    const { projectId } = useConversationMeta(agent._id, conversationId);
    const projectName = useProjectName(projectId);

    if (!agent.uiConfig.spaces?.enabled || !projectId || !projectName) return null;

    return (
        <span className="flex min-w-0 items-center gap-1.5 max-lg:hidden">
            <span aria-hidden className="text-sm font-light text-muted-foreground/45 select-none">
                /
            </span>
            <SimpleTooltip content={`Open ${projectName}`} side="bottom">
                <Link
                    to={`/agent/${agent.slug}/spaces/${projectId}`}
                    aria-label={`Open space ${projectName}`}
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
                        <FolderIcon className="size-3 group-hover:hidden" />
                        <ArrowUpRightIcon className="hidden size-3 group-hover:block" />
                    </span>
                    <span className="truncate">{projectName}</span>
                </Link>
            </SimpleTooltip>
        </span>
    );
};

export default ConversationSpaceBadge;
