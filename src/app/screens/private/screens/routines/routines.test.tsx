import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearManualRunWindow } from '@/lib/api/app/routines';
import { apiUrl, envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import Routines from './routines';

const agentRef = { _id: 'agent-1', name: 'Research', slug: 'research' };
const otherAgentRef = { _id: 'agent-2', name: 'Marketing', slug: 'marketing' };

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
    agent: agentRef,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    ...overrides,
});

const stub = (routines: Record<string, unknown>[], runs: Record<string, unknown>[] = []) => {
    server.use(
        // `search` is a server parameter, so the handler has to answer it or the screen looks unfiltered.
        http.get(apiUrl('/routines'), ({ request }) => {
            const term = (new URL(request.url).searchParams.get('search') ?? '').toLowerCase();
            const matches = (row: Record<string, unknown>) =>
                !term ||
                String(row.name ?? '')
                    .toLowerCase()
                    .includes(term);

            return pagedEnvelope(routines.filter(matches));
        }),
        respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
        respond('get', '/routines/runs', () => pagedEnvelope(runs)),
        respond('get', '/routines/connector-health', () => envelope({ connectors: [] })),
        respond('get', '/agents', () => pagedEnvelope([{ _id: 'agent-1', name: 'Research' }])),
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

type Row = Record<string, unknown>;

/**
 * `GET /routines` serves the live and the archived view from the same path, so the handler has to
 * read the `archived` param, and pin/archive have to mutate the store the next fetch reads.
 */
const stubStore = (initial: Row[]) => {
    let rows = initial;

    const byId = (id: string): Row => rows.find((row) => row._id === id) as Row;

    const patch = (id: string, changes: Row) => {
        rows = rows.map((row) => (row._id === id ? { ...row, ...changes } : row));

        return envelope(byId(id));
    };

    server.use(
        http.get(apiUrl('/routines'), ({ request }) => {
            const params = new URL(request.url).searchParams;
            const wantsArchived = params.get('archived') === 'true';
            const term = (params.get('search') ?? '').toLowerCase();

            return pagedEnvelope(
                rows.filter(
                    (row) =>
                        Boolean(row.archivedAt) === wantsArchived &&
                        (!term ||
                            String(row.name ?? '')
                                .toLowerCase()
                                .includes(term)),
                ),
            );
        }),
        respond('get', '/routines/runs', () => pagedEnvelope([])),
        respond('get', '/agents', () => pagedEnvelope([{ _id: 'agent-1', name: 'Research' }])),
        http.put(apiUrl('/routines/:id/pin'), ({ params }) => {
            const id = params.id as string;

            return patch(id, { pinnedAt: byId(id).pinnedAt ? null : '2026-08-26T10:00:00.000Z' });
        }),
        http.post(apiUrl('/routines/:id/archive'), ({ params }) =>
            patch(params.id as string, { archivedAt: '2026-08-26T10:00:00.000Z', status: 'paused' }),
        ),
        http.post(apiUrl('/routines/:id/unarchive'), ({ params }) => patch(params.id as string, { archivedAt: null })),
    );
};

const renderRoutable = () =>
    renderWithProviders(
        <Routes>
            <Route path="/settings/routines" element={<Routines />} />
            <Route path="/settings/routines/:routineId" element={<div>settings routine page</div>} />
            <Route path="/agent/:slug/routines/:routineId" element={<div>routine page</div>} />
        </Routes>,
        { route: '/settings/routines' },
    );

const renderAgentScoped = (route: string) =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/research/routines" element={<Routines agent={agentRef} />} />
            <Route path="/settings/routines/:routineId" element={<div>settings routine page</div>} />
            <Route path="/agent/:slug/routines/:routineId" element={<div>routine page</div>} />
        </Routes>,
        { route },
    );

/** MemoryRouter keeps the location off `window`, so the search string has to be read from the router. */
const LocationProbe = () => {
    const { search } = useLocation();

    return <div data-testid="location-search">{search}</div>;
};

/** Archived routines live behind their own view, reached from the link under the list. */
const openArchived = async () => {
    await userEvent.click(await screen.findByRole('button', { name: /View archived/ }));
};

const leaveArchived = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Routines' }));
};

const openRowMenu = async (name: string) => {
    await userEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }));

    return screen.findByRole('menu');
};

describe('Routines screen', () => {
    // The manual-run fast-poll window is module state; without this a run in one test speeds up the next.
    beforeEach(clearManualRunWindow);

    it('surfaces a load failure instead of the empty state', async () => {
        server.use(
            respond('get', '/routines', () => httpError(500, 'Routines are unavailable right now.')),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/agents', () => pagedEnvelope([])),
        );

        renderWithProviders(<Routines />);

        expect(await screen.findByText('Routines are unavailable right now.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
        expect(screen.queryByText(/No routines yet/)).not.toBeInTheDocument();
    });

    // A Space card row links here with its id attached, so this list has to widen to the whole Space —
    // otherwise a teammate's routine is missing from the page its own row opened.
    it('lists the whole space, other members included, when opened from a space row', async () => {
        const searches: string[] = [];

        server.use(
            http.get(apiUrl('/routines'), ({ request }) => {
                searches.push(new URL(request.url).search);

                return pagedEnvelope([
                    routine({
                        _id: 'routine-2',
                        agentId: 'agent-2',
                        name: 'Teammate scan',
                        agent: otherAgentRef,
                        projectId: 'project-1',
                        project: { _id: 'project-1', name: 'Atlas' },
                    }),
                ]);
            }),
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
        );

        renderWithProviders(<Routines agent={agentRef} />, { route: '/agent/research/routines?projectId=project-1' });

        expect(await screen.findByText('Teammate scan')).toBeInTheDocument();
        expect(screen.getByText(/Every routine reporting into Atlas/)).toBeInTheDocument();
        expect(searches[0]).toContain('projectId=project-1');
    });

    // A space's rows can come from several agents, so two routines of one name are told apart by that column.
    it('names the agent of every row in a space-scoped list', async () => {
        stub([routine(), routine({ _id: 'routine-2', agentId: 'agent-2', agent: otherAgentRef })]);

        renderWithProviders(<Routines agent={agentRef} />, { route: '/agent/research/routines?projectId=project-1' });

        expect(await screen.findByRole('columnheader', { name: 'Agent' })).toBeInTheDocument();
        expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    it('prefixes the title with the agent an agent-scoped list belongs to', async () => {
        stub([routine()]);

        renderWithProviders(<Routines agent={agentRef} />);

        expect(await screen.findByRole('link', { name: 'Agent: Research' })).toHaveAttribute('href', '/agent/research');
    });

    it('leaves the agent prefix off the unscoped settings list', async () => {
        stub([routine()]);

        renderWithProviders(<Routines />);

        expect(await screen.findByRole('heading', { name: 'Routines' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /^Agent: / })).not.toBeInTheDocument();
    });

    it('leaves the agent column out of a plain agent-scoped list', async () => {
        stub([routine()]);

        renderWithProviders(<Routines agent={agentRef} />);

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
        expect(screen.queryByRole('columnheader', { name: 'Agent' })).not.toBeInTheDocument();
    });

    it('shows the empty state when the list is genuinely empty', async () => {
        stub([]);

        renderWithProviders(<Routines />);

        expect(await screen.findByText(/No routines yet/)).toBeInTheDocument();
    });

    it('gives the schedule, the next run, the last run and the status a column each, with created under the name', async () => {
        stub([routine()]);

        renderWithProviders(<Routines />);

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Schedule' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Next run' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Last run' })).toBeInTheDocument();
        // Created rides under the routine name: the agent page caps this table's width.
        expect(screen.queryByRole('columnheader', { name: 'Created' })).not.toBeInTheDocument();
        expect(within(screen.getByRole('table')).getByText(/Created Aug/)).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: 'Mon at 9:00 AM' })).toBeInTheDocument();
        expect(within(screen.getByRole('table')).getByText('Active')).toBeInTheDocument();
    });

    it('shows an em dash in the next run column for a paused routine', async () => {
        stub([routine({ status: 'paused' })]);

        renderWithProviders(<Routines />);

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();

        const table = screen.getByRole('table');
        const headers = within(table)
            .getAllByRole('columnheader')
            .map((header) => header.textContent);
        const cells = within(table).getAllByRole('row')[1].querySelectorAll('td');

        // Named by column rather than counted, so a future column that also reads as a dash cannot break this.
        expect(cells[headers.indexOf('Next run')]).toHaveTextContent('—');
        expect(cells[headers.indexOf('Last run')]).toHaveTextContent('—');
        expect(within(table).getByText('Paused')).toBeInTheDocument();
    });

    it('marks a spent one-shot as done', async () => {
        stub([routine({ runOnce: true, runAt: '2026-08-22T10:00', lastRunAt: '2026-08-22T10:05:00.000Z' })]);

        renderWithProviders(<Routines />);

        expect(await screen.findByText('Done')).toBeInTheDocument();
    });

    it('shows the agent column only when not scoped to one agent', async () => {
        stub([routine()]);

        const { unmount } = renderWithProviders(<Routines />);

        expect(await screen.findByRole('columnheader', { name: 'Agent' })).toBeInTheDocument();
        unmount();

        stub([routine()]);
        renderWithProviders(<Routines agent={{ _id: 'agent-1', name: 'Research' }} />);

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
        expect(screen.queryByRole('columnheader', { name: 'Agent' })).not.toBeInTheDocument();
    });

    it('asks the api for one agent when scoped, rather than filtering a shared page', async () => {
        const rows = [
            routine(),
            routine({ _id: 'routine-2', agentId: 'agent-2', name: 'Brand watch', agent: otherAgentRef }),
        ];

        server.use(
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/agents', () => pagedEnvelope([])),
            http.get(apiUrl('/routines'), ({ request }) => {
                const agentId = new URL(request.url).searchParams.get('agentId');

                return pagedEnvelope(agentId ? rows.filter((row) => row.agentId === agentId) : rows);
            }),
        );

        renderWithProviders(<Routines agent={{ _id: 'agent-1', name: 'Research' }} />);

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
        expect(screen.queryByText('Brand watch')).not.toBeInTheDocument();
    });

    it('filters the list by the search term', async () => {
        stub([routine(), routine({ _id: 'routine-2', name: 'Supplier risk digest' })]);

        renderWithProviders(<Routines />);

        expect(await screen.findByText('Supplier risk digest')).toBeInTheDocument();

        await userEvent.type(screen.getByPlaceholderText('Search routines'), 'supplier');

        await waitFor(() => {
            expect(screen.queryByText('Weekly competitor scan')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Supplier risk digest')).toBeInTheDocument();
    });

    it('drops the agent field in the form when the page is scoped', async () => {
        stub([]);

        renderWithProviders(<Routines agent={{ _id: 'agent-1', name: 'Research' }} />);

        await userEvent.click(await screen.findByRole('button', { name: /New routine/ }));

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.queryByText('Select an agent...')).not.toBeInTheDocument();
    });

    it('shows a relative hint when the next run is within a day', async () => {
        stub([routine({ cron: '0 * * * *' })]);

        renderWithProviders(<Routines />);

        await screen.findByText('Weekly competitor scan');

        expect(screen.getByRole('cell', { name: /in (\d+s|1min|\d+ min|\d+ hours?)/ })).toBeInTheDocument();
    });

    it('keeps the settings list on its own detail route, which every agent has', async () => {
        stub([routine()]);

        renderRoutable();

        await userEvent.click(await screen.findByRole('button', { name: 'Open Weekly competitor scan' }));

        expect(await screen.findByText('settings routine page')).toBeInTheDocument();
    });

    it('opens the agent detail route from an agent-scoped list', async () => {
        stub([routine()]);

        renderAgentScoped('/agent/research/routines');

        await userEvent.click(await screen.findByRole('button', { name: 'Open Weekly competitor scan' }));

        expect(await screen.findByText('routine page')).toBeInTheDocument();
    });

    it("never opens another agent's routine under the current agent", async () => {
        stub([routine({ _id: 'routine-9', name: 'Marketing sweep', agentId: 'agent-2', agent: null })]);

        renderAgentScoped('/agent/research/routines?projectId=space-1');

        expect(await screen.findByText('Marketing sweep')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Open Marketing sweep' })).not.toBeInTheDocument();
        expect(screen.queryByText('routine page')).not.toBeInTheDocument();
    });

    it('keeps every row a table row, cells and all', async () => {
        stub([routine()]);

        renderRoutable();

        await screen.findByText('Weekly competitor scan');

        const rows = screen.getAllByRole('row');

        expect(rows).toHaveLength(2);
        expect(within(rows[1]).getAllByRole('cell').length).toBeGreaterThan(3);
    });

    it('does not open the routine when a click dismisses its row menu', async () => {
        stub([routine()]);

        renderRoutable();

        await openRowMenu('Weekly competitor scan');
        await userEvent.click(screen.getByRole('button', { name: 'Open Weekly competitor scan' }));

        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
        expect(screen.queryByText('settings routine page')).not.toBeInTheDocument();
        expect(screen.queryByText('routine page')).not.toBeInTheDocument();
    });

    it('still opens a routine after a menu was dismissed onto a row that cannot be opened', async () => {
        stub([
            routine(),
            routine({ _id: 'routine-2', name: 'Marketing digest', agentId: 'agent-2', agent: otherAgentRef }),
        ]);

        renderAgentScoped('/agent/research/routines?projectId=space-1');

        await openRowMenu('Weekly competitor scan');
        // The foreign row has no click handler of its own, so it must not latch the guard for later rows.
        await userEvent.click(await screen.findByText('Marketing digest'));
        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

        await userEvent.click(screen.getByRole('button', { name: 'Open Weekly competitor scan' }));

        expect(await screen.findByText('routine page')).toBeInTheDocument();
    });

    it('explains what routines are from the heading info button', async () => {
        stub([routine()]);

        renderWithProviders(<Routines />);

        await userEvent.click(await screen.findByRole('button', { name: 'What are Routines?' }));

        expect(await screen.findByRole('heading', { name: 'What are Routines?' })).toBeInTheDocument();
        expect(screen.getByText(/run research for you on their own/)).toBeInTheDocument();
    });

    it('shows an em dash rather than "Not set" for a routine with no schedule', async () => {
        stub([routine({ cron: null, runOnce: false })]);

        renderWithProviders(<Routines />);

        await screen.findByText('Weekly competitor scan');

        expect(screen.queryByText('Not set')).not.toBeInTheDocument();
    });

    it('activates a row from the keyboard', async () => {
        stub([routine()]);

        renderRoutable();

        const row = await screen.findByRole('button', { name: 'Open Weekly competitor scan' });

        row.focus();
        await userEvent.keyboard('{Enter}');

        expect(await screen.findByText('settings routine page')).toBeInTheDocument();
    });

    it('does not navigate when the row action menu is opened', async () => {
        stub([routine()]);

        renderRoutable();

        await openRowMenu('Weekly competitor scan');

        expect(screen.queryByText('routine page')).not.toBeInTheDocument();
    });

    it('edits a routine from the row menu without leaving the list', async () => {
        stub([routine()]);
        server.use(respond('get', '/routines/routine-1/triggers', () => envelope({ values: [] })));

        renderWithProviders(<Routines />);

        await userEvent.click(
            within(await openRowMenu('Weekly competitor scan')).getByRole('menuitem', { name: 'Edit' }),
        );

        expect(await screen.findByRole('heading', { name: 'Edit routine' })).toBeInTheDocument();
    });

    it('renders a routine carrying neither pinnedAt nor archivedAt exactly as before', async () => {
        stub([routine()]);

        renderWithProviders(<Routines />);

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
        expect(within(screen.getByRole('table')).getByText('Active')).toBeInTheDocument();
        expect(screen.queryByLabelText('Unpin Weekly competitor scan')).not.toBeInTheDocument();

        const menu = await openRowMenu('Weekly competitor scan');

        expect(within(menu).getByRole('menuitem', { name: 'Pin' })).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', { name: 'Archive' })).toBeInTheDocument();
    });

    it('pins a routine and then unpins it from the same row action', async () => {
        stubStore([routine()]);

        renderWithProviders(<Routines />);

        await userEvent.click(
            within(await openRowMenu('Weekly competitor scan')).getByRole('menuitem', { name: 'Pin' }),
        );

        expect(await screen.findByLabelText('Unpin Weekly competitor scan')).toBeInTheDocument();

        await userEvent.click(
            within(await openRowMenu('Weekly competitor scan')).getByRole('menuitem', { name: 'Unpin' }),
        );

        await waitFor(() => {
            expect(screen.queryByLabelText('Unpin Weekly competitor scan')).not.toBeInTheDocument();
        });
    });

    it('renders the order the api returns instead of resorting the loaded pages', async () => {
        stub([
            routine({ _id: 'routine-2', name: 'Weekly competitor scan', pinnedAt: '2026-08-26T10:00:00.000Z' }),
            routine({ _id: 'routine-1', name: 'Hourly pulse', cron: '0 * * * *' }),
        ]);

        renderWithProviders(<Routines />);

        await screen.findByText('Hourly pulse');

        const rowNames = screen.getAllByRole('button', { name: /^Open / }).map((row) => row.textContent);

        expect(rowNames[0]).toContain('Weekly competitor scan');
        expect(rowNames[1]).toContain('Hourly pulse');
    });

    it('sorts on the server, so changing the sort refetches from the first page', async () => {
        // Two pages, and the alphabetically first routine lives on page 2 — a client-side sort over the
        // loaded pages alone could never surface it.
        const rows = Array.from({ length: 30 }, (_, index) =>
            routine({ _id: `routine-${index}`, name: `Routine ${String(90 - index).padStart(2, '0')}` }),
        );
        const sortParams: (string | null)[] = [];

        server.use(
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/agents', () => pagedEnvelope([])),
            http.get(apiUrl('/routines'), ({ request }) => {
                const url = new URL(request.url);
                const sortBy = url.searchParams.get('sortBy');

                sortParams.push(sortBy);

                const ordered =
                    sortBy === 'name:asc'
                        ? [...rows].sort((a, b) => (a.name as string).localeCompare(b.name as string))
                        : rows;
                const page = Number(url.searchParams.get('page') ?? 0);
                const size = Number(url.searchParams.get('size') ?? 20);

                return pagedEnvelope(ordered.slice(page * size, page * size + size), {
                    page,
                    totalPages: Math.ceil(ordered.length / size),
                    totalCount: ordered.length,
                });
            }),
        );

        renderWithProviders(<Routines />);

        await screen.findByText('Routine 90');
        expect(sortParams[0]).toBe('nextRunAt:asc');

        await userEvent.click(screen.getByRole('button', { name: /Sort by next run/ }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Sort by name' }));

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /^Open / })[0]).toHaveTextContent('Routine 61');
        });

        expect(sortParams).toContain('name:asc');
    });

    it('falls back to the default sort for a ?sort= value that is not an option', async () => {
        const sortParams: (string | null)[] = [];

        server.use(
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/agents', () => pagedEnvelope([])),
            http.get(apiUrl('/routines'), ({ request }) => {
                sortParams.push(new URL(request.url).searchParams.get('sortBy'));

                return pagedEnvelope([routine()]);
            }),
        );

        // `constructor` exists on every object's prototype chain, so a naive `in` check would accept it.
        renderWithProviders(<Routines />, { route: '/settings/routines?sort=constructor' });

        await screen.findByText('Weekly competitor scan');

        expect(sortParams[0]).toBe('nextRunAt:asc');
    });

    it('bounds the name column so a very long name cannot widen the table', async () => {
        stub([routine({ name: 'N'.repeat(170) })]);

        renderWithProviders(<Routines />);

        const name = await screen.findByText('N'.repeat(170));
        const nameCell = name.closest('td') as HTMLElement;

        // `w-full` alone lets an auto-layout cell grow to its content; `max-w-0` is what makes `truncate` bite.
        expect(nameCell).toHaveClass('max-w-0');
        expect(name).toHaveClass('truncate');

        // The column holding the name is what caps the chain above it: it clips at its own floor
        // rather than sizing to the name, so no wrapper between it and the cell can be widened by a
        // long one. The floor is also what stops the `shrink-0` chips beside the name from taking the
        // last of the width and truncating the name away to nothing.
        expect(name.parentElement).toHaveClass('min-w-20');
    });

    it('moves an archived routine out of the current list and into the archived filter', async () => {
        stubStore([routine()]);

        renderWithProviders(<Routines />);

        await userEvent.click(
            within(await openRowMenu('Weekly competitor scan')).getByRole('menuitem', { name: 'Archive' }),
        );

        expect(await screen.findByText('Archive routine?')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Archive' }));

        await waitFor(() => {
            expect(screen.queryByText('Weekly competitor scan')).not.toBeInTheDocument();
        });

        await openArchived();

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
    });

    it('offers only Unarchive and Delete on an archived routine', async () => {
        stubStore([routine({ archivedAt: '2026-08-26T10:00:00.000Z', status: 'paused' })]);

        renderWithProviders(<Routines />);

        await openArchived();

        const menu = await openRowMenu('Weekly competitor scan');

        expect(within(menu).getByRole('menuitem', { name: 'Unarchive' })).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', { name: 'Run now' })).not.toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', { name: 'Resume' })).not.toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', { name: 'Pin' })).not.toBeInTheDocument();
    });

    it('returns an unarchived routine to the live list still paused', async () => {
        stubStore([routine({ archivedAt: '2026-08-26T10:00:00.000Z', status: 'paused' })]);

        renderWithProviders(<Routines />);

        await openArchived();
        await userEvent.click(
            within(await openRowMenu('Weekly competitor scan')).getByRole('menuitem', { name: 'Unarchive' }),
        );

        expect(await screen.findByText(/Nothing archived/)).toBeInTheDocument();

        await leaveArchived();

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
        expect(within(screen.getByRole('table')).getByText('Paused')).toBeInTheDocument();
        expect(
            within(await openRowMenu('Weekly competitor scan')).getByRole('menuitem', { name: 'Resume' }),
        ).toBeInTheDocument();
    });

    it('reads an archived routine as archived, never as active', async () => {
        stubStore([routine({ archivedAt: '2026-08-26T10:00:00.000Z', status: 'active' })]);

        renderWithProviders(<Routines />);

        await openArchived();

        const row = (await screen.findAllByRole('row'))[1];

        expect(within(row).getByText('Archived')).toBeInTheDocument();
        expect(within(row).queryByText('Active')).not.toBeInTheDocument();
    });

    it('says so when nothing is archived', async () => {
        stubStore([routine()]);

        renderWithProviders(
            <Routes>
                <Route path="/settings/routines" element={<Routines />} />
            </Routes>,
            { route: '/settings/routines?view=archived' },
        );

        expect(await screen.findByText(/Nothing archived/)).toBeInTheDocument();
    });

    it('offers no archived link when there is nothing archived', async () => {
        stubStore([routine()]);

        renderWithProviders(<Routines />);

        await screen.findByText('Weekly competitor scan');

        expect(screen.queryByRole('button', { name: /View archived/ })).not.toBeInTheDocument();
    });

    it('searches inside the archived filter rather than the current one', async () => {
        stubStore([
            routine({ _id: 'routine-1', name: 'Weekly competitor scan' }),
            routine({ _id: 'routine-2', name: 'Retired supplier digest', archivedAt: '2026-08-26T10:00:00.000Z' }),
            routine({ _id: 'routine-3', name: 'Retired brand watch', archivedAt: '2026-08-26T10:00:00.000Z' }),
        ]);

        renderWithProviders(<Routines />);

        await openArchived();
        await screen.findByText('Retired supplier digest');

        await userEvent.type(screen.getByPlaceholderText('Search routines'), 'brand');

        expect(await screen.findByText('Retired brand watch')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.queryByText('Retired supplier digest')).not.toBeInTheDocument();
        });
        // The current-scope row must not leak in through the search.
        expect(screen.queryByText('Weekly competitor scan')).not.toBeInTheDocument();
    });

    it('asks the api for the archived page and keeps sorting it', async () => {
        const seen: string[] = [];

        server.use(
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/agents', () => pagedEnvelope([])),
            http.get(apiUrl('/routines'), ({ request }) => {
                const url = new URL(request.url);

                seen.push(`${url.searchParams.get('archived') ?? 'none'}|${url.searchParams.get('sortBy')}`);

                return pagedEnvelope([routine({ archivedAt: '2026-08-26T10:00:00.000Z' })]);
            }),
        );

        renderWithProviders(<Routines />);

        await screen.findByText('Weekly competitor scan');
        expect(seen[0]).toBe('none|nextRunAt:asc');

        await openArchived();
        // Archived rows have no next run, so the archived view falls back to last run.
        await waitFor(() => expect(seen).toContain('true|lastRunAt:desc'));

        await userEvent.click(screen.getByRole('button', { name: /Sort by last run/ }));

        expect(screen.queryByRole('menuitem', { name: 'Sort by next run' })).not.toBeInTheDocument();

        await userEvent.click(await screen.findByRole('menuitem', { name: 'Sort by name' }));

        // Filter and sort have to travel together, not reset one another.
        await waitFor(() => expect(seen).toContain('true|name:asc'));
    });

    it('writes the archived view to the url when the link under the list is used', async () => {
        stubStore([routine(), routine({ _id: 'routine-2', archivedAt: '2026-08-26T10:00:00.000Z' })]);

        renderWithProviders(
            <>
                <LocationProbe />
                <Routes>
                    <Route path="/settings/routines" element={<Routines />} />
                </Routes>
            </>,
            { route: '/settings/routines' },
        );

        expect(await screen.findByRole('button', { name: 'View archived (1)' })).toBeInTheDocument();

        await openArchived();

        await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('view=archived'));
    });

    it('opens the archived view straight from the url', async () => {
        stubStore([routine({ archivedAt: '2026-08-26T10:00:00.000Z', status: 'paused' })]);

        renderWithProviders(
            <Routes>
                <Route path="/settings/routines" element={<Routines />} />
            </Routes>,
            { route: '/settings/routines?view=archived' },
        );

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Archived' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /New routine/ })).not.toBeInTheDocument();
    });
    it('asks the api for one agent when the settings list is filtered, and says so in the url', async () => {
        const seen: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/routines'), ({ request }) => {
                seen.push(new URL(request.url).searchParams.get('agentId'));

                return pagedEnvelope([routine()]);
            }),
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/agents', () => pagedEnvelope([{ _id: 'agent-1', name: 'Research' }])),
            // The filter offers only agents whose record proves routines are available on them.
            respond('get', '/agents/agent-1', () =>
                envelope({ _id: 'agent-1', name: 'Research', uiConfig: { componentType: 'chat' } }),
            ),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
        );

        renderWithProviders(
            <>
                <LocationProbe />
                <Routes>
                    <Route path="/settings/routines" element={<Routines />} />
                </Routes>
            </>,
            { route: '/settings/routines' },
        );

        await userEvent.click(await screen.findByRole('combobox', { name: 'Filter routines by agent' }));
        await userEvent.click(await screen.findByRole('option', { name: 'Research' }));

        await waitFor(() => expect(seen).toContain('agent-1'));
        expect(screen.getByTestId('location-search')).toHaveTextContent('agentId=agent-1');
    });

    it("offers no agent filter on an agent-scoped page, where every routine is that agent's", async () => {
        stub([routine()]);

        renderWithProviders(<Routines agent={agentRef} />);

        await screen.findByText('Weekly competitor scan');

        expect(screen.queryByRole('combobox', { name: 'Filter routines by agent' })).not.toBeInTheDocument();
    });
    it('marks a routine with waiting reports with an unread chip', async () => {
        const unreadRun = {
            _id: 'run-1',
            routineId: 'routine-1',
            status: 'completed',
            trigger: 'schedule',
            conversationId: 'conv-1',
            error: '',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            isRead: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        server.use(
            respond('get', '/routines', () => pagedEnvelope([routine()])),
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/agents', () => pagedEnvelope([])),
            respond('get', '/routines/runs', () => pagedEnvelope([unreadRun, { ...unreadRun, _id: 'run-2' }])),
        );

        renderWithProviders(<Routines agent={agentRef} />);

        expect(await screen.findByText('2 new')).toBeInTheDocument();
    });

    it('counts unseen attention runs in their own chip and keeps them out of the new count', async () => {
        const unreadRun = {
            _id: 'run-1',
            routineId: 'routine-1',
            status: 'completed',
            trigger: 'schedule',
            conversationId: 'conv-1',
            error: '',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            isRead: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        server.use(
            respond('get', '/routines', () => pagedEnvelope([routine()])),
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/agents', () => pagedEnvelope([])),
            respond('get', '/routines/runs', () =>
                pagedEnvelope([unreadRun, { ...unreadRun, _id: 'run-2', status: 'failed', error: 'boom' }]),
            ),
        );

        renderWithProviders(<Routines agent={agentRef} />);

        const chip = await screen.findByRole('link', { name: '1 needs attention for Weekly competitor scan' });

        // The count and the destination come from one derivation, so the list it opens holds these rows.
        expect(chip).toHaveAttribute('href', '/agent/research/routines/routine-1?runStatus=failed');
        expect(chip.querySelector('.lucide-circle-alert')).toBeInTheDocument();
        expect(chip).toHaveAttribute('data-tone', 'destructive');
        expect(screen.getByText('1 new')).toBeInTheDocument();
    });

    it('keeps a reconnect-only chip neutral and links it to needs_reconnect', async () => {
        const blockedRun = {
            _id: 'run-blocked',
            routineId: 'routine-1',
            status: 'needs_reconnect',
            trigger: 'schedule',
            conversationId: null,
            error: '',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            isRead: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        server.use(
            respond('get', '/routines', () => pagedEnvelope([routine()])),
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/agents', () => pagedEnvelope([])),
            respond('get', '/routines/runs', () => pagedEnvelope([blockedRun])),
        );

        renderWithProviders(<Routines agent={agentRef} />);

        const chip = await screen.findByRole('link', { name: '1 needs attention for Weekly competitor scan' });

        expect(chip).toHaveAttribute('href', '/agent/research/routines/routine-1?runStatus=needs_reconnect');
        // There is no `warning` token, and destructive would read as the failure this status exists to stop
        // reporting, so a reconnect-only group takes the neutral treatment and the row's own plug icon.
        expect(chip.querySelector('.lucide-plug-zap')).toBeInTheDocument();
        expect(chip.querySelector('.lucide-circle-alert')).not.toBeInTheDocument();
        expect(chip).toHaveAttribute('data-tone', 'neutral');
    });

    it('counts both statuses in one chip and carries both to the run list', async () => {
        const base = {
            routineId: 'routine-1',
            trigger: 'schedule',
            conversationId: null,
            error: '',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            isRead: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        server.use(
            respond('get', '/routines', () => pagedEnvelope([routine()])),
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/agents', () => pagedEnvelope([])),
            respond('get', '/routines/runs', () =>
                pagedEnvelope([
                    { ...base, _id: 'run-blocked', status: 'needs_reconnect' },
                    { ...base, _id: 'run-failed', status: 'failed', error: 'boom' },
                ]),
            ),
        );

        renderWithProviders(<Routines agent={agentRef} />);

        const chip = await screen.findByRole('link', { name: '2 need attention for Weekly competitor scan' });

        // The regression test for this whole bug: the href must carry the same set the count came from.
        expect(chip).toHaveAttribute('href', '/agent/research/routines/routine-1?runStatus=needs_reconnect,failed');
        // The worst state in the group owns the colour.
        expect(chip).toHaveAttribute('data-tone', 'destructive');
        expect(chip.querySelector('.lucide-circle-alert')).toBeInTheDocument();
    });

    it('leaves a routine with nothing waiting unchipped', async () => {
        stub([routine()]);

        renderWithProviders(<Routines agent={agentRef} />);

        await screen.findByText('Weekly competitor scan');

        expect(screen.queryByText(/\d+ new/)).not.toBeInTheDocument();
    });
    it('names the outcome of the last run, and only for the routines the feed covers', async () => {
        const failedRun = {
            _id: 'run-9',
            routineId: 'routine-1',
            status: 'failed',
            trigger: 'schedule',
            conversationId: 'conv-9',
            error: 'boom',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            isRead: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        stub(
            [
                routine({ lastRunAt: new Date().toISOString() }),
                routine({ _id: 'routine-2', name: 'Supplier risk digest' }),
            ],
            [failedRun],
        );

        renderWithProviders(<Routines agent={agentRef} />);

        await screen.findByText('Weekly competitor scan');

        // The outcome is a quiet glyph in the Last run column; the status column stays the schedule's own state.
        const table = screen.getByRole('table');

        expect(within(table).getByText('Failed', { selector: '.sr-only' })).toBeInTheDocument();
        expect(within(table).getAllByText('Active')).toHaveLength(2);
        expect(within(table).queryByText(/last run failed/)).not.toBeInTheDocument();
    });

    it('stacks the list as cards on a narrow viewport', async () => {
        const mql = (matches: boolean) => ({
            matches,
            addEventListener: () => {},
            removeEventListener: () => {},
        });

        vi.stubGlobal('matchMedia', (query: string) => mql(query === '(max-width: 639px)'));
        try {
            stub([routine()]);

            renderWithProviders(<Routines agent={agentRef} />);

            expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
            expect(screen.queryByRole('table')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Actions for Weekly competitor scan' })).toBeInTheDocument();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
