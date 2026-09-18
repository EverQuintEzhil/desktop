import type { FileMessagePartProps } from '@assistant-ui/react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatHostProvider, type ChatHost } from '@/components/chat-host';
import { renderWithProviders } from '@/test/test-utils';

import { UserFileRenderer } from './user-file-parts';

vi.mock('@/components/file-list/library-preview-content', () => {
    interface MockProps {
        item: { name?: string; url?: string; extension?: string };
        theme?: string;
    }

    const MockLibraryPreviewContent = ({ item, theme }: MockProps) => (
        <div
            data-testid="library-preview-content"
            data-url={item.url}
            data-theme={theme}
            data-extension={item.extension}
        >
            {item.name}
        </div>
    );

    return { default: MockLibraryPreviewContent };
});

const fetchMock = vi.fn();

const chatHost = {
    transport: {
        endpoint: '/chat',
        baseUrl: 'https://api.localhost',
        filesBaseUrl: 'https://files.localhost',
        fetch: (...args: unknown[]) => fetchMock(...args),
        credentials: 'include',
    },
} as unknown as ChatHost;

const renderFilePart = (overrides: Partial<FileMessagePartProps> = {}) =>
    renderWithProviders(
        <ChatHostProvider value={chatHost}>
            <UserFileRenderer
                {...({
                    type: 'file',
                    data: 'https://files.localhost/pasted-text.txt',
                    filename: 'pasted-text.txt',
                    mimeType: 'text/plain',
                    ...overrides,
                } as FileMessagePartProps)}
            />
        </ChatHostProvider>,
    );

describe('UserFileRenderer', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        window.URL.createObjectURL = vi.fn(() => 'blob:download');
        window.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('opens the preview dialog instead of downloading on click', async () => {
        const user = userEvent.setup();

        renderFilePart();

        await user.click(screen.getByRole('button', { name: 'Preview pasted-text.txt' }));

        const preview = await screen.findByTestId('library-preview-content');

        expect(preview).toHaveAttribute('data-url', 'https://files.localhost/pasted-text.txt');
        expect(preview).toHaveAttribute('data-theme', 'auto');
        expect(preview).toHaveAttribute('data-extension', 'txt');
        expect(screen.getByRole('dialog')).toHaveAccessibleName('pasted-text.txt');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('opens the preview dialog on Space', async () => {
        const user = userEvent.setup();

        renderFilePart();

        const chip = screen.getByRole('button', { name: 'Preview pasted-text.txt' });

        chip.focus();
        await user.keyboard(' ');

        expect(await screen.findByTestId('library-preview-content')).toBeInTheDocument();
    });

    it('downloads the file from the dialog Download button', async () => {
        const user = userEvent.setup();

        fetchMock.mockResolvedValue(new Response('body text', { status: 200 }));

        renderFilePart();

        await user.click(screen.getByRole('button', { name: 'Preview pasted-text.txt' }));
        await user.click(await screen.findByRole('button', { name: 'Download' }));

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                'https://files.localhost/pasted-text.txt',
                expect.objectContaining({ credentials: 'include' }),
            ),
        );
        expect(window.URL.createObjectURL).toHaveBeenCalled();
    });

    it.each([
        ['activity-log.csv', 'text/csv', 'csv'],
        ['report.xls', 'application/vnd.ms-excel', 'xls'],
        ['proposal.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
    ])('opens the preview dialog for %s instead of downloading', async (filename, mimeType, extension) => {
        const user = userEvent.setup();

        renderFilePart({
            data: `https://files.localhost/${filename}`,
            filename,
            mimeType,
        });

        await user.click(screen.getByRole('button', { name: `Preview ${filename}` }));

        expect(await screen.findByTestId('library-preview-content')).toHaveAttribute('data-extension', extension);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('previews an image-named part that carries no mime type through the dialog', async () => {
        const user = userEvent.setup();

        renderFilePart({
            data: 'https://files.localhost/photo.png',
            filename: 'photo.png',
            mimeType: undefined,
        });

        await user.click(screen.getByRole('button', { name: 'Preview photo.png' }));

        expect(await screen.findByTestId('library-preview-content')).toHaveAttribute('data-extension', 'png');
    });

    it('downloads a non-previewable file instead of opening the dialog', async () => {
        const user = userEvent.setup();

        fetchMock.mockResolvedValue(new Response('body', { status: 200 }));

        renderFilePart({
            data: 'https://files.localhost/archive.zip',
            filename: 'archive.zip',
            mimeType: 'application/zip',
        });

        await user.click(screen.getByRole('button', { name: 'Download archive.zip' }));

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                'https://files.localhost/archive.zip',
                expect.objectContaining({ credentials: 'include' }),
            ),
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByTestId('library-preview-content')).not.toBeInTheDocument();
    });

    it('does nothing when the part carries no url', async () => {
        const user = userEvent.setup();

        renderFilePart({ data: '' });

        await user.click(screen.getByRole('button', { name: 'Download pasted-text.txt' }));

        expect(screen.queryByTestId('library-preview-content')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('downloads a blob: url instead of previewing it', async () => {
        const user = userEvent.setup();

        fetchMock.mockResolvedValue(new Response('body', { status: 200 }));

        renderFilePart({ data: 'blob:https://app.localhost/9f0e', filename: 'staged.txt' });

        await user.click(screen.getByRole('button', { name: 'Download staged.txt' }));

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                'blob:https://app.localhost/9f0e',
                expect.objectContaining({ credentials: 'include' }),
            ),
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders an image part as a lightbox image, not a chip', () => {
        renderFilePart({
            data: 'https://files.localhost/photo.png',
            filename: 'photo.png',
            mimeType: 'image/png',
        });

        expect(screen.getByRole('button', { name: 'View photo.png in lightbox' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^(Preview|Download)/ })).not.toBeInTheDocument();
    });
});
