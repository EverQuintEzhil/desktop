import { describe, expect, it } from 'vitest';

import { buildReportOutline, collectResearchContent, hasRenderableResearch } from './research-contract';

const planPart = (queries: string[]) => ({ type: 'data', name: 'research-plan', data: { queries } });

const source = (position: number) => ({
    title: `Source ${position}`,
    url: `https://example-${position}.com/article`,
});

const roundPart = (round: number, queries: string[], sourceCount: number) => ({
    type: 'data',
    name: 'research-round',
    data: {
        round,
        queries,
        summary: `Summary of round ${round}`,
        sources: Array.from({ length: sourceCount }, (_, position) => source(position)),
    },
});

describe('collectResearchContent rounds without queries', () => {
    it('keeps the sources of a round that named no queries', () => {
        const content = collectResearchContent([roundPart(2, [], 12)]);

        expect(content.queryGroups).toHaveLength(1);
        expect(content.queryGroups[0].round).toBe(2);
        expect(content.queryGroups[0].sources).toHaveLength(12);
        expect(content.sourceCount).toBe(12);
    });

    it('labels the round-level group and marks it unattributed', () => {
        const content = collectResearchContent([roundPart(3, ['   '], 2)]);

        expect(content.queryGroups[0].text).toBe('Round 3 results');
        expect(content.queryGroups[0].isUnattributed).toBe(true);
    });

    it('still drops a round that reported neither queries nor sources', () => {
        const content = collectResearchContent([roundPart(1, [], 0)]);

        expect(content.queryGroups).toEqual([]);
        expect(content.sourceCount).toBe(0);
    });
});

describe('collectResearchContent plan parts', () => {
    it('replaces the plan when the backend re-emits it as it grows', () => {
        const content = collectResearchContent([
            planPart(['Compare pricing models', 'Check support tiers']),
            planPart(['Compare pricing models', 'Check support tiers', 'Read migration guides', 'Summarise']),
        ]);

        expect(content.planQueries.map((query) => query.text)).toEqual([
            'Compare pricing models',
            'Check support tiers',
            'Read migration guides',
            'Summarise',
        ]);
    });

    it('keeps plan entry ids stable across a re-emit so the checklist does not remount', () => {
        const first = collectResearchContent([planPart(['Compare pricing models'])]);
        const second = collectResearchContent([
            planPart(['Compare pricing models']),
            planPart(['Compare pricing models', 'Check support tiers']),
        ]);

        expect(second.planQueries[0].id).toBe(first.planQueries[0].id);
        expect(new Set(second.planQueries.map((query) => query.id)).size).toBe(2);
    });
});

describe('collectResearchContent report text', () => {
    it('reads the report from the text parts that follow the last phase', () => {
        const parts = [
            { type: 'data', name: 'research-plan', data: { steps: [{ id: 's1', text: 'Survey vendors' }] } },
            { type: 'text', text: '# Findings\n\nSeat prices cluster tightly.' },
        ];
        const content = collectResearchContent(parts);

        expect(content.reportMarkdown).toBe('# Findings\n\nSeat prices cluster tightly.');
    });

    it('ignores text that came before the run', () => {
        const parts = [
            { type: 'text', text: 'Starting research now.' },
            { type: 'data', name: 'research-plan', data: { steps: ['Survey vendors'] } },
        ];
        const content = collectResearchContent(parts);

        expect(content.reportMarkdown).toBeUndefined();
    });
});

describe('buildReportOutline', () => {
    it('lists the headings in document order with their level', () => {
        expect(buildReportOutline('# Title\n\ntext\n\n## Pricing\n\n### Seats\n\n#### Ignored')).toEqual([
            { text: 'Title', level: 1 },
            { text: 'Pricing', level: 2 },
            { text: 'Seats', level: 3 },
        ]);
    });

    it('never reads a hash inside a fenced block as a heading', () => {
        expect(buildReportOutline('```sh\n# not a heading\n```\n\n## Real heading')).toEqual([
            { text: 'Real heading', level: 2 },
        ]);
    });
});

describe('source URL safety', () => {
    it('drops a source whose URL is not a web address', () => {
        const parts = [
            {
                type: 'data',
                name: 'research-round',
                data: {
                    round: 1,
                    queries: [{ queryId: 'q1', text: 'vendor pricing' }],
                    sources: [
                        { queryId: 'q1', title: 'Script', url: 'javascript:alert(1)' },
                        { queryId: 'q1', title: 'Data', url: 'data:text/html,<script>' },
                        { queryId: 'q1', title: 'Real', url: 'https://openai.com/pricing' },
                    ],
                },
            },
        ];
        const content = collectResearchContent(parts);

        expect(content.queryGroups[0].sources.map((source) => source.url)).toEqual(['https://openai.com/pricing']);
        expect(content.sourceCount).toBe(1);
    });
});

describe('source site names', () => {
    const contentWithSiteNames = (siteNames: (string | undefined)[]) => {
        const parts = [
            {
                type: 'data',
                name: 'research-round',
                data: {
                    round: 1,
                    queries: [{ queryId: 'q1', text: 'iphone 18 pro' }],
                    sources: siteNames.map((siteName, position) => ({
                        queryId: 'q1',
                        title: `Source ${position}`,
                        url: `https://www.example-${position}.com/a`,
                        siteName,
                    })),
                },
            },
        ];

        return collectResearchContent(parts);
    };

    it('drops the www prefix a stated host-shaped site name carries', () => {
        const content = contentWithSiteNames(['www.facebook.com', 'MacRumors']);

        expect(content.queryGroups[0].sources.map((source) => source.siteName)).toEqual(['facebook.com', 'MacRumors']);
    });

    it('falls back to the URL host when no site name is stated', () => {
        const content = contentWithSiteNames([undefined, '   ']);

        expect(content.queryGroups[0].sources.map((source) => source.siteName)).toEqual([
            'example-0.com',
            'example-1.com',
        ]);
    });
});

describe('hasRenderableResearch', () => {
    const statusPart = (label: string, phase: string, done = false) => ({
        type: 'data',
        name: 'research-status',
        data: { label, phase, ...(done && { done: true }) },
    });

    // The announcement lands before the gate tool call exists; a card there flashes for a second
    // and then yields to the gate's own shell, so it is never worth drawing.
    it('never draws the planning announcement on its own, even while live', () => {
        const content = collectResearchContent([statusPart('Planning the research', 'planning')]);

        expect(hasRenderableResearch(content, true)).toBe(false);
    });

    // `phase` is sticky and optional per write, so a rewrite that adds sources but omits the phase
    // still carries `planning` — and must still draw.
    it('draws a sticky planning phase once sources have arrived', () => {
        const rewritten = {
            type: 'data',
            name: 'research-status',
            data: { label: 'Researching 8 websites', sourceCount: 8 },
        };
        const content = collectResearchContent([statusPart('Planning the research', 'planning'), rewritten]);

        expect(hasRenderableResearch(content, true)).toBe(true);
    });

    it('still shows a live run from its first searching status alone', () => {
        const content = collectResearchContent([statusPart('Searching the web', 'searching')]);

        expect(hasRenderableResearch(content, true)).toBe(true);
    });

    it('drops it once the turn settles without a run', () => {
        // The backend announces the mode before the model has chosen to use it, so a turn that
        // answers from earlier research must not be left with a card frozen on "Planning".
        const content = collectResearchContent([statusPart('Planning the research', 'planning')]);

        expect(hasRenderableResearch(content, false)).toBe(false);
    });

    it('keeps a terminal status, so a run that failed before its plan still says so', () => {
        const content = collectResearchContent([statusPart('Research could not be completed', 'done', true)]);

        expect(hasRenderableResearch(content, false)).toBe(true);
    });

    it('keeps a settled run that produced a plan', () => {
        expect(hasRenderableResearch(collectResearchContent([planPart(['one'])]), false)).toBe(true);
    });

    it('keeps a settled run that produced rounds', () => {
        expect(hasRenderableResearch(collectResearchContent([roundPart(1, ['one'], 2)]), false)).toBe(true);
    });
});
