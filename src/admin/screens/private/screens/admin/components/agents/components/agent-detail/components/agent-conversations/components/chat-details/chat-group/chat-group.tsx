import { useState } from 'react';

import type { AgentType } from '@/types/admin';

import type { AdminConversationMessage } from '../chat-details';
import { ChatMessageAdmin } from '../chat-message';

import './chat-group.scss';

interface ChatNoGroupAdminProps {
    messages: AdminConversationMessage[];
    agent: AgentType;
}

export const ChatNoGroupAdmin = (props: ChatNoGroupAdminProps) => {
    const { messages, agent } = props;
    const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});

    const toggleMessage = (messageId: string) => {
        setExpandedMessages((prev) => ({
            ...prev,
            [messageId]: !prev[messageId],
        }));
    };

    return (
        <div className="chat-no-group rounded-xl bg-card">
            {messages.map((message) => (
                <ChatMessageAdmin
                    key={message._id}
                    message={message}
                    agent={agent}
                    isExpanded={expandedMessages[message._id] || false}
                    toggleMessage={() => toggleMessage(message._id)}
                />
            ))}
        </div>
    );
};
