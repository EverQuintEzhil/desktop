import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, rawPaged, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import type { AgentConfigItem } from '../../types';

import { SettingsModal } from './settings-modal';

const model = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
    _id: id,
    model: name,
    provider: 'openai',
    description: `${name} description`,
    ...overrides,
});

const stubList = (values: unknown[] = [model('m-1', 'gpt-5')]) => {
    server.use(respond('get', '/models', () => envelope(rawPaged(values))));
};

const renderModal = (models: AgentConfigItem[] = [], open = true) => {
    const onClose = vi.fn();
    const onChange = vi.fn();

    const view = renderWithProviders(
        <SettingsModal open={open} onClose={onClose} models={models} onChange={onChange} />,
    );

    return { ...view, onClose, onChange };
};

describe('SettingsModal', () => {
    it('renders nothing while closed', () => {
        stubList();
        renderModal([], false);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('lists the available models', async () => {
        stubList([model('m-1', 'gpt-5'), model('m-2', 'claude-5')]);
        renderModal();

        expect(await screen.findByRole('button', { name: /gpt-5/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /claude-5/ })).toBeInTheDocument();
        expect(screen.getByText('Select a model')).toBeInTheDocument();
    });

    it('asks only for text-generation models at the picker page size', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/models'), ({ request }) => {
                requestUrl = request.url;

                return envelope(rawPaged([model('m-1', 'gpt-5')]));
            }),
        );

        renderModal();

        await screen.findByRole('button', { name: /gpt-5/ });

        const params = new URL(requestUrl).searchParams;

        expect(params.getAll('capability')).toEqual(['text-generation']);
        expect(params.get('size')).toBe('100');
        expect(params.get('page')).toBe('0');
        expect(params.has('search')).toBe(false);
    });

    it('shows the empty state when nothing matches', async () => {
        stubList([]);
        renderModal();

        expect(await screen.findByText('No models found')).toBeInTheDocument();
    });

    it('surfaces a list error', async () => {
        server.use(respond('get', '/models', () => httpError(500)));
        renderModal();

        expect(await screen.findByText(/Request failed with status code 500/)).toBeInTheDocument();
    });

    it('surfaces a success:false envelope as its message', async () => {
        server.use(
            respond('get', '/models', () =>
                Response.json({
                    success: false,
                    message: 'Model catalog unavailable',
                    value: null,
                }),
            ),
        );
        renderModal();

        expect(await screen.findByText('Model catalog unavailable')).toBeInTheDocument();
    });

    it('debounces the search into the list request', async () => {
        const user = userEvent.setup();
        const searches: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/models'), ({ request }) => {
                searches.push(new URL(request.url).searchParams.get('search'));

                return envelope(rawPaged([model('m-1', 'gpt-5')]));
            }),
        );

        renderModal();

        await screen.findByRole('button', { name: /gpt-5/ });
        await user.type(screen.getByLabelText('Search models'), '  gpt  ');

        await waitFor(() => {
            expect(searches).toContain('gpt');
        });
        expect(searches.filter((term) => term === 'gpt')).toHaveLength(1);
    });

    it('splits the already-chosen models into their own group', async () => {
        stubList([model('m-1', 'gpt-5'), model('m-2', 'claude-5')]);
        renderModal([{ _id: 'm-1', name: 'gpt-5', provider: 'openai' }]);

        expect(await screen.findByText('Selected')).toBeInTheDocument();
        expect(screen.getByText('Available')).toBeInTheDocument();
    });

    it('opens the detail pane and fetches the full model', async () => {
        const user = userEvent.setup();

        stubList();
        server.use(
            respond('get', '/models/m-1', () =>
                envelope(
                    model('m-1', 'gpt-5', {
                        description: 'The newest frontier model',
                    }),
                ),
            ),
        );

        renderModal();

        await user.click(await screen.findByRole('button', { name: /gpt-5/ }));

        expect(await screen.findByRole('heading', { name: 'gpt-5' })).toBeInTheDocument();
        expect(await screen.findByText('The newest frontier model')).toBeInTheDocument();
        expect(screen.getByText('Available')).toBeInTheDocument();
    });

    it('shows a detail error without losing the header', async () => {
        const user = userEvent.setup();

        stubList();
        server.use(respond('get', '/models/m-1', () => httpError(500)));

        renderModal();

        await user.click(await screen.findByRole('button', { name: /gpt-5/ }));

        expect(await screen.findByText('Error loading details.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'gpt-5' })).toBeInTheDocument();
    });

    it('adds a model and closes', async () => {
        const user = userEvent.setup();

        stubList();
        server.use(respond('get', '/models/m-1', () => envelope(model('m-1', 'gpt-5'))));

        const { onChange, onClose } = renderModal();

        await user.click(await screen.findByRole('button', { name: /gpt-5/ }));
        await user.click(await screen.findByRole('button', { name: 'Add model' }));

        expect(onChange).toHaveBeenCalledWith([{ _id: 'm-1', name: 'gpt-5', provider: 'openai' }]);
        expect(onClose).toHaveBeenCalled();
    });

    it('marks the first chosen model as the default and offers only removal', async () => {
        const user = userEvent.setup();

        stubList();
        server.use(respond('get', '/models/m-1', () => envelope(model('m-1', 'gpt-5'))));

        renderModal([{ _id: 'm-1', name: 'gpt-5', provider: 'openai' }]);

        await user.click((await screen.findAllByRole('button', { name: /gpt-5/ }))[0]);

        expect(await screen.findByText('Default model')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove model' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Set as default' })).not.toBeInTheDocument();
    });

    it('promotes a non-default model to the front of the list', async () => {
        const user = userEvent.setup();

        stubList([model('m-1', 'gpt-5'), model('m-2', 'claude-5')]);
        server.use(respond('get', '/models/m-2', () => envelope(model('m-2', 'claude-5'))));

        const { onChange, onClose } = renderModal([
            { _id: 'm-1', name: 'gpt-5', provider: 'openai' },
            { _id: 'm-2', name: 'claude-5', provider: 'openai' },
        ]);

        await user.click((await screen.findAllByRole('button', { name: /claude-5/ }))[0]);
        await user.click(await screen.findByRole('button', { name: 'Set as default' }));

        expect(onChange).toHaveBeenCalledWith([
            { _id: 'm-2', name: 'claude-5', provider: 'openai' },
            { _id: 'm-1', name: 'gpt-5', provider: 'openai' },
        ]);
        expect(onClose).toHaveBeenCalled();
    });

    it('removes a model without closing the dialog', async () => {
        const user = userEvent.setup();

        stubList();
        server.use(respond('get', '/models/m-1', () => envelope(model('m-1', 'gpt-5'))));

        const { onChange, onClose } = renderModal([{ _id: 'm-1', name: 'gpt-5', provider: 'openai' }]);

        await user.click((await screen.findAllByRole('button', { name: /gpt-5/ }))[0]);
        await user.click(await screen.findByRole('button', { name: 'Remove model' }));

        expect(onChange).toHaveBeenCalledWith([]);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('falls back to placeholder copy for a model with no description', async () => {
        const user = userEvent.setup();

        stubList([{ _id: 'm-3', model: 'bare', provider: 'openai' }]);
        server.use(respond('get', '/models/m-3', () => envelope({ _id: 'm-3', model: 'bare', provider: 'openai' })));

        renderModal();

        await user.click(await screen.findByRole('button', { name: /bare/ }));

        expect(await screen.findByText(/No description has been provided/)).toBeInTheDocument();
    });

    it('closes from the empty pane header', async () => {
        const user = userEvent.setup();

        stubList();
        const { onClose } = renderModal();

        await user.click(await screen.findByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalled();
    });
});
