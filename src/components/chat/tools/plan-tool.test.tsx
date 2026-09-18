import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PlanTool from './plan-tool';

type FakeState = {
    message: {
        parts: unknown[];
        status?: { type: string };
    };
};

let auiState: FakeState;

vi.mock('@assistant-ui/react', () => ({
    useAuiState: (selector: (s: FakeState) => unknown) => selector(auiState),
}));

const Plan = PlanTool as unknown as (props: { args: unknown; toolCallId: string }) => ReactElement;

interface PlanItemInput {
    content?: string;
    status?: string;
}

const planPart = (items: PlanItemInput[], toolCallId = 'call-1') => ({
    type: 'tool-call',
    toolName: 'update_plan',
    toolCallId,
    args: { items },
});

const renderPlan = (
    items: PlanItemInput[],
    statusType?: string,
    { parts, toolCallId = 'call-1' }: { parts?: unknown[]; toolCallId?: string } = {},
) => {
    auiState = {
        message: {
            parts: parts ?? [planPart(items)],
            status: statusType ? { type: statusType } : undefined,
        },
    };

    return render(<Plan args={{ items }} toolCallId={toolCallId} />);
};

const classesOf = (text: string) => screen.getByText(text).className;

beforeEach(() => {
    auiState = { message: { parts: [] } };
});

describe('PlanTool', () => {
    it('shows a placeholder until the first item streams in', () => {
        renderPlan([]);

        expect(screen.getByText('Planning…')).toBeInTheDocument();
    });

    it('strikes through a completed step', () => {
        renderPlan([{ content: 'Create the agent', status: 'completed' }]);

        expect(classesOf('Create the agent')).toContain('line-through');
    });

    it('mutes a cancelled step without striking it through or colouring it as an error', () => {
        renderPlan([{ content: 'Wire the datastore', status: 'cancelled' }]);

        const classes = classesOf('Wire the datastore');

        expect(classes).not.toContain('line-through');
        expect(classes).toContain('text-muted-foreground');
        expect(classes).not.toContain('text-destructive');
    });

    it('marks a step still pending when the run died as skipped rather than upcoming', () => {
        renderPlan(
            [
                { content: 'Did happen', status: 'completed' },
                { content: 'Never happened', status: 'pending' },
            ],
            'incomplete',
        );

        const classes = classesOf('Never happened');

        expect(classes).toContain('text-muted-foreground');
        expect(classes).not.toContain('line-through');
        expect(classes).not.toContain('text-destructive');
        expect(screen.getByText('1/2')).toBeInTheDocument();
    });

    it('keeps pending steps upcoming on a cleanly completed message — the plan continues in the next one', () => {
        renderPlan(
            [
                { content: 'Did happen', status: 'completed' },
                { content: 'Coming up', status: 'pending' },
            ],
            'complete',
        );

        const classes = classesOf('Coming up');

        expect(classes).toContain('text-muted-foreground');
        expect(classes).not.toContain('text-muted-foreground/70');
        expect(classes).not.toContain('line-through');
    });

    it('leaves pending steps upcoming while the run is still going', () => {
        renderPlan(
            [
                { content: 'Under way', status: 'in_progress' },
                { content: 'Up next', status: 'pending' },
            ],
            'running',
        );

        expect(classesOf('Up next')).toContain('text-muted-foreground');
        expect(classesOf('Under way')).toContain('font-medium');
    });

    it('does not skip pending steps when the run status has not arrived yet', () => {
        renderPlan([{ content: 'Still queued', status: 'pending' }]);

        expect(classesOf('Still queued')).not.toContain('line-through');
    });

    it('colours a failed step as an error and does NOT strike it through', () => {
        renderPlan([{ content: 'Publish the skill', status: 'failed' }]);

        const classes = classesOf('Publish the skill');

        expect(classes).toContain('text-destructive');
        expect(classes).not.toContain('line-through');
    });

    it('leaves pending and in-progress steps unstruck', () => {
        renderPlan(
            [
                { content: 'Not started', status: 'pending' },
                { content: 'Under way', status: 'in_progress' },
            ],
            'running',
        );

        expect(classesOf('Not started')).not.toContain('line-through');
        expect(classesOf('Under way')).not.toContain('line-through');
        expect(classesOf('Under way')).toContain('font-medium');
    });

    it('falls back to pending for an unrecognised status', () => {
        renderPlan([{ content: 'Mystery step', status: 'not-a-status' }]);

        const classes = classesOf('Mystery step');

        expect(classes).toContain('text-muted-foreground');
        expect(classes).not.toContain('line-through');
        expect(classes).not.toContain('text-destructive');
    });

    it('treats a step left in progress as completed when the run finished cleanly', () => {
        renderPlan([{ content: 'Left hanging', status: 'in_progress' }], 'complete');

        expect(classesOf('Left hanging')).toContain('line-through');
    });

    it('treats a step left in progress as failed when the run did not finish', () => {
        renderPlan([{ content: 'Died midway', status: 'in_progress' }], 'incomplete');

        const classes = classesOf('Died midway');

        expect(classes).toContain('text-destructive');
        expect(classes).not.toContain('line-through');
    });

    it('keeps a step in progress while the run is paused for an action', () => {
        renderPlan([{ content: 'Awaiting approval', status: 'in_progress' }], 'requires-action');

        const classes = classesOf('Awaiting approval');

        expect(classes).toContain('font-medium');
        expect(classes).not.toContain('line-through');
        expect(classes).not.toContain('text-destructive');
    });

    it('counts only completed steps in the header', () => {
        renderPlan([
            { content: 'One', status: 'completed' },
            { content: 'Two', status: 'completed' },
            { content: 'Three', status: 'failed' },
            { content: 'Four', status: 'pending' },
        ]);

        expect(screen.getByText('2/4')).toBeInTheDocument();
    });

    it('renders the plan once, on the first plan tool call in the message', () => {
        const items = [{ content: 'Only once', status: 'pending' }];

        renderPlan(items, undefined, {
            parts: [planPart(items, 'call-1'), planPart(items, 'call-2')],
            toolCallId: 'call-2',
        });

        expect(screen.queryByText('Only once')).not.toBeInTheDocument();
    });

    it('renders the longest plan when the message holds several update_plan calls', () => {
        const short = [{ content: 'First draft', status: 'completed' }];
        const long = [
            { content: 'First draft', status: 'completed' },
            { content: 'Second step', status: 'in_progress' },
        ];

        renderPlan(short, 'running', {
            parts: [planPart(short, 'call-1'), planPart(long, 'call-2')],
        });

        expect(screen.getByText('Second step')).toBeInTheDocument();
    });
});
