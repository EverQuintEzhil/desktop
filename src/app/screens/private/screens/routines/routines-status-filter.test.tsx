import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import RoutineDetail from './routine-detail';
import Routines from './routines';

const agentRef = { _id: 'agent-1', name: 'Research', slug: 'research' };

const routine = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
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
    ...overrides,
});

const LocationProbe = () => {
    const { search } = useLocation();

    return <div data-testid="location-search">{search}</div>;
};

describe('Routines status filter', () => {
    it('sends the picked status to the api and writes it to the url', async () => {
        const seen: (string | null)[] = [];

        server.use(
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/agents', () => pagedEnvelope([])),
            http.get(apiUrl('/routines'), ({ request }) => {
                seen.push(new URL(request.url).searchParams.get('status'));

                return pagedEnvelope([routine()]);
            }),
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

        await screen.findByText('Weekly competitor scan');
        expect(seen).toContain(null);

        await userEvent.click(screen.getByRole('button', { name: /All statuses/ }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Paused' }));

        await waitFor(() => expect(seen).toContain('paused'));
        expect(screen.getByTestId('location-search')).toHaveTextContent('status=paused');
    });

    it('restores the status filter from the url', async () => {
        const seen: (string | null)[] = [];

        server.use(
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/agents', () => pagedEnvelope([])),
            http.get(apiUrl('/routines'), ({ request }) => {
                seen.push(new URL(request.url).searchParams.get('status'));

                return pagedEnvelope([routine({ status: 'paused' })]);
            }),
        );

        renderWithProviders(
            <Routes>
                <Route path="/settings/routines" element={<Routines />} />
            </Routes>,
            { route: '/settings/routines?status=paused' },
        );

        await screen.findByText('Weekly competitor scan');

        await waitFor(() => expect(seen).toContain('paused'));
        expect(screen.getByRole('button', { name: /Paused/ })).toBeInTheDocument();
    });

    it('drops the status filter in the archived view instead of sending it', async () => {
        const seen: { archived: string | null; status: string | null }[] = [];

        server.use(
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/agents', () => pagedEnvelope([])),
            http.get(apiUrl('/routines'), ({ request }) => {
                const params = new URL(request.url).searchParams;

                seen.push({ archived: params.get('archived'), status: params.get('status') });

                return pagedEnvelope([routine({ status: 'paused', archivedAt: '2026-08-20T09:00:00.000Z' })]);
            }),
        );

        renderWithProviders(
            <Routes>
                <Route path="/settings/routines" element={<Routines />} />
            </Routes>,
            { route: '/settings/routines?view=archived&status=active' },
        );

        await screen.findByText('Weekly competitor scan');

        await waitFor(() => expect(seen.some((call) => call.archived === 'true')).toBe(true));
        expect(seen.filter((call) => call.archived === 'true').every((call) => call.status === null)).toBe(true);
    });

    it('asks the runs api for one status from the history filter', async () => {
        const seen: (string | null)[] = [];

        server.use(
            respond('get', '/routines/routine-1', () => envelope(routine())),
            respond('get', '/routines/routine-1/triggers', () => envelope({ values: [] })),
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/agents/agent-1', () => envelope({ _id: 'agent-1', name: 'Research' })),
            http.get(apiUrl('/routines/routine-1/runs'), ({ request }) => {
                seen.push(new URL(request.url).searchParams.get('status'));

                return pagedEnvelope([]);
            }),
        );

        renderWithProviders(
            <Routes>
                <Route path="/agent/research/routines/:routineId" element={<RoutineDetail agent={agentRef} />} />
            </Routes>,
            { route: '/agent/research/routines/routine-1' },
        );

        await screen.findByRole('heading', { name: 'History' });
        expect(seen).toContain(null);

        await userEvent.click(screen.getByRole('button', { name: /All runs/ }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Failed' }));

        await waitFor(() => expect(seen).toContain('failed'));
    });
    it('offers no create action when a status filter is what emptied the list', async () => {
        server.use(
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/agents', () => pagedEnvelope([])),
            respond('get', '/routines', () => pagedEnvelope([])),
        );

        renderWithProviders(
            <Routes>
                <Route path="/settings/routines" element={<Routines />} />
            </Routes>,
            { route: '/settings/routines?status=paused' },
        );

        // Creating from here would make a routine the filter immediately hides, which reads as a failed save,
        // so only the header's own button is left — the empty state offers none.
        expect(await screen.findByText('No paused routines')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'New routine' })).toHaveLength(1);
        expect(screen.queryByText('No routines yet')).not.toBeInTheDocument();
    });

    it('leaves the history filter behind when it goes back to the list', async () => {
        server.use(
            respond('get', '/routines/routine-1', () => envelope(routine())),
            respond('get', '/routines/routine-1/triggers', () => envelope({ values: [] })),
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/routines/routine-1/runs', () => pagedEnvelope([])),
            respond('get', '/agents/agent-1', () => envelope({ _id: 'agent-1', name: 'Research' })),
        );

        renderWithProviders(
            <>
                <LocationProbe />
                <Routes>
                    <Route path="/agent/research/routines/:routineId" element={<RoutineDetail agent={agentRef} />} />
                </Routes>
            </>,
            { route: '/agent/research/routines/routine-1?sort=name&runStatus=failed' },
        );

        const back = await screen.findByRole('link', { name: /All routines/ });

        expect(back).toHaveAttribute('href', '/agent/research/routines?sort=name');
    });

    it('names the filter in an empty history instead of claiming there are no runs', async () => {
        server.use(
            respond('get', '/routines/routine-1', () => envelope(routine())),
            respond('get', '/routines/routine-1/triggers', () => envelope({ values: [] })),
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/runs', () => pagedEnvelope([])),
            respond('get', '/routines/routine-1/runs', () => pagedEnvelope([])),
            respond('get', '/agents/agent-1', () => envelope({ _id: 'agent-1', name: 'Research' })),
        );

        renderWithProviders(
            <Routes>
                <Route path="/agent/research/routines/:routineId" element={<RoutineDetail agent={agentRef} />} />
            </Routes>,
            { route: '/agent/research/routines/routine-1?runStatus=failed' },
        );

        expect(await screen.findByText('No runs under Failed')).toBeInTheDocument();
        expect(screen.queryByText('No runs yet')).not.toBeInTheDocument();
        // The raw enum is the database's spelling, never a sentence a person is shown.
        expect(screen.queryByText(/needs_reconnect/)).not.toBeInTheDocument();
    });
});
