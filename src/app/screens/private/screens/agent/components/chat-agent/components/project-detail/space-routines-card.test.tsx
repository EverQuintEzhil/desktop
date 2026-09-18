import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { apiUrl, envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';
import type { RoutineType } from '@/types/routines';

import SpaceRoutinesCard from './space-routines-card';

const agent = { _id: 'agent-1', name: 'Research', slug: 'research', uiConfig: {} } as unknown as ChatAgentType;

const routine = (overrides: Partial<RoutineType>): RoutineType => ({
    _id: 'routine-1',
    agentId: 'agent-1',
    name: 'Weekly competitor scan',
    prompt: 'Track competitors',
    cron: '0 9 * * 1',
    timezone: 'UTC',
    runOnce: false,
    status: 'active',
    lastRunAt: null,
    projectId: 'project-1',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    ...overrides,
});

let requests: URLSearchParams[] = [];

const routinesHandler = (all: RoutineType[]) =>
    http.get(apiUrl('/routines'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(params);

        const size = Number(params.get('size') ?? 20);

        return pagedEnvelope(all.slice(0, size), {
            totalCount: all.length,
            totalPages: Math.max(1, Math.ceil(all.length / size)),
        });
    });

const renderCard = () =>
    renderWithProviders(<SpaceRoutinesCard agent={agent} projectId="project-1" projectName="Atlas" />);

beforeEach(() => {
    requests = [];
});

describe('SpaceRoutinesCard', () => {
    it('asks the backend for this space and lists what it answers, including other members routines', async () => {
        server.use(routinesHandler([routine({}), routine({ _id: 'routine-2', name: 'Teammate scan' })]));

        renderCard();

        expect(await screen.findByText('Weekly competitor scan')).toBeInTheDocument();
        expect(screen.getByText('Teammate scan')).toBeInTheDocument();
        expect(requests[0]?.get('projectId')).toBe('project-1');
    });

    // The routines list is caller-scoped unless it is told which space to widen to, so a row that links
    // there without its space id lands on a list its own routine is missing from.
    it('carries the space through to the routines list it links to', async () => {
        server.use(routinesHandler([routine({ _id: 'routine-2', name: 'Teammate scan' })]));

        renderCard();

        expect(await screen.findByRole('link', { name: /Teammate scan/ })).toHaveAttribute(
            'href',
            '/agent/research/routines?projectId=project-1',
        );
    });

    it('keeps the show-more trigger a list item of the routine list', async () => {
        const all = Array.from({ length: 23 }, (_, index) =>
            routine({ _id: `routine-${index}`, name: `Routine ${index}` }),
        );

        server.use(routinesHandler(all));

        renderCard();

        const list = await screen.findByRole('list');

        expect([...list.children].every((child) => child.tagName === 'LI')).toBe(true);
    });

    it('describes the schedule and the state of each routine', async () => {
        server.use(routinesHandler([routine({ status: 'paused' })]));

        renderCard();

        expect(await screen.findByText('Paused')).toBeInTheDocument();
        expect(screen.getByText(/Mon/)).toBeInTheDocument();
    });

    it('counts the whole space, and shows no count until the list has loaded', async () => {
        const all = Array.from({ length: 23 }, (_, index) =>
            routine({ _id: `routine-${index}`, name: `Routine ${index}` }),
        );

        server.use(routinesHandler(all));

        renderCard();

        expect(screen.queryByText('23')).not.toBeInTheDocument();

        expect(await screen.findByText('Routine 0')).toBeInTheDocument();
        expect(screen.getByText('23')).toBeInTheDocument();
        expect(screen.queryByText('Routine 22')).not.toBeInTheDocument();
    });

    it('loads the rest of the space on show more', async () => {
        const all = Array.from({ length: 23 }, (_, index) =>
            routine({ _id: `routine-${index}`, name: `Routine ${index}` }),
        );

        server.use(routinesHandler(all));

        renderCard();

        await userEvent.click(await screen.findByRole('button', { name: 'Show more' }));

        expect(await screen.findByText('Routine 22')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
        expect(requests.at(-1)?.get('size')).toBe('40');
        expect(requests.at(-1)?.get('projectId')).toBe('project-1');
    });

    it('shows an empty state when the space has no routines', async () => {
        server.use(routinesHandler([]));

        renderCard();

        expect(await screen.findByText(/No routines report into this space yet/)).toBeInTheDocument();
    });

    it('opens the routine form with this space already chosen', async () => {
        server.use(
            routinesHandler([]),
            respond('get', '/agents/agent-1', () =>
                envelope({ _id: 'agent-1', name: 'Research', models: [], uiConfig: { spaces: { enabled: true } } }),
            ),
            respond('get', '/projects', () => pagedEnvelope([{ _id: 'project-1', name: 'Atlas' }])),
            respond('get', '/projects/project-1', () => envelope({ _id: 'project-1', name: 'Atlas' })),
            respond('get', '/routines/event-sources', () => HttpResponse.json({ sources: [] })),
            respond('get', '/routines/connector-health', () => envelope({ connectors: [] })),
        );

        renderCard();

        await userEvent.click(await screen.findByRole('button', { name: 'New routine' }));

        expect(await screen.findByText('New routine', { selector: 'h2' })).toBeInTheDocument();
        expect(await screen.findByText('Atlas')).toBeInTheDocument();
    });

    it('says so and offers a retry when the routines cannot be loaded', async () => {
        server.use(respond('get', '/routines', () => httpError(500, 'Boom')));

        renderCard();

        expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
        expect(screen.queryByText(/No routines report into this space yet/)).not.toBeInTheDocument();
    });

    it('reports a non-member as an access error rather than an empty space', async () => {
        server.use(respond('get', '/routines', () => httpError(403, 'You are not a member of this space.')));

        renderCard();

        expect(await screen.findByText('You are not a member of this space.')).toBeInTheDocument();
        expect(screen.queryByText(/No routines report into this space yet/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
});
