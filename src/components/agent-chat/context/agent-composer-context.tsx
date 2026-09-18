import { createContext, useContext } from 'react';

import type { AgentComposerContextValue } from '@/components/agent-chat/types';

const AgentComposerContext = createContext<AgentComposerContextValue | null>(null);

export function useAgentComposerContext(): AgentComposerContextValue {
    const ctx = useContext(AgentComposerContext);

    if (!ctx) throw new Error('useAgentComposerContext must be used inside AgentComposerProvider');

    return ctx;
}

export { AgentComposerContext };
