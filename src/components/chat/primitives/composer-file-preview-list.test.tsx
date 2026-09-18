import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';
import type { FileType } from '@/types/chat';

import ComposerFilePreviewList from './composer-file-preview-list';

vi.mock('@/components/file-list/library-preview-content', async () => {
    const { useEffect } = await import('react');

    interface MockProps {
        item: { name?: string; url?: string; extension?: string };
        theme?: string;
        onContentLoaded?: (text: string) => void;
    }

    const MockLibraryPreviewContent = ({ item, theme, onContentLoaded }: MockProps) => {
        useEffect(() => {
            onContentLoaded?.('the pasted body text');
        }, [onContentLoaded]);

        return (
            <div
                data-testid="library-preview-content"
                data-url={item.url}
                data-theme={theme}
                data-extension={item.extension}
            >
                {item.name}
            </div>
        );
    };

    return { default: MockLibraryPreviewContent };
});

const textFile: FileType = {
    name: 'pasted-text.txt',
    type: 'file',
    url: 'https://files.localhost/pasted-text.txt',
    tempId: 'temp-1',
};

const markdownFile: FileType = {
    name: 'notes.md',
    type: 'file',
    url: 'https://files.localhost/notes.md',
    tempId: 'temp-2',
};

const listElement = (files: FileType[]) => (
    <ComposerFilePreviewList files={files} fileInputRef={createRef<HTMLInputElement>()} onRemove={vi.fn()} />
);

const renderList = (files: FileType[]) => renderWithProviders(listElement(files));

describe('ComposerFilePreviewList', () => {
    it('opens the file preview for a .txt attachment', async () => {
        const user = userEvent.setup();

        renderList([textFile]);

        await user.click(screen.getByRole('button', { name: 'Preview pasted-text.txt' }));

        const preview = await screen.findByTestId('library-preview-content');

        expect(preview).toHaveTextContent('pasted-text.txt');
        expect(preview).toHaveAttribute('data-url', 'https://files.localhost/pasted-text.txt');
    });

    it('titles the preview dialog with the filename and renders theme-aware content', async () => {
        const user = userEvent.setup();

        renderList([textFile]);

        await user.click(screen.getByRole('button', { name: 'Preview pasted-text.txt' }));

        expect(screen.getByRole('dialog')).toHaveAccessibleName('pasted-text.txt');
        expect(screen.getByRole('heading', { name: 'pasted-text.txt' })).toBeInTheDocument();
        expect(await screen.findByTestId('library-preview-content')).toHaveAttribute('data-theme', 'auto');
    });

    it('copies the loaded text', async () => {
        const user = userEvent.setup();

        renderList([textFile]);

        await user.click(screen.getByRole('button', { name: 'Preview pasted-text.txt' }));
        await user.click(await screen.findByRole('button', { name: 'Copy text' }));

        await expect(navigator.clipboard.readText()).resolves.toBe('the pasted body text');
    });

    it('offers no copy button for a pdf attachment', async () => {
        const user = userEvent.setup();

        renderList([{ ...textFile, name: 'brief.pdf' }]);

        await user.click(screen.getByRole('button', { name: 'Preview brief.pdf' }));

        expect(screen.getByRole('dialog')).toHaveAccessibleName('brief.pdf');
        expect(screen.queryByRole('button', { name: 'Copy text' })).not.toBeInTheDocument();
    });

    it('closes the preview again', async () => {
        const user = userEvent.setup();

        renderList([textFile]);

        await user.click(screen.getByRole('button', { name: 'Preview pasted-text.txt' }));
        await user.click(screen.getByRole('button', { name: 'Close preview' }));

        expect(screen.queryByTestId('library-preview-content')).not.toBeInTheDocument();
    });

    it('resolves a json extension from the name when the file carries none', async () => {
        const user = userEvent.setup();

        renderList([{ ...textFile, name: 'config.json' }]);

        await user.click(screen.getByRole('button', { name: 'Preview config.json' }));

        expect(await screen.findByTestId('library-preview-content')).toHaveAttribute('data-extension', 'json');
    });

    it('resolves a py extension from the name when the file carries none', async () => {
        const user = userEvent.setup();

        renderList([{ ...textFile, name: 'script.py' }]);

        await user.click(screen.getByRole('button', { name: 'Preview script.py' }));

        expect(await screen.findByTestId('library-preview-content')).toHaveAttribute('data-extension', 'py');
    });

    it('closes the preview when the previewed file leaves the list', async () => {
        const user = userEvent.setup();

        const { rerender } = renderList([textFile, markdownFile]);

        await user.click(screen.getByRole('button', { name: 'Preview pasted-text.txt' }));

        expect(await screen.findByRole('dialog')).toHaveAccessibleName('pasted-text.txt');

        rerender(listElement([markdownFile]));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        rerender(listElement([textFile, markdownFile]));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes the preview when the list empties', async () => {
        const user = userEvent.setup();

        const { rerender } = renderList([textFile]);

        await user.click(screen.getByRole('button', { name: 'Preview pasted-text.txt' }));

        expect(await screen.findByRole('dialog')).toHaveAccessibleName('pasted-text.txt');

        rerender(listElement([]));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        rerender(listElement([textFile]));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens the file preview for a csv attachment', async () => {
        const user = userEvent.setup();

        renderList([{ ...textFile, name: 'activity-log.csv' }]);

        await user.click(screen.getByRole('button', { name: 'Preview activity-log.csv' }));

        expect(await screen.findByTestId('library-preview-content')).toHaveAttribute('data-extension', 'csv');
    });

    it('opens the file preview for a docx attachment', async () => {
        const user = userEvent.setup();

        renderList([{ ...textFile, name: 'proposal.docx' }]);

        await user.click(screen.getByRole('button', { name: 'Preview proposal.docx' }));

        expect(await screen.findByTestId('library-preview-content')).toHaveAttribute('data-extension', 'docx');
    });

    it('leaves a non-previewable extension inert', () => {
        renderList([{ ...textFile, name: 'archive.zip' }]);

        expect(screen.getByText('archive.zip')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
    });

    it('leaves a staged file with no url inert', () => {
        renderList([{ ...textFile, url: '' }]);

        expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
    });

    it('opens an image attachment in the lightbox rather than the dialog', async () => {
        const user = userEvent.setup();

        renderList([{ ...textFile, name: 'photo.png', type: 'image' }]);

        await user.click(screen.getByRole('button', { name: 'Preview photo.png' }));

        const dialog = await screen.findByRole('dialog');

        expect(within(dialog).getByAltText('photo.png')).toBeInTheDocument();
        expect(screen.queryByTestId('library-preview-content')).not.toBeInTheDocument();
    });
});
