import { useAuiState } from '@assistant-ui/react';
import type { FileMessagePartComponent, ImageMessagePartComponent, PartState } from '@assistant-ui/react';
import type { FC } from 'react';

import { hasToolPartOutput, type ToolPartLabelCandidate } from '@/components/assistant-ui/tool-label';
import { AssistantActions } from '@/components/chat/message/assistant-actions';
import { ChatAssistantMessage } from '@/components/chat/message/chat-assistant-message';
import { ChatUserMessage } from '@/components/chat/message/chat-user-message';
import { UserActions } from '@/components/chat/message/user-actions';
import CollapsibleMessageText from '@/components/chat/primitives/collapsible-message-text';
import DirectiveText from '@/components/chat/primitives/directive-text';
import { UserFileRenderer, UserImageRenderer } from '@/components/chat/primitives/user-file-parts';
import { DefaultToolCall } from '@/components/chat/tools';
import TenantAssistantAvatar from '@/components/tenant-assistant-avatar';

import UserAttachmentRenderer from './user-attachment-renderer';

const STANDALONE_BUILDER_TOOLS = new Set(['update_plan']);

export const groupBuilderParts = (part: PartState): readonly ('group-reasoning' | 'group-tool')[] => {
    if (part.type === 'reasoning') return ['group-reasoning'];

    if (part.type === 'tool-call') {
        return STANDALONE_BUILDER_TOOLS.has(part.toolName) ? [] : ['group-tool'];
    }

    return [];
};

const isUnresolvedAskUserPart = (part: unknown): boolean => {
    if (typeof part !== 'object' || part === null) return false;

    const candidate = part as ToolPartLabelCandidate;

    return candidate.type === 'tool-call' && candidate.toolName === 'ask_user' && !hasToolPartOutput(candidate);
};

const hasUnresolvedAskUserTool = (indices: readonly number[], parts: readonly unknown[]): boolean =>
    indices.some((index) => isUnresolvedAskUserPart(parts[index]));

export const getBuilderToolGroupState = (
    indices: readonly number[],
    parts: readonly unknown[],
    isMessageRunning: boolean,
    partStatusType: string | undefined,
) => {
    const defaultOpen = partStatusType === 'requires-action' || hasUnresolvedAskUserTool(indices, parts);

    return { defaultOpen, active: (isMessageRunning && partStatusType === 'running') || defaultOpen };
};

const UserMessageContent: FC = () => (
    <ChatUserMessage
        Text={DirectiveText}
        File={UserFileRenderer as FileMessagePartComponent}
        Image={UserImageRenderer as ImageMessagePartComponent}
        wrapParts={(parts) => <CollapsibleMessageText>{parts}</CollapsibleMessageText>}
        actions={<UserActions className="copy-button-container opacity-0 max-lg:opacity-100" />}
        AttachmentRenderer={UserAttachmentRenderer}
        attachmentsMode="when-present"
        rootClassName="message flex flex-col group"
        bubbleClassName="self-end rounded-xl [&_span]:text-h5 py-[10px] px-[14px] text-(--text-primary) max-w-[88%] bg-card [&_span]:whitespace-pre-wrap"
        attachmentsWrapperClassName="flex flex-wrap justify-end gap-2 self-end max-w-[88%]"
    />
);

const AssistantMessageContent: FC = () => (
    <ChatAssistantMessage
        groupBy={groupBuilderParts}
        getToolGroupState={getBuilderToolGroupState}
        ToolCall={DefaultToolCall}
        indicatorLabel="Working"
        actionsRow={<AssistantActions className="like-unlike" copyFormatted copy={false} />}
        avatar={<TenantAssistantAvatar className="flex size-6 shrink-0 items-center justify-center" />}
        rootClassName="flex flex-col group"
        contentClassName="flex flex-col min-w-0 flex-1 [&_p]:mb-1 [&_p]:mt-0 [&_p]:leading-[1.6]"
    />
);

const ChatMessage: FC = () => {
    const role = useAuiState((s) => s.message.role);

    if (role === 'user') return <UserMessageContent />;

    return <AssistantMessageContent />;
};

export default ChatMessage;
