import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResearchPlanConfirm } from './research-plan-confirm';

interface FakeState {
    message: { isLast: boolean; parts: unknown[] };
}

let auiState: FakeState;

vi.mock('@assistant-ui/react', () => ({
    useAuiState: (selector: (s: FakeState) => unknown) => selector(auiState),
}));

const toastError = vi.fn();

vi.mock('sonner', () => ({
    toast: { error: (...args: unknown[]) => toastError(...args) },
}));

const addResult = vi.fn();

const ARGS = {
    title: 'Compare vector databases',
    steps: [
        { id: 'step-1', text: 'Pinecone pricing 2026' },
        { id: 'step-2', text: 'Weaviate self-hosting cost' },
    ],
    etaLabel: 'about 4 minutes',
};

const renderGate = (
    overrides: {
        args?: unknown;
        result?: unknown;
        status?: { type?: string };
        isLast?: boolean;
        add?: typeof addResult | undefined;
        parts?: unknown[];
        toolCallId?: string;
    } = {},
) => {
    auiState = { message: { isLast: overrides.isLast ?? true, parts: overrides.parts ?? [] } };

    return render(
        <ResearchPlanConfirm
            toolCallId={overrides.toolCallId ?? 'call-1'}
            args={overrides.args ?? ARGS}
            result={overrides.result}
            status={overrides.status}
            addResult={'add' in overrides ? overrides.add : addResult}
        />,
    );
};

beforeEach(() => {
    addResult.mockReset();
    toastError.mockReset();
});

describe('ResearchPlanConfirm', () => {
    it('lays the plan out as the four-stage card with one tap to start', () => {
        renderGate();

        expect(screen.getByRole('heading', { name: 'Compare vector databases' })).toBeInTheDocument();
        expect(screen.getByText('Research Websites')).toBeInTheDocument();
        expect(screen.getByText('Analyze Results')).toBeInTheDocument();
        expect(screen.getByText('Create Report')).toBeInTheDocument();
        expect(screen.getByText(/Pinecone pricing 2026/)).toBeInTheDocument();
        expect(screen.getByText(/Weaviate self-hosting cost/)).toBeInTheDocument();
        expect(screen.getByText('Ready in a few mins')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start research' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('says the same thing whether or not the backend states a wait', () => {
        renderGate({ args: { title: ARGS.title, steps: ARGS.steps } });

        expect(screen.getByText('Ready in a few mins')).toBeInTheDocument();
    });

    // Every observed run overran the model's own estimate, so its wording is not shown.
    it('never repeats the estimate the model wrote', () => {
        renderGate({ args: { ...ARGS, etaLabel: 'About 4 minutes, up to 3 rounds of searching' } });

        expect(screen.queryByText(/About 4 minutes/)).not.toBeInTheDocument();
        expect(screen.getByText('Ready in a few mins')).toBeInTheDocument();
    });

    it('hides the tail of a long plan behind More', async () => {
        const user = userEvent.setup();
        const steps = Array.from({ length: 6 }, (_, position) => ({
            id: `step-${position}`,
            text: `Step ${position + 1}`,
        }));

        renderGate({ args: { ...ARGS, steps } });

        expect(screen.getByText(/Step 3/)).toBeInTheDocument();
        expect(screen.queryByText(/Step 6/)).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'More' }));

        expect(screen.getByText(/Step 6/)).toBeInTheDocument();
    });

    it('waits for the arguments to finish streaming before offering to start', () => {
        renderGate({ args: { steps: [] }, status: { type: 'running' } });

        expect(screen.getByText('Preparing the research plan…')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start research' })).not.toBeInTheDocument();
    });

    it('answers with the plan unchanged when Start research is pressed', async () => {
        const user = userEvent.setup();

        renderGate();
        await user.click(screen.getByRole('button', { name: 'Start research' }));

        expect(addResult).toHaveBeenCalledWith({
            approved: true,
            steps: [
                { id: 'step-1', text: 'Pinecone pricing 2026' },
                { id: 'step-2', text: 'Weaviate self-hosting cost' },
            ],
        });
    });

    it('declines the plan when Cancel is pressed', async () => {
        const user = userEvent.setup();

        renderGate();
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(addResult).toHaveBeenCalledWith(expect.objectContaining({ approved: false }));
    });

    // The run's own card takes over the moment Start is pressed; a receipt here would sit above it.
    it('steps aside as soon as Start research is pressed', async () => {
        const user = userEvent.setup();

        const { container } = renderGate();
        await user.click(screen.getByRole('button', { name: 'Start research' }));

        expect(container).toBeEmptyDOMElement();
    });

    // A reloaded mid-run message has the answered gate but no status part, since status is never
    // persisted — the gate must not fill that second with a "started" receipt above the live card.
    it('renders nothing for a reloaded approved gate, even before any phase has streamed', () => {
        const { container } = renderGate({
            result: { approved: true, steps: [{ id: 'step-1', text: 'Pinecone pricing 2027' }] },
        });

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('button', { name: 'Start research' })).not.toBeInTheDocument();
    });

    it('says the plan was never run when the gate was declined', () => {
        renderGate({ result: { approved: false, steps: [] } });

        expect(screen.getByText('Research cancelled. This plan was never run.')).toBeInTheDocument();
    });

    it('answers only once when Start research is double-clicked', async () => {
        const user = userEvent.setup();

        renderGate();

        const start = screen.getByRole('button', { name: 'Start research' });

        await user.click(start);
        await user.click(start);

        expect(addResult).toHaveBeenCalledTimes(1);
    });

    it('does not carry the answered latch into a different gate', async () => {
        const user = userEvent.setup();

        const { rerender } = renderGate();

        await user.click(screen.getByRole('button', { name: 'Start research' }));
        expect(screen.queryByRole('button', { name: 'Start research' })).not.toBeInTheDocument();

        rerender(<ResearchPlanConfirm toolCallId="call-2" args={ARGS} addResult={addResult} />);

        await user.click(screen.getByRole('button', { name: 'Start research' }));

        expect(addResult).toHaveBeenCalledTimes(2);
    });

    it('renders the plan inert once the conversation has moved on', () => {
        renderGate({ isLast: false });

        expect(screen.getByText(/Pinecone pricing 2026/)).toBeInTheDocument();
        expect(screen.getByText('No longer active — the conversation has moved on.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start research' })).not.toBeInTheDocument();
    });

    it('renders the plan inert for a viewer who cannot answer it', () => {
        renderGate({ add: undefined });

        expect(screen.getByText(/Pinecone pricing 2026/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start research' })).not.toBeInTheDocument();
    });

    it('steps aside once the run has actually started searching', () => {
        const { container } = renderGate({
            result: { approved: true, steps: ARGS.steps },
            parts: [
                {
                    type: 'data',
                    name: 'research-round',
                    data: { round: 1, queries: [{ queryId: 'q1', text: 'Pinecone pricing 2026' }] },
                },
            ],
        });

        expect(container).toBeEmptyDOMElement();
    });

    it('stays answerable while only the proposed plan has landed', () => {
        renderGate({
            parts: [{ type: 'data', name: 'research-plan', data: { queries: ['Pinecone pricing 2026'] } }],
        });

        expect(screen.getByRole('button', { name: 'Start research' })).toBeInTheDocument();
    });

    it('warns and re-offers the action when answering the gate fails', async () => {
        const user = userEvent.setup();
        const add = vi.fn(() => {
            throw new Error('no live run');
        });

        renderGate({ add });
        await user.click(screen.getByRole('button', { name: 'Start research' }));

        expect(toastError).toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Start research' })).toBeInTheDocument();
    });

    it('renders nothing when the tool arguments do not parse', () => {
        const { container } = renderGate({ args: { steps: 'not an array' } });

        expect(container).toBeEmptyDOMElement();
    });
});
