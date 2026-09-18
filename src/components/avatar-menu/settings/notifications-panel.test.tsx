import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeProfile } from '@/lib/api';
import { apiUrl, envelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import NotificationsPanel from './notifications-panel';

const makeProfile = (preferences: MeProfile['preferences'] = null): MeProfile => ({
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
});

interface UpdateBody {
    preferences?: Record<string, unknown>;
}

/**
 * Captures every PUT /users/me body while serving the profile from GET. Writes are echoed
 * back, because the panel refetches after every save: a GET that kept replaying the original
 * preferences would snap the control back and make a second edit look like a no-op.
 */
const stubProfile = (profile: MeProfile) => {
    const bodies: UpdateBody[] = [];
    let current = profile;

    server.use(respond('get', '/users/me', () => envelope(current)));
    server.use(
        http.put(apiUrl('/users/me'), async ({ request }) => {
            const body = (await request.json()) as UpdateBody;

            bodies.push(body);
            current = {
                ...current,
                preferences: (body.preferences ?? current.preferences) as MeProfile['preferences'],
            };

            return envelope(current);
        }),
    );

    return bodies;
};

const stubNotification = (permission: NotificationPermission, requestPermission = vi.fn()) => {
    vi.stubGlobal('Notification', { permission, requestPermission });

    return requestPermission;
};

const stubUnsupportedNotification = () => vi.stubGlobal('Notification', undefined);

const neverResolvingRequest = () => vi.fn(() => new Promise<NotificationPermission>(() => {}));

const renderPanel = () => renderWithProviders(<NotificationsPanel />);

const toggle = () => screen.getByRole('switch', { name: 'Response completions' });

const waitForToggleState = async (checked: boolean) => {
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', String(checked)));
};

describe('NotificationsPanel', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    // vi.unstubAllGlobals() would also drop the ResizeObserver and IntersectionObserver stubs
    // src/test/setup.ts installs once per file.
    afterEach(() => {
        vi.stubGlobal('Notification', undefined);
    });

    it('disables the toggle until the profile has loaded', async () => {
        stubNotification('granted');
        // GET stays pending so the profile never resolves and the control must stay disabled,
        // guarding against a first-time toggle wiping sibling preferences.
        server.use(respond('get', '/users/me', () => new Promise<Response>(() => {})));

        renderPanel();

        expect(await screen.findByRole('switch', { name: 'Response completions' })).toBeDisabled();
    });

    it('renders the toggle reflecting the stored enabled preference', async () => {
        stubNotification('granted');
        stubProfile(makeProfile({ notifications: { responseCompletion: true } }));

        renderPanel();

        await waitForToggleState(true);
    });

    it('renders the toggle off when the stored preference is off', async () => {
        stubNotification('granted');
        stubProfile(makeProfile({ notifications: { responseCompletion: false } }));

        renderPanel();

        await waitForToggleState(false);
    });

    it('requests browser permission when turned on while permission is undecided, showing guidance immediately', async () => {
        const requestPermission = neverResolvingRequest();

        stubNotification('default', requestPermission);

        const bodies = stubProfile(makeProfile({ notifications: { responseCompletion: false } }));

        renderPanel();

        await waitForToggleState(false);

        const liveRegion = screen.getByRole('status');

        await userEvent.click(toggle());

        expect(requestPermission).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('status')).toHaveTextContent(/address bar/i);
        expect(screen.getByRole('status')).toBe(liveRegion);

        await waitFor(() => expect(bodies).toHaveLength(1));

        expect(bodies[0].preferences?.notifications).toEqual({ responseCompletion: true });
    });

    it('does not request permission when turned off and hides any notice', async () => {
        const requestPermission = stubNotification('default');
        const bodies = stubProfile(makeProfile({ notifications: { responseCompletion: true } }));

        renderPanel();

        await waitForToggleState(true);

        // Enabled + undecided permission shows the ungranted notice before anything is toggled.
        expect(screen.getByRole('status')).toHaveTextContent(/has not allowed notifications/i);

        await userEvent.click(toggle());

        await waitFor(() => expect(bodies).toHaveLength(1));

        expect(bodies[0].preferences?.notifications).toEqual({ responseCompletion: false });
        expect(requestPermission).not.toHaveBeenCalled();
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('explains that an undecided permission has to be granted before anything is delivered', async () => {
        stubNotification('default');
        stubProfile(makeProfile({ notifications: { responseCompletion: true } }));

        renderPanel();

        await waitForToggleState(true);

        expect(screen.getByRole('status')).toHaveTextContent(/has not allowed notifications/i);
    });

    it('requests browser permission from the notice action', async () => {
        const requestPermission = neverResolvingRequest();

        stubNotification('default', requestPermission);
        stubProfile(makeProfile({ notifications: { responseCompletion: true } }));

        renderPanel();

        await waitForToggleState(true);
        await userEvent.click(screen.getByRole('button', { name: 'Allow notifications' }));

        expect(requestPermission).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('status')).toHaveTextContent(/address bar/i);
    });

    it('says notifications are blocked when denied and the feature is on', async () => {
        stubNotification('denied');
        stubProfile(makeProfile({ notifications: { responseCompletion: true } }));

        renderPanel();

        await waitForToggleState(true);

        expect(screen.getByRole('status')).toHaveTextContent(/blocked for this site/i);
        expect(screen.getByRole('status')).toHaveTextContent(/browser settings/i);
        expect(screen.queryByRole('button', { name: 'Allow notifications' })).not.toBeInTheDocument();
    });

    it('shows no notice when denied but the feature is off', async () => {
        stubNotification('denied');
        stubProfile(makeProfile({ notifications: { responseCompletion: false } }));

        renderPanel();

        await waitForToggleState(false);

        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('says the browser does not support notifications when enabled', async () => {
        stubUnsupportedNotification();
        stubProfile(makeProfile({ notifications: { responseCompletion: true } }));

        renderPanel();

        await waitForToggleState(true);

        expect(screen.getByRole('status')).toHaveTextContent(/does not support notifications/i);
    });

    it('shows no permission notice once notifications are granted', async () => {
        stubNotification('granted');
        stubProfile(makeProfile({ notifications: { responseCompletion: true } }));

        renderPanel();

        await waitForToggleState(true);

        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });
});
