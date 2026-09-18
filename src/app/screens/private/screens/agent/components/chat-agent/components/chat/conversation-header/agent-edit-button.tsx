import { Settings2Icon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { useCanEditAgent } from '@/app/hooks';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import type { AgentMenuItemsAgent } from './use-agent-menu-items';

export interface AgentEditButtonProps {
    agent: AgentMenuItemsAgent;
}

/** Direct builder link for headers with no overflow menu to join (chat home), sized to match the neighbouring circular buttons. */
const AgentEditButton = ({ agent }: AgentEditButtonProps) => {
    const location = useLocation();
    const canEditAgent = useCanEditAgent(agent);

    if (!canEditAgent) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="outline"
                    size="icon-lg"
                    asChild
                    aria-label="Edit agent"
                    className="size-8 shrink-0 rounded-full lg:size-10"
                >
                    <Link to={`/agent-builder/${agent._id}`} state={{ from: `${location.pathname}${location.search}` }}>
                        <Settings2Icon className="size-5" />
                    </Link>
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Edit agent</TooltipContent>
        </Tooltip>
    );
};

export default AgentEditButton;
