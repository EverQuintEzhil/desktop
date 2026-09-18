import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import AppearancePanel from './appearance-panel';

const STORAGE_KEY = 'fm-appearance';

describe('AppearancePanel', () => {
    beforeEach(() => {
        localStorage.removeItem(STORAGE_KEY);
        document.documentElement.classList.remove('dark');
    });

    afterEach(() => {
        localStorage.removeItem(STORAGE_KEY);
        document.documentElement.classList.remove('dark');
    });

    it('renders the Appearance heading with the theme switcher', () => {
        renderWithProviders(<AppearancePanel />);

        expect(screen.getByRole('heading', { level: 2, name: 'Appearance' })).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
        expect(screen.getByText('Always use the light theme on this device.')).toBeInTheDocument();
    });

    it('updates the theme description as the selection changes', async () => {
        renderWithProviders(<AppearancePanel />);

        await userEvent.click(screen.getByRole('radio', { name: 'System theme' }));

        expect(screen.getByText('Follows the light or dark setting of your device.')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('radio', { name: 'Dark theme' }));

        expect(screen.getByText('Always use the dark theme on this device.')).toBeInTheDocument();
        expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    });
});
