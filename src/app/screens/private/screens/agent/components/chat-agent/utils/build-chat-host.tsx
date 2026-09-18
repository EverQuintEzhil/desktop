import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { AgentFooter } from '@/app/components';
import NotificationPermissionPrompt from '@/app/components/chat-completion-notifier/notification-permission-prompt';
import { useAgentLauncherSidesheet } from '@/app/hooks';
import {
    isUsageVisibleTo,
    readAgentUsageConfig,
    TokenUsageDialog,
} from '@/app/screens/private/screens/agent/components/token-usage-dialog';
import { areRoutinesVisibleTo } from '@/app/screens/private/screens/routines/routines-visibility';
import { createFluentMindConversationAdapter, createFluentMindSession, type ChatHost } from '@/components/chat-host';
import { InstructionsEditor } from '@/components/instructions-editor';
import { appConversationApi } from '@/lib/api/app/conversation';
import { authAwareFetch } from '@/lib/auth-aware-fetch';
import { getApiBaseUrl, getFilesBaseUrl } from '@/lib/axios';
import type { ChatAgentType } from '@/types/admin';
import type { TenantType, UserState } from '@/types/store';

import { useChatSidePanel } from '../components/chat/conversation-files/chat-files-panel-context';
import ChatFilesToggleButton from '../components/chat/conversation-files/chat-files-toggle-button';
import ConversationFilesPanel from '../components/chat/conversation-files/conversation-files-panel';
import AgentEditButton from '../components/chat/conversation-header/agent-edit-button';
import ConversationHeaderMenuItems from '../components/chat/conversation-header/conversation-header-menu-items';
import ConversationRoutineCrumb from '../components/chat/conversation-header/conversation-routine-crumb';
import ConversationSpaceBadge from '../components/chat/conversation-header/conversation-space-badge';
import ConversationTitleCrumb from '../components/chat/conversation-header/conversation-title-crumb';
import ConversationTokensPill from '../components/chat/conversation-header/conversation-tokens-pill';
import useAgentMenuItems from '../components/chat/conversation-header/use-agent-menu-items';
import ConversationRoutinePane from '../components/chat/conversation-routine/conversation-routine-pane';
import ConversationRoutineToggleButton from '../components/chat/conversation-routine/conversation-routine-toggle-button';
import ConversationToolsPane from '../components/chat/conversation-tools/chat-tools-pane';
import ChatToolsToggleButton from '../components/chat/conversation-tools/chat-tools-toggle-button';

export interface BuildChatHostParams {
    agent: ChatAgentType;
    user: UserState;
    tenant: TenantType;
    isPreview: boolean;
    getFrom: () => string;
    navigate: (path: string, options?: { replace?: boolean; state?: unknown }) => void;
    onStartNewConversation: () => void;
}

export const buildChatHost = ({
    agent,
    user,
    tenant,
    isPreview,
    getFrom,
    navigate,
    onStartNewConversation,
}: BuildChatHostParams): ChatHost => {
    // In preview the chat runs under an isolated router with no app-level
    // settings routes, so the "manage" escape slots are omitted (the slot
    // contract auto-hides those rows) and share URLs resolve to the real app.
    const escapeSlots = isPreview
        ? {
              resolveShareUrl: (conversationId: string) =>
                  `${window.location.origin}/agent/${agent.slug}/chat/${conversationId}`,
          }
        : {
              renderManageConnectorsLink: (children: ReactNode) => (
                  <Link to="/settings/connectors" state={{ from: getFrom() }}>
                      {children}
                  </Link>
              ),
              onManageSkills: () => navigate('/settings/skills', { state: { from: getFrom() } }),
              onManageMemories: () => navigate('/settings/memories', { state: { from: getFrom() } }),
          };

    const canSeeUsage = isUsageVisibleTo(readAgentUsageConfig(agent.uiConfig), user.role, tenant.hideAiUsage);
    const areRoutinesEnabled = areRoutinesVisibleTo(agent.uiConfig, user.role, tenant.hideRoutines);

    return {
        session: createFluentMindSession(user, tenant),
        transport: {
            endpoint: `${getApiBaseUrl()}/ai/chat`,
            baseUrl: getApiBaseUrl(),
            filesBaseUrl: getFilesBaseUrl(),
            fetch: authAwareFetch,
            credentials: 'include',
        },
        conversations: createFluentMindConversationAdapter(appConversationApi, { agentId: agent._id }),
        navigation: {
            setConversationId: (id, opts) => {
                if (id) {
                    navigate(`/agent/${agent.slug}/chat/${id}`, {
                        replace: opts?.replace,
                        state: opts?.pendingPrompt ? { pendingBranchPrompt: opts.pendingPrompt } : undefined,
                    });
                }
            },
            startNewConversation: () => {
                onStartNewConversation();
                navigate(`/agent/${agent.slug}`);
            },
        },
        slots: {
            useAgentLauncher: useAgentLauncherSidesheet,
            useSidePanel: useChatSidePanel,
            // Presence must never change for a mounted host: the slot is hook-shaped, so
            // ChatViewHeader's hook count depends on it. The hook self-gates on preview instead.
            useAgentMenuItems,
            renderAboveComposer: () => <NotificationPermissionPrompt agent={agent} />,
            renderFooter: () => <AgentFooter />,
            ...(canSeeUsage && { renderTokenUsageDialog: (props) => <TokenUsageDialog {...props} /> }),
            renderInstructionsEditor: (props) => <InstructionsEditor {...props} />,
            ...escapeSlots,
            renderConversationLink: (conversationId, children) => (
                <Link to={`/agent/${agent.slug}/chat/${conversationId}`}>{children}</Link>
            ),
            onOpenPrompt: (promptId) => navigate(`/agent/${agent.slug}/prompt-library/${promptId}`),
            renderConversationBadge: ({ conversationId }) => (
                <>
                    <ConversationSpaceBadge agent={agent} conversationId={conversationId} />
                    {areRoutinesEnabled && <ConversationRoutineCrumb agent={agent} conversationId={conversationId} />}
                    <ConversationTitleCrumb agent={agent} conversationId={conversationId} />
                </>
            ),
            renderConversationMenuItems: ({ conversationId }) => (
                <ConversationHeaderMenuItems agent={agent} conversationId={conversationId} />
            ),
            renderHeaderActions: ({ conversationId }) => (
                <>
                    <ConversationTokensPill agent={agent} conversationId={conversationId} />
                    {areRoutinesEnabled && <ConversationRoutineToggleButton conversationId={conversationId} />}
                    <ChatFilesToggleButton agent={agent} conversationId={conversationId} />
                    <ChatToolsToggleButton agent={agent} conversationId={conversationId} />
                </>
            ),
            renderChatSidePanel: ({ conversationId }) => (
                <>
                    <ConversationFilesPanel agent={agent} conversationId={conversationId} />
                    <ConversationToolsPane agent={agent} conversationId={conversationId} />
                    {areRoutinesEnabled && <ConversationRoutinePane agent={agent} conversationId={conversationId} />}
                </>
            ),
            renderHomeHeaderActions: () => (
                <>
                    <ChatToolsToggleButton agent={agent} isHome />
                    {!isPreview && <AgentEditButton agent={agent} />}
                </>
            ),
            renderHomeSidePanel: () => <ConversationToolsPane agent={agent} />,
        },
    };
};
