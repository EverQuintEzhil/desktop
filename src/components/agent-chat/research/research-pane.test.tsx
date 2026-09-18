import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ResearchContent, ResearchQueryGroup } from './research-contract';
import ResearchPane from './research-pane';
import { ResearchAllSourcesLevel } from './research-sources-level';

const WIDE_VIEWPORT = 1400;

const setViewportWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
};

const group = (overrides: Partial<ResearchQueryGroup> & { id: string; text: string }): ResearchQueryGroup => ({
    round: 0,
    sources: [],
    ...overrides,
});

const buildContent = (overrides: Partial<ResearchContent> = {}): ResearchContent => ({
    title: 'Battery supply chains',
    planQueries: [
        { id: 'plan-0', text: 'lithium refining capacity' },
        { id: 'plan-1', text: 'cathode plant announcements' },
    ],
    queryGroups: [
        group({
            id: 'round-0-0',
            text: 'lithium refining capacity',
            round: 0,
            sources: [
                {
                    id: 'round-0-source-0',
                    title: 'Refining capacity outlook',
                    url: 'https://iea.org/report',
                    siteName: 'iea.org',
                },
            ],
        }),
        group({
            id: 'round-1-0',
            text: 'cathode plant announcements',
            round: 1,
            sources: [
                {
                    id: 'round-1-source-0',
                    title: 'New cathode plant in Nevada',
                    url: 'https://reuters.com/cathode',
                    siteName: 'reuters.com',
                },
            ],
        }),
    ],
    executedStepIds: [],
    roundSummaries: [],
    sourceCount: 2,
    runningSourceCount: 2,
    isComplete: true,
    ...overrides,
});

const renderPane = (
    content: ResearchContent | null,
    isRunning = false,
    requestedView?: 'trace' | 'report',
    requestedViewNonce = 0,
) =>
    render(
        <ResearchPane
            isVisible
            runId="message-1"
            content={content}
            isRunning={isRunning}
            requestedView={requestedView}
            requestedViewNonce={requestedViewNonce}
            onClose={() => {}}
        />,
    );

const paneRoot = () => document.querySelector('[data-slot="research-pane"]') as HTMLElement;

const phaseRows = () => paneRoot().querySelectorAll('.research-phase-row');

beforeEach(() => {
    setViewportWidth(WIDE_VIEWPORT);
});

describe('ResearchPane', () => {
    it('lists one row per phase on the overview', () => {
        renderPane(buildContent({ reportMarkdown: '# Cathode supply\n\nCapacity is tightening.' }));

        expect(phaseRows()).toHaveLength(4);
        expect(within(paneRoot()).getByText('Research plan created')).toBeInTheDocument();
        expect(within(paneRoot()).getAllByText('Gathered 1 source')).toHaveLength(2);
        expect(within(paneRoot()).getByText('Research report is ready')).toBeInTheDocument();
    });

    it('closes the timeline with the outcome when the run was stopped', () => {
        renderPane(buildContent({ runOutcome: 'unfinished' }));

        expect(within(paneRoot()).getByText('Research stopped')).toBeInTheDocument();
        expect(within(paneRoot()).queryByText('Research report is ready')).not.toBeInTheDocument();
    });

    it('drills into a round and shows its sources', async () => {
        const user = userEvent.setup();

        renderPane(buildContent());

        await user.click(screen.getAllByRole('button', { name: /show sources/i })[1]);

        expect(await screen.findByText('New cathode plant in Nevada')).toBeInTheDocument();
        expect(screen.getByText('reuters.com')).toBeInTheDocument();
        expect(screen.queryByText('Research plan created')).not.toBeInTheDocument();
    });

    it('returns to the overview from the sources level', async () => {
        const user = userEvent.setup();

        renderPane(buildContent());

        await user.click(screen.getAllByRole('button', { name: /show sources/i })[0]);
        expect(await screen.findByText('Refining capacity outlook')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /back to research overview/i }));

        expect(await screen.findByText('Research plan created')).toBeInTheDocument();
        expect(screen.queryByText('Refining capacity outlook')).not.toBeInTheDocument();
    });

    it('keeps the drill-down while the run streams more sources in', async () => {
        const user = userEvent.setup();
        const content = buildContent();
        const { rerender } = renderPane(content);

        await user.click(screen.getAllByRole('button', { name: /show sources/i })[1]);
        expect(await screen.findByText('New cathode plant in Nevada')).toBeInTheDocument();

        const grown: ResearchContent = {
            ...content,
            queryGroups: content.queryGroups.map((queryGroup) =>
                queryGroup.round === 1
                    ? {
                          ...queryGroup,
                          sources: [
                              ...queryGroup.sources,
                              {
                                  id: 'round-1-source-1',
                                  title: 'Cathode supply deal signed',
                                  url: 'https://ft.com/cathode',
                                  siteName: 'ft.com',
                              },
                          ],
                      }
                    : queryGroup,
            ),
        };

        rerender(<ResearchPane isVisible runId="message-1" content={grown} isRunning={false} onClose={() => {}} />);

        expect(await screen.findByText('Cathode supply deal signed')).toBeInTheDocument();
        expect(screen.getByText('New cathode plant in Nevada')).toBeInTheDocument();
    });

    it('shows the plan checklist and no round rows for a plan-only run', () => {
        renderPane(buildContent({ queryGroups: [], sourceCount: 0, runningSourceCount: 0, isComplete: false }));

        expect(within(paneRoot()).getByText('lithium refining capacity')).toBeInTheDocument();
        expect(phaseRows()).toHaveLength(1);
        expect(within(paneRoot()).queryByRole('button', { name: /show sources/i })).not.toBeInTheDocument();
    });

    it('renders no trace body when there is no content', () => {
        renderPane(null);

        expect(phaseRows()).toHaveLength(0);
        expect(within(paneRoot()).queryByText('Battery supply chains')).not.toBeInTheDocument();
    });

    it('shows the run title and the settled source count in the header', () => {
        renderPane(buildContent());

        expect(within(paneRoot()).getByRole('heading', { name: 'Battery supply chains' })).toBeInTheDocument();
        expect(within(paneRoot()).getByRole('button', { name: '2 sources' })).toBeInTheDocument();
    });

    it('counts up while the run is live', () => {
        renderPane(buildContent({ runningSourceCount: 238, isComplete: false, phase: 'searching' }), true);

        expect(within(paneRoot()).getByRole('button', { name: '238 sources and counting…' })).toBeInTheDocument();
    });

    it('keeps the settled count when the pushed snapshot says the run is done', () => {
        renderPane(buildContent({ runningSourceCount: 238, phase: 'done' }), true);

        expect(within(paneRoot()).getByRole('button', { name: '2 sources' })).toBeInTheDocument();
    });

    it('opens the flat sources list from the header count', async () => {
        const user = userEvent.setup();

        renderPane(buildContent());

        await user.click(screen.getByRole('button', { name: '2 sources' }));

        expect(await screen.findByText('Browsed 2 websites')).toBeInTheDocument();

        const links = screen.getAllByRole('link');

        expect(links).toHaveLength(2);
        expect(links[0]).toHaveAttribute('href', 'https://iea.org/report');
        expect(links[0]).toHaveAttribute('target', '_blank');
        expect(links[0]).toHaveTextContent('iea.org');
        expect(links[0]).toHaveTextContent('Refining capacity outlook');
        expect(links[1]).toHaveTextContent('reuters.com');

        await user.click(screen.getByRole('button', { name: /back to research overview/i }));

        expect(await screen.findByText('Research plan created')).toBeInTheDocument();
    });

    it('lists every distinct source once in the flat view', async () => {
        const user = userEvent.setup();
        const duplicated = buildContent({
            queryGroups: [
                group({
                    id: 'round-0-0',
                    text: 'lithium refining capacity',
                    sources: [
                        {
                            id: 'a',
                            title: 'Refining capacity outlook',
                            url: 'https://iea.org/report',
                            siteName: 'iea.org',
                        },
                        {
                            id: 'b',
                            title: 'Refining capacity outlook',
                            url: 'https://iea.org/report',
                            siteName: 'iea.org',
                        },
                    ],
                }),
            ],
            sourceCount: 1,
            runningSourceCount: 1,
        });

        renderPane(duplicated);

        await user.click(screen.getByRole('button', { name: '1 source' }));

        expect(await screen.findByText('Browsed 1 website')).toBeInTheDocument();
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('shows a pending search and the progress the payload states', async () => {
        const user = userEvent.setup();
        const live = buildContent({
            queryGroups: [
                group({
                    id: 'round-0-0',
                    text: 'lithium refining capacity',
                    status: 'pending',
                    index: 2,
                    total: 4,
                }),
            ],
            sourceCount: 0,
            runningSourceCount: 0,
            isComplete: false,
            phase: 'searching',
        });

        renderPane(live, true);

        expect(within(paneRoot()).getByText('2/4')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /show sources/i }));

        const pendingGroup = await screen.findByText('Results are still coming in.');
        const groupRoot = pendingGroup.closest('.research-query-group') as HTMLElement;

        expect(groupRoot).toHaveAttribute('data-status', 'pending');
        expect(within(groupRoot).getByText('Searching…')).toBeInTheDocument();
        expect(within(groupRoot).getByText('2/4')).toBeInTheDocument();
        expect(screen.queryByText(/^\d+ results?$/)).not.toBeInTheDocument();
    });

    it('falls back to the first letter when a favicon fails to load', async () => {
        const user = userEvent.setup();

        renderPane(
            buildContent({
                queryGroups: [
                    group({
                        id: 'round-0-0',
                        text: 'lithium refining capacity',
                        sources: [
                            {
                                id: 'a',
                                title: 'Refining capacity outlook',
                                url: 'https://iea.org/report',
                                siteName: 'iea.org',
                                faviconUrl: 'https://iea.org/favicon.ico',
                            },
                        ],
                    }),
                ],
                sourceCount: 1,
                runningSourceCount: 1,
            }),
        );

        await user.click(screen.getByRole('button', { name: '1 source' }));

        const icon = (await screen.findByRole('link')).querySelector('img') as HTMLImageElement;

        fireEvent.error(icon);

        expect(screen.getByRole('link')).toHaveTextContent('I');
        expect(screen.getByRole('link').querySelector('img')).toBeNull();
    });

    it('states no progress when the payload reports none', () => {
        renderPane(buildContent());

        expect(within(paneRoot()).queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
    });

    it('reports an empty run', () => {
        renderPane(buildContent({ planQueries: [], queryGroups: [], sourceCount: 0, runningSourceCount: 0 }));

        expect(within(paneRoot()).getByText('No research steps reported yet.')).toBeInTheDocument();
        expect(phaseRows()).toHaveLength(0);
        expect(within(paneRoot()).queryByRole('button', { name: /sources/i })).not.toBeInTheDocument();
    });

    it('opens straight at the report when the transcript asks for it', () => {
        renderPane(
            buildContent({ reportMarkdown: '# What 500 seats cost\n\n## Pricing\n\nSeat prices cluster tightly.' }),
            false,
            'report',
        );

        expect(within(paneRoot()).getByRole('heading', { name: 'What 500 seats cost' })).toBeInTheDocument();
        expect(within(paneRoot()).getByRole('button', { name: 'Contents' })).toBeInTheDocument();
        expect(within(paneRoot()).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
        expect(within(paneRoot()).getByRole('button', { name: 'Download report' })).toBeInTheDocument();
        expect(phaseRows()).toHaveLength(0);
    });

    it('re-applies the asked-for level when the transcript asks again after in-pane navigation', async () => {
        const user = userEvent.setup();
        const content = buildContent();
        const { rerender } = renderPane(content, false, 'trace', 1);

        await user.click(within(paneRoot()).getByText('2 sources'));
        expect(await screen.findByText('Browsed 2 websites')).toBeInTheDocument();

        // Same level, new request: clicking the run's card again has to return to the overview.
        rerender(
            <ResearchPane
                isVisible
                runId="message-1"
                content={content}
                isRunning={false}
                requestedView="trace"
                requestedViewNonce={2}
                onClose={() => {}}
            />,
        );

        expect(within(paneRoot()).getByText('Research plan created')).toBeInTheDocument();
    });

    it('shows the trace when the report level is asked for but no report exists', () => {
        renderPane(buildContent(), false, 'report');

        expect(within(paneRoot()).getByText('Research plan created')).toBeInTheDocument();
    });
});

describe('ResearchPane top sites breakdown', () => {
    const manySources = (): ResearchQueryGroup[] => [
        group({
            id: 'round-1-0',
            text: 'cathode plant announcements',
            round: 1,
            sources: [
                { id: 's1', title: 'Nevada plant', url: 'https://reuters.com/a', siteName: 'reuters.com' },
                { id: 's2', title: 'Ohio plant', url: 'https://reuters.com/b', siteName: 'reuters.com' },
                { id: 's3', title: 'Capacity note', url: 'https://iea.org/a', siteName: 'iea.org' },
                { id: 's4', title: 'Refining', url: 'https://ft.com/a', siteName: 'ft.com' },
                { id: 's5', title: 'Cells', url: 'https://bloomberg.com/a', siteName: 'bloomberg.com' },
                { id: 's6', title: 'Tail one', url: 'https://wsj.com/a', siteName: 'wsj.com' },
                { id: 's7', title: 'Tail two', url: 'https://nyt.com/a', siteName: 'nyt.com' },
            ],
        }),
    ];

    const renderBreakdown = () =>
        renderPane(buildContent({ queryGroups: manySources(), sourceCount: 7, runningSourceCount: 7 }));

    it('opens one site\u2019s own sources when its row is clicked', async () => {
        const user = userEvent.setup();

        renderBreakdown();
        await user.click(within(paneRoot()).getByRole('button', { name: /from reuters\.com/ }));

        expect(within(paneRoot()).getByText('2 sources from reuters.com')).toBeInTheDocument();
        expect(within(paneRoot()).getByText('Nevada plant')).toBeInTheDocument();
        expect(within(paneRoot()).getByText('Ohio plant')).toBeInTheDocument();
        expect(within(paneRoot()).queryByText('Refining')).not.toBeInTheDocument();
    });

    // The tail used to be a bare paragraph, so the sources it counted were unreachable.
    it('reaches every source from the tail row', async () => {
        const user = userEvent.setup();

        renderBreakdown();
        await user.click(within(paneRoot()).getByRole('button', { name: '+2 more sources' }));

        expect(within(paneRoot()).getByText('Tail one')).toBeInTheDocument();
        expect(within(paneRoot()).getByText('Tail two')).toBeInTheDocument();
    });

    it('draws no unlabelled share bar beside a row', () => {
        renderBreakdown();

        const row = within(paneRoot()).getByRole('button', { name: /from reuters\.com/ });

        expect(row.querySelector('[style*="width"]')).toBeNull();
        expect(row.textContent).toBe('Rreuters.com2 sources');
    });

    it('marks a filtered count as provisional while the run is still going', () => {
        render(
            <ResearchAllSourcesLevel
                sources={[{ id: 's1', title: 'Nevada plant', url: 'https://reuters.com/a', siteName: 'reuters.com' }]}
                isLive
                site="reuters.com"
                onBack={() => {}}
            />,
        );

        expect(screen.getByText('1 source from reuters.com so far…')).toBeInTheDocument();
    });

    // A round rewrite can drop the very sources the reader filtered to, and "nothing arrived yet"
    // is a different claim from "this site has none".
    it('names the empty site instead of claiming nothing has arrived', () => {
        render(
            <ResearchAllSourcesLevel
                sources={[{ id: 's1', title: 'Nevada plant', url: 'https://reuters.com/a', siteName: 'reuters.com' }]}
                isLive={false}
                site="ft.com"
                onBack={() => {}}
            />,
        );

        expect(screen.getByText('No sources left from ft.com.')).toBeInTheDocument();
        expect(screen.queryByText('No sources reported yet.')).not.toBeInTheDocument();
    });
});
