import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResearchReportChip from './research-report-chip';

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

const planPart = (queries: string[]) => ({
    type: 'data',
    name: 'research-plan',
    data: { queries },
});

const roundPart = (round: number, queries: string[]) => ({
    type: 'data',
    name: 'research-round',
    data: { round, queries, summary: 'summary', sources: [{ title: 'Tiers', url: 'https://a.example.com/tiers' }] },
});

const renderChip = (parts: unknown[], statusType = 'complete') => {
    auiState = { message: { id: 'message-1', parts, status: { type: statusType }, metadata: {} } };

    return render(<ResearchReportChip />);
};

beforeEach(() => {
    onShowResearch.mockClear();
});

describe('ResearchReportChip', () => {
    it('opens the pane at the report', async () => {
        const user = userEvent.setup();

        renderChip([
            planPart(['Compare pricing tiers']),
            roundPart(0, ['Compare pricing tiers']),
            { type: 'text', text: '# What 500 seats cost\n\nSeat prices cluster tightly.' },
        ]);

        await user.click(screen.getByRole('button', { name: /Document/i }));

        expect(onShowResearch).toHaveBeenCalledWith(
            'message-1',
            expect.objectContaining({ reportMarkdown: '# What 500 seats cost\n\nSeat prices cluster tightly.' }),
            false,
            'report',
        );
    });

    it('stays away while the run is still going', () => {
        renderChip([planPart(['Compare pricing tiers']), roundPart(0, ['Compare pricing tiers'])], 'running');

        expect(screen.queryByRole('button', { name: /Document/i })).not.toBeInTheDocument();
    });

    it('stays away when the plan was cancelled', () => {
        renderChip([
            planPart(['Compare pricing tiers']),
            {
                type: 'tool-call',
                toolName: 'confirm_research_plan',
                toolCallId: 'call-1',
                result: { approved: false, steps: [] },
            },
            { type: 'text', text: 'Research cancelled — nothing was searched.' },
        ]);

        expect(screen.queryByRole('button', { name: /Document/i })).not.toBeInTheDocument();
    });

    it('stays away when the message carries no research', () => {
        renderChip([{ type: 'text', text: 'Just an answer.' }]);

        expect(screen.queryByRole('button', { name: /Document/i })).not.toBeInTheDocument();
    });
});

// The backend announces the mode before the model decides whether to research, so a turn that
// answers from research already done carries a status label and nothing else.
describe('a turn that only announced the mode', () => {
    const announcement = { type: 'data', name: 'research-status', data: { label: 'Planning the research' } };

    it('does not offer the plain answer as a research document', () => {
        renderChip([announcement, { type: 'text', text: 'Zomato trades at 12x forward sales.' }]);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('still offers the document once the run reported a terminal status', () => {
        renderChip([
            { type: 'data', name: 'research-status', data: { label: 'Research complete', done: true } },
            { type: 'text', text: '# Report\n\nZomato trades at 12x forward sales.' },
        ]);

        expect(screen.getByRole('button')).toBeInTheDocument();
    });
});
