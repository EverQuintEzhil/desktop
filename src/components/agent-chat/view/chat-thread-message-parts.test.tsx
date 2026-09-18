import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AssistantActions, ChatAgentToolStep } from './chat-thread-message-parts';

interface FakeState {
    message: {
        parts: unknown[];
        isLast: boolean;
        id: string;
        status?: { type: string; reason?: string };
        metadata: { custom?: unknown };
    };
}

const auiState: FakeState = { message: { parts: [], isLast: true, id: 'm1', metadata: {} } };

vi.mock('@assistant-ui/react', () => ({
    useAui: () => ({}),
    useAuiState: (selector: (s: FakeState) => unknown) => selector(auiState),
    ActionBarPrimitive: { Root: ({ children }: { children: ReactNode }) => <div>{children}</div> },
}));

let isReadOnly = false;

vi.mock('./chat-view-context', () => ({
    ChatViewContext: { Provider: ({ children }: { children: ReactNode }) => children },
    useChatViewContext: () => ({
        agent: { _id: 'a1', mcpServers: [], apps: [], tools: [], skills: [], uiConfig: {} },
        isReadOnly,
    }),
}));

vi.mock('@/components/assistant-ui/markdown-text', () => ({ MarkdownText: () => null }));
vi.mock('@/components/assistant-ui/tool-fallback', () => ({ ToolFallback: () => <span>tool fallback</span> }));
vi.mock('@/components/assistant-ui/tool-group', () => ({
    ToolRailItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/chat-host', () => ({ useChatHost: () => ({ slots: undefined }) }));
vi.mock('@/components/chat/message/assistant-actions', () => ({
    AssistantActions: ({ deepResearch }: { deepResearch?: boolean }) => (
        <span data-testid="deep-research-tag">{String(deepResearch)}</span>
    ),
}));
vi.mock('@/components/chat/message/user-actions', () => ({ UserActions: () => null }));
vi.mock('@/components/chat/primitives/directive-text', () => ({ default: () => null }));
vi.mock('../context/agent-composer-context', () => ({
    useAgentComposerContext: () => ({ composer: { availableModels: [] } }),
}));
vi.mock('../genui/genui-app', () => ({ GenUIApp: () => null }));
vi.mock('../hooks/use-fork-conversation', () => ({ useForkConversation: () => ({ fork: vi.fn(), isPending: false }) }));
vi.mock('../hooks/use-mention-suggestions', () => ({ useMentionSuggestions: () => [] }));
vi.mock('../mcp-ui/mcp-ui-resource', () => ({ McpUiResource: () => null, isMcpUiDataPart: () => false }));
vi.mock('../reconnect-required', () => ({
    getReconnectGateServerId: () => null,
    isReconnectRequiredToolResult: () => false,
    ReconnectGateTool: () => null,
    ReconnectResultTool: () => null,
}));
const collectResearchContentSpy = vi.fn();

vi.mock('../research/research-contract', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../research/research-contract')>();

    return {
        ...actual,
        collectResearchContent: (parts: Parameters<typeof actual.collectResearchContent>[0]) => {
            collectResearchContentSpy(parts);

            return actual.collectResearchContent(parts);
        },
    };
});
vi.mock('./tool-approval', () => ({
    default: () => <span>generic approval</span>,
    buildMcpFaviconUrl: () => undefined,
    formatToolName: (name: string) => name,
    getMcpServerId: () => null,
}));

const PLAN_CONFIRM_PART = {
    type: 'tool-call',
    toolCallId: 'call-1',
    toolName: 'confirm_research_plan',
    args: { title: 'Compare vector databases', steps: [{ id: 'step-1', text: 'Pinecone pricing 2026' }] },
    argsText: '',
    addResult: vi.fn(),
    status: { type: 'requires-action' },
} as unknown as ToolCallMessagePartProps;

describe('ChatAgentToolStep plan-confirm routing', () => {
    it('renders the plan gate for the confirm tool', () => {
        isReadOnly = false;
        render(<ChatAgentToolStep {...PLAN_CONFIRM_PART} />);

        expect(screen.getByText(/Pinecone pricing 2026/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start research' })).toBeInTheDocument();
    });

    it('never hands a read-only viewer the live gate buttons', () => {
        isReadOnly = true;
        render(<ChatAgentToolStep {...PLAN_CONFIRM_PART} />);

        expect(screen.queryByRole('button', { name: 'Start research' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
});

const RUN_RESEARCH_PART = {
    type: 'tool-call',
    toolCallId: 'call-2',
    toolName: 'deep_research',
    args: {},
    argsText: '',
    status: { type: 'running' },
} as unknown as ToolCallMessagePartProps;

describe('ChatAgentToolStep run-tool routing', () => {
    it('hides the run tool step once the card is narrating the run', () => {
        isReadOnly = false;
        auiState.message.parts = [{ type: 'data', name: 'research-plan', data: { queries: ['Pinecone pricing'] } }];

        const { container } = render(<ChatAgentToolStep {...RUN_RESEARCH_PART} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('keeps the step as the only receipt when no phase ever streamed', () => {
        isReadOnly = false;
        auiState.message.parts = [];

        render(<ChatAgentToolStep {...RUN_RESEARCH_PART} />);

        expect(screen.getByText('tool fallback')).toBeInTheDocument();
    });

    // The card's settled line is always "Research complete", so a hidden failure would read as
    // a finished run.
    it('keeps the step for a run that errored', () => {
        isReadOnly = false;
        const failed = { ...RUN_RESEARCH_PART, result: { error: 'the run failed' } } as ToolCallMessagePartProps;

        auiState.message.parts = [
            { type: 'data', name: 'research-plan', data: { queries: ['Pinecone'] } },
            { type: 'tool-call', toolName: 'deep_research', toolCallId: 'call-2', result: { error: 'the run failed' } },
        ];

        render(<ChatAgentToolStep {...failed} />);

        expect(screen.getByText('tool fallback')).toBeInTheDocument();
    });

    // A model that calls the tool twice is refused on the second; judging that part alone would
    // print a bare failed step under a report that is fine.
    it('hides a refused duplicate call when the run itself succeeded', () => {
        isReadOnly = false;
        auiState.message.parts = [
            { type: 'data', name: 'research-plan', data: { queries: ['Pinecone'] } },
            { type: 'tool-call', toolName: 'deep_research', toolCallId: 'run-1', result: { report: '# Report' } },
            {
                type: 'tool-call',
                toolName: 'deep_research',
                toolCallId: 'run-2',
                result: { error: 'deep_research has already run' },
            },
        ];

        const refused = {
            ...RUN_RESEARCH_PART,
            toolCallId: 'run-2',
            result: { error: 'deep_research has already run' },
        } as unknown as ToolCallMessagePartProps;

        const { container } = render(<ChatAgentToolStep {...refused} />);

        expect(container).toBeEmptyDOMElement();
    });

    // Stop leaves a BARE requires-action — no approval, no interrupt — so the absent result is the
    // only signal, and the card's own "Research stopped" line is already the whole account.
    it('hides the step for a run stopped mid-flight, since the card already says so', () => {
        isReadOnly = false;
        auiState.message.parts = [
            { type: 'data', name: 'research-plan', data: { queries: ['Pinecone'] } },
            { type: 'tool-call', toolName: 'deep_research', toolCallId: 'call-2', status: { type: 'requires-action' } },
        ];

        const stopped = {
            ...RUN_RESEARCH_PART,
            status: { type: 'requires-action', reason: 'tool-calls' },
        } as unknown as ToolCallMessagePartProps;

        const { container } = render(<ChatAgentToolStep {...stopped} />);

        expect(container).toBeEmptyDOMElement();
    });

    // A routine has no gate. Stopped during the planning announcement there is no card to say so,
    // and hiding the step too would leave the message empty.
    it('keeps the step for a run stopped before any card could be drawn', () => {
        isReadOnly = false;
        auiState.message.parts = [
            { type: 'data', name: 'research-status', data: { label: 'Planning the research', phase: 'planning' } },
            { type: 'tool-call', toolName: 'deep_research', toolCallId: 'call-2', status: { type: 'requires-action' } },
        ];

        const stopped = {
            ...RUN_RESEARCH_PART,
            status: { type: 'requires-action', reason: 'tool-calls' },
        } as unknown as ToolCallMessagePartProps;

        render(<ChatAgentToolStep {...stopped} />);

        expect(screen.getByText('tool fallback')).toBeInTheDocument();
    });

    // A genuine HITL pause is a different signal from Stop: only this one keeps the step.
    it('keeps the step for a run interrupted mid-flight', () => {
        isReadOnly = false;
        auiState.message.parts = [{ type: 'data', name: 'research-plan', data: { queries: ['Pinecone'] } }];

        const interrupted = {
            ...RUN_RESEARCH_PART,
            status: { type: 'requires-action', reason: 'interrupt' },
            interrupt: { type: 'human', payload: undefined },
        } as unknown as ToolCallMessagePartProps;

        render(<ChatAgentToolStep {...interrupted} />);

        expect(screen.getByText('generic approval')).toBeInTheDocument();
    });
});

const ACTIONS_PROPS = {
    isLiked: false,
    isDisliked: false,
    isFeedbackPending: false,
    isBranchPending: false,
    canBranch: false,
    onFeedback: vi.fn(),
    onBranch: vi.fn(),
};

const renderActions = (parts: unknown[], custom?: unknown) => {
    auiState.message = { parts, isLast: true, id: 'm1', metadata: { custom } };
    collectResearchContentSpy.mockClear();

    return render(<AssistantActions {...ACTIONS_PROPS} />);
};

const TEXT_PARTS = Array.from({ length: 40 }, (_, position) => ({ type: 'text', text: `chunk ${position}` }));
const RESEARCH_PART = { type: 'data', name: 'research-plan', data: { queries: ['Compare pricing models'] } };

describe('AssistantActions research-card lookup', () => {
    it('never parses a message that carries no research part', () => {
        renderActions(TEXT_PARTS, { deepResearch: true });

        expect(collectResearchContentSpy).not.toHaveBeenCalled();
        expect(screen.getByTestId('deep-research-tag')).toHaveTextContent('true');
    });

    it('still suppresses the tag when the message renders a research card', () => {
        renderActions([...TEXT_PARTS, RESEARCH_PART], { deepResearch: true });

        expect(screen.getByTestId('deep-research-tag')).toHaveTextContent('false');
    });

    it('leaves the tag off a message that is not deep research at all', () => {
        renderActions(TEXT_PARTS);

        expect(screen.getByTestId('deep-research-tag')).toHaveTextContent('false');
    });
});
