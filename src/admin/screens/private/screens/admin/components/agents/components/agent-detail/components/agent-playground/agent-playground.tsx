import { BadgeAlertIcon } from 'lucide-react';

import type { AgentType, ChatAgentType } from '@/types/admin';
import { hasApiUi, hasAppUi, hasChatUi, hasGalleryUi } from '@/types/ui';

import AgentAPIPlayground from '../agent-api-playground';
import AgentChatPlaygroundNew from '../agent-chat-playground';
import AgentGalleryPlayground from '../agent-gallery-playground';

interface Props {
    agent: AgentType;
    basePath?: string;
}
const AgentPlayground = ({ agent, basePath }: Props) => {
    if (hasApiUi(agent)) {
        return <AgentAPIPlayground agent={agent} />;
    }
    if (hasChatUi(agent)) {
        return <AgentChatPlaygroundNew agent={agent} basePath={basePath} />;
    }
    if (hasAppUi(agent)) {
        // An app agent's uiConfig carries the same chat fields — the playground
        // exercises the assistant side; the app pane is a runtime-only surface.
        const chatView = {
            ...agent,
            uiConfig: { ...agent.uiConfig, componentType: 'chat', type: 'chat' },
        } as unknown as ChatAgentType;

        return <AgentChatPlaygroundNew agent={chatView} basePath={basePath} />;
    }
    if (hasGalleryUi(agent)) {
        return <AgentGalleryPlayground agent={agent} />;
    }

    return (
        <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4">
            <BadgeAlertIcon className="size-8 text-5xl! text-destructive!" />
            <span className="text-sm font-medium text-text-secondary">Please check the agent UI configuration</span>
        </div>
    );
};

export default AgentPlayground;
