import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import { agentModelPreferenceQueryKey } from '@/components/agent-chat/hooks/use-agent-model-preference';
import { stopChatGeneration } from '@/components/agent-chat/runtime/stop-chat-generation';
import { createToolProgressStore } from '@/components/chat';
import { chatAgent } from '@/test/fixtures/agents';
import { apiUrl, envelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import ChatAgent from './chat-agent';

vi.mock('@/components/agent-chat/runtime/stop-chat-generation', () => ({
    stopChatGeneration: vi.fn(() => Promise.resolve()),
}));

vi.mock('@assistant-ui/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@assistant-ui/react')>();

    return {
        ...actual,
        AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) => children,
    };
});

vi.mock('./components/chat/chat-side-bar/chat-side-bar', () => ({
    default: () => <div>Chat side bar</div>,
}));

vi.mock('@/app/components/chat-keyboard-layer/chat-keyboard-layer', () => ({
    default: () => null,
}));

vi.mock('@/app/components/chat-completion-notifier/chat-completion-notifier', () => ({
    default: () => null,
}));

vi.mock('@/components/agent-chat/view/home', () => ({
    default: () => <div>Chat home view</div>,
}));

const MockChatView = ({ isConversationLoading }: { isConversationLoading: boolean }) => {
    const { onStopGeneration } = useAgentComposerContext();

    return (
        <div data-loading={isConversationLoading ? 'true' : 'false'}>
            Chat conversation view
            <button onClick={onStopGeneration}>Stop generation</button>
        </div>
    );
};

vi.mock('@/components/agent-chat/view/chat-view', () => ({
    default: (props: { isConversationLoading: boolean }) => <MockChatView {...props} />,
}));

const mockThreadState: { messages: unknown[]; isRunning: boolean } = { messages: [], isRunning: false };

const mockRuntime = {
    thread: {
        append: vi.fn(),
        cancelRun: vi.fn(),
        getState: () => mockThreadState,
    },
};

let mockActiveConversationId: string | null = null;

vi.mock('@/components/agent-chat/hooks/use-agent-runtime', () => ({
    useAgentRuntime: () => ({
        runtime: mockRuntime,
        resolvePersistedMessageId: (id: string) => id,
        isPersistedMessageId: () => false,
        registerPersistedMessageIds: vi.fn(),
        resumeAfterReconnect: vi.fn(),
        streamedConversationId: null,
        get activeConversationId() {
            return mockActiveConversationId;
        },
        toolProgressStore: createToolProgressStore(),
        abortAttach: vi.fn(),
    }),
}));

vi.mock('@/components/agent-chat/hooks/use-conversation-loader', () => ({
    useConversationLoader: () => ({
        isConversationLoading: false,
        branchedFromConversation: null,
        loadedConversation: null,
        loadOlderMessages: vi.fn(),
        hasMoreOlderMessages: false,
        isLoadingOlderMessages: false,
        reloadNewestMessages: vi.fn(),
    }),
}));

vi.mock('@/components/agent-chat/hooks/use-conversation-pending-poll', () => ({
    useConversationPendingPoll: () => ({
        isPendingGeneration: false,
    }),
}));

vi.mock('@/components/agent-chat/hooks/use-branch-head-sync', () => ({
    useBranchHeadSync: () => undefined,
}));

vi.mock('@/lib/chat/use-chat-files', () => ({
    useChatFiles: () => ({
        files: [],
        fileInputRef: { current: null },
        isUploading: false,
        setAgentFiles: vi.fn(),
        addFiles: vi.fn(),
        removeFile: vi.fn(),
        clearFiles: vi.fn(),
    }),
}));

vi.mock('@/components/agent-chat/hooks/use-agent-composer-options', () => ({
    useAgentComposerOptions: () => ({
        model: null,
        setModel: vi.fn(),
        availableModels: [],
        parameters: {},
        setParameter: vi.fn(),
        setParameters: vi.fn(),
        removeParameter: vi.fn(),
        isWebSearchEnabled: false,
        setIsWebSearchEnabled: vi.fn(),
        isDeepSearchEnabled: false,
        setIsDeepSearchEnabled: vi.fn(),
        isIncognitoMode: false,
        toggleIncognitoMode: vi.fn(),
        isPublic: false,
        setIsPublic: vi.fn(),
        plusDropdownOptions: [],
        handlePlusDropdownSelect: vi.fn(),
        showPlusDropdown: false,
        setShowPlusDropdown: vi.fn(),
        renderSelectedParameters: () => null,
        connectors: { mcpServers: [] },
        customConnectorIds: [],
        sharedConnectorIds: [],
        skills: { skillArguments: [] },
        composerActionsRef: { current: null },
    }),
}));

vi.mock('./hooks/use-conversation-meta', () => ({
    getConversationMetaQueryKey: (agentId: string, conversationId: string) => [
        'conversation-meta',
        agentId,
        conversationId,
    ],
    useConversationMeta: () => ({ projectId: null }),
}));

vi.mock('./components/chat/conversation-header/use-project-name', () => ({
    useProjectName: () => null,
}));

vi.mock('./hooks/use-conversation-space-move', () => ({
    useConversationSpaceMove: () => vi.fn(),
}));

const renderChatAgentRoute = (route = '/agent/agent-1/chat', agent: ChatAgentType = chatAgent as ChatAgentType) =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/:agentId/*" element={<ChatAgent agent={agent} />} />
        </Routes>,
        { route },
    );

let preferencesRequestPaths: string[] = [];

// The composer options hook is mocked above, so any preferences GET recorded
// here can only come from the screen-level prefetch.
beforeEach(() => {
    preferencesRequestPaths = [];
    mockThreadState.messages = [];
    mockThreadState.isRunning = false;
    mockActiveConversationId = null;
    vi.mocked(stopChatGeneration).mockClear();
    server.use(
        http.get(apiUrl('/agents/:agentId/preferences'), ({ request }) => {
            preferencesRequestPaths.push(new URL(request.url).pathname);

            return envelope({ defaultModelId: 'model-deep' });
        }),
        // The screen reads the notification preference off the profile to decide whether a
        // conversation the reader left should notify when it finishes.
        http.get(apiUrl('/users/me'), () => envelope({ preferences: {} })),
    );
});

describe('ChatAgent', () => {
    it('renders the chat side bar and the chat conversation view for the chat route', () => {
        renderChatAgentRoute();

        expect(screen.getByText('Chat side bar')).toBeInTheDocument();
        expect(screen.getByText('Chat conversation view')).toBeInTheDocument();
    });

    it('renders the chat home view for the root route once the model preference settles', async () => {
        renderChatAgentRoute('/agent/agent-1');

        expect(screen.getByText('Chat side bar')).toBeInTheDocument();
        expect(await screen.findByText('Chat home view')).toBeInTheDocument();
    });

    it('prefetches the model preference at mount and seeds the composer query key', async () => {
        const { queryClient } = renderChatAgentRoute();

        await waitFor(() => expect(preferencesRequestPaths).toEqual([`/agents/${chatAgent._id}/preferences`]));

        await waitFor(() =>
            expect(queryClient.getQueryData(agentModelPreferenceQueryKey(chatAgent._id))).toEqual({
                defaultModelId: 'model-deep',
            }),
        );
    });

    it('keeps the conversation view on its loading state until the model preference settles', async () => {
        renderChatAgentRoute();

        expect(screen.getByText('Chat conversation view')).toHaveAttribute('data-loading', 'true');

        await waitFor(() =>
            expect(screen.getByText('Chat conversation view')).toHaveAttribute('data-loading', 'false'),
        );
    });

    it('does not hold the conversation view loading when the model preference request fails', async () => {
        server.use(
            http.get(apiUrl('/agents/:agentId/preferences'), () =>
                HttpResponse.json({ success: false, value: null }, { status: 500 }),
            ),
        );

        renderChatAgentRoute();

        await waitFor(() =>
            expect(screen.getByText('Chat conversation view')).toHaveAttribute('data-loading', 'false'),
        );
    });

    describe('handleStopGeneration', () => {
        it('does not POST /ai/chat/stop for a turn paused on approval (no live server run to abort)', async () => {
            mockActiveConversationId = 'conversation-1';
            mockThreadState.isRunning = false;

            renderChatAgentRoute();
            await waitFor(() => expect(preferencesRequestPaths.length).toBeGreaterThan(0));

            fireEvent.click(screen.getByText('Stop generation'));

            expect(stopChatGeneration).not.toHaveBeenCalled();
        });

        it('POSTs /ai/chat/stop while the thread is actually running', async () => {
            mockActiveConversationId = 'conversation-1';
            mockThreadState.isRunning = true;

            renderChatAgentRoute();
            await waitFor(() => expect(preferencesRequestPaths.length).toBeGreaterThan(0));

            fireEvent.click(screen.getByText('Stop generation'));

            expect(stopChatGeneration).toHaveBeenCalledTimes(1);
        });
    });
});
