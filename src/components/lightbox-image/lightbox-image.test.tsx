import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import Markdown from '@/components/markdown';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { renderWithProviders } from '@/test/test-utils';

import LightboxImage from './lightbox-image';

describe('LightboxImage', () => {
    it('opens the lightbox on click', async () => {
        renderWithProviders(<LightboxImage src="https://example.com/a.png" alt="Chart" />);

        await userEvent.click(screen.getByRole('button', { name: 'View Chart in lightbox' }));

        expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('opens the lightbox from the keyboard', async () => {
        renderWithProviders(<LightboxImage src="https://example.com/a.png" alt="Chart" />);

        screen.getByRole('button', { name: 'View Chart in lightbox' }).focus();
        await userEvent.keyboard('{Enter}');

        expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('drops the click affordance when the image fails to load', () => {
        renderWithProviders(<LightboxImage src="https://example.com/missing.png" alt="Chart" className="aui-md-img" />);

        fireEvent.error(screen.getByAltText('Chart'));

        expect(screen.getByRole('button', { name: 'View Chart in lightbox' })).toBeDisabled();
        expect(screen.getByAltText('Chart')).not.toHaveClass('clickable-image');
    });

    it('restores the click affordance when the image loads after a transient failure', () => {
        renderWithProviders(<LightboxImage src="https://example.com/flaky.png" alt="Chart" />);

        fireEvent.error(screen.getByAltText('Chart'));
        expect(screen.getByRole('button', { name: 'View Chart in lightbox' })).toBeDisabled();

        fireEvent.load(screen.getByAltText('Chart'));

        expect(screen.getByRole('button', { name: 'View Chart in lightbox' })).toBeEnabled();
        expect(screen.getByAltText('Chart')).toHaveClass('clickable-image');
    });

    it('restores the click affordance when the src changes after a failed load', () => {
        const { rerender } = renderWithProviders(<LightboxImage src="https://example.com/missing.png" alt="Chart" />);

        fireEvent.error(screen.getByAltText('Chart'));
        expect(screen.getByRole('button', { name: 'View Chart in lightbox' })).toBeDisabled();

        rerender(<LightboxImage src="https://example.com/working.png" alt="Chart" />);

        expect(screen.getByRole('button', { name: 'View Chart in lightbox' })).toBeEnabled();
        expect(screen.getByAltText('Chart')).toHaveClass('clickable-image');
    });

    it('closes the lightbox when the open image swaps to a different src mid-stream', async () => {
        const { rerender } = renderWithProviders(<LightboxImage src="https://example.com/a.png" alt="Chart" />);

        await userEvent.click(screen.getByRole('button', { name: 'View Chart in lightbox' }));
        expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument();

        rerender(<LightboxImage src="https://example.com/b.png" alt="Chart" />);

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
        });
    });

    it('forwards the title to the image in both the normal and error states', () => {
        renderWithProviders(<LightboxImage src="https://example.com/a.png" alt="Chart" title="Quarterly revenue" />);

        expect(screen.getByAltText('Chart')).toHaveAttribute('title', 'Quarterly revenue');

        fireEvent.error(screen.getByAltText('Chart'));

        expect(screen.getByRole('button', { name: 'View Chart in lightbox' })).toBeDisabled();
        expect(screen.getByAltText('Chart')).toHaveAttribute('title', 'Quarterly revenue');
    });

    it('closes only the inner lightbox on Escape and unwinds the overlay lock while the outer dialog stays mounted', async () => {
        renderWithProviders(
            <Dialog open>
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle>Table</DialogTitle>
                    <LightboxImage src="https://example.com/a.png" alt="Chart" />
                </DialogContent>
            </Dialog>,
        );

        expect(document.body).not.toHaveClass('overlay-open');

        await userEvent.click(screen.getByRole('button', { name: 'View Chart in lightbox' }));
        expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument();
        expect(document.body).toHaveClass('overlay-open');

        await userEvent.keyboard('{Escape}');

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
        });
        expect(screen.getByText('Table')).toBeInTheDocument();
        expect(document.body).not.toHaveClass('overlay-open');
    });

    it('renders a plain image with no lightbox trigger when the markdown image is inside a link', () => {
        renderWithProviders(<Markdown>{'[![Chart](https://example.com/a.png)](https://example.com/build)'}</Markdown>);

        expect(screen.getByRole('link')).toBeInTheDocument();
        expect(screen.getByAltText('Chart')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'View Chart in lightbox' })).not.toBeInTheDocument();
        expect(screen.getByAltText('Chart')).not.toHaveClass('clickable-image');
    });
});
