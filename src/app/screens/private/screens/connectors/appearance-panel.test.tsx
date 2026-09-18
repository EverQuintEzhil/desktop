import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navigate, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppearancePanel from '@/components/avatar-menu/settings/appearance-panel';
import { renderWithProviders } from '@/test/test-utils';

import SettingsLayout from './settings-layout';

const STORAGE_KEY = 'fm-appearance';

const renderSettingsAppearance = () =>
    renderWithProviders(
        <Routes>
            <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/connectors" replace />} />
                <Route path="appearance" element={<AppearancePanel />} />
            </Route>
        </Routes>,
        { route: '/settings/appearance' },
    );

/** setup.ts stubs matchMedia to always report `matches: false`; override per test. */
const stubPrefersDark = (prefersDark: boolean) => {
    vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
            ({
                matches: prefersDark,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }) as unknown as MediaQueryList,
    );
};

const selectTheme = async (label: string) => {
    await userEvent.click(screen.getByRole('radio', { name: `${label} theme` }));
};

const activeTheme = (): string | null => {
    const checked = screen.getAllByRole('radio').find((radio) => radio.getAttribute('aria-checked') === 'true');

    return checked ? (checked.getAttribute('aria-label') ?? '').replace(' theme', '') : null;
};

describe('Settings appearance panel', () => {
    beforeEach(() => {
        localStorage.removeItem(STORAGE_KEY);
        document.documentElement.classList.remove('dark');
    });

    afterEach(() => {
        localStorage.removeItem(STORAGE_KEY);
        document.documentElement.classList.remove('dark');
    });

    it('renders the appearance selector defaulting to Light', () => {
        renderSettingsAppearance();

        expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
        expect(activeTheme()).toBe('Light');
    });

    it('reads the stored appearance on mount', () => {
        localStorage.setItem(STORAGE_KEY, 'dark');

        renderSettingsAppearance();

        expect(activeTheme()).toBe('Dark');
    });

    it('falls back to Light when the stored value is not a valid appearance', () => {
        localStorage.setItem(STORAGE_KEY, 'neon');

        renderSettingsAppearance();

        expect(activeTheme()).toBe('Light');
    });

    it('persists the chosen theme and applies the dark class', async () => {
        renderSettingsAppearance();

        await selectTheme('Dark');

        expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
        expect(document.documentElement).toHaveClass('dark');
        expect(activeTheme()).toBe('Dark');
    });

    it('removes the dark class when switching back to Light', async () => {
        localStorage.setItem(STORAGE_KEY, 'dark');

        renderSettingsAppearance();

        expect(document.documentElement).toHaveClass('dark');

        await selectTheme('Light');

        expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
        expect(document.documentElement).not.toHaveClass('dark');
    });

    it('stays light under System when the OS does not prefer dark', async () => {
        stubPrefersDark(false);

        renderSettingsAppearance();

        await selectTheme('System');

        expect(localStorage.getItem(STORAGE_KEY)).toBe('system');
        expect(document.documentElement).not.toHaveClass('dark');
    });

    it('goes dark under System when the OS prefers dark', async () => {
        stubPrefersDark(true);

        renderSettingsAppearance();

        await selectTheme('System');

        expect(localStorage.getItem(STORAGE_KEY)).toBe('system');
        expect(document.documentElement).toHaveClass('dark');
    });
});
