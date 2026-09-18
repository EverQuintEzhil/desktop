import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ChatAgentType } from '@/types/admin';

import { TokenUsageDialog, useCanSeeUsage } from '../../../../token-usage-dialog';
import { buildConversationUsage } from '../../../../token-usage-dialog/conversation-usage';
import { useConversationMeta } from '../../../hooks/use-conversation-meta';

interface OpenConversationUsageArgs {
    agentId: string;
    conversationId: string;
    model?: string;
}

interface ConversationUsageDialogContextValue {
    openConversationUsage: (args: OpenConversationUsageArgs) => void;
}

interface Props {
    agent: ChatAgentType;
    children: ReactNode;
}

const ConversationUsageDialogContext = createContext<ConversationUsageDialogContextValue | null>(null);

// Owns a single usage dialog outside any dropdown so it survives the menu that
// opened it being closed. It derives usage live from the conversation-meta
// query (by id) rather than a snapshot, so an open dialog refreshes in place
// when the totals refetch after a turn.
export const ConversationUsageDialogProvider = ({ agent, children }: Props) => {
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState<OpenConversationUsageArgs | null>(null);
    const canSeeUsage = useCanSeeUsage(agent.uiConfig);

    const { aiInfo } = useConversationMeta(target?.agentId ?? '', target?.conversationId ?? null);
    const usage = buildConversationUsage(aiInfo);

    const openConversationUsage = useCallback(
        (next: OpenConversationUsageArgs) => {
            if (!canSeeUsage) return;

            setTarget(next);
            setOpen(true);
        },
        [canSeeUsage],
    );

    const handleOpenChange = useCallback((next: boolean) => {
        setOpen(next);
        if (!next) setTarget(null);
    }, []);

    const value = useMemo(() => ({ openConversationUsage }), [openConversationUsage]);

    return (
        <ConversationUsageDialogContext.Provider value={value}>
            {children}
            {canSeeUsage && open && usage ? (
                <TokenUsageDialog
                    open={open}
                    onOpenChange={handleOpenChange}
                    usage={usage}
                    model={target?.model ?? aiInfo?.model}
                    subtitle="this conversation"
                />
            ) : null}
        </ConversationUsageDialogContext.Provider>
    );
};

export const useConversationUsageDialog = () => useContext(ConversationUsageDialogContext);

export default ConversationUsageDialogProvider;
