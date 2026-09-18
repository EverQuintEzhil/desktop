import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Navigate, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import ShortcutsPanel from '@/components/keyboard-shortcuts/shortcuts-panel';
import { type MeProfile } from '@/lib/api';
import { apiUrl, envelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import SettingsLayout from './settings-layout';

const makeProfile = (preferences: MeProfile['preferences'] = null): MeProfile =>
    ({
        _id: 'user-1',
        name: { first: 'Jane', last: 'Doe' },
        role: 'user',
        avatar: '',
        email: 'jane.doe@example.com',
        otherEmails: [],
        mobile: null,
        defaultLanguage: 'English',
        timezone: null,
        timezoneOffset: null,
        tags: [],
        portalAccessEnabled: true,
        preferences,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
    }) as MeProfile;

interface UpdateBody {
    preferences?: Record<string, unknown> & { keyboard?: Record<string, { enabled?: boolean }> };
}

/** Captures every PUT /users/me body while serving the given profile from GET. */
const stubProfile = (profile: MeProfile) => {
    const bodies: UpdateBody[] = [];

    server.use(respond('get', '/users/me', () => envelope(profile)));
    server.use(
        http.put(apiUrl('/users/me'), async ({ request }) => {
            bodies.push((await request.json()) as UpdateBody);

            return envelope(profile);
        }),
    );

    return bodies;
};

const renderSettingsKeyboardShortcuts = () =>
    renderWithProviders(
        <Routes>
            <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/connectors" replace />} />
                <Route path="keyboard-shortcuts" element={<ShortcutsPanel showHeading />} />
            </Route>
        </Routes>,
        { route: '/settings/keyboard-shortcuts' },
    );

describe('Settings keyboard shortcuts panel', () => {
    it('renders shortcut rows and the restore defaults action', async () => {
        stubProfile(makeProfile());

        renderSettingsKeyboardShortcuts();

        expect(screen.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getAllByRole('switch').length).toBeGreaterThan(0);
        });

        expect(screen.getByRole('button', { name: 'Restore defaults' })).toBeInTheDocument();
    });

    it('renders a row for every registered shortcut', async () => {
        stubProfile(makeProfile());

        renderSettingsKeyboardShortcuts();

        await waitFor(() => {
            expect(screen.getByText('Send message')).toBeInTheDocument();
        });

        expect(screen.getByText('Select model')).toBeInTheDocument();
        expect(screen.getByText('Recall previous / next message')).toBeInTheDocument();
    });

    // The panel renders every switch enabled before the profile query settles,
    // so the disabled state must be awaited rather than read straight after mount.
    it('shows a shortcut as off when the stored preference disables it', async () => {
        stubProfile(makeProfile({ keyboard: { send: { enabled: false } } } as never));

        renderSettingsKeyboardShortcuts();

        await waitFor(() => {
            expect(screen.getByLabelText('Enable Send message')).not.toBeChecked();
        });

        expect(screen.getByLabelText('Enable Select model')).toBeChecked();
    });

    it('persists a toggle through PUT /users/me', async () => {
        const bodies = stubProfile(makeProfile());

        renderSettingsKeyboardShortcuts();

        await waitFor(() => {
            expect(screen.getByLabelText('Enable Send message')).toBeChecked();
        });

        await userEvent.click(screen.getByLabelText('Enable Send message'));

        await waitFor(() => {
            expect(bodies.length).toBe(1);
        });

        expect(bodies[0].preferences?.keyboard).toEqual({ send: { enabled: false } });
    });

    it('preserves sibling preference keys when saving a toggle', async () => {
        const bodies = stubProfile(makeProfile({ theme: 'dark', keyboard: {} } as never));

        renderSettingsKeyboardShortcuts();

        await waitFor(() => {
            expect(screen.getByLabelText('Enable Send message')).toBeChecked();
        });

        await userEvent.click(screen.getByLabelText('Enable Send message'));

        await waitFor(() => {
            expect(bodies.length).toBe(1);
        });

        expect(bodies[0].preferences?.theme).toBe('dark');
    });

    it('clears every override when Restore defaults is clicked', async () => {
        const bodies = stubProfile(makeProfile({ keyboard: { send: { enabled: false } } } as never));

        renderSettingsKeyboardShortcuts();

        await waitFor(() => {
            expect(screen.getByLabelText('Enable Send message')).not.toBeChecked();
        });

        await userEvent.click(screen.getByRole('button', { name: 'Restore defaults' }));

        await waitFor(() => {
            expect(bodies.length).toBe(1);
        });

        expect(bodies[0].preferences?.keyboard).toEqual({});
    });
});
