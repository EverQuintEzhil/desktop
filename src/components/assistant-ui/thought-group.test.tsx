import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThoughtGroup, ThoughtReasoningStep } from './thought-group';

// The elapsed hook reads the assistant-ui message scope, which only exists inside a live thread.
// The panel's own label and open-state logic is what these tests cover, so the reading is pinned.
const elapsed = { isStreaming: false, elapsedMs: undefined as number | undefined };

vi.mock('./use-reasoning-elapsed', () => ({
    useReasoningElapsed: () => elapsed,
}));

const renderThoughtGroup = (props: Partial<React.ComponentProps<typeof ThoughtGroup>> = {}) =>
    render(
        <ThoughtGroup
            startIndex={0}
            endIndex={1}
            hasReasoning
            hasTools
            ownsAllReasoning
            allToolsTimed
            toolLabel="Used Run Python"
            toolDurationMs={4_000}
            active={false}
            done
            defaultOpen
            forceOpen={false}
            settleKey="settled"
            {...props}
        >
            <ThoughtReasoningStep>reasoning body</ThoughtReasoningStep>
        </ThoughtGroup>,
    );

const contentState = (container: HTMLElement) =>
    container.querySelector('[data-slot="tool-group-content"]')?.getAttribute('data-state');

describe('ThoughtGroup', () => {
    beforeEach(() => {
        elapsed.isStreaming = false;
        elapsed.elapsedMs = 12_000;
    });

    it('says "Worked for" when the reported number includes tool time', () => {
        renderThoughtGroup();

        expect(screen.getByText('Worked for 16s')).toBeInTheDocument();
        expect(screen.queryByText(/Thought for/)).not.toBeInTheDocument();
        expect(screen.queryByText('· 4s')).not.toBeInTheDocument();
    });

    it('says "Thought for" when the panel only thought', () => {
        renderThoughtGroup({ hasTools: false, toolDurationMs: undefined });

        expect(screen.getByText('Thought for 12s')).toBeInTheDocument();
        expect(screen.queryByText(/Worked for/)).not.toBeInTheDocument();
    });

    it('reports tool time alone when the backend persisted no reasoning duration', () => {
        elapsed.elapsedMs = undefined;
        renderThoughtGroup({ hasReasoning: false });

        expect(screen.getByText('Used Run Python')).toBeInTheDocument();
        expect(screen.getByText('· 4s')).toBeInTheDocument();
    });

    it('names the work rather than announce thinking time as the whole span when tools are untimed', () => {
        elapsed.elapsedMs = 1_175;
        renderThoughtGroup({ allToolsTimed: false, toolDurationMs: undefined, toolLabel: 'Searched the Web' });

        expect(screen.getByText('Searched the Web')).toBeInTheDocument();
        expect(screen.queryByText(/Thought for|Worked for/)).not.toBeInTheDocument();
    });

    it('does not sell a partial tool sum as the whole span when only some tools are timed', () => {
        elapsed.elapsedMs = 1_175;
        renderThoughtGroup({
            allToolsTimed: false,
            toolDurationMs: 1_000,
            toolLabel: 'Searched the Web and 1 more step',
        });

        expect(screen.getByText('Searched the Web and 1 more step')).toBeInTheDocument();
        expect(screen.queryByText(/Thought for|Worked for/)).not.toBeInTheDocument();
        // The suffix carries the same partial sum, so withholding it from the header alone
        // would just move the wrong number one slot to the right.
        expect(screen.queryByText('· 1s')).not.toBeInTheDocument();
    });

    it('names what the panel did instead of printing a sub-second total', () => {
        elapsed.elapsedMs = 400;
        renderThoughtGroup({ toolDurationMs: undefined, toolLabel: 'Searched the Web' });

        expect(screen.getByText('Searched the Web')).toBeInTheDocument();
        expect(screen.queryByText(/Thought for/)).not.toBeInTheDocument();
    });

    it('keeps the tool label and its duration for a run with no reasoning', () => {
        renderThoughtGroup({ hasReasoning: false });

        expect(screen.getByText('Used Run Python')).toBeInTheDocument();
        expect(screen.getByText('· 4s')).toBeInTheDocument();
        expect(screen.queryByText(/Thought for/)).not.toBeInTheDocument();
    });

    it('shows the running tool label while the run is still active', () => {
        renderThoughtGroup({ active: true, done: false, toolLabel: 'Using Run Python' });

        expect(screen.getByText('Using Run Python')).toBeInTheDocument();
    });

    it('never names a tool on an active panel that holds only reasoning', () => {
        renderThoughtGroup({ active: true, done: false, hasTools: false, toolLabel: 'Using tools' });

        expect(screen.getByText('Thinking…')).toBeInTheDocument();
        expect(screen.queryByText('Using tools')).not.toBeInTheDocument();
    });

    it('never names a tool on a settled reasoning-only panel with no measured duration', () => {
        elapsed.elapsedMs = undefined;
        renderThoughtGroup({ hasTools: false, toolDurationMs: undefined, toolLabel: 'Using tools' });

        expect(screen.getByText('Reasoning')).toBeInTheDocument();
        expect(screen.queryByText('Using tools')).not.toBeInTheDocument();
    });

    it('labels the panel "Thinking…" and opens it while reasoning streams', () => {
        elapsed.isStreaming = true;
        const { container } = renderThoughtGroup({ active: true, done: false, defaultOpen: false });

        expect(screen.getByText('Thinking…')).toBeInTheDocument();
        expect(contentState(container)).toBe('open');
    });

    it('keeps a running panel open once reasoning has arrived, even after a tool takes over', () => {
        const { container } = renderThoughtGroup({
            active: true,
            done: false,
            defaultOpen: false,
            toolLabel: 'Using Run Python',
        });

        expect(screen.getByText('Using Run Python')).toBeInTheDocument();
        expect(contentState(container)).toBe('open');
    });

    it('leaves a running tool-only panel closed', () => {
        const { container } = renderThoughtGroup({
            hasReasoning: false,
            active: true,
            done: false,
            defaultOpen: false,
            toolLabel: 'Using Run Python',
        });

        expect(contentState(container)).toBe('closed');
    });

    it('keeps the measured duration when the collapsible remounts on settle', () => {
        const { rerender, container } = renderThoughtGroup({ settleKey: 'running' });

        rerender(
            <ThoughtGroup
                startIndex={0}
                endIndex={1}
                hasReasoning
                hasTools
                ownsAllReasoning
                allToolsTimed
                toolLabel="Used Run Python"
                toolDurationMs={4_000}
                active={false}
                done
                defaultOpen={false}
                forceOpen={false}
                settleKey="settled"
            >
                <ThoughtReasoningStep>reasoning body</ThoughtReasoningStep>
            </ThoughtGroup>,
        );

        expect(screen.getByText('Worked for 16s')).toBeInTheDocument();
        expect(contentState(container)).toBe('closed');
    });

    it('renders the steps on one rail with a Done marker and no brain icon', () => {
        const { container } = renderThoughtGroup();

        expect(screen.getByText('reasoning body')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(container.querySelector('.lucide-brain')).toBeNull();
        expect(container.querySelectorAll('[data-slot="tool-group-root"]')).toHaveLength(1);
    });
});
