import { describe, expect, it } from 'vitest';

import { buildPersistedResearchParts, collectResearchContent, isResearchPart } from './research-contract';
import { buildPlanSteps, buildResearchPhases } from './research-view-model';

const PLAN_ENTRIES = ['Compare pricing models', 'Check support tiers', 'Read migration guides'];

const planPart = (queries: readonly string[]) => ({
    type: 'data',
    name: 'research-plan',
    data: { queries: [...queries] },
});

const roundPart = (round: number, queries: string[]) => ({
    type: 'data',
    name: 'research-round',
    data: {
        round,
        queries,
        summary: `Summary of round ${round}`,
        sources: [{ title: `Source ${round}`, url: `https://example-${round}.com/article` }],
    },
});

interface QueryInput {
    queryId?: string;
    text: string;
    stepId?: string;
    status?: 'pending' | 'complete' | 'error';
}

interface CorrelatedRoundInput {
    round: number;
    queries: QueryInput[];
    sources?: { title: string; url: string }[];
}

const correlatedPlanPart = (steps: readonly { id: string; text: string }[]) => ({
    type: 'data',
    name: 'research-plan',
    data: { steps: [...steps] },
});

const correlatedRoundPart = ({ round, queries, sources = [] }: CorrelatedRoundInput) => ({
    type: 'data',
    name: 'research-round',
    data: { round, queries, sources },
});

const statusPart = (data: Record<string, unknown>) => ({ type: 'data', name: 'research-status', data });

const contentOf = (parts: unknown[]) => collectResearchContent(parts as never[]);

const phaseRowsOf = (parts: unknown[], isRunning: boolean) =>
    buildResearchPhases(contentOf(parts), isRunning).map((phase) => `${phase.id}:${phase.state}:${phase.label}`);

const PLAN_STEPS = PLAN_ENTRIES.map((text, position) => ({ id: `step-${position}`, text }));

const statesOf = (parts: unknown[], isRunning: boolean) =>
    buildPlanSteps(collectResearchContent(parts as never[]), isRunning).map((step) => step.state);

describe('buildPlanSteps', () => {
    it('ticks off entries by round progress when the queries do not read like the plan', () => {
        const parts = [
            planPart(PLAN_ENTRIES),
            roundPart(1, ['acme pricing 2026 site:acme.com']),
            roundPart(2, ['acme support sla tiers']),
        ];

        expect(statesOf(parts, true)).toEqual(['done', 'done', 'active']);
    });

    it('leaves no entry active once a run with rounds has settled', () => {
        const parts = [planPart(PLAN_ENTRIES), roundPart(1, ['acme pricing 2026'])];

        expect(statesOf(parts, false)).toEqual(['done', 'pending', 'pending']);
        expect(statesOf(parts, false)).not.toContain('active');
    });

    it('marks every entry done once as many rounds as entries have reported', () => {
        const parts = [
            planPart(PLAN_ENTRIES),
            roundPart(1, ['acme pricing 2026']),
            roundPart(2, ['acme support sla']),
            roundPart(3, ['acme migration guide']),
        ];

        expect(statesOf(parts, false)).toEqual(['done', 'done', 'done']);
    });

    it('counts a re-emitted round only once', () => {
        const parts = [planPart(PLAN_ENTRIES), roundPart(1, ['acme pricing 2026']), roundPart(1, ['acme pricing v2'])];

        expect(statesOf(parts, true)).toEqual(['done', 'active', 'pending']);
    });

    it('keeps the exact-text match as the reliable signal', () => {
        const parts = [planPart(PLAN_ENTRIES), roundPart(1, ['  read migration GUIDES  '])];

        expect(statesOf(parts, true)).toEqual(['done', 'active', 'done']);
    });

    it('marks nothing done before any round has reported', () => {
        expect(statesOf([planPart(PLAN_ENTRIES)], true)).toEqual(['active', 'pending', 'pending']);
    });
});

describe('buildPlanSteps correlation', () => {
    it('ticks off exactly the plan entries a round claimed by stepId', () => {
        const parts = [
            correlatedPlanPart(PLAN_STEPS),
            correlatedRoundPart({ round: 1, queries: [{ queryId: 'q1', text: 'acme support sla', stepId: 'step-1' }] }),
        ];

        expect(statesOf(parts, true)).toEqual(['active', 'done', 'pending']);
    });

    it('never falls back to round pacing once a stepId has correlated anything', () => {
        const parts = [
            correlatedPlanPart(PLAN_STEPS),
            correlatedRoundPart({ round: 1, queries: [{ queryId: 'q1', text: 'a', stepId: 'step-2' }] }),
            correlatedRoundPart({ round: 2, queries: [{ queryId: 'q2', text: 'b', stepId: 'step-2' }] }),
        ];

        expect(statesOf(parts, false)).toEqual(['pending', 'pending', 'done']);
    });

    it('keeps the uncorrelated pacing inference for a backend that sends no stepId', () => {
        const parts = [
            correlatedPlanPart(PLAN_STEPS),
            correlatedRoundPart({ round: 1, queries: [{ queryId: 'q1', text: 'acme pricing 2026' }] }),
            correlatedRoundPart({ round: 2, queries: [{ queryId: 'q2', text: 'acme support sla' }] }),
        ];

        expect(statesOf(parts, true)).toEqual(['done', 'done', 'active']);
    });
});

describe('buildResearchPhases', () => {
    it('leads with the plan row and marks a pending query as the live round', () => {
        const parts = [
            correlatedPlanPart(PLAN_STEPS),
            correlatedRoundPart({
                round: 1,
                queries: [{ queryId: 'q1', text: 'acme pricing 2026' }],
                sources: [{ title: 'Pricing', url: 'https://a.example.com/pricing' }],
            }),
            correlatedRoundPart({ round: 2, queries: [{ queryId: 'q2', text: 'acme sla', status: 'pending' }] }),
        ];

        expect(phaseRowsOf(parts, true)).toEqual([
            'plan:done:Research plan created',
            'round-1:done:Gathered 1 source',
            'round-2:active:Searching…',
        ]);
    });

    it('reads the reported phase rather than inferring one from isRunning', () => {
        const parts = [
            correlatedPlanPart(PLAN_STEPS),
            correlatedRoundPart({
                round: 1,
                queries: [{ queryId: 'q1', text: 'acme pricing 2026' }],
                sources: [{ title: 'Pricing', url: 'https://a.example.com/pricing' }],
            }),
            statusPart({ label: 'Writing the report', phase: 'writing' }),
        ];

        expect(phaseRowsOf(parts, true)).toEqual([
            'plan:done:Research plan created',
            'round-1:done:Gathered 1 source',
            'report:active:Writing the report…',
        ]);
    });

    it('recovers the narrative line from a round summary that is a raw findings dump', () => {
        // The shape the merged backend actually sends: a search heading, a Source: line, a bare
        // URL, a markdown table, then the prose worth showing.
        const raw = [
            '### Search: Claude for Enterprise pricing per seat 2026',
            'Source: Claude Enterprise Pricing 2026',
            'https://www.gosearch.ai/blog/claude-enterprise-pricing/',
            '| Plan | Price |',
            '|-|-|',
            '| Claude Team | $25/user/month |',
            '**Claude Team:** $25 per user per month billed annually.',
        ].join('\n');

        const parts = [
            correlatedPlanPart(PLAN_STEPS),
            {
                type: 'data',
                name: 'research-round',
                data: {
                    round: 1,
                    summary: raw,
                    queries: [{ queryId: 'q1', text: 'claude enterprise pricing' }],
                    sources: [{ queryId: 'q1', title: 'Pricing', url: 'https://a.example.com/pricing' }],
                },
            },
        ];

        const summaries = contentOf(parts).roundSummaries;

        expect(summaries).toHaveLength(1);
        expect(summaries[0].text).toBe('Claude Team: $25 per user per month billed annually.');
    });

    it('shows no narrative line when a round summary carries no prose at all', () => {
        const parts = [
            correlatedPlanPart(PLAN_STEPS),
            {
                type: 'data',
                name: 'research-round',
                data: {
                    round: 1,
                    summary: '### Search: pricing\n| Plan | Price |\n|-|-|\nhttps://example.com/a',
                    queries: [{ queryId: 'q1', text: 'pricing' }],
                    sources: [],
                },
            },
        ];

        expect(contentOf(parts).roundSummaries).toHaveLength(0);
    });

    it('keeps the report writing rather than settling when the backend sets done early', () => {
        const parts = [
            correlatedPlanPart(PLAN_STEPS),
            correlatedRoundPart({
                round: 1,
                queries: [{ queryId: 'q1', text: 'acme pricing 2026' }],
                sources: [{ title: 'Pricing', url: 'https://a.example.com/pricing' }],
            }),
            // `done` means the searching is over, not the run: the phase it states still wins.
            statusPart({ label: 'Writing the report', phase: 'writing', done: true }),
        ];

        // isRunning false is the case the payload-phase guard exists for: assistant-ui reports the
        // run finished the moment the report starts streaming.
        expect(phaseRowsOf(parts, false)).toEqual([
            'plan:done:Research plan created',
            'round-1:done:Gathered 1 source',
            'report:active:Writing the report…',
        ]);
    });

    it('shows the approval wait as its own live row while the gate is open', () => {
        const parts = [correlatedPlanPart(PLAN_STEPS), statusPart({ label: 'Plan ready', phase: 'awaiting-approval' })];

        expect(phaseRowsOf(parts, true)).toEqual([
            'plan:done:Research plan created',
            'approval:active:Waiting for your go-ahead',
        ]);
    });

    it('leaves no row live once the run has settled, whatever phase the last part named', () => {
        const parts = [
            correlatedPlanPart(PLAN_STEPS),
            correlatedRoundPart({
                round: 1,
                queries: [{ queryId: 'q1', text: 'acme pricing 2026', status: 'pending' }],
                sources: [{ title: 'Pricing', url: 'https://a.example.com/pricing' }],
            }),
            statusPart({ label: 'Searching', phase: 'searching' }),
            { type: 'data', name: 'research-report', data: { markdown: '## Findings' } },
        ];

        expect(phaseRowsOf(parts, false)).toEqual([
            'plan:done:Research plan created',
            'round-1:done:Gathered 1 source',
            'report:done:Research report is ready',
        ]);
    });
});

describe('buildResearchPhases on a run that did not finish', () => {
    const RUN_TOOL = { type: 'tool-call', toolName: 'deep_research', toolCallId: 'run-1' };
    const searched = [
        correlatedPlanPart(PLAN_STEPS),
        correlatedRoundPart({
            round: 1,
            queries: [{ queryId: 'q1', text: 'acme pricing 2026' }],
            sources: [{ title: 'Pricing', url: 'https://a.example.com/pricing' }],
        }),
    ];

    // Stop leaves the call without a result. The phases alone look settled, and the pane used to
    // close the timeline with "Research report is ready" for a report that was never written.
    it('ends a stopped run with a stopped row, not a ready report', () => {
        const parts = [...searched, { ...RUN_TOOL, status: { type: 'requires-action' } }];

        expect(phaseRowsOf(parts, false).at(-1)).toBe('report:stopped:Research stopped');
    });

    it('ends a failed run with the failure', () => {
        const parts = [...searched, { ...RUN_TOOL, result: { error: 'upstream timeout' } }];

        expect(phaseRowsOf(parts, false).at(-1)).toBe('report:stopped:Research failed');
    });

    it('does not call a run stopped while it is still running', () => {
        const parts = [...searched, { ...RUN_TOOL, status: { type: 'requires-action' } }];

        expect(phaseRowsOf(parts, true).some((row) => row.includes('stopped'))).toBe(false);
    });

    // An approval prompt is a resultless call on a settled message too, and the user can still
    // answer it — the run has not stopped, it has not started.
    it('does not call a run stopped while its approval prompt is unanswered', () => {
        const parts = [
            ...searched,
            { ...RUN_TOOL, status: { type: 'requires-action' }, approval: { approved: undefined } },
        ];

        expect(phaseRowsOf(parts, false).some((row) => row.includes('stopped'))).toBe(false);
    });

    // A reload rebuilds the plan and rounds from metadata but never the tool call, so the outcome
    // is gone; only the missing report keeps the timeline from promising one.
    it('claims no ready report on a reloaded run that never wrote one', () => {
        expect(phaseRowsOf([...searched], false).some((row) => row.includes('ready'))).toBe(false);
    });
});

describe('the report, across both wire contracts', () => {
    const BODY = '## Executive Summary\n\nCopilot lists at $30 per seat.';
    const reportPart = (markdown: string) => ({ type: 'data', name: 'research-report', data: { markdown } });

    it('takes the report the backend delivered as its own part', () => {
        const parts = [
            statusPart({ label: 'done', phase: 'done', done: true }),
            reportPart(BODY),
            { type: 'text', text: 'Here is the full research report.' },
        ];

        expect(contentOf(parts).reportMarkdown).toBe(BODY);
    });

    // The deployed backend still writes the report as the message's own text.
    it('falls back to the message text when no report part arrived', () => {
        const parts = [statusPart({ label: 'done', phase: 'done', done: true }), { type: 'text', text: BODY }];

        expect(contentOf(parts).reportMarkdown).toBe(BODY);
    });

    it('prefers the delivered part over the text beside it', () => {
        const parts = [
            statusPart({ label: 'done', phase: 'done', done: true }),
            reportPart(BODY),
            { type: 'text', text: 'A lead-in that is not the report.' },
        ];

        expect(contentOf(parts).reportMarkdown).not.toContain('lead-in');
    });

    it('ignores a report part carrying nothing', () => {
        const parts = [
            statusPart({ label: 'done', phase: 'done', done: true }),
            reportPart('   '),
            { type: 'text', text: BODY },
        ];

        expect(contentOf(parts).reportMarkdown).toBe(BODY);
    });

    // Membership is what keeps the part inside the run's group. A data part the grouping does not
    // recognise returns an empty path, which closes the group and splits one run into two.
    it('counts the report as part of the run, not a stray data part', () => {
        expect(isResearchPart(reportPart(BODY) as never)).toBe(true);
    });

    it('rebuilds the report from a reloaded message so a reopened run still has it', () => {
        const rebuilt = buildPersistedResearchParts({ research_report: BODY });

        expect(rebuilt).toEqual([{ type: 'data-research-report', id: 'research_report', data: { markdown: BODY } }]);
    });

    it('rebuilds the report after the rounds, the way the run streamed it', () => {
        const rebuilt = buildPersistedResearchParts({
            research_plan: { queries: ['Compare pricing'], startedAt: 1 },
            research_rounds: [{ round: 0, queries: [] }],
            research_report: BODY,
        });

        expect(rebuilt.map((part) => part.type)).toEqual([
            'data-research-plan',
            'data-research-round',
            'data-research-report',
        ]);
    });

    it('rebuilds the report when the backend stored the stream part verbatim', () => {
        const rebuilt = buildPersistedResearchParts({ research_report: { markdown: BODY } });

        expect(rebuilt).toEqual([{ type: 'data-research-report', id: 'research_report', data: { markdown: BODY } }]);
    });

    // An empty report part can land AFTER the text on a run whose report came through blank, which
    // is the reverse of the case above and the one that used to lose the report.
    it('reads the report from text that arrived before an empty report part', () => {
        const parts = [
            statusPart({ label: 'done', phase: 'done', done: true }),
            { type: 'text', text: BODY },
            reportPart('   '),
        ];

        expect(contentOf(parts).reportMarkdown).toBe(BODY);
    });

    // The lead-in sits before the blank report part and the document after it. Anchoring past the
    // report part would glue the two together and open the pane on a chat sentence.
    it('keeps a lead-in out of the report when text follows the empty report part', () => {
        const parts = [
            statusPart({ label: 'done', phase: 'done', done: true }),
            { type: 'text', text: "Done — I've written the report." },
            reportPart('   '),
            { type: 'text', text: BODY },
        ];

        expect(contentOf(parts).reportMarkdown).toBe(BODY);
    });
});
