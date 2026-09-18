import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResearchCard } from './research-card';

interface FakeState {
    message: {
        id: string;
        parts: unknown[];
        status?: { type: string };
        metadata: { custom?: unknown };
    };
}

let auiState: FakeState;

vi.mock('@assistant-ui/react', () => ({
    useAuiState: (selector: (s: FakeState) => unknown) => selector(auiState),
}));

const onShowResearch = vi.fn();

vi.mock('../view/chat-view-context', () => ({
    useChatViewContext: () => ({ onShowResearch, activeResearchMessageId: null }),
}));

const planPart = (queries: string[], title?: string) => ({
    type: 'data',
    name: 'research-plan',
    data: { title, queries },
});

interface SourceInput {
    title: string;
    url: string;
    favicon?: string;
    siteName?: string;
}

const roundPart = (round: number, queries: string[], sources: SourceInput[]) => ({
    type: 'data',
    name: 'research-round',
    data: { round, queries, summary: 'summary', sources },
});

interface RenderOptions {
    statusType?: string;
    custom?: unknown;
}

const renderCard = (parts: unknown[], { statusType = 'running', custom }: RenderOptions = {}) => {
    auiState = {
        message: { id: 'message-1', parts, status: { type: statusType }, metadata: { custom } },
    };

    return render(
        <ResearchCard indices={parts.map((_, index) => index)}>
            <span>fallback children</span>
        </ResearchCard>,
    );
};

const faviconMarks = (container: HTMLElement) => container.querySelectorAll('[data-slot="research-favicon"]');

beforeEach(() => {
    onShowResearch.mockClear();
});

describe('ResearchCard', () => {
    it('leaves the plan to the gate while the gate is unanswered', () => {
        const { container } = renderCard([
            planPart(['Compare pricing tiers']),
            { type: 'tool-call', toolName: 'confirm_research_plan', toolCallId: 'call-1' },
        ]);

        expect(container.querySelector('.research-plan-card')).toBeNull();
        expect(screen.queryByText('Compare pricing tiers')).not.toBeInTheDocument();
    });

    it('stands down entirely when the plan was cancelled', () => {
        const { container } = renderCard(
            [
                planPart(['Compare pricing tiers']),
                {
                    type: 'tool-call',
                    toolName: 'confirm_research_plan',
                    toolCallId: 'call-1',
                    result: { approved: false, steps: [] },
                },
            ],
            { statusType: 'complete' },
        );

        expect(container.querySelector('.research-plan-card')).toBeNull();
        expect(container.querySelector('.research-card')).toBeNull();
    });

    it('still describes the run when an earlier plan in the same message was cancelled', () => {
        const { container } = renderCard(
            [
                planPart(['Compare pricing tiers']),
                {
                    type: 'tool-call',
                    toolName: 'confirm_research_plan',
                    toolCallId: 'call-1',
                    result: { approved: false, steps: [] },
                },
                {
                    type: 'tool-call',
                    toolName: 'confirm_research_plan',
                    toolCallId: 'call-2',
                    result: { approved: true, steps: [] },
                },
                roundPart(0, ['Compare pricing tiers'], [{ title: 'Tiers', url: 'https://a.example.com/tiers' }]),
            ],
            { statusType: 'complete' },
        );

        expect(container.querySelector('.research-card')).not.toBeNull();
    });

    // The reader just read the plan and pressed Start; repeating the steps under it says nothing
    // new, and the status part still reads "Waiting for you to start" until the resumed leg lands.
    it('hands over to the compact card as soon as the gate is approved', () => {
        const { container } = renderCard([
            planPart(['Compare pricing tiers']),
            {
                type: 'data',
                name: 'research-status',
                data: { label: 'Waiting for you to start the research', phase: 'awaiting-approval' },
            },
            {
                type: 'tool-call',
                toolName: 'confirm_research_plan',
                toolCallId: 'call-1',
                result: { approved: true, steps: [] },
            },
        ]);

        expect(container.querySelector('.research-plan-card')).toBeNull();
        expect(container.querySelector('.research-card')).not.toBeNull();
        expect(screen.getByText('Starting the research')).toBeInTheDocument();
        expect(screen.queryByText(/Waiting for you/)).not.toBeInTheDocument();
        expect(screen.queryByText(/•/)).not.toBeInTheDocument();
    });

    // The model may propose a follow-up plan after a finished run; that gate must not erase the
    // finished run's card, which is the only way into its trace.
    it('keeps the card of a finished run while a second plan gate waits unanswered', () => {
        const { container } = renderCard(
            [
                planPart(['Compare pricing tiers']),
                {
                    type: 'tool-call',
                    toolName: 'confirm_research_plan',
                    toolCallId: 'gate-1',
                    result: { approved: true, steps: [] },
                },
                roundPart(0, ['Compare pricing tiers'], [{ title: 'Tiers', url: 'https://a.example.com/tiers' }]),
                { type: 'tool-call', toolName: 'confirm_research_plan', toolCallId: 'gate-2' },
            ],
            { statusType: 'complete' },
        );

        expect(container.querySelector('.research-card')).not.toBeNull();
    });

    // The backend announces `planning` before any plan exists. The gate's own shell already says
    // "Preparing the research plan…", so a card above it would say the same thing twice.
    it('draws nothing while an unanswered gate is still preparing the plan', () => {
        const { container } = renderCard([
            { type: 'data', name: 'research-status', data: { label: 'Planning the research', phase: 'planning' } },
            { type: 'tool-call', toolName: 'confirm_research_plan', toolCallId: 'call-1', status: { type: 'running' } },
        ]);

        expect(container.querySelector('.research-card')).toBeNull();
        expect(container.querySelector('.research-plan-card')).toBeNull();
        expect(screen.getByText('fallback children')).toBeInTheDocument();
    });

    it('leads with the plan checklist while no round has been reported', () => {
        renderCard([planPart(['Compare pricing tiers', 'Find migration guides'], 'Pricing research')]);

        expect(screen.getByText('Compare pricing tiers')).toBeInTheDocument();
        expect(screen.getByText('Find migration guides')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Pricing research' })).toBeInTheDocument();
    });

    it('leaves the trace shut when searching starts, the way Claude does', () => {
        renderCard([
            planPart(['Compare pricing tiers'], 'Pricing research'),
            roundPart(0, ['Compare pricing tiers'], [{ title: 'Tiers', url: 'https://a.example.com/tiers' }]),
        ]);

        expect(onShowResearch).not.toHaveBeenCalled();
    });

    it('waits for the run to start before opening itself on a plan alone', () => {
        renderCard([planPart(['Compare pricing tiers'], 'Pricing research')]);

        expect(onShowResearch).not.toHaveBeenCalled();
    });

    it('never opens itself while the plan gate is still unanswered', () => {
        renderCard([
            planPart(['Compare pricing tiers']),
            { type: 'tool-call', toolName: 'confirm_research_plan', toolCallId: 'call-1' },
        ]);

        expect(onShowResearch).not.toHaveBeenCalled();
    });

    it('stays shut even once the run is past the gate and searching', () => {
        renderCard([
            planPart(['Compare pricing tiers']),
            {
                type: 'tool-call',
                toolName: 'confirm_research_plan',
                toolCallId: 'call-1',
                result: { approved: true, steps: [] },
            },
            roundPart(0, ['Compare pricing tiers'], [{ title: 'Tiers', url: 'https://a.example.com/tiers' }]),
        ]);

        expect(onShowResearch).not.toHaveBeenCalled();
    });

    it('never opens itself for a run that is already finished', () => {
        renderCard(
            [
                planPart(['Compare pricing tiers']),
                roundPart(0, ['Compare pricing tiers'], [{ title: 'Tiers', url: 'https://a.example.com/tiers' }]),
            ],
            { statusType: 'complete' },
        );

        expect(onShowResearch).not.toHaveBeenCalled();
    });

    it('opens the trace from the plan card, before any round has been reported', async () => {
        renderCard([planPart(['Compare pricing tiers'], 'Pricing research')]);

        await userEvent.click(screen.getByRole('button', { name: /Open research trace/ }));

        expect(onShowResearch).toHaveBeenCalledTimes(1);
    });

    it('shows the progress line and the elapsed clock while the plan phase is live', () => {
        renderCard([
            planPart(['Compare pricing tiers']),
            { type: 'data', name: 'research-status', data: { label: 'Reading sources' } },
        ]);

        expect(screen.getByText('Reading sources • 0s')).toBeInTheDocument();
    });

    it('collapses the checklist into the compact row once the first round is reported', () => {
        renderCard([
            planPart(['Compare pricing tiers', 'Find migration guides'], 'Pricing research'),
            roundPart(
                0,
                ['Compare pricing tiers'],
                [{ title: 'Tiers', url: 'https://a.example.com/tiers', siteName: 'a.example.com' }],
            ),
        ]);

        expect(screen.queryByText('Find migration guides')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open research trace: Pricing research' })).toBeInTheDocument();
        expect(screen.getByText('1 source and counting… • 0s')).toBeInTheDocument();
    });

    it('caps the favicon strip at three marks and keeps one per site', () => {
        const { container } = renderCard([
            planPart(['Compare pricing tiers']),
            roundPart(
                0,
                ['Compare pricing tiers'],
                [
                    {
                        title: 'One',
                        url: 'https://a.example.com/1',
                        favicon: 'https://a.example.com/i.png',
                        siteName: 'a.example.com',
                    },
                    {
                        title: 'Two',
                        url: 'https://a.example.com/2',
                        favicon: 'https://a.example.com/i.png',
                        siteName: 'a.example.com',
                    },
                    { title: 'Three', url: 'https://b.example.com/1', siteName: 'b.example.com' },
                    { title: 'Four', url: 'https://c.example.com/1', siteName: 'c.example.com' },
                    { title: 'Five', url: 'https://d.example.com/1', siteName: 'd.example.com' },
                ],
            ),
        ]);

        const marks = faviconMarks(container);

        expect(marks).toHaveLength(3);
        expect(marks[0]?.querySelector('img')).toHaveAttribute('src', 'https://a.example.com/i.png');
        expect(marks[1]?.textContent).toBe('B');
    });

    it('opens the trace panel from the compact row', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');

        renderCard([
            planPart(['Compare pricing tiers'], 'Pricing research'),
            roundPart(
                0,
                ['Compare pricing tiers'],
                [{ title: 'Tiers', url: 'https://a.example.com/tiers', siteName: 'a.example.com' }],
            ),
        ]);

        await userEvent.setup().click(screen.getByRole('button', { name: 'Open research trace: Pricing research' }));

        expect(onShowResearch).toHaveBeenCalledWith(
            'message-1',
            expect.objectContaining({ title: 'Pricing research' }),
            expect.any(Boolean),
            'trace',
        );
    });

    it('renders its children unwrapped when the payload does not parse', () => {
        renderCard([{ type: 'data', name: 'research-plan', data: { queries: 'not-an-array' } }]);

        expect(screen.getByText('fallback children')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Open research trace/ })).not.toBeInTheDocument();
    });
});

describe('ResearchCard elapsed reading', () => {
    const traceParts = (status?: Record<string, unknown>) => [
        planPart(['Compare pricing tiers'], 'Pricing research'),
        roundPart(
            0,
            ['Compare pricing tiers'],
            [{ title: 'Tiers', url: 'https://a.example.com/tiers', siteName: 'a.example.com' }],
        ),
        ...(status ? [{ type: 'data', name: 'research-status', data: status }] : []),
    ];

    it('reports the duration the backend measured instead of restarting from this mount', () => {
        renderCard(traceParts({ label: 'Reading sources', elapsedMs: 47_000 }));

        expect(screen.getByText('1 source and counting… • 47s')).toBeInTheDocument();
    });

    it('prefers the persisted receipt over the backend reading for a settled run', () => {
        renderCard(traceParts({ label: 'Done', elapsedMs: 47_000, done: true }), {
            statusType: 'complete',
            custom: { deepResearch: { durationMs: 92_000 } },
        });

        expect(screen.getByText('Research complete • 1 source • 1m 32s')).toBeInTheDocument();
    });

    it('falls back to the backend reading when a settled run has no persisted receipt', () => {
        renderCard(traceParts({ label: 'Done', elapsedMs: 47_000, done: true }), { statusType: 'complete' });

        expect(screen.getByText('Research complete • 1 source • 47s')).toBeInTheDocument();
    });
});

describe('opening the report when it lands', () => {
    const runParts = (withReport: boolean) => [
        planPart(['Compare pricing tiers'], 'Pricing research'),
        roundPart(0, ['Compare pricing tiers'], [{ title: 'Tiers', url: 'https://a.example.com/tiers' }]),
        ...(withReport ? [{ type: 'text', text: '# Pricing report\n\nCopilot lists at $30.' }] : []),
    ];

    it('opens the report on the run it watched finish', () => {
        const { rerender } = renderCard(runParts(false));

        expect(onShowResearch).not.toHaveBeenCalled();

        auiState = {
            message: {
                id: 'message-1',
                parts: runParts(true),
                status: { type: 'complete' },
                metadata: { custom: undefined },
            },
        };

        rerender(
            <ResearchCard indices={[0, 1, 2]}>
                <span>fallback children</span>
            </ResearchCard>,
        );

        expect(onShowResearch).toHaveBeenCalledWith(
            'message-1',
            expect.objectContaining({ title: 'Pricing research' }),
            false,
            'report',
        );
    });

    it('leaves a finished run reopened from history exactly as the reader left it', () => {
        renderCard(runParts(true), { statusType: 'complete' });

        expect(onShowResearch).not.toHaveBeenCalled();
    });

    it('stays shut when the run settles without writing a report', () => {
        const { rerender } = renderCard(runParts(false));

        auiState = {
            message: {
                id: 'message-1',
                parts: runParts(false),
                status: { type: 'complete' },
                metadata: { custom: undefined },
            },
        };

        rerender(
            <ResearchCard indices={[0, 1]}>
                <span>fallback children</span>
            </ResearchCard>,
        );

        expect(onShowResearch).not.toHaveBeenCalled();
    });
});

describe('the report auto-open guards', () => {
    const withReport = (extra: unknown[] = []) => [
        planPart(['Compare pricing tiers'], 'Pricing research'),
        roundPart(0, ['Compare pricing tiers'], [{ title: 'Tiers', url: 'https://a.example.com/tiers' }]),
        ...extra,
        { type: 'text', text: '# Pricing report\n\nCopilot lists at $30.' },
    ];

    const settle = (parts: unknown[], id: string, rerender: (ui: ReactElement) => void) => {
        auiState = { message: { id, parts, status: { type: 'complete' }, metadata: { custom: undefined } } };

        rerender(
            <ResearchCard indices={parts.map((_, index) => index)}>
                <span>fallback children</span>
            </ResearchCard>,
        );
    };

    // Message components are keyed by index, so this instance is reused across a conversation
    // or branch switch and its refs come with it.
    it('does not open another run that lands at the same position', () => {
        const running = [
            planPart(['Compare pricing tiers'], 'Pricing research'),
            roundPart(0, ['Compare pricing tiers'], [{ title: 'Tiers', url: 'https://a.example.com/tiers' }]),
        ];
        const { rerender } = renderCard(running);

        settle(withReport(), 'message-2', rerender);

        expect(onShowResearch).not.toHaveBeenCalled();
    });

    it('never opens a report for a plan that was cancelled', () => {
        const gate = {
            type: 'tool-call',
            toolName: 'confirm_research_plan',
            toolCallId: 'call-1',
            result: { approved: false },
        };
        const running = [planPart(['Compare pricing tiers'], 'Pricing research'), gate];
        const { rerender } = renderCard(running);

        settle(
            [
                planPart(['Compare pricing tiers'], 'Pricing research'),
                gate,
                { type: 'text', text: 'Research cancelled — nothing was searched.' },
            ],
            'message-1',
            rerender,
        );

        expect(onShowResearch).not.toHaveBeenCalled();
    });

    it('never opens a report before the run has searched anything', () => {
        const { rerender } = renderCard([planPart(['Compare pricing tiers'], 'Pricing research')]);

        settle(
            [planPart(['Compare pricing tiers'], 'Pricing research'), { type: 'text', text: '# Report\n\nBody.' }],
            'message-1',
            rerender,
        );

        expect(onShowResearch).not.toHaveBeenCalled();
    });
});

describe('a run that ended badly', () => {
    const RUN_TOOL = { type: 'tool-call', toolName: 'deep_research', toolCallId: 'run-1' };

    const settledRun = (runTool: Record<string, unknown>) => [
        planPart(['Compare pricing tiers'], 'Pricing research'),
        roundPart(0, ['Compare pricing tiers'], [{ title: 'Tiers', url: 'https://a.example.com/tiers' }]),
        runTool,
        { type: 'text', text: 'I could not finish this research.' },
    ];

    it('says the research failed rather than claiming it completed', () => {
        renderCard(settledRun({ ...RUN_TOOL, result: { error: 'upstream timeout' } }), {
            statusType: 'complete',
        });

        expect(screen.getByText(/Research failed/)).toBeInTheDocument();
        expect(screen.queryByText(/Research complete/)).not.toBeInTheDocument();
    });

    // Stop leaves a bare requires-action, so an absent result is the only signal.
    it('says the research stopped when the call never returned', () => {
        renderCard(settledRun({ ...RUN_TOOL, status: { type: 'requires-action' } }), { statusType: 'complete' });

        expect(screen.getByText(/Research stopped/)).toBeInTheDocument();
    });

    // The line is the whole account of a stop; a nested tool step under it would show an empty
    // result chip for a call that never returned.
    // Approve, then Stop before the first phase: on reload there is no status part, so this shape is
    // indistinguishable from a run about to start except by the tool call that never returned.
    it('says a run stopped right after approval stopped, not that it is starting', () => {
        renderCard(
            [
                planPart(['Compare pricing tiers']),
                {
                    type: 'tool-call',
                    toolName: 'confirm_research_plan',
                    toolCallId: 'gate-1',
                    result: { approved: true, steps: [] },
                },
                { ...RUN_TOOL, status: { type: 'requires-action' } },
            ],
            { statusType: 'complete' },
        );

        expect(screen.getByText(/Research stopped/)).toBeInTheDocument();
        expect(screen.queryByText(/Starting the research/)).not.toBeInTheDocument();
    });

    it('renders no children for a stopped run', () => {
        renderCard(settledRun({ ...RUN_TOOL, status: { type: 'requires-action' } }), { statusType: 'complete' });

        expect(screen.queryByText('fallback children')).not.toBeInTheDocument();
    });

    // The backend refuses a second call with `{ error: 'deep_research has already run…' }`, so a
    // model that calls twice must not turn its own successful report into a failure.
    it('keeps a successful run successful when the model called the tool twice', () => {
        renderCard(
            [
                planPart(['Compare pricing tiers'], 'Pricing research'),
                roundPart(0, ['Compare pricing tiers'], [{ title: 'Tiers', url: 'https://a.example.com/tiers' }]),
                { ...RUN_TOOL, result: { report: '# Pricing report' } },
                { ...RUN_TOOL, toolCallId: 'run-2', result: { error: 'deep_research has already run' } },
                { type: 'text', text: '# Pricing report\n\nCopilot lists at $30.' },
            ],
            { statusType: 'complete' },
        );

        expect(screen.getByText(/Research complete/)).toBeInTheDocument();
        expect(screen.queryByText(/Research failed/)).not.toBeInTheDocument();
    });

    it('renders the run tool step so the failure is visible, not summarised away', () => {
        renderCard(settledRun({ ...RUN_TOOL, result: { error: 'upstream timeout' } }), {
            statusType: 'complete',
        });

        expect(screen.getByText('fallback children')).toBeInTheDocument();
    });

    it('never opens a failed run as though its apology were the report', () => {
        const running = [
            planPart(['Compare pricing tiers'], 'Pricing research'),
            roundPart(0, ['Compare pricing tiers'], [{ title: 'Tiers', url: 'https://a.example.com/tiers' }]),
        ];
        const { rerender } = renderCard(running);

        auiState = {
            message: {
                id: 'message-1',
                parts: settledRun({ ...RUN_TOOL, result: { error: 'upstream timeout' } }),
                status: { type: 'complete' },
                metadata: { custom: undefined },
            },
        };

        rerender(
            <ResearchCard indices={[0, 1, 2, 3]}>
                <span>fallback children</span>
            </ResearchCard>,
        );

        expect(onShowResearch).not.toHaveBeenCalled();
    });
});

describe('a turn that only announced the mode', () => {
    const announcement = { type: 'data', name: 'research-status', data: { label: 'Planning the research' } };

    // The reuse-turn bug: the card sat frozen on "Planning the research" describing a run that
    // never happened.
    it('draws no card once the turn has settled without researching', () => {
        renderCard([announcement, { type: 'text', text: 'Zomato trades at 12x forward sales.' }], {
            statusType: 'complete',
        });

        expect(screen.getByText('fallback children')).toBeInTheDocument();
        expect(screen.queryByText(/Planning the research/)).not.toBeInTheDocument();
    });

    // While the model is still deciding, "Planning the research" is true.
    it('draws the card while the turn is still live', () => {
        renderCard([announcement], { statusType: 'running' });

        expect(screen.getByText(/Planning the research/)).toBeInTheDocument();
    });

    // A run that failed before it ever had a plan is the reason the terminal-status clause exists.
    it('keeps a run that failed before it had a plan visible', () => {
        renderCard([{ type: 'data', name: 'research-status', data: { label: 'Research complete', done: true } }], {
            statusType: 'complete',
        });

        expect(screen.queryByText('fallback children')).not.toBeInTheDocument();
    });
});
