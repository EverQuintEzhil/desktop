import { useMemo, type ReactNode } from 'react';
import { MemoryRouter, Navigate, Route, Routes, UNSAFE_LocationContext, UNSAFE_RouteContext } from 'react-router-dom';

import ChatAgentNew from '@/app/screens/private/screens/agent/components/chat-agent';
import { ChatShellContext } from '@/components/agent-chat/context/chat-shell-context';
import type { ChatShellValue } from '@/components/agent-chat/context/chat-shell-context';
import type { ChatAgentType } from '@/types/admin';

interface PreviewChatProps {
    agent: ChatAgentType;
    onClose: () => void;
}

// The app root already renders a BrowserRouter. react-router v7 throws when a Router
// is nested inside another, and its <Routes> resolves paths relative to the parent
// route match — so the inner MemoryRouter would both crash and fail to match. Reset
// both contexts to their top-level defaults so the preview router is fully isolated
// from the outer app route and matches from the root.
const ROOT_ROUTE_CONTEXT = { outlet: null, matches: [], isDataRoute: false };

const IsolatedRouterContext = ({ children }: { children: ReactNode }) => (
    <UNSAFE_LocationContext.Provider value={null as never}>
        <UNSAFE_RouteContext.Provider value={ROOT_ROUTE_CONTEXT as never}>{children}</UNSAFE_RouteContext.Provider>
    </UNSAFE_LocationContext.Provider>
);

const PreviewChat = ({ agent, onClose }: PreviewChatProps) => {
    const shellValue = useMemo<ChatShellValue>(() => ({ isPreview: true, onExit: onClose }), [onClose]);

    return (
        <div className="page page-styled relative flex h-full w-full bg-background">
            <ChatShellContext.Provider value={shellValue}>
                <IsolatedRouterContext>
                    <MemoryRouter initialEntries={[`/agent/${agent.slug}`]}>
                        <Routes>
                            <Route path="/agent/:agentId/*" element={<ChatAgentNew agent={agent} />} />
                            <Route path="*" element={<Navigate to={`/agent/${agent.slug}`} replace />} />
                        </Routes>
                    </MemoryRouter>
                </IsolatedRouterContext>
            </ChatShellContext.Provider>
        </div>
    );
};

export default PreviewChat;
