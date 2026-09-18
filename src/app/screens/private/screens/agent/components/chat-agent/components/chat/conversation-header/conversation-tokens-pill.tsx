import { CoinsIcon } from 'lucide-react';

import { useChatShell } from '@/components/agent-chat/context/chat-shell-context';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChatAgentType } from '@/types/admin';

import { useCanSeeUsage } from '../../../../token-usage-dialog';
import { buildConversationUsage } from '../../../../token-usage-dialog/conversation-usage';
import { useConversationMeta } from '../../../hooks/use-conversation-meta';

import { useConversationUsageDialog } from './conversation-usage-dialog-context';

interface Props {
    agent: ChatAgentType;
    conversationId: string;
}

const ConversationTokensPill = ({ agent, conversationId }: Props) => {
    const { aiInfo } = useConversationMeta(agent._id, conversationId);
    const usageDialog = useConversationUsageDialog();
    const canSeeUsage = useCanSeeUsage(agent.uiConfig);
    const { variant } = useChatShell();
    const usage = buildConversationUsage(aiInfo);

    if (!canSeeUsage || !usage || variant === 'panel') {
        return null;
    }

    const totalLabel = usage.total_tokens.toLocaleString();

    const handleClick = () => {
        usageDialog?.openConversationUsage({ agentId: agent._id, conversationId, model: aiInfo?.model });
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="outline"
                    size="xs"
                    className="shrink-0 rounded-full tabular-nums"
                    aria-label={`View AI usage (${totalLabel} tokens)`}
                    disabled={!usageDialog}
                    onClick={handleClick}
                >
                    <CoinsIcon className="size-3.5" />
                    {totalLabel}
                </Button>
            </TooltipTrigger>
            <TooltipContent>AI Usage</TooltipContent>
        </Tooltip>
    );
};

export default ConversationTokensPill;
