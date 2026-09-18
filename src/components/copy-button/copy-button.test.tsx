import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import CopyButton from './copy-button';

const writeText = vi.fn<(text: string) => Promise<void>>();

/**
 * `userEvent.setup()` installs its own `navigator.clipboard` stub, so the spy has
 * to be planted after it or the click writes to user-event's copy instead.
 */
const setupUser = () => {
    const user = userEvent.setup();

    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
    });

    return user;
};

describe('CopyButton', () => {
    beforeEach(() => {
        writeText.mockReset();
        writeText.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('exposes the button under the ariaLabel it is given', () => {
        renderWithProviders(<CopyButton text="body" ariaLabel="Copy text" />);

        expect(screen.getByRole('button', { name: 'Copy text' })).toBeInTheDocument();
    });

    // The five pre-FM-193 consumers pass no ariaLabel; the attribute must stay absent
    // rather than becoming an empty string, which would blank the accessible name.
    it('sets no aria-label when none is given', () => {
        renderWithProviders(<CopyButton text="body" />);

        expect(screen.getByRole('button')).not.toHaveAttribute('aria-label');
    });

    it('copies the text and flips the icon on click', async () => {
        const user = setupUser();
        const onCopy = vi.fn();

        renderWithProviders(<CopyButton text="the body text" ariaLabel="Copy text" onCopy={onCopy} />);

        const button = screen.getByRole('button', { name: 'Copy text' });

        expect(button.querySelector('.lucide-copy')).toBeInTheDocument();

        await user.click(button);

        expect(writeText).toHaveBeenCalledWith('the body text');
        expect(onCopy).toHaveBeenCalledTimes(1);
        expect(await screen.findByRole('button', { name: 'Copy text' })).toBeInTheDocument();
        expect(button.querySelector('.lucide-check')).toBeInTheDocument();
        expect(button.querySelector('.lucide-copy')).not.toBeInTheDocument();
    });

    it('keeps the copy icon and reports the failure when the clipboard rejects', async () => {
        const user = setupUser();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        writeText.mockRejectedValue(new Error('denied'));

        renderWithProviders(<CopyButton text="body" ariaLabel="Copy text" />);

        const button = screen.getByRole('button', { name: 'Copy text' });

        await user.click(button);

        expect(consoleError).toHaveBeenCalled();
        expect(button.querySelector('.lucide-copy')).toBeInTheDocument();
        expect(button.querySelector('.lucide-check')).not.toBeInTheDocument();
    });

    it('applies the caller className alongside its own layout class', () => {
        renderWithProviders(<CopyButton text="body" ariaLabel="Copy text" className="custom-copy" />);

        const button = screen.getByRole('button', { name: 'Copy text' });

        expect(button).toHaveClass('ml-auto');
        expect(button).toHaveClass('custom-copy');
    });
});
