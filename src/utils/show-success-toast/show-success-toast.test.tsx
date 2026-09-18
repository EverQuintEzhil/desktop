import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import showSuccessToast from './show-success-toast';

// Sonner captures the pointer on press, which jsdom's Element does not model.
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

describe('showSuccessToast', () => {
    it('renders an action button that fires the callback', async () => {
        const onClick = vi.fn();

        render(<Toaster />);
        showSuccessToast('Routine created.', { action: { label: 'Run now', onClick } });

        await userEvent.click(await screen.findByRole('button', { name: 'Run now' }));

        expect(onClick).toHaveBeenCalled();
    });

    it('still renders a plain toast without an action', async () => {
        render(<Toaster />);
        showSuccessToast('Saved.');

        expect(await screen.findByText('Saved.')).toBeInTheDocument();
    });
});
