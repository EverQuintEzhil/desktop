import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';

import { appProjectsApi } from './projects';

const project = { _id: 'project-1', name: 'Marketing space' };

describe('appProjectsApi.listProjects', () => {
    it('unwraps the envelope and maps page_info to pageInfo', async () => {
        server.use(
            respond('get', '/projects', () => pagedEnvelope([project], { page: 2, totalPages: 5, totalCount: 96 })),
        );

        const result = await appProjectsApi.listProjects();

        expect(result.values).toEqual([project]);
        expect(result.pageInfo).toEqual({ page: 2, totalPages: 5, totalCount: 96 });
    });

    it('forwards the scope, search and paging params', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/projects'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([]);
            }),
        );

        await appProjectsApi.listProjects({
            agentId: 'agent-1',
            search: 'launch',
            mineOnly: false,
            sortBy: 'name:asc',
            page: 1,
            size: 20,
        });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('agentId')).toBe('agent-1');
        expect(params.get('search')).toBe('launch');
        expect(params.get('mineOnly')).toBe('false');
        expect(params.get('sortBy')).toBe('name:asc');
        expect(params.get('page')).toBe('1');
        expect(params.get('size')).toBe('20');
    });

    it('throws with the API message when success is false', async () => {
        server.use(respond('get', '/projects', () => failureEnvelope('Projects service unavailable')));

        await expect(appProjectsApi.listProjects()).rejects.toThrow('Projects service unavailable');
    });

    it('rejects on a transport error', async () => {
        server.use(respond('get', '/projects', () => httpError(503)));

        await expect(appProjectsApi.listProjects()).rejects.toThrow();
    });
});

describe('appProjectsApi writes', () => {
    it('posts the create payload as-is', async () => {
        let body: unknown;

        server.use(
            http.post(apiUrl('/projects'), async ({ request }) => {
                body = await request.json();

                return envelope(project);
            }),
        );

        const created = await appProjectsApi.createProject({
            name: 'Marketing space',
            agentId: 'agent-1',
            description: 'Campaign planning',
            instructions: '',
        });

        expect(body).toEqual({
            name: 'Marketing space',
            agentId: 'agent-1',
            description: 'Campaign planning',
            instructions: '',
        });
        expect(created).toEqual(project);
    });

    it('puts only the fields present in an update patch', async () => {
        let body: unknown;

        server.use(
            http.put(apiUrl('/projects/project-1'), async ({ request }) => {
                body = await request.json();

                return envelope(project);
            }),
        );

        await appProjectsApi.updateProject('project-1', { instructions: 'Always cite sources' });

        expect(body).toEqual({ instructions: 'Always cite sources' });
    });

    it('pins with an empty-bodied put to the pin sub-resource', async () => {
        let pinned = false;

        server.use(
            http.put(apiUrl('/projects/project-1/pin'), () => {
                pinned = true;

                return envelope(null);
            }),
        );

        await appProjectsApi.pinProject('project-1');

        expect(pinned).toBe(true);
    });

    it('posts a member with the requested role', async () => {
        let body: unknown;

        server.use(
            http.post(apiUrl('/projects/project-1/members'), async ({ request }) => {
                body = await request.json();

                return envelope(null);
            }),
        );

        await appProjectsApi.addMember('project-1', { userId: 'user-2', role: 'editor' });

        expect(body).toEqual({ userId: 'user-2', role: 'editor' });
    });

    it('puts a member role change to the member sub-resource', async () => {
        let body: unknown;

        server.use(
            http.put(apiUrl('/projects/project-1/members/user-2'), async ({ request }) => {
                body = await request.json();

                return envelope(null);
            }),
        );

        await appProjectsApi.changeMemberRole('project-1', 'user-2', { role: 'viewer' });

        expect(body).toEqual({ role: 'viewer' });
    });

    it('deletes a member by id', async () => {
        let deleted = false;

        server.use(
            http.delete(apiUrl('/projects/project-1/members/user-2'), () => {
                deleted = true;

                return envelope(null);
            }),
        );

        await appProjectsApi.removeMember('project-1', 'user-2');

        expect(deleted).toBe(true);
    });
});

describe('appProjectsApi.listActivities', () => {
    it('maps the paged activity envelope and forwards paging', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/projects/project-1/activities'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([{ _id: 'activity-1' }], { page: 0, totalPages: 2, totalCount: 30 });
            }),
        );

        const result = await appProjectsApi.listActivities('project-1', { page: 0, size: 25 });

        expect(result.values).toEqual([{ _id: 'activity-1' }]);
        expect(result.pageInfo).toEqual({ page: 0, totalPages: 2, totalCount: 30 });
        expect(new URL(requestUrl).searchParams.get('size')).toBe('25');
    });
});
