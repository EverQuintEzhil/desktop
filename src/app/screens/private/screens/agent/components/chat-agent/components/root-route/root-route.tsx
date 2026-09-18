import { Navigate, useLocation } from 'react-router-dom';

import type { HomeSubmitPayload } from '@/components/agent-chat/types';
import ChatHome from '@/components/agent-chat/view/home';
import type { ChatAgentType } from '@/types/admin';
import type { FileType } from '@/types/chat';

export interface RootRouteProps {
    agent: ChatAgentType;
    onSubmit: (mode: 'chat', payload: HomeSubmitPayload) => void;
}

const RootRoute = ({ agent, onSubmit }: RootRouteProps) => {
    const location = useLocation();

    if (agent.uiConfig.home?.startPage === 'library' && !location.state?.showHome) {
        return <Navigate to="library" replace />;
    }

    const homeState = location.state as { prompt?: string; files?: FileType[] } | null;

    return (
        <ChatHome
            agent={agent}
            onSubmit={(payload) => onSubmit('chat', payload)}
            initialPrompt={homeState?.prompt}
            initialFiles={homeState?.files}
            resetKey={location.key}
        />
    );
};

export default RootRoute;
