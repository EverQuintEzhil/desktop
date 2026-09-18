import { Link } from 'react-router-dom';

import { TruncatedLabel } from '@/components/ui/truncated-label';
import { cn } from '@/lib/utils';

export interface AgentRef {
    name: string;
    slug?: string;
    launcher?: { name: string } | null;
}

interface Props {
    agent?: AgentRef | null;
    className?: string;
}

export const agentDisplayName = (agent?: AgentRef | null): string => agent?.launcher?.name || agent?.name || '';

const AgentNameLink = ({ agent, className }: Props) => {
    const name = agentDisplayName(agent);

    if (!name) return null;

    const classNames = cn(
        // Unlayered `a { color: var(--primary) }` in index.css outranks any layered utility, so the colour needs `!`.
        'agent-name-link inline-flex w-fit max-w-full min-w-0 items-center text-sm text-text-secondary! no-underline',
        className,
    );

    if (!agent?.slug) {
        return (
            <span className={classNames}>
                <TruncatedLabel text={name} />
            </span>
        );
    }

    return (
        <Link to={`/agent/${agent.slug}`} aria-label={`Agent: ${name}`} className={cn(classNames, 'group')}>
            <TruncatedLabel text={name} className="group-hover:underline" />
        </Link>
    );
};

export default AgentNameLink;
