import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import ThemeSwitcher from '@/components/theme-switcher';
import { useAppearance } from '@/hooks';
import { renderWithProviders } from '@/test/test-utils';

const STORAGE_KEY = 'fm-appearance';

const AppearanceReadout = () => {
    const { appearance } = useAppearance();

    return <span data-testid="appearance-readout">{appearance}</span>;
};

describe('ThemeSwitcher', () => {
    beforeEach(() => {
        localStorage.removeItem(STORAGE_KEY);
        document.documentElement.classList.remove('dark');
    });

    afterEach(() => {
        localStorage.removeItem(STORAGE_KEY);
        document.documentElement.classList.remove('dark');
    });

    it('renders the three theme options with Light active by default', () => {
        renderWithProviders(<ThemeSwitcher />);

        expect(screen.getByRole('radio', { name: 'Light theme' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: 'Dark theme' })).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByRole('radio', { name: 'System theme' })).toHaveAttribute('aria-checked', 'false');
    });

    it('selecting Dark applies the dark class and persists the choice', async () => {
        renderWithProviders(<ThemeSwitcher />);

        await userEvent.click(screen.getByRole('radio', { name: 'Dark theme' }));

        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
        expect(screen.getByRole('radio', { name: 'Dark theme' })).toHaveAttribute('aria-checked', 'true');
    });

    it('selecting Light again removes the dark class', async () => {
        localStorage.setItem(STORAGE_KEY, 'dark');
        renderWithProviders(<ThemeSwitcher />);

        await userEvent.click(screen.getByRole('radio', { name: 'Light theme' }));

        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
    });

    it('moves the selection with arrow keys as a single-tab-stop radiogroup', async () => {
        renderWithProviders(<ThemeSwitcher />);

        const lightRadio = screen.getByRole('radio', { name: 'Light theme' });

        expect(lightRadio).toHaveAttribute('tabindex', '0');
        expect(screen.getByRole('radio', { name: 'Dark theme' })).toHaveAttribute('tabindex', '-1');

        lightRadio.focus();
        await userEvent.keyboard('{ArrowRight}');

        const darkRadio = screen.getByRole('radio', { name: 'Dark theme' });

        expect(darkRadio).toHaveAttribute('aria-checked', 'true');
        expect(darkRadio).toHaveFocus();
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('keeps a second useAppearance consumer in sync with the switcher', async () => {
        renderWithProviders(
            <>
                <ThemeSwitcher />
                <AppearanceReadout />
            </>,
        );

        expect(screen.getByTestId('appearance-readout')).toHaveTextContent('light');

        await userEvent.click(screen.getByRole('radio', { name: 'Dark theme' }));

        expect(screen.getByTestId('appearance-readout')).toHaveTextContent('dark');
    });
});
