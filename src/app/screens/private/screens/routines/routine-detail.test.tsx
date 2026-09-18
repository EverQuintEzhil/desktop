import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';
import { apiUrl, envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import RoutineDetail from './routine-detail';

// sonner's action button calls setPointerCapture, which jsdom does not implement: without this the
// throw escapes as an unhandled error and the run exits 1 with every assertion still passing.
installPointerCaptureShims();

const agent = { _id: 'agent-1', name: 'Research', slug: 'research' };

const routine = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    _id: 'routine-1',
    agentId: 'agent-1',
    name: 'Weekly competitor scan',
    prompt: 'Track announcements from our top five competitors',
    cron: '0 9 * * 1',
    // The viewer's own zone: schedule lines only carry a zone tag when the two differ.
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    runOnce: false,
    status: 'active',
    lastRunAt: null,
    agent,
    project: { _id: 'space-1', name: 'Market intel' },
    model: { _id: 'model-1', label: 'GPT 5.4 mini', model: 'gpt-5.4-mini' },
    emailOnRun: true,
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
    startedAt: '2026-08-20T09:00:00.000Z',
    finishedAt: '2026-08-20T09:04:00.000Z',
    isRead: true,
    createdAt: '2026-08-20T09:00:00.000Z',
    updatedAt: '2026-08-20T09:04:00.000Z',
    ...overrides,
});

const stub = (row: Record<string, unknown> | null, runs: Record<string, unknown>[] = []) => {
    server.use(
        respond('get', '/routines/routine-1', () => (row ? envelope(row) : httpError(404, 'Routine not found'))),
        respond('get', '/routines/routine-1/runs', () => pagedEnvelope(runs)),
        respond('get', '/routines/runs', () => pagedEnvelope([])),
        respond('get', '/routines/routine-1/triggers', () => envelope({ values: [] })),
        respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
        respond('get', '/routines/connector-health', () => envelope({ connectors: [] })),
        respond('get', '/agents/agent-1', () =>
            envelope({
                _id: 'agent-1',
                name: 'Research',
                defaultModelId: 'model-1',
                models: [{ _id: 'model-1', label: 'GPT 5.4 mini' }],
            }),
        ),
    );
};

const stubAgentConnectors = (mcpServers: Record<string, unknown>[]) => {
    server.use(
        respond('get', '/agents/agent-1', () =>
            envelope({
                _id: 'agent-1',
                name: 'Research',
                defaultModelId: 'model-1',
                models: [{ _id: 'model-1', label: 'GPT 5.4 mini' }],
                mcpServers,
            }),
        ),
    );
};

const renderPage = () =>
    renderWithProviders(
        <>
            <Toaster />
            <Routes>
                <Route path="/agent/research/routines" element={<div>routines list</div>} />
                <Route path="/settings/connectors" element={<div>connectors page</div>} />
                <Route path="/agent/research/routines/:routineId" element={<RoutineDetail agent={agent} />} />
            </Routes>
        </>,
        { route: '/agent/research/routines/routine-1' },
    );

describe('Routine detail page', () => {
    it('shows the name, status, schedule, instructions and run history', async () => {
        stub(routine(), [run()]);

        renderPage();

        expect(await screen.findByRole('heading', { name: 'Weekly competitor scan' })).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Mon at 9:00 AM')).toBeInTheDocument();
        expect(screen.getByText('Track announcements from our top five competitors')).toBeInTheDocument();
        expect(screen.getByText('Market intel')).toBeInTheDocument();
        expect(screen.getByText('GPT 5.4 mini')).toBeInTheDocument();
        expect(await screen.findByRole('link', { name: /Scheduled/ })).toHaveAttribute(
            'href',
            '/agent/research/chat/conv-1',
        );
    });

    it('omits the Repeats row rather than printing "Not set"', async () => {
        stub(routine({ cron: null, runOnce: false }), []);

        renderPage();

        await screen.findByRole('heading', { name: 'Weekly competitor scan' });

        expect(screen.queryByText('Repeats')).not.toBeInTheDocument();
        expect(screen.queryByText('Not set')).not.toBeInTheDocument();
    });

    it('bounds a long prompt in its own scrolling Instructions card', async () => {
        const longPrompt = Array.from({ length: 12 }, (_, index) => `Paragraph ${index} of the research brief.`).join(
            '\n\n',
        );

        stub(routine({ prompt: longPrompt }), []);

        renderPage();

        // One text block now, not a paragraph per line, so match inside it rather than on it.
        await screen.findByText(/Paragraph 0 of the research brief\./);

        const body = document.querySelector('.routine-instructions-card-content-text') as HTMLElement;

        expect(body).toHaveClass('lg:max-h-48');
        expect(body).toHaveClass('scrollbar-vertical');
        expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument();
    });

    it('renders a mentioned connector as a chip rather than the directive it is stored as', async () => {
        stub(routine({ prompt: ':mcp[Microsoft%20365%20(EQ)] use this connector' }), []);
        // The chip resolves against the agent's own connectors, so the suggestion has to be there for
        // the favicon to prove the wiring rather than just the parser.
        stubAgentConnectors([{ _id: 'mcp-1', name: 'Microsoft 365 (EQ)', serverUrl: 'https://mcp.example.com' }]);

        renderPage();

        expect(await screen.findByText('Microsoft 365 (EQ)')).toBeInTheDocument();
        expect(screen.queryByText(/:mcp\[/)).not.toBeInTheDocument();

        const card = document.querySelector('.routine-instructions-card-content-text') as HTMLElement;

        await waitFor(() => expect(card.querySelector('img')).toBeInTheDocument());
        // A read-only record of the routine, so the chip offers no hover of its own — and with none,
        // there is nowhere left for the stored token to reach a reader either.
        expect(card.querySelector('[title]')).not.toBeInTheDocument();
    });

    it('says so plainly when a routine has no instructions', async () => {
        stub(routine({ prompt: '' }), []);

        renderPage();

        expect(await screen.findByText('No instructions for this routine')).toBeInTheDocument();
    });

    it('shows a spinner until the routine lands', async () => {
        stub(routine());
        server.use(respond('get', '/routines/routine-1', async () => (await delay(50), envelope(routine()))));

        renderPage();

        expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'Weekly competitor scan' })).toBeInTheDocument();
    });

    it('links the back pill to the list', async () => {
        stub(routine());

        renderPage();

        await userEvent.click(await screen.findByRole('link', { name: 'All routines' }));

        expect(await screen.findByText('routines list')).toBeInTheDocument();
    });

    it('fires the routine from Run now', async () => {
        stub(routine());
        const runNow = vi.fn(() => envelope({ started: true }));

        server.use(http.post(apiUrl('/routines/routine-1/run'), runNow));

        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: 'Run now' }));

        await waitFor(() => expect(runNow).toHaveBeenCalled());
    });

    it('names the connector that refused a Run now, and offers a way to reach it', async () => {
        const refusal = '"Microsoft 365 (PW)" needs reconnecting before this routine can run.';

        stub(routine());
        server.use(
            http.post(apiUrl('/routines/routine-1/run'), () =>
                // 424 with the api's own code: a refusal, not a failure. Nothing ran.
                HttpResponse.json({ success: false, code: 'MCP_REAUTH_REQUIRED', message: refusal }, { status: 424 }),
            ),
        );

        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: 'Run now' }));

        expect(await screen.findByText(refusal)).toBeInTheDocument();
        // Never the generic string: the whole point is that this one is fixable.
        expect(screen.queryByText('Failed to start the run.')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Open connectors' }));

        expect(await screen.findByText('connectors page')).toBeInTheDocument();
    });

    it('still shows a plain failure as a failure, with no connector action', async () => {
        stub(routine());
        server.use(http.post(apiUrl('/routines/routine-1/run'), () => httpError(500, 'The service is down.')));

        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: 'Run now' }));

        expect(await screen.findByText('The service is down.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Open connectors' })).not.toBeInTheDocument();
    });

    it('opens the edit form from the instructions card', async () => {
        stub(routine());
        // The edit form's recipient picker resolves the pre-filled owner from the viewer.
        server.use(respond('get', '/users/me', () => envelope({ _id: 'owner-1', email: 'ada@ex.com' })));

        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: 'Edit instructions' }));

        expect(await screen.findByRole('heading', { name: 'Edit routine' })).toBeInTheDocument();
    });

    it('offers the same row actions as the list, minus the ones the page already shows', async () => {
        stub(routine());

        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: 'More actions' }));

        const menu = await screen.findByRole('menu');

        expect(within(menu).getByRole('menuitem', { name: 'Pause' })).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', { name: 'Pin' })).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', { name: 'Archive' })).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', { name: 'Delete routine' })).toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', { name: /Run now/ })).not.toBeInTheDocument();
    });

    it('offers only Unarchive on an archived routine', async () => {
        stub(routine({ archivedAt: '2026-08-26T10:00:00.000Z', status: 'paused' }));

        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: 'More actions' }));

        const menu = await screen.findByRole('menu');

        expect(within(menu).getByRole('menuitem', { name: 'Unarchive' })).toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', { name: 'Pause' })).not.toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', { name: 'Pin' })).not.toBeInTheDocument();
    });

    it('hides Run now on an archived routine, which the api refuses to fire', async () => {
        stub(routine({ archivedAt: '2026-08-26T10:00:00.000Z', status: 'paused' }));

        renderPage();

        await screen.findByRole('button', { name: 'More actions' });

        expect(screen.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument();
    });

    it('deletes the routine and returns to the list', async () => {
        stub(routine());
        server.use(http.delete(apiUrl('/routines/routine-1'), () => envelope({ _id: 'routine-1' })));

        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: 'More actions' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete routine' }));
        await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('routines list')).toBeInTheDocument();
    });

    it('says so instead of rendering an empty shell when the routine does not exist', async () => {
        stub(null);

        renderPage();

        expect(await screen.findByRole('heading', { name: 'Routine not found' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument();
    });

    it("says so when the routine is not the caller's to see", async () => {
        server.use(respond('get', '/routines/routine-1', () => httpError(403, 'Forbidden!')));

        renderPage();

        expect(await screen.findByRole('heading', { name: 'Routine not found' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to routines' })).toBeInTheDocument();
    });
    it('refuses a routine that belongs to another agent on an agent-scoped route', async () => {
        stub(routine({ agentId: 'agent-2' }));

        renderPage();

        expect(await screen.findByRole('heading', { name: 'Routine not found' })).toBeInTheDocument();
    });
    it('carries the list url state on the back link', async () => {
        stub(routine());

        renderWithProviders(
            <Routes>
                <Route path="/agent/research/routines/:routineId" element={<RoutineDetail agent={agent} />} />
            </Routes>,
            { route: '/agent/research/routines/routine-1?agentId=agent-1&view=archived' },
        );

        const back = await screen.findByRole('link', { name: /All routines/ });

        expect(back).toHaveAttribute('href', '/agent/research/routines?agentId=agent-1&view=archived');
    });

    it('does not blame permissions for a server failure', async () => {
        server.use(
            respond('get', '/routines/routine-1', () => httpError(500, 'boom')),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
        );

        renderPage();

        expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
        expect(screen.queryByText(/may not have access/)).not.toBeInTheDocument();
    });
    it('reads a 200 envelope failure as not-found, not as a crash', async () => {
        server.use(
            respond('get', '/routines/routine-1', () =>
                HttpResponse.json({ success: false, message: 'Routine not accessible' }),
            ),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
        );

        renderPage();

        expect(await screen.findByRole('heading', { name: 'Routine not found' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Something went wrong' })).not.toBeInTheDocument();
    });
});
