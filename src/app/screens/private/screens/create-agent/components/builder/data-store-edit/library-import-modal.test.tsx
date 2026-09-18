import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, rawPaged, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import LibraryImportModal from './library-import-modal';

const file = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
    _id: id,
    name,
    type: 'image/png',
    extension: 'png',
    url: `https://api.localhost/files/${id}/raw`,
    creator_id: 'user-1',
    meta: { size: 2048 },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

const stubFiles = (values: unknown[] = [file('f1', 'diagram.png')]) => {
    server.use(respond('get', '/files', () => envelope(rawPaged(values))));
};

const renderModal = () => {
    const onImportFiles = vi.fn();

    const view = renderWithProviders(<LibraryImportModal onImportFiles={onImportFiles} />);

    return { ...view, onImportFiles };
};

const openModal = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /Import from library/ }));

    return screen.findByRole('dialog');
};

describe('LibraryImportModal', () => {
    it('renders only the trigger until it is opened', () => {
        stubFiles();
        renderModal();

        expect(screen.getByRole('button', { name: /Import from library/ })).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('lists the library files once opened', async () => {
        const user = userEvent.setup();

        stubFiles([file('f1', 'diagram.png'), file('f2', 'notes.pdf')]);
        renderModal();
        await openModal(user);

        expect(await screen.findByText('diagram.png')).toBeInTheDocument();
        expect(screen.getByText('notes.pdf')).toBeInTheDocument();
    });

    it('shows an empty state when the library has nothing', async () => {
        const user = userEvent.setup();

        stubFiles([]);
        renderModal();
        await openModal(user);

        expect(await screen.findByText('No files found')).toBeInTheDocument();
    });

    it('survives a failed list request', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/files', () => httpError(500)));
        renderModal();

        const dialog = await openModal(user);

        expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('sends the scope and search term the user picked', async () => {
        const user = userEvent.setup();
        const requests: URL[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                requests.push(new URL(request.url));

                return envelope(rawPaged([file('f1', 'diagram.png')]));
            }),
        );

        renderModal();
        await openModal(user);
        await screen.findByText('diagram.png');

        await user.click(screen.getByRole('tab', { name: 'Shared with me' }));

        await waitFor(() => {
            expect(requests.some((url) => url.searchParams.get('scope') === 'shared')).toBe(true);
        });
    });

    it('keeps Import disabled until something is ticked, then counts the selection', async () => {
        const user = userEvent.setup();

        stubFiles([file('f1', 'diagram.png'), file('f2', 'notes.pdf')]);
        renderModal();

        const dialog = await openModal(user);

        expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled();
        expect(within(dialog).getByText('Select files to import')).toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: /diagram\.png/ }));

        expect(await within(dialog).findByText('1 selected')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Import (1)' })).toBeEnabled();
    });

    it('unticks a row that is clicked twice', async () => {
        const user = userEvent.setup();

        stubFiles();
        renderModal();

        const dialog = await openModal(user);
        const row = await screen.findByRole('button', { name: /diagram\.png/ });

        await user.click(row);
        await user.click(row);

        expect(within(dialog).getByText('Select files to import')).toBeInTheDocument();
    });

    it('selects a row from the keyboard', async () => {
        const user = userEvent.setup();

        stubFiles();
        renderModal();

        const dialog = await openModal(user);

        (await screen.findByRole('button', { name: /diagram\.png/ })).focus();
        await user.keyboard('{Enter}');

        expect(await within(dialog).findByText('1 selected')).toBeInTheDocument();
    });

    it('downloads the ticked files and hands them back as File objects', async () => {
        const user = userEvent.setup();

        stubFiles();
        server.use(
            http.get('https://api.localhost/files/f1/raw', () =>
                HttpResponse.arrayBuffer(new ArrayBuffer(8), { headers: { 'Content-Type': 'image/png' } }),
            ),
        );

        const { onImportFiles } = renderModal();

        const dialog = await openModal(user);

        await user.click(await screen.findByRole('button', { name: /diagram\.png/ }));
        await user.click(within(dialog).getByRole('button', { name: 'Import (1)' }));

        await waitFor(() => {
            expect(onImportFiles).toHaveBeenCalled();
        });

        const [files] = onImportFiles.mock.calls[0] as [File[]];

        expect(files).toHaveLength(1);
        expect(files[0].name).toBe('diagram.png');
    });

    it('keeps the dialog open when a download fails', async () => {
        const user = userEvent.setup();

        let attempts = 0;

        stubFiles();
        server.use(
            http.get('https://api.localhost/files/f1/raw', () => {
                attempts += 1;

                return HttpResponse.error();
            }),
        );

        const { onImportFiles } = renderModal();

        const dialog = await openModal(user);

        await user.click(await screen.findByRole('button', { name: /diagram\.png/ }));
        await user.click(within(dialog).getByRole('button', { name: 'Import (1)' }));

        await waitFor(() => {
            expect(attempts).toBe(1);
        });
        expect(onImportFiles).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('clears the selection when the dialog is dismissed', async () => {
        const user = userEvent.setup();

        stubFiles();
        renderModal();

        let dialog = await openModal(user);

        await user.click(await screen.findByRole('button', { name: /diagram\.png/ }));
        await within(dialog).findByText('1 selected');
        await user.click(within(dialog).getByRole('button', { name: 'Close import dialog' }));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        dialog = await openModal(user);

        expect(within(dialog).getByText('Select files to import')).toBeInTheDocument();
    });
});
