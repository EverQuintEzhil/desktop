import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearManualRunWindow } from '@/lib/api/app/routines';
import { apiUrl, envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import SidebarRoutinesList from './sidebar-routines-list';

const toastError = vi.fn();

vi.mock('sonner', () => ({
    toast: {
        error: (...args: unknown[]) => toastError(...args),
        success: vi.fn(),
    },
}));

const agent = { _id: 'agent-1', name: 'Research', slug: 'research' };

const routine = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    _id: 'routine-1',
    agentId: 'agent-1',
    name: 'Weekly competitor scan',
    prompt: 'Track competitors',
    cron: '0 9 * * 1',
    timezone: 'UTC',
    runOnce: false,
    status: 'active',
    lastRunAt: null,
    agent,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    ...overrides,
});

const run = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    _id: 'run-1',
    routineId: 'routine-1',
    status: 'completed',
    trigger: 'schedule',
    conversationId: 'conv-1',
    error: '',
    startedAt: '2026-08-22T09:00:00.000Z',
    finishedAt: '2026-08-22T09:05:00.000Z',
    isRead: false,
    routine: { _id: 'routine-1', name: 'Weekly competitor scan', agentId: 'agent-1', agent },
    createdAt: '2026-08-22T09:00:00.000Z',
    updatedAt: '2026-08-22T09:05:00.000Z',
    ...overrides,
});

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

const stubMarkRead = (spy: (body: unknown) => void) =>
    server.use(
        http.put(apiUrl('/routines/runs/read'), async ({ request }) => {
            spy(await request.json());

            return envelope({ marked: 1 });
        }),
    );

const rowDot = (container: HTMLElement): Element | null => container.querySelector('a span[aria-hidden="true"]');

const setup = (routines: Record<string, unknown>[], runs: Record<string, unknown>[], activePath?: string) => {
    server.use(
        respond('get', '/routines', () => pagedEnvelope(routines)),
        respond('get', '/routines/runs', () => pagedEnvelope(runs)),
    );

    return renderWithProviders(
        <>
            <SidebarRoutinesList
                id="sidebar-routines"
                agentId="agent-1"
                agentSlug="research"
                isCollapsed={false}
                activePath={activePath}
            />
            <LocationProbe />
        </>,
    );
};

describe('SidebarRoutinesList', () => {
    // The manual-run fast-poll window is module state; without this a run in one test speeds up the next.
    beforeEach(clearManualRunWindow);

    it('points an empty list at the full page rather than claiming there are no routines', async () => {
        setup([], []);

        // The list is active-only server-side, so empty here still leaves paused routines on that page.
        const link = await screen.findByRole('link', { name: 'Nothing running — see all routines' });

        expect(link).toHaveAttribute('href', '/agent/research/routines');
        expect(screen.queryByText('No routines yet')).not.toBeInTheDocument();
        expect(screen.queryByText('Routines')).not.toBeInTheDocument();
    });

    it('asks the api for active routines only', async () => {
        const seen: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/routines'), ({ request }) => {
                seen.push(new URL(request.url).searchParams.get('status'));

                return pagedEnvelope([routine()]);
            }),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
        );

        renderWithProviders(
            <SidebarRoutinesList id="sidebar-routines" agentId="agent-1" agentSlug="research" isCollapsed={false} />,
        );

        await screen.findByText('Weekly competitor scan');
        expect(seen).toEqual(['active']);
    });

    it('renders nothing when the sidebar is collapsed', async () => {
        server.use(
            respond('get', '/routines', () => pagedEnvelope([routine()])),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
        );

        renderWithProviders(
            <SidebarRoutinesList id="sidebar-routines" agentId="agent-1" agentSlug="research" isCollapsed />,
        );

        await waitFor(() => {
            expect(screen.queryByText('Weekly competitor scan')).not.toBeInTheDocument();
        });
    });

    it('carries the id it is given so the nav row can point aria-controls at it', async () => {
        const { container } = setup([routine()], []);

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
        expect(container.querySelector('ul#sidebar-routines')).toBeInTheDocument();
    });

    it('highlights the routine whose detail page is open', async () => {
        setup([routine()], [], 'routines/routine-1');

        const row = (await screen.findByText('Weekly competitor scan')).closest('li');

        expect(row).toHaveClass('active');
    });

    it('leaves rows unhighlighted on the routines list itself', async () => {
        setup([routine()], [], 'routines');

        const row = (await screen.findByText('Weekly competitor scan')).closest('li');

        expect(row).not.toHaveClass('active');
    });

    it('still highlights the routine whose report conversation is open', async () => {
        setup([routine()], [run()], 'chat/conv-1');

        const row = (await screen.findByText('Weekly competitor scan')).closest('li');

        expect(row).toHaveClass('active');
    });

    it('counts unread settled runs as "new"', async () => {
        setup([routine()], [run(), run({ _id: 'run-2', conversationId: 'conv-2' })]);

        expect(await screen.findByText('2 new')).toBeInTheDocument();
    });

    it('does not count an in-flight run as new', async () => {
        setup([routine()], [run({ status: 'running', conversationId: null, finishedAt: null })]);

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
        expect(screen.queryByText(/new$/)).not.toBeInTheDocument();
    });

    it('shows unseen failures as their own badge and opens exactly the runs it counted', async () => {
        const markRead = vi.fn();

        stubMarkRead(markRead);
        setup([routine()], [run(), run({ _id: 'run-2', status: 'failed', conversationId: 'conv-2', error: 'boom' })]);

        expect(await screen.findByText('1 needs attention')).toBeInTheDocument();
        expect(screen.queryByText(/new$/)).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Weekly competitor scan/ })).toHaveAttribute(
            'href',
            '/agent/research/routines/routine-1?runStatus=failed',
        );

        await userEvent.click(screen.getByRole('link', { name: /Weekly competitor scan/ }));

        // The link lands on rows that exist, so opening the routine reads them: a badge that only the
        // kebab could ever clear stopped being information. But the filtered list never shows the
        // unread completed report, so clearing that too would lose news nobody has seen.
        await waitFor(() => {
            expect(markRead).toHaveBeenCalledWith({ runIds: ['run-2'] });
        });
    });

    it('counts a blocked run and links to the status it counted, not to failed', async () => {
        const markRead = vi.fn();

        stubMarkRead(markRead);
        setup([routine()], [run({ _id: 'run-2', status: 'needs_reconnect', conversationId: null, error: '' })]);

        expect(await screen.findByText('1 needs attention')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Weekly competitor scan/ })).toHaveAttribute(
            'href',
            '/agent/research/routines/routine-1?runStatus=needs_reconnect',
        );

        await userEvent.click(screen.getByRole('link', { name: /Weekly competitor scan/ }));

        // A blocked run mints no conversation, so there is no report path to gate on: without reading
        // what the click lands on, this routine's badge could only ever be cleared from the kebab.
        await waitFor(() => {
            expect(markRead).toHaveBeenCalledWith({ runIds: ['run-2'] });
        });
    });

    it('acts on no chip while a run is in flight, since the row shows none', async () => {
        const markRead = vi.fn();

        stubMarkRead(markRead);
        setup(
            [routine()],
            [
                run({ _id: 'run-2', status: 'failed', conversationId: null, error: 'boom' }),
                run({ _id: 'run-3', status: 'running', conversationId: 'conv-3' }),
            ],
        );

        expect(await screen.findByLabelText('Running now')).toBeInTheDocument();
        expect(screen.queryByText(/need(s)? attention/)).not.toBeInTheDocument();

        // The chip, the destination and the mark-read all read one condition, so a suppressed chip
        // cannot be silently cleared by a click that never showed it.
        const link = screen.getByRole('link', { name: /Weekly competitor scan/ });

        expect(link.getAttribute('href')).not.toContain('runStatus');

        await userEvent.click(link);

        // A run in flight has minted no report yet, so the row falls back to the routine's own page.
        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/agent/research/routines/routine-1');
        });
        expect(markRead).not.toHaveBeenCalled();
    });

    it('spares a suppressed attention run when the click opens an older report instead', async () => {
        const markRead = vi.fn();

        stubMarkRead(markRead);
        setup(
            [routine()],
            [
                // An older report the click can land on, beside a suppressed failure and a run in flight.
                run({ _id: 'run-1', status: 'completed', conversationId: 'conv-1' }),
                run({ _id: 'run-2', status: 'failed', conversationId: null, error: 'boom' }),
                run({ _id: 'run-3', status: 'running', conversationId: 'conv-3' }),
            ],
        );

        expect(await screen.findByLabelText('Running now')).toBeInTheDocument();
        expect(screen.queryByText(/need(s)? attention/)).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('link', { name: /Weekly competitor scan/ }));

        // The failure's chip is suppressed by the run in flight; clearing it here would mean the chip
        // never appears once that run settles.
        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/agent/research/chat/conv-1');
        });
        expect(markRead).not.toHaveBeenCalledWith({ runIds: expect.arrayContaining(['run-2']) });
    });

    it('carries both statuses in the link when the count holds both', async () => {
        setup(
            [routine()],
            [
                run({ _id: 'run-2', status: 'needs_reconnect', conversationId: null, error: '' }),
                run({ _id: 'run-3', status: 'failed', conversationId: null, error: 'boom' }),
            ],
        );

        expect(await screen.findByText('2 need attention')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Weekly competitor scan/ })).toHaveAttribute(
            'href',
            '/agent/research/routines/routine-1?runStatus=needs_reconnect,failed',
        );
    });

    it('opens the report and marks the routine read', async () => {
        const markRead = vi.fn();

        server.use(
            http.put(apiUrl('/routines/runs/read'), async ({ request }) => {
                markRead(await request.json());

                return envelope({ marked: 1 });
            }),
        );
        setup([routine()], [run()]);

        await userEvent.click(await screen.findByRole('link', { name: /Weekly competitor scan/ }));

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/agent/research/chat/conv-1');
        });
        await waitFor(() => {
            expect(markRead).toHaveBeenCalledWith({ runIds: ['run-1'] });
        });
    });

    it('falls back to the routines page when no report can be opened', async () => {
        setup([routine()], []);

        await userEvent.click(await screen.findByRole('link', { name: /Weekly competitor scan/ }));

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/agent/research/routines');
        });
    });
});

describe('SidebarRoutinesList row actions', () => {
    beforeEach(() => {
        toastError.mockClear();
    });

    it('marks a routine read from the status dot without navigating', async () => {
        const markRead = vi.fn();

        stubMarkRead(markRead);
        setup([routine()], [run()]);

        // The left slot shows the running status instead of the unread dot, so the menu carries the action.
        await userEvent.click(await screen.findByRole('button', { name: 'More options for Weekly competitor scan' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Mark as read' }));

        await waitFor(() => {
            expect(markRead).toHaveBeenCalledWith({ runIds: ['run-1'] });
        });
        expect(screen.getByTestId('location')).toHaveTextContent('/');
        expect(screen.getByTestId('location')).not.toHaveTextContent('routines');
    });

    it('never sends an in-flight run to mark-as-read', async () => {
        const markRead = vi.fn();

        stubMarkRead(markRead);
        setup(
            [routine()],
            [run(), run({ _id: 'run-running', status: 'running', conversationId: null, finishedAt: null })],
        );

        // The left slot shows the running status instead of the unread dot, so the menu carries the action.
        await userEvent.click(await screen.findByRole('button', { name: 'More options for Weekly competitor scan' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Mark as read' }));

        await waitFor(() => {
            expect(markRead).toHaveBeenCalledWith({ runIds: ['run-1'] });
        });
    });

    it('offers no status-dot button and no "Mark as read" item without unread runs', async () => {
        setup([routine()], []);

        await screen.findByText('Weekly competitor scan');

        expect(screen.queryByRole('button', { name: /as read$/ })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'More options for Weekly competitor scan' }));

        expect(await screen.findByRole('menuitem', { name: 'Run now' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Mark as read' })).not.toBeInTheDocument();
    });

    it('renders the unread dot through the shared status indicator', async () => {
        setup([routine()], [run()]);

        const dotButton = await screen.findByRole('button', { name: 'Mark Weekly competitor scan as read' });

        expect(within(dotButton).getByLabelText('New response ready')).toBeInTheDocument();
    });

    it('shows no dot at all on a read routine, active or paused', async () => {
        const active = setup([routine()], []);

        expect(await screen.findByRole('link', { name: /Weekly competitor scan/ })).toBeInTheDocument();
        expect(rowDot(active.container)).toBeNull();

        active.unmount();

        const paused = setup([routine({ status: 'paused' })], []);

        expect(await screen.findByRole('link', { name: /Weekly competitor scan/ })).toBeInTheDocument();
        expect(rowDot(paused.container)).toBeNull();
    });

    it('runs a routine now from the row menu', async () => {
        const runNow = vi.fn();

        server.use(
            http.post(apiUrl('/routines/:routineId/run'), ({ params }) => {
                runNow(params.routineId);

                return envelope({ started: true });
            }),
        );
        setup([routine()], []);

        await userEvent.click(await screen.findByRole('button', { name: 'More options for Weekly competitor scan' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Run now' }));

        await waitFor(() => {
            expect(runNow).toHaveBeenCalledWith('routine-1');
        });
    });

    it('acts from the row menu without navigating away', async () => {
        server.use(respond('post', '/routines/routine-1/pause', () => envelope(routine({ status: 'paused' }))));
        setup([routine()], [run()]);

        await userEvent.click(await screen.findByRole('button', { name: 'More options for Weekly competitor scan' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Pause' }));

        // The menu lives inside the row's Link, so the action must not also open the report.
        expect(screen.getByTestId('location')).toHaveTextContent('/');
        expect(screen.getByTestId('location')).not.toHaveTextContent('chat/');
    });

    it('surfaces the API message when running a routine fails', async () => {
        server.use(respond('post', '/routines/routine-1/run', () => httpError(403, 'Routine quota exhausted.')));
        setup([routine()], []);

        await userEvent.click(await screen.findByRole('button', { name: 'More options for Weekly competitor scan' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Run now' }));

        await waitFor(() => {
            expect(toastError).toHaveBeenCalledWith('Routine quota exhausted.', expect.anything());
        });
    });

    it('pauses an active routine and resumes a paused one', async () => {
        const paused = vi.fn();

        server.use(
            respond('post', '/routines/routine-1/pause', () => {
                paused('pause');

                return envelope(routine({ status: 'paused' }));
            }),
        );
        setup([routine()], []);

        await userEvent.click(await screen.findByRole('button', { name: 'More options for Weekly competitor scan' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Pause' }));

        await waitFor(() => {
            expect(paused).toHaveBeenCalledWith('pause');
        });
    });

    it('offers Resume for a paused routine', async () => {
        const resumed = vi.fn();

        server.use(
            respond('post', '/routines/routine-1/resume', () => {
                resumed('resume');

                return envelope(routine());
            }),
        );
        setup([routine({ status: 'paused' })], []);

        await userEvent.click(await screen.findByRole('button', { name: 'More options for Weekly competitor scan' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Resume' }));

        await waitFor(() => {
            expect(resumed).toHaveBeenCalledWith('resume');
        });
    });

    it('names the routine a bare Run now failure came from, since the list shows many at once', async () => {
        server.use(respond('post', '/routines/routine-1/run', () => httpError(500, '')));
        setup([routine()], []);

        await userEvent.click(await screen.findByRole('button', { name: 'More options for Weekly competitor scan' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Run now' }));

        // The shared toast's default is "Failed to start the run.", which on this surface would not
        // say which of the listed routines it came from.
        await waitFor(() => {
            expect(toastError).toHaveBeenCalledWith('Could not start Weekly competitor scan.', expect.anything());
        });
    });

    it('offers the connector action on a refused run here too, not just on the detail page', async () => {
        server.use(
            respond('post', '/routines/routine-1/run', () =>
                HttpResponse.json(
                    { success: false, code: 'MCP_REAUTH_REQUIRED', message: '"Miro" needs reconnecting.' },
                    { status: 424 },
                ),
            ),
        );
        setup([routine()], []);

        await userEvent.click(await screen.findByRole('button', { name: 'More options for Weekly competitor scan' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Run now' }));

        await waitFor(() => {
            expect(toastError).toHaveBeenCalledWith(
                '"Miro" needs reconnecting.',
                expect.objectContaining({ action: expect.objectContaining({ label: 'Open connectors' }) }),
            );
        });
    });

    it('navigates to the routines page from the row menu', async () => {
        setup([routine()], []);

        await userEvent.click(await screen.findByRole('button', { name: 'More options for Weekly competitor scan' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'View all routines' }));

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/agent/research/routines');
        });
    });

    it('does not mark a routine read when its report cannot be opened', async () => {
        const markRead = vi.fn();

        stubMarkRead(markRead);
        // Nothing needing attention and no report to open, so the click has nothing it could be reading.
        setup([routine()], [run({ conversationId: null, status: 'completed' })]);

        await userEvent.click(await screen.findByRole('link', { name: /Weekly competitor scan/ }));

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/agent/research/routines/routine-1');
        });
        expect(markRead).not.toHaveBeenCalled();
    });
});
