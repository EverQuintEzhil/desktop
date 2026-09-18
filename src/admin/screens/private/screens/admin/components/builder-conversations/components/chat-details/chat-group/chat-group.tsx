import { useState } from 'react';

import type { AdminConversationMessage } from '../chat-details';
import { ChatMessageAdmin } from '../chat-message';

import './chat-group.scss';

interface ChatNoGroupAdminProps {
    messages: AdminConversationMessage[];
}

export const ChatNoGroupAdmin = (props: ChatNoGroupAdminProps) => {
    const { messages } = props;
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
                    isExpanded={expandedMessages[message._id] || false}
                    toggleMessage={() => toggleMessage(message._id)}
                />
            ))}
        </div>
    );
};
