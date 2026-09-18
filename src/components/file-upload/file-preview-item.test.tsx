import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { FileType } from '@/types/chat';

import FilePreviewItem from './file-preview-item';

const textFile: FileType = {
    name: 'pasted-text.txt',
    type: 'file',
    url: 'https://files.localhost/pasted-text.txt',
    tempId: 'temp-1',
};

describe('FilePreviewItem', () => {
    it('stays inert when no onPreview is given', () => {
        render(<FilePreviewItem file={textFile} />);

        expect(screen.getByText('pasted-text.txt')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('keeps the chip inert for the remove button alone', () => {
        render(<FilePreviewItem file={textFile} onRemove={vi.fn()} />);

        expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
    });

    it('calls onPreview when the chip is clicked', async () => {
        const onPreview = vi.fn();
        const user = userEvent.setup();

        render(<FilePreviewItem file={textFile} onPreview={onPreview} />);

        await user.click(screen.getByRole('button', { name: 'Preview pasted-text.txt' }));

        expect(onPreview).toHaveBeenCalledTimes(1);
        expect(onPreview).toHaveBeenCalledWith(textFile);
    });

    it('calls onPreview on Enter and on Space', async () => {
        const onPreview = vi.fn();
        const user = userEvent.setup();

        render(<FilePreviewItem file={textFile} onPreview={onPreview} />);

        const chip = screen.getByRole('button', { name: 'Preview pasted-text.txt' });

        chip.focus();
        await user.keyboard('{Enter}');
        expect(onPreview).toHaveBeenCalledTimes(1);

        await user.keyboard(' ');
        expect(onPreview).toHaveBeenCalledTimes(2);
    });

    it('does not call onPreview when the remove button is clicked', async () => {
        const onPreview = vi.fn();
        const onRemove = vi.fn();
        const user = userEvent.setup();

        render(<FilePreviewItem file={textFile} onPreview={onPreview} onRemove={onRemove} />);

        const chip = screen.getByRole('button', { name: 'Preview pasted-text.txt' });
        const removeButton = screen.getAllByRole('button').find((button) => button !== chip);

        await user.click(removeButton!);

        expect(onRemove).toHaveBeenCalledTimes(1);
        expect(onPreview).not.toHaveBeenCalled();
    });

    it('is not activatable while the file is still uploading', () => {
        render(<FilePreviewItem file={{ ...textFile, isUploading: true, uploadProgress: 40 }} onPreview={vi.fn()} />);

        expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
    });

    it('is not activatable in the upload error state', () => {
        render(
            <FilePreviewItem
                file={{ ...textFile, uploadError: true, uploadErrorMessage: 'Upload failed' }}
                onPreview={vi.fn()}
            />,
        );

        expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
    });

    it('makes an image thumbnail previewable', () => {
        const onPreview = vi.fn();
        render(<FilePreviewItem file={{ ...textFile, name: 'shot.png', type: 'image' }} onPreview={onPreview} />);

        expect(screen.getByRole('button', { name: 'Preview shot.png' })).toBeInTheDocument();
    });

    it('leaves an image thumbnail inert when there is no preview handler', () => {
        render(<FilePreviewItem file={{ ...textFile, name: 'shot.png', type: 'image' }} />);

        expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
    });
});
