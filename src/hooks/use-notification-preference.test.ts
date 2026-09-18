import { act, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import type { MeProfile } from '@/lib/api';
import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';
import { renderHookWithProviders } from '@/test/test-utils';

import { useNotificationPreference } from './use-notification-preference';

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

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

const renderPreference = () => renderHookWithProviders(() => useNotificationPreference());

describe('useNotificationPreference', () => {
    it('defaults to enabled before the profile has loaded', () => {
        stubProfile(makeProfile());

        const { result } = renderPreference();

        expect(result.current.enabled).toBe(true);
    });

    it('defaults to enabled when the profile carries no preferences', async () => {
        stubProfile(makeProfile());

        const { result } = renderPreference();

        await waitFor(() => expect(result.current.isSaving).toBe(false));

        expect(result.current.enabled).toBe(true);
    });

    it('defaults to enabled when the notifications bag has no responseCompletion', async () => {
        stubProfile(makeProfile({ notifications: { emailDigest: true } }));

        const { result } = renderPreference();

        await waitFor(() => expect(result.current.enabled).toBe(true));
    });

    it.each([
        ['a number', 42],
        ['an unknown string', 'sometimes'],
        ['null', null],
        ['an object', { mode: 'always' }],
    ])('defaults to enabled when the stored value is %s', async (_label, stored) => {
        stubProfile(makeProfile({ notifications: { responseCompletion: stored } }));

        const { result } = renderPreference();

        await waitFor(() => expect(result.current.enabled).toBe(true));
    });

    it('defaults to enabled when the notifications bag itself is not an object', async () => {
        stubProfile(makeProfile({ notifications: 42 }));

        const { result } = renderPreference();

        await waitFor(() => expect(result.current.enabled).toBe(true));
    });

    it.each([
        [true, true],
        [false, false],
    ])('reads the stored boolean %s', async (stored, expected) => {
        stubProfile(makeProfile({ notifications: { responseCompletion: stored } }));

        const { result } = renderPreference();

        await waitFor(() => expect(result.current.enabled).toBe(expected));
    });

    it.each([
        ['off', false],
        ['background', true],
        ['always', true],
    ] as const)('migrates the legacy %s mode to %s', async (stored, expected) => {
        stubProfile(makeProfile({ notifications: { responseCompletion: stored } }));

        const { result } = renderPreference();

        await waitFor(() => expect(result.current.enabled).toBe(expected));
    });

    it('keeps setEnabled referentially stable across renders', async () => {
        stubProfile(makeProfile({ notifications: { responseCompletion: false } }));

        const { result, rerender } = renderPreference();

        const initialSetEnabled = result.current.setEnabled;

        await waitFor(() => expect(result.current.enabled).toBe(false));

        rerender();

        expect(result.current.setEnabled).toBe(initialSetEnabled);
    });

    it('writes the new value through PUT /users/me', async () => {
        const bodies = stubProfile(makeProfile({ notifications: { responseCompletion: false } }));

        const { result } = renderPreference();

        await waitFor(() => expect(result.current.enabled).toBe(false));

        act(() => {
            result.current.setEnabled(true);
        });

        await waitFor(() => expect(bodies).toHaveLength(1));

        expect(bodies[0].preferences?.notifications).toEqual({ responseCompletion: true });
    });

    it('does not write before the profile has loaded, so it cannot wipe sibling keys', async () => {
        const bodies: UpdateBody[] = [];

        // GET stays pending so the cache is empty when setEnabled is called.
        server.use(respond('get', '/users/me', () => new Promise<Response>(() => {})));
        server.use(
            http.put(apiUrl('/users/me'), async ({ request }) => {
                bodies.push((await request.json()) as UpdateBody);

                return envelope(makeProfile());
            }),
        );

        const { result } = renderPreference();

        expect(result.current.isLoaded).toBe(false);

        act(() => {
            result.current.setEnabled(false);
        });

        // Flush any queued microtasks; a guarded setEnabled must still have issued no PUT.
        await act(async () => {
            await Promise.resolve();
        });

        expect(bodies).toHaveLength(0);
    });

    it('reports isLoaded once the profile has resolved', async () => {
        stubProfile(makeProfile({ notifications: { responseCompletion: true } }));

        const { result } = renderPreference();

        expect(result.current.isLoaded).toBe(false);

        await waitFor(() => expect(result.current.isLoaded).toBe(true));
    });

    it('preserves sibling preference keys and sibling notification keys when saving', async () => {
        const bodies = stubProfile(
            makeProfile({
                keyboard: { send: { enabled: false } },
                theme: 'dark',
                notifications: { emailDigest: true, responseCompletion: true },
            }),
        );

        const { result } = renderPreference();

        await waitFor(() => expect(result.current.enabled).toBe(true));

        act(() => {
            result.current.setEnabled(false);
        });

        await waitFor(() => expect(bodies).toHaveLength(1));

        expect(bodies[0].preferences?.keyboard).toEqual({ send: { enabled: false } });
        expect(bodies[0].preferences?.theme).toBe('dark');
        expect(bodies[0].preferences?.notifications).toEqual({ emailDigest: true, responseCompletion: false });
    });

    it('replaces a malformed notifications bag rather than spreading it', async () => {
        const bodies = stubProfile(makeProfile({ theme: 'dark', notifications: 'nope' }));

        const { result } = renderPreference();

        await waitFor(() => expect(result.current.enabled).toBe(true));

        act(() => {
            result.current.setEnabled(false);
        });

        await waitFor(() => expect(bodies).toHaveLength(1));

        expect(bodies[0].preferences?.notifications).toEqual({ responseCompletion: false });
        expect(bodies[0].preferences?.theme).toBe('dark');
    });

    it('applies the new value optimistically and rolls it back when the write fails', async () => {
        const profile = makeProfile({ notifications: { responseCompletion: false } });

        // The optimistic window is only observable while the write is in flight, so the
        // failure is released by hand rather than raced against a timer.
        let releaseWrite: (() => void) | undefined;

        server.use(respond('get', '/users/me', () => envelope(profile)));
        server.use(
            respond('put', '/users/me', async () => {
                await new Promise<void>((resolve) => {
                    releaseWrite = resolve;
                });

                return httpError(500);
            }),
        );

        const { result } = renderPreference();

        await waitFor(() => expect(result.current.enabled).toBe(false));

        act(() => {
            result.current.setEnabled(true);
        });

        await waitFor(() => expect(result.current.enabled).toBe(true));
        await waitFor(() => expect(releaseWrite).toBeDefined());

        act(() => {
            releaseWrite?.();
        });

        await waitFor(() => expect(result.current.enabled).toBe(false));
        await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled());
        await waitFor(() => expect(result.current.isSaving).toBe(false));
    });
});
