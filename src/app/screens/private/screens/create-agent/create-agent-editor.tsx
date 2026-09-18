import { useQueryClient } from '@tanstack/react-query';
import type { UIMessage } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useMatch, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useDeleteAgentMutation } from '@/lib/api/admin/agents';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import type { ChatAgentType } from '@/types/admin';
import type { FileType } from '@/types/chat';
import type { ChatAgentUiType } from '@/types/ui';

import { invalidateAgentTiles } from '../agents/hooks/use-agents-queries';

import Builder from './components/builder/builder';
import CreateAgentEditorSkeleton from './components/create-agent-editor-skeleton';
import { SettingsModal } from './components/settings-modal';
import { useAgentAutosave } from './hooks/use-agent-autosave';
import {
    useAgentConfigQuery,
    useConversationMessagesQuery,
    useConversationsQuery,
    usePreviewAgentQuery,
} from './hooks/use-create-agent-queries';
import type { CreateAgentConversation } from './lib/builder-conversations-api';
import { deleteLauncherById, findLauncherIdForAgent } from './lib/launcher-publish';
import type { AgentConfigDraft } from './types';

interface LocationState {
    config?: AgentConfigDraft;
    initialPrompt?: string;
    initialFiles?: FileType[];
    from?: string;
}

const getConversationStorageKey = (agentId: string): string => `create-agent:${agentId}:conversationId`;

const getStoredConversationId = (storageKey: string): string | null => {
    try {
        return window.sessionStorage.getItem(storageKey) || null;
    } catch {
        return null;
    }
};

const setStoredConversationId = (storageKey: string, conversationId: string | null) => {
    try {
        if (conversationId) {
            window.sessionStorage.setItem(storageKey, conversationId);
        } else {
            window.sessionStorage.removeItem(storageKey);
        }
    } catch {
        return;
    }
};

interface CreateAgentEditorInnerProps {
    agentId: string;
    restoredConfig: AgentConfigDraft | null;
    initialSystemPromptCodeId?: string;
    initialSystemPromptVersion?: string;
    initialUiConfigCodeId?: string;
    initialUiConfigVersion?: string;
    initialUiConfig?: ChatAgentUiType;
    initialDescription?: string;
    initialCreatedAt?: string;
    initialUpdatedAt?: string;
    initialPublishedInstructions?: string;
    initialPendingCodeId?: string;
    initialPendingVersion?: string;
    initialPendingUiConfigCodeId?: string;
    initialPendingUiConfigVersion?: string;
    initialPendingUiConfig?: ChatAgentUiType;
    agentLoading: boolean;
    conversations: CreateAgentConversation[];
    conversationsHasMore: boolean;
    conversationsLoadingMore: boolean;
    conversationsError: boolean;
    conversationsLoadMoreError: boolean;
    onLoadMoreConversations: () => void;
    onRetryConversations: () => void;
}

const CreateAgentEditorInner = ({
    agentId,
    restoredConfig,
    initialSystemPromptCodeId,
    initialSystemPromptVersion,
    initialUiConfigCodeId,
    initialUiConfigVersion,
    initialUiConfig,
    initialDescription,
    initialCreatedAt,
    initialUpdatedAt,
    initialPublishedInstructions,
    initialPendingCodeId,
    initialPendingVersion,
    initialPendingUiConfigCodeId,
    initialPendingUiConfigVersion,
    initialPendingUiConfig,
    agentLoading,
    conversations,
    conversationsHasMore,
    conversationsLoadingMore,
    conversationsError,
    conversationsLoadMoreError,
    onLoadMoreConversations,
    onRetryConversations,
}: CreateAgentEditorInnerProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const skillMatch = useMatch('/agent-builder/:id/skills/:skillId');
    const skillIdInView = skillMatch?.params.skillId;
    const dataStoreMatch = useMatch('/agent-builder/:id/datastores/:dataStoreId');
    const dataStoreIdInView = dataStoreMatch?.params.dataStoreId;
    const channelMatch = useMatch('/agent-builder/:id/channel');
    const channelInView = Boolean(channelMatch);
    const advancedSettingsMatch = useMatch('/agent-builder/:id/advanced-settings/*');
    const advancedSettingsInView = Boolean(advancedSettingsMatch);

    const locationState = location.state as LocationState | null;
    const conversationStorageKey = useMemo(() => getConversationStorageKey(agentId), [agentId]);
    const storedConversationId = useMemo(
        () => getStoredConversationId(conversationStorageKey),
        [conversationStorageKey],
    );

    const [agentConfig, setAgentConfig] = useState<AgentConfigDraft>(restoredConfig ?? locationState?.config ?? {});
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    // Covers the launcher lookup that runs before the mutation too, so the confirm button disables
    // on the first click instead of after the first round trip.
    const [deleting, setDeleting] = useState(false);

    const [initialPrompt, setInitialPrompt] = useState(() => locationState?.initialPrompt);
    const [initialFiles] = useState(() => locationState?.initialFiles);
    const [returnPath] = useState(() => locationState?.from ?? '/');

    const previewAgentQuery = usePreviewAgentQuery(agentId, previewOpen);

    const previewAgent = previewAgentQuery.data
        ? ({ ...previewAgentQuery.data, uiConfig: previewAgentQuery.data.uiConfig ?? {} } as ChatAgentType)
        : undefined;

    const deleteMutation = useDeleteAgentMutation();
    const queryClient = useQueryClient();

    const {
        saving,
        saved,
        hasPendingChanges,
        isPublishing,
        originalInstructions,
        synchronizePersistedState,
        hasUnsavedLocalEdits,
        publishAll,
        discardPending,
        getUiConfig,
        getPublishedUiConfig,
        getDescription,
        saveChannelUiConfig,
        saveChannelDescription,
        hasPendingUiConfig,
        discardModelPending,
        discardAppearancePending,
    } = useAgentAutosave(agentId, agentConfig, {
        systemPromptCodeId: initialSystemPromptCodeId,
        systemPromptVersion: initialSystemPromptVersion,
        uiConfigCodeId: initialUiConfigCodeId,
        uiConfigVersion: initialUiConfigVersion,
        uiConfig: initialUiConfig,
        description: initialDescription,
        defaultInstructions: initialPublishedInstructions ?? '',
        pendingCodeId: initialPendingCodeId,
        pendingVersion: initialPendingVersion,
        pendingUiConfigCodeId: initialPendingUiConfigCodeId,
        pendingUiConfigVersion: initialPendingUiConfigVersion,
        pendingUiConfig: initialPendingUiConfig,
    });

    // The loaded config is the only source of updatedAt and no save path refetches it, so a save
    // this session would otherwise leave the topbar reading the pre-edit value until a reload.
    useEffect(() => {
        if (saved) setLastSavedAt(new Date().toISOString());
    }, [saved]);

    useEffect(() => {
        if (restoredConfig === null) return;

        // While the user has unsaved local edits to the editor config, skip re-seeding from the
        // server so an AI mutation or refresh landing mid-edit cannot discard in-progress changes.
        // UI-config drafts are not part of this guard; the appearance form re-syncs itself safely.
        if (hasUnsavedLocalEdits()) return;

        synchronizePersistedState(restoredConfig, {
            systemPromptCodeId: initialSystemPromptCodeId,
            systemPromptVersion: initialSystemPromptVersion,
            uiConfigCodeId: initialUiConfigCodeId,
            uiConfigVersion: initialUiConfigVersion,
            uiConfig: initialUiConfig,
            description: initialDescription,
            defaultInstructions: initialPublishedInstructions ?? '',
            pendingCodeId: initialPendingCodeId,
            pendingVersion: initialPendingVersion,
            pendingUiConfigCodeId: initialPendingUiConfigCodeId,
            pendingUiConfigVersion: initialPendingUiConfigVersion,
            pendingUiConfig: initialPendingUiConfig,
        });
        setAgentConfig(restoredConfig);
    }, [
        restoredConfig,
        initialSystemPromptCodeId,
        initialSystemPromptVersion,
        initialUiConfigCodeId,
        initialUiConfigVersion,
        initialUiConfig,
        initialDescription,
        initialPublishedInstructions,
        initialPendingCodeId,
        initialPendingVersion,
        initialPendingUiConfigCodeId,
        initialPendingUiConfigVersion,
        initialPendingUiConfig,
        synchronizePersistedState,
        hasUnsavedLocalEdits,
    ]);

    const [activeConversationId, setActiveConversationId] = useState<string | null>(() => storedConversationId);
    const [chatKey, setChatKey] = useState(0);
    const isExplicitSelectionRef = useRef(Boolean(storedConversationId));
    const storedConversationRef = useRef({ key: conversationStorageKey, id: storedConversationId });

    const shouldLoadSelectedConversation = Boolean(activeConversationId && isExplicitSelectionRef.current);
    const messagesQuery = useConversationMessagesQuery(
        activeConversationId ?? '',
        agentId,
        shouldLoadSelectedConversation,
    );

    useEffect(() => {
        if (
            storedConversationRef.current.key === conversationStorageKey &&
            storedConversationRef.current.id === storedConversationId
        )
            return;

        storedConversationRef.current = { key: conversationStorageKey, id: storedConversationId };
        isExplicitSelectionRef.current = Boolean(storedConversationId);
        setActiveConversationId(storedConversationId);
        setChatKey((k) => k + 1);
    }, [conversationStorageKey, storedConversationId]);

    useEffect(() => {
        if (locationState?.initialPrompt) {
            navigate(location.pathname, {
                replace: true,
                state: { config: locationState.config },
            });
        }
    }, []);

    const handleNewChat = () => {
        isExplicitSelectionRef.current = false;
        setInitialPrompt(undefined);
        setActiveConversationId(null);
        setStoredConversationId(conversationStorageKey, null);
        setChatKey((k) => k + 1);
    };

    const handleSelectConversation = (conversationId: string) => {
        isExplicitSelectionRef.current = true;
        setActiveConversationId(conversationId);
        setStoredConversationId(conversationStorageKey, conversationId);
        setChatKey((k) => k + 1);
    };

    const handleConversationId = (id: string) => {
        isExplicitSelectionRef.current = false;
        setActiveConversationId(id);
        setStoredConversationId(conversationStorageKey, id);
        void queryClient.invalidateQueries({ queryKey: ['create-agent-conversations', agentId] });
    };

    const initialMessages = useMemo<UIMessage[]>(() => {
        const fetched = messagesQuery.data ?? [];

        return fetched.map((m, i) => ({
            id: m.id || `${activeConversationId}-restored-${i}`,
            role: m.role,
            parts: m.parts,
        }));
    }, [messagesQuery.data, activeConversationId]);

    const promptToSend = !activeConversationId && initialMessages.length === 0 ? initialPrompt : undefined;
    const shouldRestoreInitialMessages =
        shouldLoadSelectedConversation && messagesQuery.isSuccess && !messagesQuery.isFetching;
    // react-query keeps the last successful data through a failed refetch, so a populated
    // thread is never replaced by the failure state.
    const messagesError = shouldLoadSelectedConversation && messagesQuery.isError && initialMessages.length === 0;

    const handleRetryMessages = () => {
        void messagesQuery.refetch();
    };

    const handleAgentConfig = (config: AgentConfigDraft) => {
        setAgentConfig((prev) => {
            const next = { ...prev };

            if (config.name !== undefined) next.name = config.name;
            if (config.instructions !== undefined) next.instructions = config.instructions;
            if (config.models !== undefined) next.models = config.models;

            if (config.mcpServers?.length) {
                const existing = prev.mcpServers ?? [];
                const toAdd = config.mcpServers.filter((n) => !existing.some((e) => e._id === n._id));

                next.mcpServers = [...existing, ...toAdd];
            }

            if (config.skills?.length) {
                const existing = prev.skills ?? [];
                const toAdd = config.skills.filter((n) => !existing.some((e) => e._id === n._id));

                next.skills = [...existing, ...toAdd];
            }

            if (config.files?.length) {
                const existing = prev.files ?? [];
                const toAdd = config.files.filter((n) => !existing.some((e) => e._id === n._id));

                next.files = [...existing, ...toAdd];
            }

            return next;
        });
    };

    const handleSkillDeleted = (skillId: string) => {
        setAgentConfig((prev) => ({
            ...prev,
            skills: (prev.skills ?? []).filter((s) => s._id !== skillId),
        }));
        navigate(`/agent-builder/${agentId}`);
    };

    const handleSkillUpdated = ({ _id, name }: { _id: string; name: string }) => {
        setAgentConfig((prev) => ({
            ...prev,
            skills: (prev.skills ?? []).map((s) => (s._id === _id ? { ...s, name } : s)),
        }));
    };

    const handleDataStoreDeleted = (dataStoreId: string) => {
        setAgentConfig((prev) => ({
            ...prev,
            files: (prev.files ?? []).filter((f) => f._id !== dataStoreId),
        }));
        navigate(`/agent-builder/${agentId}`);
    };

    const handleDataStoreUpdated = ({ _id, name }: { _id: string; name: string }) => {
        setAgentConfig((prev) => ({
            ...prev,
            files: (prev.files ?? []).map((f) => (f._id === _id ? { ...f, name } : f)),
        }));
    };

    const handleDiscardModel = async () => {
        const result = await discardModelPending();

        if (result.ok) {
            setAgentConfig((a) => ({ ...a, models: result.models }));
        }
    };

    const handleDiscardAppearance = async () => {
        await discardAppearancePending();
    };

    const handleDelete = async () => {
        if (deleting) return;

        setDeleting(true);
        try {
            // Read before the delete, remove after it: the agent-to-launcher link is unreadable once
            // the agent is gone, and a failed agent delete must not leave the launcher gone.
            const { launcherId, readFailed } = await findLauncherIdForAgent(agentId);

            await deleteMutation.mutateAsync({ id: agentId });

            if (launcherId && !(await deleteLauncherById(launcherId))) {
                toast.warning('Agent deleted, but its launcher could not be removed. Ask an admin to delete it.');
            } else if (readFailed) {
                toast.warning(
                    'Agent deleted, but we could not check for a launcher. Ask an admin to remove any leftover.',
                );
            }
            await invalidateAgentTiles(queryClient);
            navigate('/');
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, 'Failed to delete agent.'));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="create-agent-editor flex min-h-screen">
            <Builder
                config={agentConfig}
                initialPrompt={promptToSend}
                initialFiles={initialFiles}
                initialMessages={initialMessages}
                restoreInitialMessages={shouldRestoreInitialMessages}
                agentId={agentId}
                activeConversationId={activeConversationId}
                chatKey={chatKey}
                conversations={conversations}
                conversationsHasMore={conversationsHasMore}
                conversationsLoadingMore={conversationsLoadingMore}
                conversationsError={conversationsError}
                conversationsLoadMoreError={conversationsLoadMoreError}
                onLoadMoreConversations={onLoadMoreConversations}
                onRetryConversations={onRetryConversations}
                messagesLoading={
                    shouldLoadSelectedConversation && (messagesQuery.isLoading || messagesQuery.isFetching)
                }
                messagesError={messagesError}
                onRetryMessages={handleRetryMessages}
                onNewChat={handleNewChat}
                onSelectConversation={handleSelectConversation}
                onConversationId={handleConversationId}
                skillIdInView={skillIdInView}
                onViewSkill={(skillId) => navigate(`/agent-builder/${agentId}/skills/${skillId}`)}
                onCloseSkill={() => navigate(`/agent-builder/${agentId}`)}
                onSkillDeleted={handleSkillDeleted}
                onSkillUpdated={handleSkillUpdated}
                dataStoreIdInView={dataStoreIdInView}
                onViewDataStore={(dataStoreId) => navigate(`/agent-builder/${agentId}/datastores/${dataStoreId}`)}
                onCloseDataStore={() => navigate(`/agent-builder/${agentId}`)}
                onDataStoreDeleted={handleDataStoreDeleted}
                onDataStoreUpdated={handleDataStoreUpdated}
                channelInView={channelInView}
                onViewChannel={() => navigate(`/agent-builder/${agentId}/channel`)}
                onCloseChannel={() => navigate(`/agent-builder/${agentId}`)}
                advancedSettingsInView={advancedSettingsInView}
                onViewAdvancedSettings={() => navigate(`/agent-builder/${agentId}/advanced-settings`)}
                onCloseAdvancedSettings={() => navigate(`/agent-builder/${agentId}`)}
                getChannelUiConfig={getUiConfig}
                getChannelDescription={getDescription}
                onSaveChannelUiConfig={saveChannelUiConfig}
                onSaveChannelDescription={saveChannelDescription}
                onConfigChange={setAgentConfig}
                onAgentConfig={handleAgentConfig}
                onBack={() => navigate(returnPath)}
                agentName={agentConfig.name ?? ''}
                agentCreatedAt={initialCreatedAt}
                agentUpdatedAt={lastSavedAt ?? initialUpdatedAt}
                agentLoading={agentLoading}
                agentSaving={saving}
                agentSaved={saved}
                onPreview={() => setPreviewOpen(true)}
                onSettings={() => setSettingsOpen(true)}
                onDelete={handleDelete}
                agentDeleting={deleting}
                hasPendingChanges={hasPendingChanges}
                hasPendingUiConfig={hasPendingUiConfig}
                isPublishing={isPublishing}
                originalInstructions={originalInstructions}
                currentInstructions={agentConfig.instructions ?? ''}
                getPublishedUiConfig={getPublishedUiConfig}
                getCurrentUiConfig={getUiConfig}
                onPublish={publishAll}
                onDiscardPending={async () => {
                    const orig = await discardPending();

                    setAgentConfig((a) => ({ ...a, instructions: orig }));
                }}
                onDiscardModel={handleDiscardModel}
                onDiscardAppearance={handleDiscardAppearance}
                previewOpen={previewOpen}
                previewAgent={previewAgent}
                previewLoading={previewAgentQuery.isLoading || previewAgentQuery.isFetching}
                onClosePreview={() => setPreviewOpen(false)}
            />
            <SettingsModal
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                models={agentConfig.models}
                onChange={(models) => setAgentConfig((a) => ({ ...a, models }))}
            />
        </div>
    );
};

const CreateAgentEditor = () => {
    const { id: agentId } = useParams<{ id: string }>();

    const agentQuery = useAgentConfigQuery(agentId);

    const conversationsQuery = useConversationsQuery(agentId);

    const conversations = useMemo<CreateAgentConversation[]>(() => {
        const seen = new Set<string>();
        const result: CreateAgentConversation[] = [];

        for (const page of conversationsQuery.data?.pages ?? []) {
            for (const conversation of page.conversations) {
                if (seen.has(conversation._id)) continue;
                seen.add(conversation._id);
                result.push(conversation);
            }
        }

        return result;
    }, [conversationsQuery.data]);

    const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch: refetchConversations } = conversationsQuery;

    const [loadMoreFailed, setLoadMoreFailed] = useState(false);

    // The route is `agent-builder/:id/*`, so navigating between agents swaps the param without
    // remounting this component and a latch set on the previous agent would outlive it.
    useEffect(() => {
        setLoadMoreFailed(false);
    }, [agentId]);

    const handleLoadMoreConversations = useCallback(() => {
        if (!hasNextPage || isFetchingNextPage || loadMoreFailed) return;

        // A rejected page fetch never lands in `data.pages`, so `getNextPageParam` keeps reading
        // the last successful page and `hasNextPage` stays true. Without this latch the scroll
        // sentinel re-arms the moment the fetch settles and re-requests the failing page forever.
        void fetchNextPage().then((outcome) => {
            if (outcome.error) setLoadMoreFailed(true);
        });
    }, [fetchNextPage, hasNextPage, isFetchingNextPage, loadMoreFailed]);

    const handleRetryConversations = useCallback(() => {
        // Cleared only once the refetch settles: clearing it up front remounts the sentinel under
        // the pointer, and the resulting `fetchNextPage` cancels the refetch that is still in flight.
        // `refetch` resolves with an `error` field rather than rejecting, so a retry against a
        // still-broken endpoint has to re-latch instead of reopening the refire loop.
        void refetchConversations().then((outcome) => {
            setLoadMoreFailed(Boolean(outcome.error));
        });
    }, [refetchConversations]);

    if (!agentId) {
        return null;
    }

    if (agentQuery.isLoading || conversationsQuery.isLoading) {
        return <CreateAgentEditorSkeleton />;
    }

    if (agentQuery.isError) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-[color-mix(in_srgb,var(--background)_96%,var(--primary))] text-text-secondary">
                <span>Could not load this agent. Please try again.</span>
            </div>
        );
    }

    return (
        <CreateAgentEditorInner
            // `agentConfig` and the autosave baseline seed from `useState` initialisers that do not
            // re-run on a prop change, and the re-seed below is blocked while the draft is dirty, so
            // a switch without a remount leaves the outgoing agent's draft on screen under the new
            // id with autosave suppressed. Writes stay correctly addressed either way.
            key={agentId}
            agentId={agentId}
            restoredConfig={agentQuery.data?.draft ?? null}
            initialSystemPromptCodeId={agentQuery.data?.systemPromptCodeId}
            initialSystemPromptVersion={agentQuery.data?.systemPromptVersion}
            initialUiConfigCodeId={agentQuery.data?.uiConfigCodeId}
            initialUiConfigVersion={agentQuery.data?.uiConfigVersion}
            initialUiConfig={agentQuery.data?.uiConfig}
            initialDescription={agentQuery.data?.description}
            initialCreatedAt={agentQuery.data?.createdAt}
            initialUpdatedAt={agentQuery.data?.updatedAt}
            initialPublishedInstructions={agentQuery.data?.publishedInstructions}
            initialPendingCodeId={agentQuery.data?.pendingCodeId}
            initialPendingVersion={agentQuery.data?.pendingVersion}
            initialPendingUiConfigCodeId={agentQuery.data?.pendingUiConfigCodeId}
            initialPendingUiConfigVersion={agentQuery.data?.pendingUiConfigVersion}
            initialPendingUiConfig={agentQuery.data?.pendingUiConfig}
            agentLoading={agentQuery.isFetching}
            conversations={conversations}
            conversationsHasMore={Boolean(hasNextPage) && !loadMoreFailed}
            conversationsLoadingMore={isFetchingNextPage}
            conversationsError={conversationsQuery.isError}
            conversationsLoadMoreError={loadMoreFailed}
            onLoadMoreConversations={handleLoadMoreConversations}
            onRetryConversations={handleRetryConversations}
        />
    );
};

export default CreateAgentEditor;
