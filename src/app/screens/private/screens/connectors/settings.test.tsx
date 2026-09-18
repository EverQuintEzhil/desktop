import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { Navigate, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { McpServer } from '@/lib/api';
import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import Connectors from './connectors';
import SettingsLayout from './settings-layout';

const oauthConnected = {
    _id: 'srv-oauth',
    name: 'Google Drive',
    description: 'Read and search Drive files',
    serverUrl: 'https://mcp.example.com/drive',
    authType: 'oauth',
    status: 'active',
    transport: 'http',
    version: '1.2.0',
    requireApproval: false,
    createdAt: '2026-01-05T10:00:00.000Z',
    connection: { status: 'connected', tokenExpiry: '2099-01-01T00:00:00.000Z' },
} as McpServer;

const oauthNotConnected = {
    _id: 'srv-jira',
    name: 'Jira',
    description: 'Track issues',
    serverUrl: 'https://mcp.example.com/jira',
    authType: 'oauth',
    status: 'active',
    connection: null,
} as McpServer;

const oauthExpired = {
    ...oauthConnected,
    _id: 'srv-oauth-expired',
    name: 'Dropbox',
    connection: { status: 'connected', tokenExpiry: '2020-01-01T00:00:00.000Z' },
} as McpServer;

const oauthPending = {
    ...oauthConnected,
    _id: 'srv-oauth-pending',
    name: 'Asana',
    connection: { status: 'pending', tokenExpiry: null },
} as McpServer;

const oauthFailed = {
    ...oauthConnected,
    _id: 'srv-oauth-failed',
    name: 'Trello',
    connection: { status: 'failed', tokenExpiry: null },
} as McpServer;

const apiKeyServer = {
    _id: 'srv-weather',
    name: 'Weather',
    description: 'Forecast lookups',
    serverUrl: 'https://mcp.example.com/weather',
    authType: 'none',
    status: 'active',
    transport: 'http',
    version: '0.9.0',
    requireApproval: true,
    createdAt: '2026-02-01T09:30:00.000Z',
    globalEnabled: true,
    preference: null,
} as McpServer;

const ownedServer = {
    ...apiKeyServer,
    _id: 'srv-owned',
    name: 'My Custom Server',
    creator: { _id: 'user-1' },
} as McpServer;

const preferenceDisabledServer = {
    ...apiKeyServer,
    _id: 'srv-pref-disabled',
    name: 'Notion',
    preference: { mcpServerId: 'srv-pref-disabled', userId: 'user-1', disabled: true },
} as McpServer;

const globallyDisabledServer = {
    ...apiKeyServer,
    _id: 'srv-global-disabled',
    name: 'Confluence',
    globalEnabled: false,
    preference: null,
} as McpServer;

const renderSettingsConnectors = (route = '/settings/connectors') =>
    renderWithProviders(
        <Routes>
            <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/connectors" replace />} />
                <Route path="connectors" element={<Connectors />} />
                <Route path="connectors/:connectorId" element={<Connectors />} />
            </Route>
        </Routes>,
        { route },
    );

const isEnabledForViewer = (candidate: McpServer) =>
    candidate.preference ? !candidate.preference.disabled : candidate.globalEnabled !== false;

const isConnectedForViewer = (candidate: McpServer) =>
    candidate.authType === 'oauth' ? candidate.connection?.status === 'connected' : isEnabledForViewer(candidate);

const stubCatalog = (servers: McpServer[]) => {
    server.use(
        http.get(apiUrl('/mcpservers'), ({ request }) => {
            const wantsConnected = new URL(request.url).searchParams.get('connected') === 'true';

            return pagedEnvelope(servers.filter((candidate) => isConnectedForViewer(candidate) === wantsConnected));
        }),
    );
};

const groupLabelContaining = (name: string): string | undefined => {
    const group = Array.from(document.querySelectorAll<HTMLElement>('.connectors-list-pane-group')).find(
        (candidate) => within(candidate).queryByText(name) !== null,
    );

    return group?.querySelector('span')?.textContent?.replace(/\d+$/, '');
};

const stubToolEndpoints = (serverId: string, tools: unknown[] = []) => {
    server.use(
        respond('get', `/mcpservers/${serverId}/tools`, () => envelope(tools)),
        respond('get', `/mcpservers/${serverId}/tools-preferences`, () => envelope([])),
    );
};

describe('Settings connectors list', () => {
    it('renders settings sidebar and connectors empty state', async () => {
        stubCatalog([]);

        renderSettingsConnectors();

        expect(screen.getByRole('link', { name: 'Connectors' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Skills' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Connectors' })).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('No connectors found')).toBeInTheDocument();
        });

        expect(screen.getByText("You don't have any connectors yet.")).toBeInTheDocument();
        expect(screen.getByText('Select a connector to manage access')).toBeInTheDocument();
    });

    it('shows list skeletons while the catalog is loading', () => {
        server.use(
            http.get(apiUrl('/mcpservers'), async () => {
                await delay('infinite');

                return pagedEnvelope([]);
            }),
        );

        const { container } = renderSettingsConnectors();

        expect(container.querySelector('.connectors-list-pane-group-items')).toBeInTheDocument();
        expect(screen.queryByText('No connectors found')).not.toBeInTheDocument();
    });

    it('groups servers into Connected and Not connected', async () => {
        stubCatalog([oauthConnected, oauthNotConnected, apiKeyServer]);

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Google Drive')).toBeInTheDocument();
        });

        const groups = document.querySelectorAll('.connectors-list-pane-group');

        expect(groups).toHaveLength(2);
        expect(within(groups[0] as HTMLElement).getAllByText('Connected').length).toBeGreaterThanOrEqual(1);
        expect(within(groups[0] as HTMLElement).getByText('Google Drive')).toBeInTheDocument();
        expect(within(groups[0] as HTMLElement).getByText('Weather')).toBeInTheDocument();
        expect(within(groups[1] as HTMLElement).getAllByText('Not connected').length).toBeGreaterThanOrEqual(1);
        expect(within(groups[1] as HTMLElement).getByText('Jira')).toBeInTheDocument();
    });

    it('shows a connected connector under Connected even when the not-connected list is long and paginated', async () => {
        const filler = Array.from(
            { length: 24 },
            (_, index) =>
                ({
                    ...oauthNotConnected,
                    _id: `srv-filler-${index}`,
                    name: `Filler ${index}`,
                }) as McpServer,
        );

        server.use(
            http.get(apiUrl('/mcpservers'), ({ request }) => {
                const params = new URL(request.url).searchParams;

                if (params.get('connected') === 'true') {
                    return pagedEnvelope([oauthConnected]);
                }

                const size = Number(params.get('size'));
                const page = Number(params.get('page'));

                return pagedEnvelope(filler.slice(page * size, (page + 1) * size), {
                    page,
                    totalPages: Math.ceil(filler.length / size),
                    totalCount: filler.length,
                });
            }),
        );

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Google Drive')).toBeInTheDocument();
        });

        const groups = document.querySelectorAll('.connectors-list-pane-group');

        expect(within(groups[0] as HTMLElement).getByText('Google Drive')).toBeInTheDocument();
        expect(within(groups[0] as HTMLElement).queryByText('Filler 0')).not.toBeInTheDocument();
    });

    it('shows the server-side total on the Not connected badge, not the rows loaded so far', async () => {
        const firstPage = Array.from(
            { length: 20 },
            (_, index) =>
                ({
                    ...oauthNotConnected,
                    _id: `srv-page-${index}`,
                    name: `Page item ${index}`,
                }) as McpServer,
        );

        server.use(
            http.get(apiUrl('/mcpservers'), ({ request }) => {
                const params = new URL(request.url).searchParams;

                if (params.get('connected') === 'true') {
                    return pagedEnvelope([]);
                }

                return pagedEnvelope(firstPage, { page: 0, totalPages: 7, totalCount: 130 });
            }),
        );

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Page item 0')).toBeInTheDocument();
        });

        const notConnectedGroup = document.querySelector('.connectors-list-pane-group') as HTMLElement;

        expect(within(notConnectedGroup).getByText('130')).toBeInTheDocument();
        expect(within(notConnectedGroup).queryByText('20')).not.toBeInTheDocument();
    });

    it('splits the two sections into disjoint connected=true and connected=false requests', async () => {
        const requests: URLSearchParams[] = [];

        server.use(
            http.get(apiUrl('/mcpservers'), ({ request }) => {
                const params = new URL(request.url).searchParams;

                requests.push(params);

                return pagedEnvelope(params.get('connected') === 'true' ? [oauthConnected] : [oauthNotConnected]);
            }),
        );

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Google Drive')).toBeInTheDocument();
        });

        const connectedRequests = requests.filter((params) => params.get('connected') === 'true');
        const notConnectedRequests = requests.filter((params) => params.get('connected') === 'false');

        expect(requests.every((params) => params.has('connected'))).toBe(true);
        expect(notConnectedRequests.map((params) => params.get('page'))).toEqual(['0']);
        expect(connectedRequests.map((params) => params.get('page'))).toEqual(['0']);
    });

    it('renders every connected connector when the connected endpoint spans multiple pages', async () => {
        const connectedMany = Array.from(
            { length: 125 },
            (_, index) =>
                ({
                    ...apiKeyServer,
                    _id: `srv-connected-${index}`,
                    name: `Connected item ${index}`,
                }) as McpServer,
        );

        server.use(
            http.get(apiUrl('/mcpservers'), ({ request }) => {
                const params = new URL(request.url).searchParams;

                if (params.get('connected') !== 'true') {
                    return pagedEnvelope([]);
                }

                const size = Number(params.get('size'));
                const page = Number(params.get('page'));

                return pagedEnvelope(connectedMany.slice(page * size, (page + 1) * size), {
                    page,
                    totalPages: Math.ceil(connectedMany.length / size),
                    totalCount: connectedMany.length,
                });
            }),
        );

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Connected item 124')).toBeInTheDocument();
        });

        const group = document.querySelector('.connectors-list-pane-group') as HTMLElement;

        connectedMany.forEach((connector) => {
            expect(within(group).getByText(connector.name)).toBeInTheDocument();
        });
    });

    it('moves a connector between sections when the server changes its membership', async () => {
        let isConnected = true;

        server.use(
            http.get(apiUrl('/mcpservers'), ({ request }) => {
                const wantsConnected = new URL(request.url).searchParams.get('connected') === 'true';

                return pagedEnvelope(wantsConnected === isConnected ? [apiKeyServer] : []);
            }),
            http.get(apiUrl(`/mcpservers/${apiKeyServer._id}`), () => envelope(apiKeyServer)),
            http.put(apiUrl(`/mcpservers/${apiKeyServer._id}/preferences`), () => {
                isConnected = false;

                return envelope({ mcpServerId: apiKeyServer._id, userId: 'user-1', disabled: true });
            }),
        );
        stubToolEndpoints(apiKeyServer._id);

        renderSettingsConnectors(`/settings/connectors/${apiKeyServer._id}`);

        await waitFor(() => {
            expect(groupLabelContaining('Weather')).toBe('Connected');
        });

        await userEvent.click(await screen.findByRole('button', { name: 'Disable' }));

        await waitFor(() => {
            expect(groupLabelContaining('Weather')).toBe('Not connected');
        });
    });

    it("always shows each connector's status label", async () => {
        stubCatalog([oauthConnected, oauthNotConnected, apiKeyServer]);

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Google Drive')).toBeInTheDocument();
        });

        expect(screen.getAllByText('Connected').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Not connected').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('shows Disabled for servers turned off by preference or globally', async () => {
        stubCatalog([preferenceDisabledServer, globallyDisabledServer]);

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Notion')).toBeInTheDocument();
        });

        expect(screen.getByText('Confluence')).toBeInTheDocument();
        expect(screen.getAllByText('Disabled')).toHaveLength(2);
        expect(screen.queryByText('Ready')).not.toBeInTheDocument();
    });

    it('lists a globally disabled non-oauth connector under Not connected', async () => {
        stubCatalog([globallyDisabledServer]);

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Confluence')).toBeInTheDocument();
        });

        expect(groupLabelContaining('Confluence')).toBe('Not connected');
    });

    it('keeps an oauth connector with an expired token under Connected and labels it Reconnect', async () => {
        stubCatalog([oauthExpired]);

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Dropbox')).toBeInTheDocument();
        });

        expect(groupLabelContaining('Dropbox')).toBe('Connected');
        expect(screen.getByText('Reconnect')).toBeInTheDocument();
    });

    it('lists an oauth connector with a pending connection under Not connected', async () => {
        stubCatalog([oauthPending]);

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Asana')).toBeInTheDocument();
        });

        expect(groupLabelContaining('Asana')).toBe('Not connected');
    });

    it('lists an oauth connector with a failed connection under Not connected', async () => {
        stubCatalog([oauthFailed]);

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Trello')).toBeInTheDocument();
        });

        expect(groupLabelContaining('Trello')).toBe('Not connected');
    });

    it('renders a connector once when both catalog queries return it', async () => {
        server.use(http.get(apiUrl('/mcpservers'), () => pagedEnvelope([apiKeyServer])));

        renderSettingsConnectors();

        await waitFor(() => {
            expect(groupLabelContaining('Weather')).toBe('Connected');
        });

        expect(screen.getAllByText('Weather')).toHaveLength(1);
    });

    it('marks a server created by the current user with a Custom badge', async () => {
        stubCatalog([ownedServer]);

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('My Custom Server')).toBeInTheDocument();
        });

        expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('renders an error state with Retry when the catalog request fails', async () => {
        server.use(respond('get', '/mcpservers', () => httpError(500)));

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Failed to load connectors')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('renders an error state when the API answers success: false', async () => {
        server.use(respond('get', '/mcpservers', () => failureEnvelope('Connector catalog unavailable')));

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Failed to load connectors')).toBeInTheDocument();
        });
    });

    it('recovers when Retry is clicked after a failure', async () => {
        let attempt = 0;

        server.use(
            http.get(apiUrl('/mcpservers'), ({ request }) => {
                attempt += 1;

                if (attempt <= 2) {
                    return httpError(500);
                }

                return pagedEnvelope(
                    new URL(request.url).searchParams.get('connected') === 'true' ? [oauthConnected] : [],
                );
            }),
        );

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Failed to load connectors')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => {
            expect(screen.getByText('Google Drive')).toBeInTheDocument();
        });

        expect(attempt).toBeGreaterThan(2);
    });

    it('requests the first not-connected page with the configured page size', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/mcpservers'), ({ request }) => {
                if (new URL(request.url).searchParams.get('connected') === 'false') {
                    requestUrl = request.url;
                }

                return pagedEnvelope([]);
            }),
        );

        renderSettingsConnectors();

        await waitFor(() => {
            expect(requestUrl).not.toBe('');
        });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('page')).toBe('0');
        expect(params.get('size')).toBe('20');
        expect(params.has('search')).toBe(false);
    });

    it('sends the typed query as a search param and shows the no-match empty state', async () => {
        const searches: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/mcpservers'), ({ request }) => {
                const params = new URL(request.url).searchParams;
                const search = params.get('search');

                searches.push(search);

                if (search || params.get('connected') !== 'true') {
                    return pagedEnvelope([]);
                }

                return pagedEnvelope([oauthConnected]);
            }),
        );

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Google Drive')).toBeInTheDocument();
        });

        await userEvent.type(screen.getByPlaceholderText('Search connectors'), 'zzz');

        await waitFor(
            () => {
                expect(searches).toContain('zzz');
            },
            { timeout: 3000 },
        );

        await waitFor(() => {
            expect(screen.getByText('Nothing matches "zzz". Try a different search.')).toBeInTheDocument();
        });
    });

    it('shows skeletons instead of stale rows while the two sections resolve a new search term', async () => {
        const searches: (string | null)[] = [];
        let releaseNotConnected = () => {};
        const notConnectedGate = new Promise<void>((resolve) => {
            releaseNotConnected = resolve;
        });

        server.use(
            http.get(apiUrl('/mcpservers'), async ({ request }) => {
                const params = new URL(request.url).searchParams;
                const search = params.get('search');
                const wantsConnected = params.get('connected') === 'true';

                searches.push(search);

                if (wantsConnected) {
                    return pagedEnvelope(search ? [] : [oauthConnected]);
                }

                if (!search) {
                    return pagedEnvelope([]);
                }

                await notConnectedGate;

                return pagedEnvelope([oauthNotConnected]);
            }),
        );

        const { container } = renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Google Drive')).toBeInTheDocument();
        });

        await userEvent.type(screen.getByPlaceholderText('Search connectors'), 'Jira');

        await waitFor(
            () => {
                expect(searches).toContain('Jira');
            },
            { timeout: 3000 },
        );

        await waitFor(() => {
            expect(container.querySelectorAll('.connectors-list-pane [data-slot="skeleton"]').length).toBeGreaterThan(
                0,
            );
        });

        expect(screen.queryByText('Google Drive')).not.toBeInTheDocument();

        releaseNotConnected();

        await waitFor(() => {
            expect(screen.getByText('Jira')).toBeInTheDocument();
        });

        expect(screen.queryByText('Google Drive')).not.toBeInTheDocument();
    });
});

describe('Settings connectors detail', () => {
    it('loads the selected connector and shows its metadata', async () => {
        stubCatalog([apiKeyServer]);
        server.use(respond('get', `/mcpservers/${apiKeyServer._id}`, () => envelope(apiKeyServer)));
        stubToolEndpoints(apiKeyServer._id);

        renderSettingsConnectors(`/settings/connectors/${apiKeyServer._id}`);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Weather' })).toBeInTheDocument();
        });

        expect(screen.getByText('Server URL')).toBeInTheDocument();
        expect(screen.getByText('https://mcp.example.com/weather')).toBeInTheDocument();
        expect(screen.getByText('Auth type')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Copy server url' })).toBeInTheDocument();
        expect(screen.getByText('No tools available')).toBeInTheDocument();
    });

    it('navigates to the connector detail route when a list item is clicked', async () => {
        stubCatalog([apiKeyServer]);

        const detailPaths: string[] = [];

        server.use(
            http.get(apiUrl('/mcpservers/:id'), ({ request }) => {
                detailPaths.push(new URL(request.url).pathname);

                return envelope(apiKeyServer);
            }),
        );
        stubToolEndpoints(apiKeyServer._id);

        renderSettingsConnectors();

        await waitFor(() => {
            expect(screen.getByText('Weather')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('Weather'));

        await waitFor(() => {
            expect(detailPaths).toContain('/mcpservers/srv-weather');
        });

        expect(await screen.findByRole('heading', { name: 'Weather' })).toBeInTheDocument();
    });

    it('shows a Retry error state when the connector detail request fails', async () => {
        stubCatalog([apiKeyServer]);
        server.use(respond('get', `/mcpservers/${apiKeyServer._id}`, () => httpError(500)));

        renderSettingsConnectors(`/settings/connectors/${apiKeyServer._id}`);

        await waitFor(() => {
            expect(screen.getByText('Failed to load connector')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: 'Back to connectors' })).toBeInTheDocument();
    });

    it('shows the error state when the detail endpoint answers success: false', async () => {
        stubCatalog([apiKeyServer]);
        server.use(respond('get', `/mcpservers/${apiKeyServer._id}`, () => failureEnvelope('Connector not found')));

        renderSettingsConnectors(`/settings/connectors/${apiKeyServer._id}`);

        await waitFor(() => {
            expect(screen.getByText('Failed to load connector')).toBeInTheDocument();
        });
    });

    it('disables an enabled non-oauth connector through the preferences endpoint', async () => {
        stubCatalog([apiKeyServer]);
        stubToolEndpoints(apiKeyServer._id);

        let putBody: unknown;
        let detailCalls = 0;

        server.use(
            http.get(apiUrl(`/mcpservers/${apiKeyServer._id}`), () => {
                detailCalls += 1;

                return envelope(
                    putBody
                        ? {
                              ...apiKeyServer,
                              preference: { mcpServerId: apiKeyServer._id, userId: 'user-1', disabled: true },
                          }
                        : apiKeyServer,
                );
            }),
            http.put(apiUrl(`/mcpservers/${apiKeyServer._id}/preferences`), async ({ request }) => {
                putBody = await request.json();

                return envelope({ mcpServerId: apiKeyServer._id, userId: 'user-1', disabled: true });
            }),
        );

        renderSettingsConnectors(`/settings/connectors/${apiKeyServer._id}`);

        const disableButton = await screen.findByRole('button', { name: 'Disable' });

        expect(detailCalls).toBeGreaterThan(0);

        await userEvent.click(disableButton);

        await waitFor(() => {
            expect(putBody).toEqual({ disabled: true });
        });

        expect(await screen.findByRole('button', { name: 'Enable' })).toBeInTheDocument();
    });

    it('re-enables a disabled non-oauth connector', async () => {
        const disabledServer = {
            ...apiKeyServer,
            preference: { mcpServerId: apiKeyServer._id, userId: 'user-1', disabled: true },
        } as McpServer;

        stubCatalog([disabledServer]);
        stubToolEndpoints(apiKeyServer._id);

        let putBody: unknown;

        server.use(
            respond('get', `/mcpservers/${apiKeyServer._id}`, () => envelope(disabledServer)),
            http.put(apiUrl(`/mcpservers/${apiKeyServer._id}/preferences`), async ({ request }) => {
                putBody = await request.json();

                return envelope({ mcpServerId: apiKeyServer._id, userId: 'user-1', disabled: false });
            }),
        );

        renderSettingsConnectors(`/settings/connectors/${apiKeyServer._id}`);

        await userEvent.click(await screen.findByRole('button', { name: 'Enable' }));

        await waitFor(() => {
            expect(putBody).toEqual({ disabled: false });
        });
    });

    it('disconnects a connected oauth connector after confirmation', async () => {
        stubCatalog([oauthConnected]);
        stubToolEndpoints(oauthConnected._id, [{ name: 'search_files', annotations: { readOnlyHint: true } }]);

        let disconnectCalls = 0;

        server.use(
            respond('get', `/mcpservers/${oauthConnected._id}`, () => envelope(oauthConnected)),
            http.post(apiUrl(`/mcpservers/${oauthConnected._id}/disconnect`), () => {
                disconnectCalls += 1;

                return envelope(null);
            }),
        );

        renderSettingsConnectors(`/settings/connectors/${oauthConnected._id}`);

        await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));

        expect(
            await screen.findByText("Disconnect Google Drive? You'll need to reconnect and authorize again to use it."),
        ).toBeInTheDocument();

        const dialog = screen.getByRole('alertdialog');

        await userEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));

        await waitFor(() => {
            expect(disconnectCalls).toBe(1);
        });
    });

    it('renders the tool permissions list for a connected oauth connector', async () => {
        stubCatalog([oauthConnected]);
        server.use(respond('get', `/mcpservers/${oauthConnected._id}`, () => envelope(oauthConnected)));
        stubToolEndpoints(oauthConnected._id, [
            { name: 'search_files', annotations: { readOnlyHint: true } },
            { name: 'delete_file', annotations: { readOnlyHint: false } },
        ]);

        renderSettingsConnectors(`/settings/connectors/${oauthConnected._id}`);

        await waitFor(() => {
            expect(screen.getByText('Tool permissions')).toBeInTheDocument();
        });

        expect(screen.getByText('Read-only tools')).toBeInTheDocument();
        expect(screen.getByText('Write & delete tools')).toBeInTheDocument();
        expect(screen.getByText('search_files')).toBeInTheDocument();
        expect(screen.getByText('delete_file')).toBeInTheDocument();
    });

    it('shows the tools error state with a Try again action when the tools request fails', async () => {
        stubCatalog([oauthConnected]);
        server.use(
            respond('get', `/mcpservers/${oauthConnected._id}`, () => envelope(oauthConnected)),
            respond('get', `/mcpservers/${oauthConnected._id}/tools`, () => httpError(503)),
            respond('get', `/mcpservers/${oauthConnected._id}/tools-preferences`, () => envelope([])),
        );

        renderSettingsConnectors(`/settings/connectors/${oauthConnected._id}`);

        await waitFor(() => {
            expect(screen.getByText("Couldn't load tools")).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('does not fetch tools for a connector that is not connected', async () => {
        stubCatalog([oauthNotConnected]);
        server.use(respond('get', `/mcpservers/${oauthNotConnected._id}`, () => envelope(oauthNotConnected)));

        renderSettingsConnectors(`/settings/connectors/${oauthNotConnected._id}`);

        await waitFor(() => {
            expect(screen.getByText('Tools are unavailable')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    });
});
