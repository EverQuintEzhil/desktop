import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, rawPaged, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import { CapabilityPickerModal, type PickerItemKind } from './capability-picker-modal';

const item = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
    _id: id,
    name,
    description: `${name} description`,
    ...overrides,
});

const LIST_PATH: Record<PickerItemKind, string> = {
    mcp: '/mcpservers',
    tool: '/tools',
    agent: '/agents',
    memory: '/memories',
};

/** The mcp branch renders `McpDetailPanel`, which pulls its own connector payloads. */
const stubMcpDetail = (id: string) => {
    server.use(
        respond('get', `/mcpservers/${id}`, () =>
            envelope({
                _id: id,
                name: 'Slack',
                description: 'Slack connector',
                serverUrl: 'https://mcp.slack.test',
            }),
        ),
    );
    server.use(respond('get', `/mcpservers/${id}/tools`, () => envelope([])));
    server.use(respond('get', `/mcpservers/${id}/tools-preferences`, () => envelope([])));
    server.use(respond('get', '/users/me/mcpconnections', () => envelope(rawPaged([]))));
};

interface RenderOptions {
    kind?: PickerItemKind;
    selectedIds?: Set<string>;
    selectedItems?: { _id: string; name: string }[];
    open?: boolean;
    initialItemId?: string;
    initialItemName?: string;
    initialCreating?: boolean;
}

const renderModal = ({
    kind = 'tool',
    selectedIds = new Set<string>(),
    selectedItems,
    open = true,
    initialItemId,
    initialItemName,
    initialCreating,
}: RenderOptions = {}) => {
    const onClose = vi.fn();
    const onToggle = vi.fn();

    const view = renderWithProviders(
        <CapabilityPickerModal
            open={open}
            agentId="agent-1"
            onClose={onClose}
            selectedIds={selectedIds}
            selectedItems={selectedItems}
            onToggle={onToggle}
            kind={kind}
            initialItemId={initialItemId}
            initialItemName={initialItemName}
            initialCreating={initialCreating}
        />,
    );

    return { ...view, onClose, onToggle };
};

describe('CapabilityPickerModal', () => {
    it('renders nothing while closed', () => {
        server.use(respond('get', '/tools', () => envelope(rawPaged([]))));
        renderModal({ open: false });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it.each<[PickerItemKind, string]>([
        ['tool', 'Search tools'],
        ['agent', 'Search agents'],
        ['memory', 'Search memories'],
        ['mcp', 'Search connectors'],
    ])('lists %s items behind the "%s" box', async (kind, placeholder) => {
        server.use(respond('get', LIST_PATH[kind], () => envelope(rawPaged([item('item-1', 'Alpha')]))));
        renderModal({ kind });

        expect(await screen.findByRole('button', { name: /Alpha/ })).toBeInTheDocument();
        expect(screen.getByLabelText(placeholder)).toBeInTheDocument();
    });

    it('requests the first page at the picker page size', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/tools'), ({ request }) => {
                requestUrl = request.url;

                return envelope(rawPaged([item('tool-1', 'Search the web')]));
            }),
        );

        renderModal({ kind: 'tool' });

        await screen.findByRole('button', { name: /Search the web/ });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('size')).toBe('50');
        expect(params.get('page')).toBe('0');
    });

    it('requests only shareable attachable memories', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/memories'), ({ request }) => {
                requestUrl = request.url;

                return envelope(rawPaged([item('mem-1', 'Preferences')]));
            }),
        );

        renderModal({ kind: 'memory' });

        await screen.findByRole('button', { name: /Preferences/ });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('isShareable')).toBe('true');
        expect(params.getAll('kind')).toEqual(['semantic', 'learned_hint']);
    });

    it('drops the agent being edited from the agent list', async () => {
        server.use(
            respond('get', '/agents', () =>
                envelope(rawPaged([item('agent-1', 'This agent'), item('agent-2', 'Another agent')])),
            ),
        );

        renderModal({ kind: 'agent' });

        expect(await screen.findByRole('button', { name: /Another agent/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /This agent/ })).not.toBeInTheDocument();
    });

    it('shows the kind-specific empty state', async () => {
        server.use(respond('get', '/memories', () => envelope(rawPaged([]))));
        renderModal({ kind: 'memory' });

        expect(await screen.findByText('No memories found')).toBeInTheDocument();
    });

    it('surfaces a list error', async () => {
        server.use(respond('get', '/tools', () => httpError(500)));
        renderModal({ kind: 'tool' });

        expect(await screen.findByText(/Request failed with status code 500/)).toBeInTheDocument();
    });

    it('surfaces a success:false envelope as its message', async () => {
        server.use(
            respond('get', '/tools', () =>
                Response.json({
                    success: false,
                    message: 'Tool service unavailable',
                    value: null,
                }),
            ),
        );
        renderModal({ kind: 'tool' });

        expect(await screen.findByText('Tool service unavailable')).toBeInTheDocument();
    });

    it('debounces the search box into the list request', async () => {
        const user = userEvent.setup();
        const searches: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/tools'), ({ request }) => {
                searches.push(new URL(request.url).searchParams.get('search'));

                return envelope(rawPaged([item('tool-1', 'Search the web')]));
            }),
        );

        renderModal({ kind: 'tool' });

        await screen.findByRole('button', { name: /Search the web/ });
        await user.type(screen.getByLabelText('Search tools'), '  web  ');

        await waitFor(() => {
            expect(searches).toContain('web');
        });
        expect(searches.filter((term) => term === 'web')).toHaveLength(1);
    });

    it('clears the search from the inline button', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/tools', () => envelope(rawPaged([item('tool-1', 'Search the web')]))));
        renderModal({ kind: 'tool' });

        const input = await screen.findByLabelText('Search tools');

        await user.type(input, 'web');
        await user.click(screen.getByRole('button', { name: 'Clear search' }));

        expect(input).toHaveValue('');
    });

    it('splits already-selected items into their own group', async () => {
        server.use(
            respond('get', '/tools', () =>
                envelope(rawPaged([item('tool-1', 'Search the web'), item('tool-2', 'Read a file')])),
            ),
        );

        renderModal({
            kind: 'tool',
            selectedIds: new Set(['tool-1']),
            selectedItems: [{ _id: 'tool-1', name: 'Search the web' }],
        });

        expect(await screen.findByText('Selected')).toBeInTheDocument();
        expect(screen.getAllByText('Tools').length).toBeGreaterThan(0);
    });

    it('opens the overview pane for the picked tool', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/tools', () => envelope(rawPaged([item('tool-1', 'Search the web')]))));
        server.use(
            respond('get', '/tools/tool-1', () =>
                envelope(
                    item('tool-1', 'Search the web', {
                        description: 'Runs a web query',
                    }),
                ),
            ),
        );

        renderModal({ kind: 'tool' });

        await user.click(await screen.findByRole('button', { name: /Search the web/ }));

        expect(await screen.findByRole('heading', { name: 'Search the web' })).toBeInTheDocument();
        expect(await screen.findByText('Runs a web query')).toBeInTheDocument();
        expect(screen.getByText('Available')).toBeInTheDocument();
    });

    it('reports an enabled item as Enabled and offers Remove', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/tools', () => envelope(rawPaged([item('tool-1', 'Search the web')]))));
        server.use(respond('get', '/tools/tool-1', () => envelope(item('tool-1', 'Search the web'))));

        renderModal({
            kind: 'tool',
            selectedIds: new Set(['tool-1']),
            selectedItems: [{ _id: 'tool-1', name: 'Search the web' }],
        });

        await user.click((await screen.findAllByRole('button', { name: /Search the web/ }))[0]);

        expect(await screen.findByText('Enabled')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('reports the item kind back through onToggle', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/memories', () => envelope(rawPaged([item('mem-1', 'Preferences')]))));
        server.use(respond('get', '/memories/mem-1', () => envelope(item('mem-1', 'Preferences'))));
        server.use(respond('get', '/memories/mem-1/docs', () => envelope(rawPaged([]))));

        const { onToggle } = renderModal({ kind: 'memory' });

        await user.click(await screen.findByRole('button', { name: /Preferences/ }));
        await user.click(await screen.findByRole('button', { name: 'Enable' }));

        expect(onToggle).toHaveBeenCalledWith({ _id: 'mem-1', name: 'Preferences' }, 'memory');
    });

    it('renders memory kind, linked agents, and what we know from the detail payload', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/memories', () => envelope(rawPaged([item('mem-1', 'Preferences')]))));
        server.use(
            respond('get', '/memories/mem-1', () =>
                envelope(
                    item('mem-1', 'Preferences', {
                        kind: 'semantic',
                        agents: [{ _id: 'agent-1', name: 'Research Agent', slug: 'research-agent' }],
                    }),
                ),
            ),
        );
        server.use(respond('get', '/memories/mem-1/docs', () => envelope(rawPaged([]))));

        renderModal({ kind: 'memory' });

        await user.click(await screen.findByRole('button', { name: /Preferences/ }));

        expect(await screen.findByText('semantic')).toBeInTheDocument();
        expect(screen.getByText('Linked Agents')).toBeInTheDocument();
        expect(screen.getByText('Research Agent')).toBeInTheDocument();
        expect(screen.getByText('Here is what we know about you')).toBeInTheDocument();
        expect(screen.queryByText('Details')).not.toBeInTheDocument();
        expect(screen.queryByText('Cardinality')).not.toBeInTheDocument();
    });

    it('keeps learned hint docs out of the memory panel for an end user', async () => {
        const user = userEvent.setup();
        let docsRequests = 0;

        server.use(respond('get', '/memories', () => envelope(rawPaged([item('mem-1', 'Learned hints')]))));
        server.use(
            respond('get', '/memories/mem-1', () =>
                envelope(
                    item('mem-1', 'Learned hints', {
                        kind: 'learned_hint',
                    }),
                ),
            ),
        );
        server.use(
            http.get(apiUrl('/memories/mem-1/docs'), () => {
                docsRequests += 1;

                return envelope(rawPaged([]));
            }),
        );

        renderModal({ kind: 'memory' });

        await user.click(await screen.findByRole('button', { name: /Learned hints/ }));

        expect(await screen.findByText('Only your admin can view these')).toBeInTheDocument();
        expect(screen.getByText('How this memory works')).toBeInTheDocument();
        expect(screen.queryByText('Here is what we know about you')).not.toBeInTheDocument();
        expect(docsRequests).toBe(0);
    });

    it('reports a failed memory detail instead of an endless docs skeleton', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/memories', () => envelope(rawPaged([item('mem-1', 'Preferences')]))));
        server.use(respond('get', '/memories/mem-1', () => httpError(500)));

        renderModal({ kind: 'memory' });

        await user.click(await screen.findByRole('button', { name: /Preferences/ }));

        expect(await screen.findByText(/Couldn't load this memory/)).toBeInTheDocument();
    });

    it('falls back to placeholder copy when an item has no description', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/tools', () => envelope(rawPaged([{ _id: 'tool-1', name: 'Bare tool' }]))));
        server.use(respond('get', '/tools/tool-1', () => envelope({ _id: 'tool-1', name: 'Bare tool' })));

        renderModal({ kind: 'tool' });

        await user.click(await screen.findByRole('button', { name: /Bare tool/ }));

        expect(await screen.findByText(/No description has been provided/)).toBeInTheDocument();
    });

    it('opens straight into a detail pane for an initial item', async () => {
        server.use(respond('get', '/tools', () => envelope(rawPaged([item('tool-1', 'Search the web')]))));
        server.use(respond('get', '/tools/tool-1', () => envelope(item('tool-1', 'Search the web'))));

        renderModal({ kind: 'tool', initialItemId: 'tool-1', initialItemName: 'Search the web' });

        expect(await screen.findByRole('heading', { name: 'Search the web' })).toBeInTheDocument();
    });

    it('shows the connector detail panel for an mcp item', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/mcpservers', () => envelope(rawPaged([item('mcp-1', 'Slack')]))));
        stubMcpDetail('mcp-1');

        renderModal({ kind: 'mcp' });

        await user.click(await screen.findByRole('button', { name: /Slack/ }));

        expect(await screen.findByRole('heading', { name: 'Slack' })).toBeInTheDocument();
    });

    it('only offers the create action for connectors', async () => {
        server.use(respond('get', '/mcpservers', () => envelope(rawPaged([item('mcp-1', 'Slack')]))));

        const { unmount } = renderModal({ kind: 'mcp' });

        expect(
            await screen.findByRole('button', { name: /Add connector|New connector|Connector/ }),
        ).toBeInTheDocument();

        unmount();

        server.use(respond('get', '/tools', () => envelope(rawPaged([item('tool-1', 'Search the web')]))));
        renderModal({ kind: 'tool' });

        await screen.findByRole('button', { name: /Search the web/ });
        expect(screen.queryByRole('button', { name: /Add connector/ })).not.toBeInTheDocument();
    });

    it('closes from the empty pane header', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/tools', () => envelope(rawPaged([]))));
        const { onClose } = renderModal({ kind: 'tool' });

        await user.click(await screen.findByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalled();
    });
});
