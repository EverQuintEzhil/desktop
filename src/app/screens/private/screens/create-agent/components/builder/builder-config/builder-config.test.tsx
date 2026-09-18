import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { installRichTextDomShims } from '@/test/dom-shims';
import { apiUrl, envelope, rawPaged, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import type { AgentConfigDraft } from '../../../types';

import BuilderConfig from './builder-config';

installRichTextDomShims();

const stubCatalogs = () => {
    ['/tools', '/agents', '/memories', '/mcpservers', '/skills', '/datastores', '/models'].forEach((path) => {
        server.use(respond('get', path, () => envelope(rawPaged([]))));
    });
    server.use(respond('get', '/users/me/mcpconnections', () => envelope(rawPaged([]))));
};

const renderConfig = (config: AgentConfigDraft = {}) => {
    const handlers = {
        onChange: vi.fn(),
        onGenerateSkill: vi.fn(),
        onViewSkill: vi.fn(),
        onViewDataStore: vi.fn(),
        onViewChannel: vi.fn(),
        onOpenSettings: vi.fn(),
    };

    const view = renderWithProviders(<BuilderConfig agentId="agent-1" config={config} {...handlers} />);

    return { ...view, ...handlers };
};

describe('BuilderConfig', () => {
    it('lists primary capability rows and keeps advanced ones collapsed', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        renderConfig();

        ['Add model', 'Add skill', 'Add files store', 'Add web link store', 'Add connector'].forEach((label) => {
            expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
        });

        expect(screen.queryByRole('button', { name: 'Add tool' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Advanced' }));

        ['Add tool', 'Add DB store', 'Add API store', 'Add agent', 'Add memory'].forEach((label) => {
            expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
        });
    });

    it('edits the agent name through onChange', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        const { onChange } = renderConfig({ name: 'Bot' });

        await user.type(screen.getByLabelText('Agent name'), '!');

        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Bot!' }));
    });

    it('shows a chip per attached capability', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        renderConfig({
            tools: [{ _id: 'tool-1', name: 'Search' }],
            skills: [{ _id: 'skill-1', name: 'Weekly report' }],
            agents: [{ _id: 'sub-1', name: 'Researcher' }],
            memories: [{ _id: 'mem-1', name: 'Preferences' }],
            mcpServers: [{ _id: 'mcp-1', name: 'Slack' }],
            files: [{ _id: 'ds-1', name: 'Orders DB', provider: 'mongodb' }],
            models: [{ _id: 'm-1', name: 'gpt-5' }],
        });

        expect(screen.getByRole('button', { name: 'View Slack details' })).toBeInTheDocument();
        expect(screen.getByText('Weekly report')).toBeInTheDocument();
        expect(screen.getByText('gpt-5')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Advanced' }));

        expect(screen.getByRole('button', { name: 'View Search details' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'View Researcher details' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'View Preferences details' })).toBeInTheDocument();
        expect(screen.getByText('Orders DB')).toBeInTheDocument();
    });

    it('confirms before detaching a tool and then removes it', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        const { onChange } = renderConfig({
            tools: [
                { _id: 'tool-1', name: 'Search' },
                { _id: 'tool-2', name: 'Fetch' },
            ],
        });

        await user.click(screen.getByRole('button', { name: 'Advanced' }));
        await user.click(screen.getByRole('button', { name: 'Remove Search' }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({
                tools: [{ _id: 'tool-2', name: 'Fetch' }],
            }),
        );
    });

    it('leaves the capability attached when the removal is cancelled', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        const { onChange } = renderConfig({ tools: [{ _id: 'tool-1', name: 'Search' }] });

        await user.click(screen.getByRole('button', { name: 'Advanced' }));
        await user.click(screen.getByRole('button', { name: 'Remove Search' }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('opens the capability picker for the row that was clicked', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        renderConfig();

        await user.click(screen.getByRole('button', { name: 'Advanced' }));
        await user.click(screen.getByRole('button', { name: 'Add tool' }));

        expect(await screen.findByLabelText('Search tools')).toBeInTheDocument();
    });

    it('opens the skills picker from the skills row', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        renderConfig();

        await user.click(screen.getByRole('button', { name: 'Add skill' }));

        expect(await screen.findByLabelText('Search skills')).toBeInTheDocument();
    });

    it('opens the files picker scoped to the clicked store category', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        renderConfig();

        await user.click(screen.getByRole('button', { name: 'Add web link store' }));

        expect(await screen.findByLabelText('Search Web Links Stores')).toBeInTheDocument();
    });

    it('attaches a data store created from the picker before opening it', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        server.use(http.post(apiUrl('/datastores'), () => envelope({ _id: 'ds-new', name: 'Product Docs' })));

        const { onChange, onViewDataStore } = renderConfig({ files: [] });

        await user.click(screen.getByRole('button', { name: 'Add files store' }));
        await user.type(await screen.findByPlaceholderText('Product documentation'), 'Product Docs');
        await user.click(screen.getByRole('button', { name: 'Create Files store' }));

        await waitFor(() => {
            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    files: [expect.objectContaining({ _id: 'ds-new', name: 'Product Docs', provider: 'files' })],
                }),
            );
        });
        expect(onViewDataStore).toHaveBeenCalledWith('ds-new');
    });

    it('routes the model row to the settings modal instead of a picker', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        const { onOpenSettings } = renderConfig();

        await user.click(screen.getByRole('button', { name: 'Add model' }));

        expect(onOpenSettings).toHaveBeenCalled();
    });

    it('lets a model be removed only when it is not the last one', () => {
        stubCatalogs();
        const single = renderConfig({ models: [{ _id: 'm-1', name: 'gpt-5' }] });

        expect(screen.queryByRole('button', { name: 'Remove gpt-5' })).not.toBeInTheDocument();

        single.unmount();
        renderConfig({
            models: [
                { _id: 'm-1', name: 'gpt-5' },
                { _id: 'm-2', name: 'claude-5' },
            ],
        });

        expect(screen.getByRole('button', { name: 'Remove gpt-5' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove claude-5' })).toBeInTheDocument();
    });

    it('opens the explainer dialog for a capability row', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        renderConfig();

        await user.click(screen.getByRole('button', { name: 'About Connectors' }));

        const dialog = await screen.findByRole('dialog');

        expect(within(dialog).getByText('Connectors')).toBeInTheDocument();
    });

    it('opens the chat channel editor from the channel card', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        const { onViewChannel } = renderConfig();

        await user.click(screen.getByRole('button', { name: 'Edit chat channel' }));

        expect(onViewChannel).toHaveBeenCalled();
    });

    it('opens the chat channel editor from the keyboard', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        const { onViewChannel } = renderConfig();

        screen.getByRole('button', { name: 'Edit chat channel' }).focus();
        await user.keyboard('{Enter}');

        expect(onViewChannel).toHaveBeenCalled();
    });

    it('reports an instruction edit through onChange', async () => {
        const user = userEvent.setup();

        stubCatalogs();
        const { onChange } = renderConfig({ instructions: '' });

        const editor = document.querySelector('.ca-instr-editor') as HTMLElement;

        await user.click(editor);
        await user.keyboard('Be helpful');

        await waitFor(() => {
            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    instructions: expect.stringContaining('Be helpful'),
                }),
            );
        });
    });
});
