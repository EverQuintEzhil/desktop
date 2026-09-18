import { useQuery, useQueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { createRef, useEffect, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it } from 'vitest';

import { AgentComposerContext, useAgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import { useAgentComposerOptions } from '@/components/agent-chat/hooks/use-agent-composer-options';
import type { AgentComposerContextValue } from '@/components/agent-chat/types';
import { ChatHostProvider } from '@/components/chat-host';
import type { ChatHost } from '@/components/chat-host';
import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';
import type { ChatFilesState } from '@/types/chat';

import ChatToolsPanel from './chat-tools-panel';

const ROUTE = '/agent/test-agent/spaces/project-1?tab=tools';

const chatHost = {
    session: { user: { id: 'user-1' }, tenant: { id: 'tenant-1' } },
} as unknown as ChatHost;

/** Attached OAuth connector, connected with a token that never expires. */
const attachedOauth = {
    _id: 'mcp-attached',
    name: 'Github',
    authType: 'oauth',
    serverUrl: 'https://mcp.github.com/sse',
    connection: { status: 'connected', tokenExpiry: null },
};

const attachedApiKey = {
    _id: 'mcp-basic',
    name: 'Weather',
    authType: 'apiKey',
};

/** `GET /mcpservers?createdByMe=true` — the user's own connectors. */
const customConnector = {
    _id: 'mcp-custom',
    name: 'My Notion',
    authType: 'apiKey',
    globalEnabled: true,
    creator: { _id: 'user-1' },
};

/** `GET /mcpservers` — entitled, created by somebody else. */
const sharedConnector = {
    _id: 'mcp-shared',
    name: 'Corp Drive',
    authType: 'apiKey',
    globalEnabled: true,
    creator: { _id: 'user-2' },
};

const attachedSkill = {
    _id: 'skill-attached',
    name: 'Summarise',
    description: 'Condense a long document',
};

const customSkill = {
    _id: 'skill-custom',
    name: 'My skill',
    category: 'personal',
    globalEnabled: true,
};

const sharedSkill = {
    _id: 'skill-shared',
    name: 'Corp skill',
    category: 'enterprise',
    globalEnabled: true,
};

const allowAll = {
    componentType: 'chat',
    allowCustomConnectors: true,
    allowSharedConnectors: true,
    allowCustomSkills: true,
    allowSharedSkills: true,
};

const allowNone = {
    componentType: 'chat',
    allowCustomConnectors: false,
    allowSharedConnectors: false,
    allowCustomSkills: false,
    allowSharedSkills: false,
};

interface AgentOverrides {
    uiConfig?: Record<string, unknown>;
    mcpServers?: Record<string, unknown>[];
    skills?: Record<string, unknown>[];
}

const buildAgent = ({ uiConfig = allowAll, mcpServers = [], skills = [] }: AgentOverrides = {}) =>
    ({
        _id: 'agent-1',
        slug: 'test-agent',
        name: 'Test Agent',
        uiConfig,
        settings: uiConfig,
        mcpServers,
        skills,
    }) as unknown as ChatAgentType;

/** URLs of every catalog read, in arrival order. */
let catalogUrls: string[] = [];
/** `[url, body]` of every preference write. Writes only — the toggle's `onSettled` refetches the catalogs. */
let writes: [string, unknown][] = [];

beforeEach(() => {
    catalogUrls = [];
    writes = [];
    // The composer reads the per-agent model preference on mount.
    server.use(http.get(apiUrl('/agents/:agentId/preferences'), () => envelope(null)));
});

interface CatalogStubs {
    custom?: Record<string, unknown>[];
    shared?: Record<string, unknown>[];
    skills?: Record<string, unknown>[];
    connectorsResponse?: () => Response;
    skillsResponse?: () => Response;
}

const stubCatalogs = ({
    custom = [],
    shared = [],
    skills = [],
    connectorsResponse,
    skillsResponse,
}: CatalogStubs = {}) => {
    server.use(
        http.get(apiUrl('/mcpservers'), ({ request }) => {
            catalogUrls.push(request.url);

            if (connectorsResponse) {
                return connectorsResponse();
            }

            const isCustom = new URL(request.url).searchParams.get('createdByMe') === 'true';

            return pagedEnvelope(isCustom ? custom : shared);
        }),
        http.get(apiUrl('/skills'), ({ request }) => {
            catalogUrls.push(request.url);

            return skillsResponse ? skillsResponse() : pagedEnvelope(skills);
        }),
    );
};

const stubPreferenceWrites = (build: () => Response = () => envelope({ disabled: true })) => {
    server.use(
        http.put(apiUrl('/mcpservers/:id/preferences'), async ({ request }) => {
            writes.push([request.url, await request.json()]);

            return build();
        }),
        http.put(apiUrl('/skills/:id/preferences'), async ({ request }) => {
            writes.push([request.url, await request.json()]);

            return build();
        }),
    );
};

const FromProbe = () => {
    const { state } = useLocation();

    return <div>{`from: ${(state as { from?: string } | null)?.from}`}</div>;
};

const emptyFilesState = {
    files: [],
    isUploading: false,
    fileInputRef: createRef<HTMLInputElement>(),
    setFiles: () => {},
    updateFileById: () => {},
    addFiles: () => {},
    onChangeFile: () => {},
    clearFiles: () => {},
    retryUpload: () => {},
} as unknown as ChatFilesState;

/** Owns one composer instance so the panel shares toggle state with the "+" menus. */
const PanelUnderComposer = ({ agent, children }: { agent: ChatAgentType; children?: ReactNode }) => {
    const queryClient = useQueryClient();

    useEffect(() => {
        queryClient.setQueryData(['agent', agent._id], agent);
    }, [agent, queryClient]);

    const { data: liveAgent = agent } = useQuery({
        queryKey: ['agent', agent._id],
        queryFn: () => queryClient.getQueryData<ChatAgentType>(['agent', agent._id]) ?? agent,
        initialData: agent,
        staleTime: Infinity,
    });

    const composer = useAgentComposerOptions(liveAgent, () => {});

    return (
        <AgentComposerContext.Provider
            value={{ composer, filesState: emptyFilesState } satisfies AgentComposerContextValue}
        >
            <ChatToolsPanel agent={liveAgent} />
            {children}
        </AgentComposerContext.Provider>
    );
};

const ComposerMirror = ({ connectorId }: { connectorId: string }) => {
    const { composer } = useAgentComposerContext();

    return <div data-testid="composer-mirror">{composer.connectors.disabledMap[connectorId] ? 'off' : 'on'}</div>;
};

const renderPanel = (agent: ChatAgentType, children?: ReactNode): ReturnType<typeof renderWithProviders> =>
    renderWithProviders(
        <ChatHostProvider value={chatHost}>
            <Routes>
                <Route
                    path="/agent/:agentSlug/spaces/:projectId"
                    element={<PanelUnderComposer agent={agent}>{children}</PanelUnderComposer>}
                />
                <Route path="/settings/connectors" element={<FromProbe />} />
                <Route path="/settings/skills" element={<FromProbe />} />
            </Routes>
            <Toaster />
        </ChatHostProvider>,
        { route: ROUTE },
    );

const sectionOf = (container: HTMLElement, name: 'connectors' | 'skills'): HTMLElement =>
    container.querySelector(`.chat-tools-panel-${name}`) as HTMLElement;

const rowFor = (name: string): HTMLElement =>
    screen.getByRole('switch', { name: `Toggle ${name}` }).closest('li') as HTMLElement;

const fullAgent = (): ChatAgentType =>
    buildAgent({
        mcpServers: [attachedOauth, attachedApiKey],
        skills: [attachedSkill],
    });

describe('ChatToolsPanel', () => {
    it('shows both empty states and asks for no catalogs when the agent allows neither custom nor shared', async () => {
        stubCatalogs({ custom: [customConnector], shared: [sharedConnector], skills: [customSkill] });

        const { container, rerender } = renderPanel(buildAgent({ uiConfig: allowNone }));

        expect(await screen.findByText('No connectors found')).toBeInTheDocument();
        expect(screen.getByText('No skills found')).toBeInTheDocument();
        expect(within(sectionOf(container, 'connectors')).getByText('0')).toBeInTheDocument();
        expect(within(sectionOf(container, 'skills')).getByText('0')).toBeInTheDocument();

        // The zero above is only load-bearing if the same recorder can reach the
        // catalogs — flipping the flags on must produce exactly three reads.
        rerender(
            <ChatHostProvider value={chatHost}>
                <Routes>
                    <Route
                        path="/agent/:agentSlug/spaces/:projectId"
                        element={<PanelUnderComposer agent={buildAgent({ uiConfig: allowAll })} />}
                    />
                </Routes>
            </ChatHostProvider>,
        );

        expect(await screen.findByText('My Notion')).toBeInTheDocument();
        await waitFor(() => expect(catalogUrls).toHaveLength(3));
    });

    it('asks each catalog for the agent-scoped page it needs', async () => {
        stubCatalogs({ custom: [customConnector], shared: [sharedConnector], skills: [customSkill] });

        renderPanel(fullAgent());

        await screen.findByText('My Notion');
        await waitFor(() => expect(catalogUrls).toHaveLength(3));

        const params = catalogUrls.map((url) => new URL(url));
        const customRead = params.find((url) => url.searchParams.get('createdByMe') === 'true');
        const sharedRead = params.find((url) => url.pathname === '/mcpservers' && !url.searchParams.get('createdByMe'));
        const skillsRead = params.find((url) => url.pathname === '/skills');

        expect(customRead?.searchParams.get('agentId')).toBe('agent-1');
        expect(customRead?.searchParams.get('size')).toBe('100');
        expect(sharedRead?.searchParams.get('agentId')).toBe('agent-1');
        expect(sharedRead?.searchParams.get('size')).toBe('100');
        expect(skillsRead?.searchParams.get('agentId')).toBe('agent-1');
        // Composer skills ask for the full entitled set (`size: 0`).
        expect(skillsRead?.searchParams.get('size')).toBe('0');
    });

    it('merges attached, custom and shared entries and badges the merged ones', async () => {
        stubCatalogs({ custom: [customConnector], shared: [sharedConnector], skills: [customSkill, sharedSkill] });

        const { container } = renderPanel(fullAgent());

        expect(await screen.findByText('My Notion')).toBeInTheDocument();
        expect(screen.getByText('Github')).toBeInTheDocument();
        expect(screen.getByText('Weather')).toBeInTheDocument();
        expect(screen.getByText('Corp Drive')).toBeInTheDocument();

        expect(within(rowFor('My Notion')).getByLabelText('Your custom connector')).toBeInTheDocument();
        expect(within(rowFor('Corp Drive')).getByLabelText('Enterprise')).toBeInTheDocument();
        expect(within(rowFor('Github')).queryByLabelText('Your custom connector')).not.toBeInTheDocument();

        expect(screen.getByText('Summarise')).toBeInTheDocument();
        expect(screen.getByText('Condense a long document')).toBeInTheDocument();
        expect(within(rowFor('My skill')).getByLabelText('Your custom skill')).toBeInTheDocument();
        expect(within(rowFor('Corp skill')).getByLabelText('Enterprise')).toBeInTheDocument();

        expect(within(sectionOf(container, 'connectors')).getByText('4')).toBeInTheDocument();
        expect(within(sectionOf(container, 'skills')).getByText('3')).toBeInTheDocument();
    });

    it('drops a connector the catalog already attached to the agent', async () => {
        stubCatalogs({
            custom: [{ ...customConnector, _id: 'mcp-basic', name: 'Weather' }],
            shared: [sharedConnector],
            skills: [{ ...customSkill, _id: 'skill-attached', name: 'Summarise' }],
        });

        const { container } = renderPanel(fullAgent());

        expect(await screen.findByText('Corp Drive')).toBeInTheDocument();
        expect(screen.getAllByText('Weather')).toHaveLength(1);
        expect(screen.getAllByText('Summarise')).toHaveLength(1);
        expect(within(sectionOf(container, 'connectors')).getByText('3')).toBeInTheDocument();
        expect(within(sectionOf(container, 'skills')).getByText('1')).toBeInTheDocument();
    });

    it('hides an OAuth connector that has never finished connecting', async () => {
        stubCatalogs();

        const { container } = renderPanel(
            buildAgent({
                uiConfig: allowNone,
                mcpServers: [
                    {
                        ...attachedOauth,
                        _id: 'mcp-pending',
                        name: 'Pending server',
                        connection: { status: 'pending', tokenExpiry: null },
                    },
                    {
                        ...attachedOauth,
                        _id: 'mcp-none',
                        name: 'Never connected',
                        connection: null,
                    },
                    attachedApiKey,
                ],
            }),
        );

        expect(await screen.findByText('Weather')).toBeInTheDocument();
        expect(screen.queryByText('Pending server')).not.toBeInTheDocument();
        expect(screen.queryByText('Never connected')).not.toBeInTheDocument();
        expect(within(sectionOf(container, 'connectors')).getByText('1')).toBeInTheDocument();
    });

    it('falls back to the attached entries when both catalogs return 500, offering no error or retry', async () => {
        stubCatalogs({
            connectorsResponse: () => httpError(500),
            skillsResponse: () => httpError(500),
        });

        renderPanel(fullAgent());

        expect(await screen.findByText('Github')).toBeInTheDocument();
        await waitFor(() => expect(catalogUrls).toHaveLength(3));

        expect(screen.getByText('Summarise')).toBeInTheDocument();
        expect(screen.queryByText('My Notion')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it('falls back to the attached entries when both catalogs answer success:false', async () => {
        stubCatalogs({
            connectorsResponse: () => failureEnvelope('Connectors unavailable'),
            skillsResponse: () => failureEnvelope('Skills unavailable'),
        });

        renderPanel(fullAgent());

        expect(await screen.findByText('Github')).toBeInTheDocument();
        await waitFor(() => expect(catalogUrls).toHaveLength(3));

        expect(screen.getByText('Summarise')).toBeInTheDocument();
        expect(screen.queryByText('Corp Drive')).not.toBeInTheDocument();
        expect(screen.queryByText('Connectors unavailable')).not.toBeInTheDocument();
    });

    it('links each section to its settings page carrying the current location as return state', async () => {
        stubCatalogs();

        const user = userEvent.setup();

        renderPanel(buildAgent({ uiConfig: allowNone }));

        const links = await screen.findAllByRole('link', { name: 'Manage' });

        expect(links[0]).toHaveAttribute('href', '/settings/connectors');
        expect(links[1]).toHaveAttribute('href', '/settings/skills');

        await user.click(links[0]);

        expect(await screen.findByText('from: /agent/test-agent/spaces/project-1?tab=tools')).toBeInTheDocument();
    });

    it('writes a single disable preference for the toggled connector', async () => {
        stubCatalogs();
        stubPreferenceWrites();

        const user = userEvent.setup();

        renderPanel(buildAgent({ uiConfig: allowNone, mcpServers: [attachedOauth, attachedApiKey] }));

        const toggle = await screen.findByRole('switch', { name: 'Toggle Github' });

        expect(toggle).toBeChecked();

        await user.click(toggle);

        await waitFor(() => expect(toggle).not.toBeChecked());
        await waitFor(() => expect(writes).toHaveLength(1));
        expect(new URL(writes[0][0]).pathname).toBe('/mcpservers/mcp-attached/preferences');
        expect(writes[0][1]).toEqual({ disabled: true, agentId: 'agent-1' });
    });

    it('keeps the composer mirror in sync when the panel toggles a connector', async () => {
        stubCatalogs();
        stubPreferenceWrites();

        const user = userEvent.setup();

        renderPanel(
            buildAgent({ uiConfig: allowNone, mcpServers: [attachedOauth] }),
            <ComposerMirror connectorId="mcp-attached" />,
        );

        const toggle = await screen.findByRole('switch', { name: 'Toggle Github' });
        const mirror = screen.getByTestId('composer-mirror');

        expect(toggle).toBeChecked();
        expect(mirror).toHaveTextContent('on');

        await user.click(toggle);

        await waitFor(() => expect(toggle).not.toBeChecked());
        expect(mirror).toHaveTextContent('off');
    });

    it('rolls the connector toggle back and warns when the preference write fails', async () => {
        stubCatalogs();
        stubPreferenceWrites(() => httpError(500));

        const user = userEvent.setup();

        renderPanel(buildAgent({ uiConfig: allowNone, mcpServers: [attachedApiKey] }));

        const toggle = await screen.findByRole('switch', { name: 'Toggle Weather' });

        await user.click(toggle);

        expect(await screen.findByText("Couldn't update connector. Please try again.")).toBeInTheDocument();
        await waitFor(() => expect(toggle).toBeChecked());
    });

    it('starts a connector off when the server reports it disabled and re-enables it on click', async () => {
        stubCatalogs();
        stubPreferenceWrites(() => envelope({ disabled: false }));

        const user = userEvent.setup();

        renderPanel(
            buildAgent({
                uiConfig: allowNone,
                mcpServers: [{ ...attachedApiKey, effectiveEnabled: false }],
            }),
        );

        const toggle = await screen.findByRole('switch', { name: 'Toggle Weather' });

        expect(toggle).not.toBeChecked();

        await user.click(toggle);

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(writes[0][1]).toEqual({ disabled: false, agentId: 'agent-1' });
    });

    it('writes a single disable preference for the toggled skill', async () => {
        stubCatalogs();
        stubPreferenceWrites();

        const user = userEvent.setup();

        renderPanel(buildAgent({ uiConfig: allowNone, skills: [attachedSkill] }));

        const toggle = await screen.findByRole('switch', { name: 'Toggle Summarise' });

        expect(toggle).toBeChecked();

        await user.click(toggle);

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(new URL(writes[0][0]).pathname).toBe('/skills/skill-attached/preferences');
        expect(writes[0][1]).toEqual({ disabled: true, agentId: 'agent-1' });
    });

    it('rolls the skill toggle back and warns when the preference write fails', async () => {
        stubCatalogs();
        stubPreferenceWrites(() => httpError(500));

        const user = userEvent.setup();

        renderPanel(buildAgent({ uiConfig: allowNone, skills: [attachedSkill] }));

        const toggle = await screen.findByRole('switch', { name: 'Toggle Summarise' });

        await user.click(toggle);

        expect(await screen.findByText("Couldn't update skill. Please try again.")).toBeInTheDocument();
        await waitFor(() => expect(toggle).toBeChecked());
    });

    it('offers Reconnect only for a connected OAuth server whose token has expired', async () => {
        stubCatalogs();

        renderPanel(
            buildAgent({
                uiConfig: allowNone,
                mcpServers: [
                    attachedOauth,
                    {
                        ...attachedOauth,
                        _id: 'mcp-expired',
                        name: 'Expired server',
                        connection: { status: 'connected', tokenExpiry: '2020-01-01T00:00:00.000Z' },
                    },
                    {
                        ...attachedOauth,
                        _id: 'mcp-expired-off',
                        name: 'Expired and off',
                        effectiveEnabled: false,
                        connection: { status: 'connected', tokenExpiry: '2020-01-01T00:00:00.000Z' },
                    },
                ],
            }),
        );

        expect(await screen.findByText('Expired server')).toBeInTheDocument();
        expect(within(rowFor('Expired server')).getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
        expect(within(rowFor('Github')).queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument();
        expect(within(rowFor('Expired and off')).queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument();
    });

    it('asks the connect endpoint for an authorization url and surfaces its failure', async () => {
        stubCatalogs();

        let connectUrl = '';

        server.use(
            http.get(apiUrl('/mcpservers/mcp-expired/connect'), ({ request }) => {
                connectUrl = request.url;

                return failureEnvelope('Connector is unavailable.');
            }),
        );

        const user = userEvent.setup();

        renderPanel(
            buildAgent({
                uiConfig: allowNone,
                mcpServers: [
                    {
                        ...attachedOauth,
                        _id: 'mcp-expired',
                        name: 'Expired server',
                        connection: { status: 'connected', tokenExpiry: '2020-01-01T00:00:00.000Z' },
                    },
                ],
            }),
        );

        await user.click(await screen.findByRole('button', { name: 'Reconnect' }));

        expect(await screen.findByText('Connector is unavailable.')).toBeInTheDocument();
        expect(new URL(connectUrl).searchParams.get('redirectUrl')).toBe(window.location.href);
    });

    it('omits the hover description for a skill that has none', async () => {
        stubCatalogs();

        renderPanel(
            buildAgent({
                uiConfig: allowNone,
                skills: [attachedSkill, { _id: 'skill-bare', name: 'Bare skill' }],
            }),
        );

        expect(await screen.findByText('Bare skill')).toBeInTheDocument();
        expect(within(rowFor('Bare skill')).queryByText('Condense a long document')).not.toBeInTheDocument();
        expect(within(rowFor('Summarise')).getByText('Condense a long document')).toBeInTheDocument();
    });
});
