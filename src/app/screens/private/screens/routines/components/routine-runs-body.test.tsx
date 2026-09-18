import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearManualRunWindow } from '@/lib/api/app/routines';
import { apiUrl, rawPaged, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { RoutineType } from '@/types/routines';

import RoutineRunsBody from './routine-runs-body';

const agentRef = { _id: 'agent-1', name: 'Research', slug: 'research' };

const routine = {
    _id: 'routine-1',
    agentId: 'agent-1',
    name: 'Weekly competitor scan',
    prompt: 'Track announcements',
    cron: '0 9 * * 1',
    timezone: 'UTC',
    runOnce: false,
    status: 'active',
    lastRunAt: null,
    agent: agentRef,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
} as unknown as RoutineType;

const run = (id: string) => ({
    _id: id,
    routineId: 'routine-1',
    status: 'completed',
    trigger: 'schedule',
    conversationId: `conv-${id}`,
    error: '',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    isRead: true,
    routine: { _id: 'routine-1', name: 'Weekly competitor scan', agentId: 'agent-1', agent: agentRef },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
});

/**
 * jsdom has no real IntersectionObserver, and `useInfiniteScroll` rebuilds its observer on every
 * render — so the test fires the most recently connected instance.
 */
const observers: { callback: IntersectionObserverCallback; connected: boolean }[] = [];

class StubIntersectionObserver {
    root = null;

    rootMargin = '';

    thresholds: number[] = [];

    private record: { callback: IntersectionObserverCallback; connected: boolean };

    constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, connected: false };
        observers.push(this.record);
    }

    observe = () => {
        this.record.connected = true;
    };

    unobserve = () => {};

    disconnect = () => {
        this.record.connected = false;
    };

    takeRecords = () => [];
}

class StubResizeObserver {
    observe = () => {};

    unobserve = () => {};

    disconnect = () => {};
}

const requestedPages: string[] = [];

beforeEach(() => {
    clearManualRunWindow();
    observers.length = 0;
    requestedPages.length = 0;
    vi.stubGlobal('IntersectionObserver', StubIntersectionObserver);
    vi.stubGlobal('ResizeObserver', StubResizeObserver);

    server.use(
        // The rows carry the unread chip's mark-read flow, so the unread feed is fetched alongside them.
        http.get(apiUrl('/routines/runs'), () => Response.json({ success: true, value: rawPaged([]) })),
        http.put(apiUrl('/routines/runs/read'), () => Response.json({ success: true, value: { marked: 1 } })),
        http.get(apiUrl('/routines/routine-1/runs'), ({ request }) => {
            const page = new URL(request.url).searchParams.get('page') ?? '0';

            requestedPages.push(page);

            return Response.json({
                success: true,
                value: rawPaged([run(`run-page-${page}`)], { page: Number(page), totalPages: 2, totalCount: 2 }),
            });
        }),
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('RoutineRunsBody', () => {
    it('loads the next page of runs from Show more', async () => {
        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        await screen.findByText(/Scheduled/);
        expect(requestedPages).toEqual(['0']);

        await userEvent.click(screen.getByRole('button', { name: 'Show more' }));

        await waitFor(() => expect(requestedPages).toEqual(['0', '1']));
        await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2));
    });

    it('makes a completed run row a link to its report and closes the dialog behind it', async () => {
        const onClose = vi.fn();

        renderWithProviders(
            <Routes>
                <Route path="/" element={<RoutineRunsBody routine={routine} onClose={onClose} />} />
                <Route path="/agent/research/chat/:conversationId" element={<div>report conversation</div>} />
            </Routes>,
        );

        const link = await screen.findByRole('link', { name: /Scheduled/ });

        expect(link).toHaveAttribute('href', '/agent/research/chat/conv-run-page-0');

        await userEvent.click(link);

        expect(await screen.findByText('report conversation')).toBeInTheDocument();
        expect(onClose).toHaveBeenCalled();
    });

    it('leaves a run with no report inert', async () => {
        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () =>
                Response.json({
                    success: true,
                    value: rawPaged(
                        [{ ...run('run-failed'), status: 'failed', conversationId: null, error: 'Model timed out' }],
                        { page: 0, totalPages: 1, totalCount: 1 },
                    ),
                }),
            ),
        );

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByText('Run failed — Model timed out')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /View report/ })).not.toBeInTheDocument();
    });
    it('shows a blocked run as needing a reconnect, never as a success', async () => {
        // statusIcon and runNote are if-chains with a success fallthrough, so a status without an
        // arm of its own renders as a green tick with no note — worse than an unknown status.
        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () =>
                Response.json({
                    success: true,
                    value: rawPaged(
                        [
                            {
                                ...run('run-blocked'),
                                status: 'needs_reconnect',
                                conversationId: null,
                                error: 'The "Microsoft 365" connector needs reconnecting before this routine can run.',
                            },
                        ],
                        { page: 0, totalPages: 1, totalCount: 1 },
                    ),
                }),
            ),
        );

        const { container } = renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByText(/Microsoft 365/)).toBeInTheDocument();
        expect(screen.queryByText(/Run failed/)).not.toBeInTheDocument();

        // The note alone does not pin this: statusIcon and statusTone are if-chains falling through to
        // success, so without their own arms the row keeps its reason AND wears the green tick. Pin the
        // glyph and the tone, or deleting the arm leaves both assertions above still passing.
        const icon = container.querySelector('.lucide-plug-zap');

        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('text-text-secondary');
        expect(container.querySelector('.lucide-circle-check-big')).not.toBeInTheDocument();
        expect(icon).not.toHaveClass('text-success');
        // The row's only status text, since the icon is aria-hidden — and never the raw enum.
        expect(screen.getByText('Needs reconnect:')).toBeInTheDocument();
    });
    it('keeps a blocked run in the list even with no reason from the api', async () => {
        // The zod enum has to know the status or parsePage drops the row entirely.
        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () =>
                Response.json({
                    success: true,
                    value: rawPaged(
                        [{ ...run('run-bare'), status: 'needs_reconnect', conversationId: null, error: '' }],
                        { page: 0, totalPages: 1, totalCount: 1 },
                    ),
                }),
            ),
        );

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByText(/A connector needs reconnecting/)).toBeInTheDocument();
    });
    it('names the run when the api gives no reason at all', async () => {
        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () =>
                Response.json({
                    success: true,
                    value: rawPaged([{ ...run('run-blank'), status: 'failed', conversationId: null, error: '' }], {
                        page: 0,
                        totalPages: 1,
                        totalCount: 1,
                    }),
                }),
            ),
        );

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByText(/could not determine the cause/)).toBeInTheDocument();
        expect(screen.getByText(/run-blank/)).toBeInTheDocument();
    });

    it('opens a failed run so what went wrong can be read in its conversation', async () => {
        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () =>
                Response.json({
                    success: true,
                    value: rawPaged([{ ...run('run-failed'), status: 'failed', error: 'Model timed out' }], {
                        page: 0,
                        totalPages: 1,
                        totalCount: 1,
                    }),
                }),
            ),
        );

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        const link = await screen.findByRole('link', { name: /Run failed/ });

        expect(link).toHaveAttribute('href', '/agent/research/chat/conv-run-failed');
    });

    it('runs again without following the row it sits in', async () => {
        const runNowCalls: string[] = [];

        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () =>
                Response.json({
                    success: true,
                    value: rawPaged([{ ...run('run-failed'), status: 'failed', error: 'Model timed out' }], {
                        page: 0,
                        totalPages: 1,
                        totalCount: 1,
                    }),
                }),
            ),
            http.post(apiUrl('/routines/routine-1/run'), () => {
                runNowCalls.push('run');

                return Response.json({ success: true, value: { runId: 'run-new' } });
            }),
        );

        renderWithProviders(
            <Routes>
                <Route path="/" element={<RoutineRunsBody routine={routine} onClose={() => {}} />} />
                <Route path="/agent/research/chat/:conversationId" element={<div>report conversation</div>} />
            </Routes>,
        );

        await userEvent.click(await screen.findByRole('button', { name: 'Run again' }));

        await waitFor(() => expect(runNowCalls).toEqual(['run']));
        // The button lives inside the row's link, so an unguarded click would navigate as well.
        expect(await screen.findByRole('button', { name: 'Run again' })).toBeInTheDocument();
        expect(screen.queryByText('report conversation')).not.toBeInTheDocument();
    });

    it('leaves a skipped run inert: it never started, so there is nothing to open', async () => {
        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () =>
                Response.json({
                    success: true,
                    value: rawPaged([{ ...run('run-skipped'), status: 'skipped', error: 'the previous run' }], {
                        page: 0,
                        totalPages: 1,
                        totalCount: 1,
                    }),
                }),
            ),
        );

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByText(/the previous run/)).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
    it('opens a run that is still going, so its answer can be watched as it streams', async () => {
        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () =>
                Response.json({
                    success: true,
                    value: rawPaged([{ ...run('run-live'), status: 'running', finishedAt: null }], {
                        page: 0,
                        totalPages: 1,
                        totalCount: 1,
                    }),
                }),
            ),
        );

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        const link = await screen.findByRole('link', { name: /Running now/ });

        expect(link).toHaveAttribute('href', '/agent/research/chat/conv-run-live');
    });

    const failedRun = (overrides: Record<string, unknown>) =>
        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () =>
                Response.json({
                    success: true,
                    value: rawPaged([{ ...run('run-coded'), status: 'failed', conversationId: null, ...overrides }], {
                        page: 0,
                        totalPages: 1,
                        totalCount: 1,
                    }),
                }),
            ),
        );

    it('marks a connector reconnect with a warning glyph, never a button, naming the connector the context names', async () => {
        failedRun({
            status: 'needs_reconnect',
            error: 'The "Microsoft 365" connector needs reconnecting before this routine can run.',
            errorCode: 'CONNECTOR_REAUTH_REQUIRED',
            errorContext: { connectorId: 'connector-1', connectorName: 'Microsoft 365' },
        });

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByRole('img', { name: 'Reconnect Microsoft 365' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Reconnect/ })).not.toBeInTheDocument();
    });

    // A failure re-classified from its stored sentence carries no connector name at all.
    it('names the indicator "Open connectors" when the context carries no name', async () => {
        failedRun({
            status: 'needs_reconnect',
            errorCode: 'CONNECTOR_REAUTH_REQUIRED',
            errorContext: { connectorId: 'connector-1' },
        });

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByRole('img', { name: 'Open connectors' })).toBeInTheDocument();
    });

    it('labels the reconnect glyph from the context and never from the reason', async () => {
        failedRun({
            status: 'needs_reconnect',
            error: 'The "Slack" connector needs reconnecting before this routine can run.',
            errorCode: 'CONNECTOR_REAUTH_REQUIRED',
            errorContext: { connectorName: 'Microsoft 365' },
        });

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByRole('img', { name: 'Reconnect Microsoft 365' })).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: /Slack/ })).not.toBeInTheDocument();
    });

    // Going forward the ai image never writes 'failed' for a reconnect issue, only 'needs_reconnect' -
    // a 'failed' row carrying the connector code predates that split and gets no glyph, errors or not.
    it('wears no reconnect glyph on a "failed" row, even one carrying the connector code', async () => {
        failedRun({
            error: 'The "Microsoft 365" connector needs reconnecting before this routine can run.',
            errorCode: 'CONNECTOR_REAUTH_REQUIRED',
            errorContext: { connectorId: 'connector-1', connectorName: 'Microsoft 365' },
        });

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByText(/Run failed — The "Microsoft 365"/)).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: /Reconnect|Open connectors/ })).not.toBeInTheDocument();
    });

    it('opens the routine editor for a failure whose fix is a field on the routine', async () => {
        const onEditRoutine = vi.fn();

        failedRun({ error: 'Pick a different model.', errorCode: 'MODEL_INCAPABLE' });

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} onEditRoutine={onEditRoutine} />);

        await userEvent.click(await screen.findByRole('button', { name: 'Choose a model' }));

        expect(onEditRoutine).toHaveBeenCalledTimes(1);
    });

    it('drops the editor action where the list cannot open the routine', async () => {
        failedRun({ error: 'Pick a different model.', errorCode: 'MODEL_INCAPABLE' });

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByText(/Pick a different model/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Choose a model' })).not.toBeInTheDocument();
    });

    it('shows no action for a failure nothing can be done about', async () => {
        failedRun({ error: 'Something went wrong.', errorCode: 'UNKNOWN' });

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Reconnect|Choose|Check|Edit the/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Run again' })).toBeInTheDocument();
    });

    // 28 runs on dev predate the columns, so absence is the common case, not the edge one.
    it('shows no action for a run recorded before the failure columns existed', async () => {
        failedRun({ error: 'Deep research run failed.' });

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByText(/Deep research run failed/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Reconnect|Choose|Check|Edit the/ })).not.toBeInTheDocument();
    });

    // ai ships a class ahead of app, and the schema parses z.string() so the row still arrives.
    it('renders a run carrying a code this build has never seen', async () => {
        failedRun({ error: 'A newer failure class.', errorCode: 'A_CLASS_FROM_A_LATER_RELEASE' });

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        expect(await screen.findByText(/A newer failure class/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Reconnect|Choose|Check|Edit the/ })).not.toBeInTheDocument();
    });

    // A 'failed' row is an ordinary failure now, glyph or not, so its own report link is untouched.
    it('leaves the row its own report link on a "failed" run naming a connector', async () => {
        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () =>
                Response.json({
                    success: true,
                    value: rawPaged(
                        [
                            {
                                ...run('run-linked'),
                                status: 'failed',
                                error: 'Reconnect it.',
                                errorCode: 'CONNECTOR_REAUTH_REQUIRED',
                                errorContext: { connectorId: 'connector-1', connectorName: 'Microsoft 365' },
                            },
                        ],
                        { page: 0, totalPages: 1, totalCount: 1 },
                    ),
                }),
            ),
        );

        renderWithProviders(
            <Routes>
                <Route path="/" element={<RoutineRunsBody routine={routine} onClose={() => {}} />} />
                <Route path="/agent/research/chat/:conversationId" element={<p>run report</p>} />
            </Routes>,
        );

        expect(screen.queryByRole('img', { name: /Reconnect|Open connectors/ })).not.toBeInTheDocument();

        await userEvent.click(await screen.findByRole('link', { name: /Run failed/ }));

        expect(await screen.findByText('run report')).toBeInTheDocument();
    });

    it('says the history could not be loaded instead of claiming the filter found nothing', async () => {
        let calls = 0;

        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () => {
                calls += 1;

                return Response.json(
                    { success: false, message: 'status must be one of the allowed values' },
                    { status: 400 },
                );
            }),
        );

        renderWithProviders(<RoutineRunsBody routine={routine} statusFilter="needs_reconnect" onClose={() => {}} />);

        expect(await screen.findByText('This history could not be loaded')).toBeInTheDocument();
        // The empty state asserts the routine HAS other runs, which a rejected query cannot know.
        expect(screen.queryByText(/switch the filter back to All runs/)).not.toBeInTheDocument();
        expect(screen.queryByText(/No runs under/)).not.toBeInTheDocument();

        const before = calls;

        await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

        await waitFor(() => {
            expect(calls).toBeGreaterThan(before);
        });
    });

    it('keeps rows on screen when a later fetch fails instead of replacing them with the error', async () => {
        let calls = 0;

        server.use(
            http.get(apiUrl('/routines/routine-1/runs'), () => {
                calls += 1;

                if (calls === 1) {
                    return Response.json({
                        success: true,
                        value: rawPaged([{ ...run('run-ok'), status: 'completed' }], {
                            page: 0,
                            totalPages: 2,
                            totalCount: 2,
                        }),
                    });
                }

                return Response.json({ success: false, message: 'gateway timeout' }, { status: 504 });
            }),
        );

        renderWithProviders(<RoutineRunsBody routine={routine} onClose={() => {}} />);

        const row = await screen.findByRole('link', { name: /Completed:/ });

        await userEvent.click(screen.getByRole('button', { name: /Show more/ }));

        // react-query keeps the last good pages on error, so the error state must not evict them —
        // but the page that did not arrive still has to be said out loud somewhere.
        await waitFor(() => {
            expect(calls).toBeGreaterThan(1);
        });
        expect(row).toBeInTheDocument();
        expect(screen.queryByText('This history could not be loaded')).not.toBeInTheDocument();
        expect(await screen.findByText(/More runs could not be loaded/)).toBeInTheDocument();
    });
});
