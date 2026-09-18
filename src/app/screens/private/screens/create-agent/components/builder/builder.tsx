import type { UIMessage } from 'ai';
import { ChevronLeft, MessageCircleIcon, Settings2Icon } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import type { FileType } from '@/types/chat';
import type { ChatAgentUiType } from '@/types/ui';

import { SkillEdit } from '../../../skills';
import AgentAdvancedSettings from '../../agent-advanced-settings';
import { useBuilderChatWidth } from '../../hooks/use-builder-chat-width';
import type { CreateAgentConversation } from '../../lib/builder-conversations-api';
import type { AgentConfigDraft } from '../../types';
import ConfigTopbar from '../config-topbar/config-topbar';
import PreviewChat from '../preview/preview-chat';

import BuilderChat, { type BuilderChatHandle } from './builder-chat';
import BuilderConfig from './builder-config';
import { BuilderRequestsProvider, type BuilderRequest } from './builder-requests';
import BuilderResizeHandle from './builder-resize-handle';
import { ChatChannelEdit } from './chat-channel-edit';
import { DataStoreEdit } from './data-store-edit';

interface BuilderProps {
    config: AgentConfigDraft;
    initialPrompt?: string;
    initialFiles?: FileType[];
    initialMessages: UIMessage[];
    restoreInitialMessages?: boolean;
    agentId: string;
    activeConversationId: string | null;
    chatKey: number;
    conversations: CreateAgentConversation[];
    conversationsHasMore: boolean;
    conversationsLoadingMore: boolean;
    conversationsError: boolean;
    conversationsLoadMoreError: boolean;
    onLoadMoreConversations: () => void;
    onRetryConversations: () => void;
    messagesLoading: boolean;
    messagesError: boolean;
    onRetryMessages: () => void;
    onNewChat: () => void;
    onSelectConversation: (conversationId: string) => void;
    onConversationId: (id: string) => void;
    skillIdInView?: string;
    onViewSkill: (skillId: string) => void;
    onCloseSkill: () => void;
    onSkillDeleted: (skillId: string) => void;
    onSkillUpdated: (skill: { _id: string; name: string }) => void;
    dataStoreIdInView?: string;
    onViewDataStore: (id: string) => void;
    onCloseDataStore: () => void;
    onDataStoreDeleted: (dataStoreId: string) => void;
    onDataStoreUpdated: (dataStore: { _id: string; name: string }) => void;
    channelInView?: boolean;
    onViewChannel: () => void;
    onCloseChannel: () => void;
    advancedSettingsInView?: boolean;
    onViewAdvancedSettings: () => void;
    onCloseAdvancedSettings: () => void;
    getChannelUiConfig: () => ChatAgentUiType | undefined;
    getChannelDescription: () => string;
    onSaveChannelUiConfig: (next: ChatAgentUiType) => Promise<void>;
    onSaveChannelDescription: (description: string) => Promise<void>;
    onConfigChange: (config: AgentConfigDraft) => void;
    onAgentConfig: (config: AgentConfigDraft) => void;
    onBack: () => void;
    agentName: string;
    agentCreatedAt?: string;
    agentUpdatedAt?: string;
    agentLoading: boolean;
    agentSaving: boolean;
    agentSaved: boolean;
    onPreview: () => void;
    onSettings: () => void;
    onDelete: () => void | Promise<void>;
    agentDeleting?: boolean;
    hasPendingChanges?: boolean;
    hasPendingUiConfig?: boolean;
    isPublishing?: boolean;
    originalInstructions?: string;
    currentInstructions?: string;
    getPublishedUiConfig?: () => ChatAgentUiType | undefined;
    getCurrentUiConfig?: () => ChatAgentUiType | undefined;
    onPublish?: () => Promise<void>;
    onDiscardPending?: () => Promise<void>;
    onDiscardModel?: () => void | Promise<void>;
    onDiscardAppearance?: () => void | Promise<void>;
    previewOpen: boolean;
    previewAgent?: ChatAgentType;
    previewLoading?: boolean;
    onClosePreview: () => void;
}

const Builder = ({
    config,
    initialPrompt,
    initialFiles,
    initialMessages,
    restoreInitialMessages,
    agentId,
    activeConversationId,
    chatKey,
    conversations,
    conversationsHasMore,
    conversationsLoadingMore,
    conversationsError,
    conversationsLoadMoreError,
    onLoadMoreConversations,
    onRetryConversations,
    messagesLoading,
    messagesError,
    onRetryMessages,
    onNewChat,
    onSelectConversation,
    onConversationId,
    skillIdInView,
    onViewSkill,
    onCloseSkill,
    onSkillDeleted,
    onSkillUpdated,
    dataStoreIdInView,
    onViewDataStore,
    onCloseDataStore,
    onDataStoreDeleted,
    onDataStoreUpdated,
    channelInView,
    onViewChannel,
    onCloseChannel,
    advancedSettingsInView,
    onViewAdvancedSettings,
    onCloseAdvancedSettings,
    getChannelUiConfig,
    getChannelDescription,
    onSaveChannelUiConfig,
    onSaveChannelDescription,
    onConfigChange,
    onAgentConfig,
    onBack,
    agentName,
    agentCreatedAt,
    agentUpdatedAt,
    agentLoading,
    agentSaving,
    agentSaved,
    onPreview,
    onSettings,
    onDelete,
    agentDeleting,
    hasPendingChanges,
    hasPendingUiConfig,
    isPublishing,
    originalInstructions,
    currentInstructions,
    getPublishedUiConfig,
    getCurrentUiConfig,
    onPublish,
    onDiscardPending,
    onDiscardModel,
    onDiscardAppearance,
    previewOpen,
    previewAgent,
    previewLoading,
    onClosePreview,
}: BuilderProps) => {
    const builderChatRef = useRef<BuilderChatHandle>(null);
    const [mobileTab, setMobileTab] = useState<'chat' | 'config'>('chat');
    const { containerRef, isResizing, handleProps } = useBuilderChatWidth();

    const handleGenerateSkill = (description: string) => {
        builderChatRef.current?.sendMessage(`Create a skill using this description: ${description}`);
    };

    // The connection form only exists inside the data store view, so open it before answering.
    const handleBeforeRequest = (request: BuilderRequest) => {
        setMobileTab('config');
        onClosePreview();

        if (request.dataStoreId) onViewDataStore(request.dataStoreId);
    };

    const handlePreview = () => {
        onPreview();
        setMobileTab('config');
    };

    const renderRightPane = () => {
        // Preview wins whenever it's open, regardless of which sub-view is active,
        // so "Try it out" works even from channel/skill/data-store edit.
        if (previewOpen) {
            if (previewLoading || !previewAgent) {
                return (
                    <div className="flex h-full bg-background">
                        {/* sidebar rail — mirrors ChatSideBar */}
                        <div className="hidden w-[280px] shrink-0 flex-col gap-4 bg-sidebar p-3 md:flex">
                            {/* brand */}
                            <div className="h-8 w-28 rounded bg-sidebar-foreground/10" />
                            {/* nav items */}
                            <div className="flex flex-col gap-1.5">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="h-8 rounded-lg bg-sidebar-foreground/10" />
                                ))}
                            </div>
                            {/* recents list */}
                            <div className="mt-2 flex flex-col gap-1.5">
                                <div className="h-4 w-20 rounded bg-sidebar-foreground/10" />
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-7 rounded-lg bg-sidebar-foreground/10"
                                        style={{ opacity: 1 - i * 0.1 }}
                                    />
                                ))}
                            </div>
                            {/* avatar footer */}
                            <div className="mt-auto flex items-center gap-2">
                                <div className="size-8 rounded-full bg-sidebar-foreground/10" />
                                <div className="h-4 w-24 rounded bg-sidebar-foreground/10" />
                            </div>
                        </div>
                        {/* chat area */}
                        <div className="flex min-w-0 flex-1 flex-col">
                            {/* header row */}
                            <div className="flex items-center justify-between px-4 py-3">
                                <div className="h-5 w-32 rounded bg-foreground/10" />
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-16 rounded-full bg-foreground/10" />
                                    <div className="size-7 rounded-full bg-foreground/10" />
                                </div>
                            </div>
                            {/* centered home — title + composer + suggestion chips */}
                            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
                                <div className="h-8 w-44 rounded bg-foreground/10" />
                                <div className="h-28 w-full max-w-2xl rounded-2xl bg-foreground/10" />
                                <div className="grid w-full max-w-2xl grid-cols-3 gap-4">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="h-16 rounded-3xl bg-foreground/10" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            return <PreviewChat key={previewAgent._id} agent={previewAgent} onClose={onClosePreview} />;
        }

        if (skillIdInView) {
            return (
                <>
                    <header className="config-topbar z-10 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
                        <div className="flex min-w-0 items-center gap-2" aria-live="polite">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={onCloseSkill}
                                className="hover:text-text-primary h-6 w-6 shrink-0 rounded-md text-text-secondary"
                                aria-label="Back to builder"
                            >
                                <ChevronLeft className="size-5" />
                            </Button>
                            <h1 className="m-0 flex min-w-0 items-center gap-2 text-sm">
                                <span className="truncate font-medium text-text-secondary">{agentName}</span>
                                <span className="shrink-0 font-normal text-text-secondary">/</span>
                                <span className="shrink-0 truncate text-base font-medium text-text-secondary">
                                    Skills
                                </span>
                            </h1>
                        </div>
                    </header>
                    <SkillEdit
                        skillId={skillIdInView}
                        showTitleBackButton={false}
                        onBack={onCloseSkill}
                        onDeleted={onSkillDeleted}
                        onUpdated={onSkillUpdated}
                    />
                </>
            );
        }

        if (dataStoreIdInView) {
            return (
                <DataStoreEdit
                    dataStoreId={dataStoreIdInView}
                    onBack={onCloseDataStore}
                    onDeleted={onDataStoreDeleted}
                    onUpdated={onDataStoreUpdated}
                    agentName={agentName}
                />
            );
        }

        if (channelInView) {
            return (
                <ChatChannelEdit
                    agentName={agentName}
                    initialUiConfig={getChannelUiConfig()}
                    initialDescription={getChannelDescription()}
                    onSaveUiConfig={onSaveChannelUiConfig}
                    onSaveDescription={onSaveChannelDescription}
                    onBack={onCloseChannel}
                />
            );
        }

        if (advancedSettingsInView) {
            return <AgentAdvancedSettings agentName={agentName} onBack={onCloseAdvancedSettings} />;
        }

        return (
            <>
                <ConfigTopbar
                    agentName={agentName}
                    createdAt={agentCreatedAt}
                    updatedAt={agentUpdatedAt}
                    isLoading={agentLoading}
                    isSaving={agentSaving}
                    isSaved={agentSaved}
                    hasPendingChanges={hasPendingChanges}
                    hasPendingUiConfig={hasPendingUiConfig}
                    isPublishing={isPublishing}
                    originalInstructions={originalInstructions}
                    currentInstructions={currentInstructions}
                    getPublishedUiConfig={getPublishedUiConfig}
                    getCurrentUiConfig={getCurrentUiConfig}
                    getAgentDescription={getChannelDescription}
                    onPublish={onPublish}
                    onDiscardPending={onDiscardPending}
                    onDiscardModel={onDiscardModel}
                    onDiscardAppearance={onDiscardAppearance}
                    onPreview={handlePreview}
                    onDelete={onDelete}
                    isDeleting={agentDeleting}
                    onViewAdvancedSettings={onViewAdvancedSettings}
                />
                <BuilderConfig
                    config={config}
                    agentId={agentId}
                    onChange={onConfigChange}
                    onGenerateSkill={handleGenerateSkill}
                    onViewSkill={onViewSkill}
                    onViewDataStore={onViewDataStore}
                    onViewChannel={onViewChannel}
                    onOpenSettings={onSettings}
                />
            </>
        );
    };

    const renderChat = () => {
        if (messagesLoading) {
            return (
                <aside className={cn('builder-chat-aside flex shrink-0 flex-col bg-background', 'w-full')}>
                    {/* topbar */}
                    <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border px-4">
                        <div className="h-5 w-24 rounded-md bg-foreground/10" />
                        <div className="ml-auto flex items-center gap-1">
                            <div className="size-8 rounded-md bg-foreground/10" />
                            <div className="size-8 rounded-md bg-foreground/10" />
                        </div>
                    </div>

                    {/* messages */}
                    <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
                        {/* assistant */}
                        <div className="flex gap-3">
                            <div className="size-6 shrink-0 rounded-full bg-foreground/10" />
                            <div className="flex flex-1 flex-col gap-2">
                                <div className="h-3 w-[80%] rounded bg-foreground/10" />
                                <div className="h-3 w-[60%] rounded bg-foreground/10" />
                                <div className="h-3 w-[70%] rounded bg-foreground/10" />
                            </div>
                        </div>
                        {/* user */}
                        <div className="flex max-w-[88%] flex-col items-end gap-2 self-end">
                            <div className="h-3 w-40 rounded bg-foreground/10" />
                            <div className="h-3 w-32 rounded bg-foreground/10" />
                        </div>
                        {/* assistant */}
                        <div className="flex gap-3">
                            <div className="size-6 shrink-0 rounded-full bg-foreground/10" />
                            <div className="flex flex-1 flex-col gap-2">
                                <div className="h-3 w-[75%] rounded bg-foreground/10" />
                                <div className="h-3 w-[55%] rounded bg-foreground/10" />
                            </div>
                        </div>
                    </div>

                    {/* composer */}
                    <div className="shrink-0 border-t border-border p-4">
                        <div className="h-10 rounded-xl bg-foreground/10" />
                    </div>
                </aside>
            );
        }

        return (
            <BuilderChat
                key={chatKey}
                ref={builderChatRef}
                onAgentConfig={onAgentConfig}
                onConversationId={onConversationId}
                initialPrompt={initialPrompt}
                initialFiles={initialFiles}
                initialMessages={initialMessages}
                restoreInitialMessages={restoreInitialMessages}
                agentId={agentId}
                activeConversationId={activeConversationId}
                conversations={conversations}
                conversationsHasMore={conversationsHasMore}
                conversationsLoadingMore={conversationsLoadingMore}
                conversationsError={conversationsError}
                conversationsLoadMoreError={conversationsLoadMoreError}
                onLoadMoreConversations={onLoadMoreConversations}
                onRetryConversations={onRetryConversations}
                messagesError={messagesError}
                onRetryMessages={onRetryMessages}
                onNewChat={onNewChat}
                onSelectConversation={onSelectConversation}
                onBack={onBack}
                onOpenPreview={handlePreview}
                onClosePreview={onClosePreview}
                onOpenSettings={onSettings}
            />
        );
    };

    const tabBtnCls = (active: boolean) =>
        cn(
            'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
            active ? 'text-primary' : 'text-text-secondary',
        );

    return (
        <BuilderRequestsProvider onBeforeOpen={handleBeforeRequest}>
            <div
                ref={containerRef}
                className={cn(
                    'builder-container relative flex h-screen flex-1 overflow-hidden',
                    isResizing && 'cursor-col-resize select-none',
                )}
            >
                <div
                    className={cn(
                        'w-full bg-background md:w-(--builder-chat-width,420px) md:shrink-0',
                        'h-[calc(100dvh-72px)] md:sticky md:top-0 md:h-screen',
                        'scrollbar-controller scrollbar-vertical overflow-x-hidden',
                        previewOpen ? 'hidden' : mobileTab !== 'chat' && 'hidden md:block',
                    )}
                >
                    {renderChat()}
                </div>
                {!previewOpen && <BuilderResizeHandle {...handleProps} />}
                <div
                    className={cn(
                        'scrollbar-controller scrollbar-vertical flex min-w-0 flex-1 flex-col overflow-x-hidden bg-card pb-[60px] md:pb-0 [&_.skill-edit-pane]:bg-card [&_.skill-edit-pane]:p-4',
                        !previewOpen && mobileTab !== 'config' && 'hidden md:flex',
                    )}
                >
                    {renderRightPane()}
                </div>
                <nav
                    className="fixed inset-x-0 bottom-0 z-50 flex h-[60px] border-t border-border bg-card md:hidden"
                    aria-label="Panel navigation"
                >
                    <button
                        type="button"
                        className={tabBtnCls(mobileTab === 'chat' && !previewOpen)}
                        onClick={() => {
                            onClosePreview();
                            setMobileTab('chat');
                        }}
                    >
                        <MessageCircleIcon size={18} aria-hidden="true" />
                        <span>Chat</span>
                    </button>
                    <button
                        type="button"
                        className={tabBtnCls(mobileTab === 'config' && !previewOpen)}
                        onClick={() => {
                            onClosePreview();
                            setMobileTab('config');
                        }}
                    >
                        <Settings2Icon size={18} aria-hidden="true" />
                        <span>Configure</span>
                    </button>
                </nav>
            </div>
        </BuilderRequestsProvider>
    );
};

export default Builder;
