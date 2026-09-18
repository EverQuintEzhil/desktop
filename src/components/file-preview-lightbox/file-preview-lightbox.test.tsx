import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import FilePreviewLightbox from './file-preview-lightbox';

describe('FilePreviewLightbox', () => {
    it('renders a close button that closes the lightbox', async () => {
        const onClose = vi.fn();

        renderWithProviders(
            <FilePreviewLightbox src="https://example.com/image.png" alt="Example image" isOpen onClose={onClose} />,
        );

        const closeButton = screen.getByRole('button', { name: 'Close' });

        await userEvent.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not render a back button', () => {
        renderWithProviders(
            <FilePreviewLightbox src="https://example.com/image.png" alt="Example image" isOpen onClose={vi.fn()} />,
        );

        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    });

    it('renders working prev/next arrows when navigation handlers are provided', async () => {
        const onPrev = vi.fn();
        const onNext = vi.fn();

        renderWithProviders(
            <FilePreviewLightbox
                src="https://example.com/image.png"
                alt="Example image"
                isOpen
                onClose={vi.fn()}
                onPrev={onPrev}
                onNext={onNext}
                hasPrev
                hasNext
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Previous file' }));
        expect(onPrev).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByRole('button', { name: 'Next file' }));
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('navigates with the arrow keys', async () => {
        const onPrev = vi.fn();
        const onNext = vi.fn();

        renderWithProviders(
            <FilePreviewLightbox
                src="https://example.com/image.png"
                alt="Example image"
                isOpen
                onClose={vi.fn()}
                onPrev={onPrev}
                onNext={onNext}
                hasPrev
                hasNext
            />,
        );

        await userEvent.keyboard('{ArrowRight}');
        expect(onNext).toHaveBeenCalledTimes(1);

        await userEvent.keyboard('{ArrowLeft}');
        expect(onPrev).toHaveBeenCalledTimes(1);
    });

    it('disables the arrows and ignores arrow keys at the list boundaries', async () => {
        const onPrev = vi.fn();
        const onNext = vi.fn();

        renderWithProviders(
            <FilePreviewLightbox
                src="https://example.com/image.png"
                alt="Example image"
                isOpen
                onClose={vi.fn()}
                onPrev={onPrev}
                onNext={onNext}
                hasPrev={false}
                hasNext={false}
            />,
        );

        expect(screen.getByRole('button', { name: 'Previous file' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Next file' })).toBeDisabled();

        await userEvent.keyboard('{ArrowRight}{ArrowLeft}');
        expect(onNext).not.toHaveBeenCalled();
        expect(onPrev).not.toHaveBeenCalled();
    });

    it('renders no navigation arrows without handlers', () => {
        renderWithProviders(
            <FilePreviewLightbox src="https://example.com/image.png" alt="Example image" isOpen onClose={vi.fn()} />,
        );

        expect(screen.queryByRole('button', { name: 'Previous file' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Next file' })).not.toBeInTheDocument();
    });

    it('closes on Escape exactly once', async () => {
        const onClose = vi.fn();

        renderWithProviders(
            <FilePreviewLightbox src="https://example.com/image.png" alt="Example image" isOpen onClose={onClose} />,
        );

        await userEvent.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
