import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import type { SkillType } from '@/types/admin';
import type { PagedList } from '@/types/api-types';

import { skillsApi, SKILLS_LIST_QUERY_KEY, SKILLS_QUERY_KEY, useUpdateSkillMutation } from './skills';

const skill = {
    _id: 'skill-1',
    name: 'Brand voice',
    description: 'Rewrites copy in the house style',
} as SkillType;

describe('skillsApi.list', () => {
    it('unwraps the success envelope and maps page_info to pageInfo', async () => {
        server.use(
            respond('get', '/skills', () => pagedEnvelope([skill], { page: 3, totalPages: 6, totalCount: 154 })),
        );

        const result = await skillsApi.list();

        expect(result.values).toEqual([skill]);
        expect(result.pageInfo).toEqual({ page: 3, totalPages: 6, totalCount: 154 });
    });

    it('serializes sortBy in repeat format rather than bracketed indexes', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/skills'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([skill]);
            }),
        );

        await skillsApi.list({ sortBy: ['name:asc', 'createdAt:desc'], page: 0, size: 30 });

        const params = new URL(requestUrl).searchParams;

        expect(params.getAll('sortBy')).toEqual(['name:asc', 'createdAt:desc']);
        expect(requestUrl).not.toContain('sortBy%5B');
    });

    it('forwards the createdByMe, search and enabled filters', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/skills'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([]);
            }),
        );

        await skillsApi.list({
            createdByMe: true,
            search: 'brand',
            enabled: 'false',
            agentId: 'agent-2',
        });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('createdByMe')).toBe('true');
        expect(params.get('search')).toBe('brand');
        expect(params.get('enabled')).toBe('false');
        expect(params.get('agentId')).toBe('agent-2');
    });

    it('throws with the API message when success is false', async () => {
        server.use(respond('get', '/skills', () => failureEnvelope('Skills service unavailable')));

        await expect(skillsApi.list()).rejects.toThrow('Skills service unavailable');
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', '/skills', () => httpError(500)));

        await expect(skillsApi.list()).rejects.toThrow();
    });
});

describe('skillsApi.getById', () => {
    it('returns the unwrapped skill for the requested id', async () => {
        let requestPath = '';

        server.use(
            http.get(apiUrl('/skills/:id'), ({ request }) => {
                requestPath = new URL(request.url).pathname;

                return envelope(skill);
            }),
        );

        await expect(skillsApi.getById('skill-1')).resolves.toEqual(skill);
        expect(requestPath).toBe('/skills/skill-1');
    });

    it('throws with the API message when success is false', async () => {
        server.use(respond('get', '/skills/skill-1', () => failureEnvelope('Skill not found')));

        await expect(skillsApi.getById('skill-1')).rejects.toThrow('Skill not found');
    });
});

describe('skillsApi.getFiles', () => {
    it('returns a plain array response unchanged', async () => {
        const files = [{ path: 'SKILL.md' }, { path: 'assets/logo.png' }];

        server.use(respond('get', '/skills/skill-1/files', () => envelope(files)));

        await expect(skillsApi.getFiles('skill-1')).resolves.toEqual(files);
    });

    it('flattens a folders + files envelope into a single list', async () => {
        server.use(
            respond('get', '/skills/skill-1/files', () =>
                envelope({
                    folders: [{ path: 'assets', isFolder: true }],
                    files: [{ path: 'SKILL.md' }],
                }),
            ),
        );

        await expect(skillsApi.getFiles('skill-1')).resolves.toEqual([
            { path: 'assets', isFolder: true },
            { path: 'SKILL.md' },
        ]);
    });

    it('falls back to the values key when the API wraps the list', async () => {
        server.use(
            respond('get', '/skills/skill-1/files', () =>
                envelope({
                    values: [{ path: 'SKILL.md' }],
                }),
            ),
        );

        await expect(skillsApi.getFiles('skill-1')).resolves.toEqual([{ path: 'SKILL.md' }]);
    });

    it('sends the folder param when a folder is given', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/skills/skill-1/files'), ({ request }) => {
                requestUrl = request.url;

                return envelope([]);
            }),
        );

        await skillsApi.getFiles('skill-1', 'assets');

        expect(new URL(requestUrl).searchParams.get('folder')).toBe('assets');
    });
});

describe('skillsApi.getFile', () => {
    it('requests the file path with content included', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/skills/skill-1/files'), ({ request }) => {
                requestUrl = request.url;

                return envelope({ path: 'SKILL.md', content: '# Brand voice' });
            }),
        );

        const result = await skillsApi.getFile('skill-1', 'SKILL.md');

        const params = new URL(requestUrl).searchParams;

        expect(params.get('path')).toBe('SKILL.md');
        expect(params.get('includeContent')).toBe('true');
        expect(result.content).toBe('# Brand voice');
    });
});

describe('skillsApi write operations', () => {
    it('creates a skill by posting the payload to /skills', async () => {
        let body: unknown;

        server.use(
            http.post(apiUrl('/skills'), async ({ request }) => {
                body = await request.json();

                return envelope(skill);
            }),
        );

        await expect(skillsApi.create({ name: 'Brand voice' })).resolves.toEqual(skill);
        expect(body).toEqual({ name: 'Brand voice' });
    });

    it('uploads a skill zip by posting the file id to /skills', async () => {
        let body: unknown;

        server.use(
            http.post(apiUrl('/skills'), async ({ request }) => {
                body = await request.json();

                return envelope(skill);
            }),
        );

        await skillsApi.uploadSkillFromZip({ fileId: 'file-7' });

        expect(body).toEqual({ fileId: 'file-7' });
    });

    it('updates a skill by putting the payload to /skills/:id', async () => {
        let body: unknown;
        let requestPath = '';

        server.use(
            http.put(apiUrl('/skills/:id'), async ({ request }) => {
                body = await request.json();
                requestPath = new URL(request.url).pathname;

                return envelope({ ...skill, name: 'House voice' });
            }),
        );

        const result = await skillsApi.update('skill-1', { name: 'House voice' });

        expect(requestPath).toBe('/skills/skill-1');
        expect(body).toEqual({ name: 'House voice' });
        expect(result.name).toBe('House voice');
    });

    it('clones a skill with an empty body', async () => {
        let body: unknown;

        server.use(
            http.post(apiUrl('/skills/skill-1/clone'), async ({ request }) => {
                body = await request.json();

                return envelope({ ...skill, _id: 'skill-2' });
            }),
        );

        const result = await skillsApi.clone('skill-1');

        expect(body).toEqual({});
        expect(result._id).toBe('skill-2');
    });

    it('deletes a skill', async () => {
        let requestPath = '';

        server.use(
            http.delete(apiUrl('/skills/:id'), ({ request }) => {
                requestPath = new URL(request.url).pathname;

                return envelope(null);
            }),
        );

        await skillsApi.delete('skill-1');

        expect(requestPath).toBe('/skills/skill-1');
    });

    it('sends the path as a query param when deleting a file', async () => {
        let requestUrl = '';

        server.use(
            http.delete(apiUrl('/skills/skill-1/files'), ({ request }) => {
                requestUrl = request.url;

                return envelope(null);
            }),
        );

        await skillsApi.deleteFile('skill-1', 'assets/logo.png');

        expect(new URL(requestUrl).searchParams.get('path')).toBe('assets/logo.png');
    });

    it('renames a file with PATCH', async () => {
        let body: unknown;

        server.use(
            http.patch(apiUrl('/skills/skill-1/files'), async ({ request }) => {
                body = await request.json();

                return envelope(null);
            }),
        );

        await skillsApi.renameFile('skill-1', { from: 'a.md', to: 'b.md' });

        expect(body).toEqual({ from: 'a.md', to: 'b.md' });
    });

    it('replaces a skill from a zip via PUT /skills/:id/replace', async () => {
        let requestPath = '';
        let body: unknown;

        server.use(
            http.put(apiUrl('/skills/:id/replace'), async ({ request }) => {
                requestPath = new URL(request.url).pathname;
                body = await request.json();

                return envelope(skill);
            }),
        );

        await skillsApi.replaceSkillFromZip('skill-1', { fileId: 'file-9' });

        expect(requestPath).toBe('/skills/skill-1/replace');
        expect(body).toEqual({ fileId: 'file-9' });
    });

    it('throws with the API message when a write fails with success: false', async () => {
        server.use(respond('put', '/skills/skill-1', () => failureEnvelope('Skill is read-only')));

        await expect(skillsApi.update('skill-1', { name: 'x' })).rejects.toThrow('Skill is read-only');
    });
});

describe('useUpdateSkillMutation', () => {
    const renderUpdateSkill = (queryClient: QueryClient) =>
        renderHook(() => useUpdateSkillMutation(), {
            wrapper: ({ children }: { children: ReactNode }) =>
                createElement(QueryClientProvider, { client: queryClient }, children),
        });

    it('keeps globalEnabled on the cached list row when the PUT response omits it', async () => {
        server.use(http.put(apiUrl('/skills/skill-1'), () => envelope({ _id: 'skill-1', name: 'House voice' })));

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        });
        const listKey = [...SKILLS_LIST_QUERY_KEY, { page: 0 }];

        queryClient.setQueryData<PagedList<SkillType>>(listKey, {
            values: [{ ...skill, globalEnabled: false } as SkillType],
            pageInfo: { page: 0, totalPages: 1, totalCount: 1 },
        });

        const { result } = renderUpdateSkill(queryClient);

        result.current.mutate({ id: 'skill-1', data: { name: 'House voice' } });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(queryClient.getQueryData<PagedList<SkillType>>(listKey)?.values[0]).toMatchObject({
            name: 'House voice',
            globalEnabled: false,
        });
    });

    it('keeps globalEnabled and preference on the cached detail row when the PUT response omits them', async () => {
        server.use(http.put(apiUrl('/skills/skill-1'), () => envelope({ _id: 'skill-1', name: 'House voice' })));

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        });
        const detailKey = [...SKILLS_QUERY_KEY, 'detail', 'skill-1'];

        queryClient.setQueryData<SkillType>(detailKey, {
            ...skill,
            globalEnabled: false,
            preference: { skillId: 'skill-1', userId: 'user-1', disabled: true },
        } as SkillType);

        const { result } = renderUpdateSkill(queryClient);

        result.current.mutate({ id: 'skill-1', data: { name: 'House voice' } });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(queryClient.getQueryData<SkillType>(detailKey)).toMatchObject({
            name: 'House voice',
            globalEnabled: false,
            preference: { disabled: true },
        });
    });

    it('writes the response as-is when the detail cache has no previous row', async () => {
        server.use(http.put(apiUrl('/skills/skill-1'), () => envelope({ _id: 'skill-1', name: 'House voice' })));

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        });

        const { result } = renderUpdateSkill(queryClient);

        result.current.mutate({ id: 'skill-1', data: { name: 'House voice' } });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(queryClient.getQueryData<SkillType>([...SKILLS_QUERY_KEY, 'detail', 'skill-1'])).toEqual({
            _id: 'skill-1',
            name: 'House voice',
        });
    });
});

describe('skillsApi skill preferences', () => {
    it('returns null when no preference row exists', async () => {
        server.use(respond('get', '/skills/skill-1/preferences', () => envelope(null)));

        await expect(skillsApi.getSkillPreference('skill-1')).resolves.toBeNull();
    });

    it('sends only disabled when no agent is given', async () => {
        let body: unknown;

        server.use(
            http.put(apiUrl('/skills/skill-1/preferences'), async ({ request }) => {
                body = await request.json();

                return envelope({ skillId: 'skill-1', userId: 'user-1', disabled: true });
            }),
        );

        await skillsApi.putSkillPreference('skill-1', true);

        expect(body).toEqual({ disabled: true });
    });

    it('includes the agentId when one is given', async () => {
        let body: unknown;

        server.use(
            http.put(apiUrl('/skills/skill-1/preferences'), async ({ request }) => {
                body = await request.json();

                return envelope({
                    skillId: 'skill-1',
                    userId: 'user-1',
                    disabled: false,
                    agentId: 'agent-3',
                });
            }),
        );

        await skillsApi.putSkillPreference('skill-1', false, 'agent-3');

        expect(body).toEqual({ disabled: false, agentId: 'agent-3' });
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('put', '/skills/skill-1/preferences', () => httpError(403)));

        await expect(skillsApi.putSkillPreference('skill-1', true)).rejects.toThrow();
    });
});
