import { AuiIf, groupPartByType, ThreadPrimitive, useAui, useAuiState } from '@assistant-ui/react';
import type {
    FileMessagePartComponent,
    ImageMessagePartComponent,
    ReasoningMessagePartProps,
} from '@assistant-ui/react';
import { useCallback, type FC } from 'react';

import { Reasoning } from '@/components/assistant-ui/reasoning';
import { AssistantActions } from '@/components/chat/message/assistant-actions';
import { ChatAssistantMessage } from '@/components/chat/message/chat-assistant-message';
import { ChatUserMessage } from '@/components/chat/message/chat-user-message';
import { UserActions } from '@/components/chat/message/user-actions';
import ChatComposer from '@/components/chat/primitives/chat-composer';
import DirectiveText from '@/components/chat/primitives/directive-text';
import ScrollToBottomButton from '@/components/chat/primitives/scroll-to-bottom-button';
import { useAuiComposerBinding } from '@/components/chat/primitives/use-aui-composer-binding';
import { UserFileRenderer, UserImageRenderer } from '@/components/chat/primitives/user-file-parts';
import { DefaultToolCall } from '@/components/chat/tools';
import TenantAssistantAvatar from '@/components/tenant-assistant-avatar';
import { filesToAttachments, getUploadedFileIds } from '@/lib/chat/file-attachments';
import { useChatFiles } from '@/lib/chat/use-chat-files';
import { cn } from '@/lib/utils';
import type { MessageMetadataCustom } from '@/types/chat';

const COMPOSER_FILE_ACCEPT = 'image/*,.pdf,.doc,.docx,.txt';

export const Thread: FC = () => {
    return (
        <ThreadPrimitive.Root
            className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
            style={{
                ['--thread-max-width' as string]: '44rem',
                ['--composer-radius' as string]: '24px',
                ['--composer-padding' as string]: '10px',
            }}
        >
            <ThreadPrimitive.Viewport
                turnAnchor="top"
                data-slot="aui_thread-viewport"
                className="scrollbar-controller scrollbar-vertical relative flex flex-1 flex-col scroll-smooth"
            >
                <div className="mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4">
                    <AuiIf condition={(s) => s.thread.isEmpty}>
                        <ThreadWelcome />
                    </AuiIf>

                    <div data-slot="aui_message-group" className="mb-10 flex flex-col gap-y-6 empty:hidden">
                        <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
                    </div>

                    <ThreadPrimitive.ViewportFooter
                        className={cn(
                            'aui-thread-viewport-footer sticky bottom-0 mt-auto flex flex-col gap-4 overflow-visible',
                            'rounded-t-(--composer-radius) bg-background pb-4 md:pb-6',
                        )}
                    >
                        <ScrollToBottomButton />
                        <Composer />
                    </ThreadPrimitive.ViewportFooter>
                </div>
            </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
    );
};

const ThreadMessage: FC = () => {
    const role = useAuiState((s) => s.message.role);

    if (role === 'user') return <UserMessage />;

    return <AssistantMessage />;
};

const ThreadWelcome: FC = () => {
    return (
        <div className="aui-thread-welcome-root my-auto flex grow flex-col">
            <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
                <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-4">
                    <h1 className="aui-thread-welcome-message-inner animate-in text-2xl font-semibold duration-200 fill-mode-both fade-in slide-in-from-bottom-1">
                        Hello there!
                    </h1>
                    <p className="aui-thread-welcome-message-inner animate-in text-xl text-muted-foreground delay-75 duration-200 fill-mode-both fade-in slide-in-from-bottom-1">
                        How can I help you today?
                    </p>
                </div>
            </div>
        </div>
    );
};

const Composer: FC = () => {
    const aui = useAui();
    const { value, onChange } = useAuiComposerBinding();
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const { files, isUploading, fileInputRef, setFiles, onChangeFile, clearFiles, retryUpload } = useChatFiles();

    const handleSubmit = useCallback(
        (text: string) => {
            aui.thread.append({
                role: 'user',
                content: [{ type: 'text', text }],
                attachments: filesToAttachments(files),
                metadata: { custom: { fileIds: getUploadedFileIds(files) } } satisfies MessageMetadataCustom,
            });

            clearFiles();
        },
        [aui, files, clearFiles],
    );

    const removeFile = (index: number) => {
        setFiles(files.filter((_, fileIndex) => fileIndex !== index));
    };

    return (
        <ChatComposer
            value={value}
            onChange={onChange}
            files={files}
            fileInputRef={fileInputRef}
            onChangeFile={onChangeFile}
            onRemoveFile={removeFile}
            onRetryFile={retryUpload}
            isUploading={isUploading}
            accept={COMPOSER_FILE_ACCEPT}
            placeholder="Send a message..."
            onSubmit={handleSubmit}
            isRunning={isRunning}
            autoFocus
            enableHistoryRecall
        />
    );
};

const groupFloatingParts = groupPartByType({
    reasoning: ['group-reasoning'],
    'tool-call': ['group-tool'],
});

const getFloatingToolGroupState = (
    _indices: readonly number[],
    _parts: readonly unknown[],
    _isMessageRunning: boolean,
    partStatusType: string | undefined,
) => {
    const defaultOpen = partStatusType === 'requires-action';

    return { defaultOpen, active: partStatusType === 'running' || defaultOpen };
};

const AssistantMessage: FC = () => {
    return (
        <ChatAssistantMessage
            groupBy={groupFloatingParts}
            getToolGroupState={getFloatingToolGroupState}
            ToolCall={DefaultToolCall}
            renderReasoning={(part) => <Reasoning {...(part as ReasoningMessagePartProps)} />}
            indicatorLabel="Generating"
            actionsRow={
                <AssistantActions
                    copyFormatted
                    copy={false}
                    copyTooltip="Copy"
                    className="aui-assistant-action-bar-root -ml-1 gap-1 text-muted-foreground"
                />
            }
            avatar={<TenantAssistantAvatar className="flex size-6 shrink-0 items-center justify-center" />}
            rootClassName="fade-in slide-in-from-bottom-1 relative animate-in duration-150"
            contentClassName="wrap-break-word text-foreground leading-relaxed"
        />
    );
};

const UserMessage: FC = () => {
    return (
        <ChatUserMessage
            Text={DirectiveText}
            File={UserFileRenderer as FileMessagePartComponent}
            Image={UserImageRenderer as ImageMessagePartComponent}
            actions={
                <UserActions
                    copyTooltip="Copy"
                    className="gap-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 max-lg:opacity-100"
                />
            }
            attachmentsMode="when-present"
            rootClassName="fade-in slide-in-from-bottom-1 flex flex-col px-2 animate-in duration-150"
            bubbleClassName="aui-user-message-content wrap-break-word rounded-lg bg-card text-sm px-4 py-2 ml-auto max-w-[88%] empty:hidden"
            attachmentsWrapperClassName="flex flex-wrap justify-end w-full gap-2"
        />
    );
};
