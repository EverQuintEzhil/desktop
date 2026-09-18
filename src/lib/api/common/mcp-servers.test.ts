import { QueryClient } from '@tanstack/react-query';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';

import { invalidateConnectorSurfaces, mcpServersApi, type McpServer, type McpTool } from './mcp-servers';

const mcpServer = {
    _id: 'srv-1',
    name: 'Google Drive',
    description: 'Read files from Drive',
    serverUrl: 'https://mcp.example.com/drive',
    authType: 'oauth',
    status: 'active',
} as McpServer;

describe('mcpServersApi.list', () => {
    it('unwraps the success envelope and maps page_info to pageInfo', async () => {
        server.use(
            respond('get', '/mcpservers', () => pagedEnvelope([mcpServer], { page: 1, totalPages: 4, totalCount: 77 })),
        );

        const result = await mcpServersApi.list();

        expect(result.values).toEqual([mcpServer]);
        expect(result.pageInfo).toEqual({ page: 1, totalPages: 4, totalCount: 77 });
    });

    it('serializes list params onto the query string', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/mcpservers'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([mcpServer]);
            }),
        );

        await mcpServersApi.list({
            page: 2,
            size: 20,
            search: 'drive',
            createdByMe: true,
            agentId: 'agent-9',
            enabled: 'true',
        });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('page')).toBe('2');
        expect(params.get('size')).toBe('20');
        expect(params.get('search')).toBe('drive');
        expect(params.get('createdByMe')).toBe('true');
        expect(params.get('agentId')).toBe('agent-9');
        expect(params.get('enabled')).toBe('true');
    });

    it('omits undefined params instead of sending them as empty strings', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/mcpservers'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([]);
            }),
        );

        await mcpServersApi.list({ size: 20, search: undefined });

        const params = new URL(requestUrl).searchParams;

        expect(params.has('search')).toBe(false);
        expect(params.get('size')).toBe('20');
    });

    it('throws with the API message when success is false', async () => {
        server.use(respond('get', '/mcpservers', () => failureEnvelope('Connector catalog unavailable')));

        await expect(mcpServersApi.list()).rejects.toThrow('Connector catalog unavailable');
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', '/mcpservers', () => httpError(500)));

        await expect(mcpServersApi.list()).rejects.toThrow();
    });
});

describe('mcpServersApi.getById', () => {
    it('returns the unwrapped server for the requested id', async () => {
        let requestPath = '';

        server.use(
            http.get(apiUrl('/mcpservers/:id'), ({ request }) => {
                requestPath = new URL(request.url).pathname;

                return envelope(mcpServer);
            }),
        );

        await expect(mcpServersApi.getById('srv-1')).resolves.toEqual(mcpServer);
        expect(requestPath).toBe('/mcpservers/srv-1');
    });

    it('throws with the API message when success is false', async () => {
        server.use(respond('get', '/mcpservers/srv-1', () => failureEnvelope('Connector not found')));

        await expect(mcpServersApi.getById('srv-1')).rejects.toThrow('Connector not found');
    });
});

describe('mcpServersApi.connect', () => {
    it('returns the authorization url and forwards the redirect url', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/mcpservers/srv-1/connect'), ({ request }) => {
                requestUrl = request.url;

                return envelope({ authorizationUrl: 'https://auth.example.com/start' });
            }),
        );

        const result = await mcpServersApi.connect('srv-1', 'https://app.localhost/settings/connectors/srv-1');

        expect(result).toEqual({ authorizationUrl: 'https://auth.example.com/start' });
        expect(new URL(requestUrl).searchParams.get('redirectUrl')).toBe(
            'https://app.localhost/settings/connectors/srv-1',
        );
    });

    it('omits redirectUrl when none is given', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/mcpservers/srv-1/connect'), ({ request }) => {
                requestUrl = request.url;

                return envelope({ authorizationUrl: 'https://auth.example.com/start' });
            }),
        );

        await mcpServersApi.connect('srv-1');

        expect(new URL(requestUrl).searchParams.has('redirectUrl')).toBe(false);
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', '/mcpservers/srv-1/connect', () => httpError(502)));

        await expect(mcpServersApi.connect('srv-1')).rejects.toThrow();
    });
});

describe('mcpServersApi.disconnect', () => {
    it('posts to the disconnect endpoint', async () => {
        let requestPath = '';

        server.use(
            http.post(apiUrl('/mcpservers/:id/disconnect'), ({ request }) => {
                requestPath = new URL(request.url).pathname;

                return envelope(null);
            }),
        );

        await mcpServersApi.disconnect('srv-1');

        expect(requestPath).toBe('/mcpservers/srv-1/disconnect');
    });

    it('throws with the API message when success is false', async () => {
        server.use(respond('post', '/mcpservers/srv-1/disconnect', () => failureEnvelope('Disconnect failed')));

        await expect(mcpServersApi.disconnect('srv-1')).rejects.toThrow('Disconnect failed');
    });
});

describe('mcpServersApi.getTools', () => {
    it('returns the unwrapped tool list', async () => {
        const tools: McpTool[] = [
            { name: 'search_files', annotations: { readOnlyHint: true } },
            { name: 'delete_file', annotations: { readOnlyHint: false } },
        ];

        server.use(respond('get', '/mcpservers/srv-1/tools', () => envelope(tools)));

        await expect(mcpServersApi.getTools('srv-1')).resolves.toEqual(tools);
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', '/mcpservers/srv-1/tools', () => httpError(503)));

        await expect(mcpServersApi.getTools('srv-1')).rejects.toThrow();
    });
});

describe('mcpServersApi.getToolPreferences', () => {
    it('defaults the preferenceLevel param to user', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/mcpservers/srv-1/tools-preferences'), ({ request }) => {
                requestUrl = request.url;

                return envelope([]);
            }),
        );

        await mcpServersApi.getToolPreferences('srv-1');

        expect(new URL(requestUrl).searchParams.get('preferenceLevel')).toBe('user');
    });

    it('forwards an explicit global preferenceLevel and unwraps the rows', async () => {
        let requestUrl = '';
        const rows = [{ toolName: 'search_files', needsApproval: true }];

        server.use(
            http.get(apiUrl('/mcpservers/srv-1/tools-preferences'), ({ request }) => {
                requestUrl = request.url;

                return envelope(rows);
            }),
        );

        await expect(mcpServersApi.getToolPreferences('srv-1', 'global')).resolves.toEqual(rows);
        expect(new URL(requestUrl).searchParams.get('preferenceLevel')).toBe('global');
    });
});

describe('mcpServersApi.putToolsPreferences', () => {
    it('sends the preference payload as the request body', async () => {
        let body: unknown;

        server.use(
            http.put(apiUrl('/mcpservers/srv-1/tools-preferences'), async ({ request }) => {
                body = await request.json();

                return envelope({ toolName: 'delete_file', disabled: true });
            }),
        );

        const result = await mcpServersApi.putToolsPreferences('srv-1', {
            name: 'delete_file',
            needsApproval: false,
            disabled: true,
            hasUserPreferences: true,
            preferenceLevel: 'user',
        });

        expect(body).toEqual({
            name: 'delete_file',
            needsApproval: false,
            disabled: true,
            hasUserPreferences: true,
            preferenceLevel: 'user',
        });
        expect(result).toEqual({ toolName: 'delete_file', disabled: true });
    });

    it('throws with the API message when success is false', async () => {
        server.use(respond('put', '/mcpservers/srv-1/tools-preferences', () => failureEnvelope('Not allowed')));

        await expect(
            mcpServersApi.putToolsPreferences('srv-1', {
                name: 'delete_file',
                preferenceLevel: 'user',
            }),
        ).rejects.toThrow('Not allowed');
    });
});

describe('mcpServersApi.getServerPreference', () => {
    it('returns null when the API has no preference row', async () => {
        server.use(respond('get', '/mcpservers/srv-1/preferences', () => envelope(null)));

        await expect(mcpServersApi.getServerPreference('srv-1')).resolves.toBeNull();
    });

    it('returns the preference row when present', async () => {
        const preference = { mcpServerId: 'srv-1', userId: 'user-1', disabled: true };

        server.use(respond('get', '/mcpservers/srv-1/preferences', () => envelope(preference)));

        await expect(mcpServersApi.getServerPreference('srv-1')).resolves.toEqual(preference);
    });
});

describe('mcpServersApi.putServerPreference', () => {
    it('sends only disabled when no agent is given', async () => {
        let body: unknown;

        server.use(
            http.put(apiUrl('/mcpservers/srv-1/preferences'), async ({ request }) => {
                body = await request.json();

                return envelope({ mcpServerId: 'srv-1', userId: 'user-1', disabled: true });
            }),
        );

        await mcpServersApi.putServerPreference('srv-1', true);

        expect(body).toEqual({ disabled: true });
    });

    it('includes the agentId when one is given', async () => {
        let body: unknown;

        server.use(
            http.put(apiUrl('/mcpservers/srv-1/preferences'), async ({ request }) => {
                body = await request.json();

                return envelope({
                    mcpServerId: 'srv-1',
                    userId: 'user-1',
                    disabled: false,
                    agentId: 'agent-9',
                });
            }),
        );

        await mcpServersApi.putServerPreference('srv-1', false, 'agent-9');

        expect(body).toEqual({ disabled: false, agentId: 'agent-9' });
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('put', '/mcpservers/srv-1/preferences', () => httpError(500)));

        await expect(mcpServersApi.putServerPreference('srv-1', true)).rejects.toThrow();
    });
});

describe('invalidateConnectorSurfaces', () => {
    it('reaches every root that reads connector state, including the routine form', () => {
        const queryClient = new QueryClient();
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

        invalidateConnectorSurfaces(queryClient);

        const keys = invalidate.mock.calls.map(([options]) => options?.queryKey);

        expect(keys).toEqual([['connectors'], ['mcp-servers'], ['agent'], ['routines', 'connector-health']]);
    });
});
