import { Settings2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useCanEditAgent } from '@/app/hooks';
import { useChatShell } from '@/components/agent-chat/context/chat-shell-context';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { AgentType } from '@/types/admin';

export type AgentMenuItemsAgent = Pick<AgentType, '_id' | 'admins' | 'creator'>;

/**
 * Dropdown items acting on the agent itself, for placement inside an existing menu.
 * Returns null when the viewer has no agent actions, so callers can drop the whole container.
 */
const useAgentMenuItems = ({ agent }: { agent: AgentMenuItemsAgent }): ReactNode => {
    const location = useLocation();
    const canEditAgent = useCanEditAgent(agent);
    // Preview and the assistant panel both run under an isolated router with no
    // /agent-builder route, so the link would resolve nowhere.
    const { isPreview, variant } = useChatShell();
    const hasOwnRouter = isPreview || variant === 'panel';

    const items: ReactNode[] = [];

    if (canEditAgent && !hasOwnRouter) {
        items.push(
            <DropdownMenuItem key="edit-agent" asChild className="cursor-pointer">
                <Link
                    to={`/agent-builder/${agent._id}`}
                    state={{ from: `${location.pathname}${location.search}` }}
                    // `a { color: var(--primary) }` in index.css is unlayered, so it beats the utility without `!`.
                    className="text-foreground!"
                >
                    <Settings2Icon className="size-3.5" />
                    Edit agent
                </Link>
            </DropdownMenuItem>,
        );
    }

    if (!items.length) return null;

    return <>{items}</>;
};

export default useAgentMenuItems;
