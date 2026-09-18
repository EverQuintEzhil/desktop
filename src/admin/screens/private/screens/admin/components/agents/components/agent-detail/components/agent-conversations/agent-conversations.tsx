import { MessagesSquareIcon } from 'lucide-react';
import { useRef } from 'react';
import { Route, Routes } from 'react-router-dom';

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useViewportFillHeight } from '@/hooks';
import type { AgentType, ChatAgentType } from '@/types/admin';
import { hasAppUi, hasChatUi } from '@/types/ui';

import { Conversations } from './components';
import { ChatDetails } from './components/chat-details';

interface Props {
    agent: AgentType;
}

const AgentConversations = (props: Props) => {
    const { agent } = props;

    const rootRef = useRef<HTMLDivElement>(null);

    useViewportFillHeight(rootRef, { cssVar: '--agent-conversations-h' });

    if (!hasChatUi(agent) && !hasAppUi(agent)) {
        return null;
    }
    // An app agent's uiConfig carries the same chat fields the conversation
    // views read, so present a chat-typed view of it.
    const chatAgent = (
        hasChatUi(agent) ? agent : { ...agent, uiConfig: { ...agent.uiConfig, componentType: 'chat', type: 'chat' } }
    ) as ChatAgentType;

    const renderConversationsList = () => {
        return <Conversations agent={chatAgent} />;
    };

    const renderContent = () => {
        return (
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel
                    minSize="15%"
                    defaultSize="20%"
                    maxSize="40%"
                    className="scrollbar-controller scrollbar-vertical scrollbar-horizontal relative"
                >
                    {renderConversationsList()}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel minSize="30%" defaultSize="80%">
                    <Routes>
                        <Route
                            path=""
                            element={
                                <div className="no-conversation flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
                                    <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                                        <MessagesSquareIcon className="size-10" />
                                    </div>
                                    <div className="flex max-w-sm flex-col items-center gap-1.5">
                                        <span className="text-base font-medium text-foreground">
                                            Select a conversation
                                        </span>
                                        <span className="text-sm leading-5 text-muted-foreground">
                                            Choose a conversation from the list on the left to view its messages and
                                            details.
                                        </span>
                                    </div>
                                </div>
                            }
                        />
                        <Route path=":conversationId/*" element={<ChatDetails agent={chatAgent} />} />
                    </Routes>
                </ResizablePanel>
            </ResizablePanelGroup>
        );
    };

    return (
        <div
            ref={rootRef}
            className="tab-content conversations-tab flex h-(--agent-conversations-h,calc(100svh-48px-83px)) min-h-0 flex-col"
        >
            {renderContent()}
        </div>
    );
};

export default AgentConversations;
