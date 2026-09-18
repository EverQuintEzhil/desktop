import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserMessage } from './chat-thread-messages';

interface FakeState {
    message: {
        content: { type: string; text?: string }[];
        composer: { isEditing: boolean };
        metadata: { custom?: unknown };
    };
}

let auiState: FakeState;

vi.mock('@assistant-ui/react', () => ({
    useAuiState: (selector: (s: FakeState) => unknown) => selector(auiState),
    ComposerPrimitive: { Root: () => null, Input: () => null, Cancel: () => null, Send: () => null },
    MessagePrimitive: { Root: () => null, Parts: () => null, Attachments: () => null },
    groupPartByType: () => undefined,
}));

vi.mock('@/components/chat/message/chat-user-message', () => ({
    ChatUserMessage: ({ beforeBubble }: { beforeBubble?: ReactNode }) => <div>{beforeBubble}</div>,
}));

vi.mock('@/components/chat/message/chat-assistant-message', () => ({ ChatAssistantMessage: () => null }));
vi.mock('@/components/assistant-ui/reasoning', () => ({ Reasoning: () => null }));
vi.mock('@/components/tenant-assistant-avatar', () => ({ default: () => null }));
vi.mock('@/components/agent-chat/prompt-library/components/add-prompt/add-prompt', () => ({ default: () => null }));
vi.mock('./message-branch-picker', () => ({ MessageBranchPicker: () => null }));
vi.mock('./chat-thread-message-parts', () => ({
    AgentMarkdownText: () => null,
    AssistantActions: () => null,
    ChatAgentToolStep: () => null,
    ChatDirectiveText: () => null,
    ChatMessageSources: () => null,
    ChatMessageSuggestions: () => null,
    FluentMindDataPart: () => null,
    UserActionBar: () => null,
}));

vi.mock('./chat-view-context', () => ({
    ChatViewContext: { Provider: ({ children }: { children: ReactNode }) => children },
    useChatViewContext: () => ({ agent: { _id: 'a1', uiConfig: {} }, onPromptAdded: undefined }),
}));

vi.mock('@/components/chat-host', () => ({
    useChatHost: () => ({ slots: undefined }),
    useChatClassNames: () => ({}),
}));

const renderUserMessage = (custom?: unknown) => {
    auiState = {
        message: {
            content: [{ type: 'text', text: 'compare vector databases' }],
            composer: { isEditing: false },
            metadata: { custom },
        },
    };

    return render(<UserMessage />);
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('UserMessage deep-research chip', () => {
    it('labels a persisted deep-research question', () => {
        renderUserMessage({ deepResearch: { durationMs: 92_000 } });

        expect(screen.getByText('Deep Research')).toBeInTheDocument();
    });

    it('labels a question the backend flagged with the bare boolean', () => {
        renderUserMessage({ deepResearch: true });

        expect(screen.getByText('Deep Research')).toBeInTheDocument();
    });

    it('leaves an ordinary question unlabelled', () => {
        const { container } = renderUserMessage();

        expect(container.firstChild).toBeInTheDocument();
        expect(screen.queryByText('Deep Research')).not.toBeInTheDocument();
    });
});
