import { cn } from '@/lib/utils';

import AgentNameLink, { agentDisplayName, type AgentRef } from './agent-name-link';

interface Props {
    agent?: AgentRef | null;
    className?: string;
}

const AgentTitlePrefix = ({ agent, className }: Props) => {
    if (!agentDisplayName(agent)) return null;

    return (
        <span className={cn('agent-title-prefix flex min-w-0 items-center gap-1.5', className)}>
            <AgentNameLink agent={agent} className="text-xl font-bold text-inherit!" />
            <span aria-hidden="true" className="shrink-0 text-xl font-normal text-text-secondary">
                /
            </span>
        </span>
    );
};

export default AgentTitlePrefix;
