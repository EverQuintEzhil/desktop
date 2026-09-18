import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import type { McpTool, McpToolPreference } from '@/lib/api';
import { apiUrl } from '@/test/msw/base-url';
import { respond } from '@/test/msw/handlers';
import { envelope } from '@/test/msw/responses';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/test-utils';

import ConnectorTools from './connector-tools';

const SERVER_ID = 'mcp-1';

const LONG_DESCRIPTION =
    'Retrieve and extract content from one supplied URL through Firecrawl. It can return markdown, HTML, links, screenshots, or a structured JSON extraction.';

const SCRAPE: McpTool = {
    name: 'firecrawl_scrape',
    description: LONG_DESCRIPTION,
    annotations: { readOnlyHint: true },
};

const MAP: McpTool = {
    name: 'firecrawl_map',
    description: 'List every URL on a site.',
    annotations: { readOnlyHint: true },
};

const mockTools = (tools: McpTool[], preferences: McpToolPreference[]) => {
    server.use(
        respond('get', `/mcpservers/${SERVER_ID}/tools`, () => envelope(tools)),
        respond('get', `/mcpservers/${SERVER_ID}/tools-preferences`, () => envelope(preferences)),
    );
};

const capturePreferenceWrites = () => {
    const writes: unknown[] = [];

    server.use(
        http.put(apiUrl(`/mcpservers/${SERVER_ID}/tools-preferences`), async ({ request }) => {
            const body: unknown = await request.json();

            writes.push(body);

            return envelope(body);
        }),
    );

    return writes;
};

const renderTools = () => renderWithProviders(<ConnectorTools serverId={SERVER_ID} status="connected" />);

describe('Connector tools permission table', () => {
    beforeEach(() => {
        mockTools([SCRAPE, MAP], []);
    });

    it('renders one row per tool under a Tool/Access header', async () => {
        renderTools();

        expect(await screen.findByText('firecrawl_scrape')).toBeInTheDocument();
        expect(screen.getByText('firecrawl_map')).toBeInTheDocument();
        expect(screen.getByText('Tool')).toBeInTheDocument();
        expect(screen.getByText('Access')).toBeInTheDocument();
        expect(screen.getByText('Read-only tools')).toBeInTheDocument();
    });

    it('moves the description out of the row summary when the row is expanded', async () => {
        renderTools();

        const trigger = await screen.findByRole('button', { name: new RegExp(SCRAPE.name) });

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveTextContent(LONG_DESCRIPTION);

        await userEvent.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).not.toHaveTextContent(LONG_DESCRIPTION);
        expect(screen.getByText(LONG_DESCRIPTION)).toBeInTheDocument();
    });

    it('writes only the changed tool when a row permission is picked', async () => {
        const writes = capturePreferenceWrites();

        renderTools();

        const row = (await screen.findByText('firecrawl_scrape')).closest('[data-tool]') as HTMLElement;

        await userEvent.click(within(row).getByRole('radio', { name: 'Needs approval' }));

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(writes[0]).toMatchObject({ name: 'firecrawl_scrape', needsApproval: true, disabled: false });
    });

    it('writes every tool in the group when the group default is picked', async () => {
        const writes = capturePreferenceWrites();

        renderTools();

        await screen.findByText('firecrawl_scrape');
        const groupSwitch = screen.getAllByRole('radiogroup')[0];

        await userEvent.click(within(groupSwitch).getByRole('radio', { name: 'Blocked' }));

        await waitFor(() => expect(writes).toHaveLength(2));
        expect(writes).toEqual([
            expect.objectContaining({ name: 'firecrawl_scrape', disabled: true }),
            expect.objectContaining({ name: 'firecrawl_map', disabled: true }),
        ]);
    });

    it('reports a mixed group and leaves the group control unset', async () => {
        mockTools([SCRAPE, MAP], [{ toolName: MAP.name, needsApproval: true, hasUserPreferences: true }]);

        renderTools();

        expect(await screen.findByText('Custom')).toBeInTheDocument();

        const groupSwitch = screen.getAllByRole('radiogroup')[0];

        within(groupSwitch)
            .getAllByRole('radio')
            .forEach((option) => {
                expect(option).toHaveAttribute('aria-checked', 'false');
            });
    });
});
