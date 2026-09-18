import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deliverNotification } from './deliver-notification';

interface NotificationCall {
    title: string;
    options?: NotificationOptions;
}

const constructorCalls: NotificationCall[] = [];

class FakeNotification {
    static permission: NotificationPermission = 'granted';

    onclick: (() => void) | null = null;

    close = vi.fn();

    constructor(title: string, options?: NotificationOptions) {
        constructorCalls.push({ title, options });
    }
}

const setServiceWorker = (value: unknown): void => {
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value,
    });
};

const clearServiceWorker = (): void => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
};

describe('deliverNotification', () => {
    beforeEach(() => {
        constructorCalls.length = 0;
        FakeNotification.permission = 'granted';
        vi.stubGlobal('Notification', FakeNotification);
        clearServiceWorker();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearServiceWorker();
    });

    it('prefers the service worker registration when one has an active worker', async () => {
        const showNotification = vi.fn().mockResolvedValue(undefined);

        setServiceWorker({
            getRegistration: vi.fn().mockResolvedValue({ active: {}, showNotification }),
        });

        const options: NotificationOptions = {
            body: 'Body',
            tag: 'fluentmind-chat-completion',
            data: { url: 'https://app.test/agent/a-1/chat/c-1' },
        };

        const result = await deliverNotification('Title', options);

        expect(result).toBe(true);
        expect(showNotification).toHaveBeenCalledWith('Title', {
            body: 'Body',
            tag: 'fluentmind-chat-completion',
            data: { url: 'https://app.test/agent/a-1/chat/c-1' },
        });
        expect(constructorCalls).toHaveLength(0);
    });

    it('falls back to the constructor when no registration exists', async () => {
        setServiceWorker({ getRegistration: vi.fn().mockResolvedValue(undefined) });

        const result = await deliverNotification('Title', { body: 'Body' });

        expect(result).toBe(true);
        expect(constructorCalls).toEqual([{ title: 'Title', options: { body: 'Body' } }]);
    });

    it('falls back to the constructor when the registration has no active worker', async () => {
        const showNotification = vi.fn();

        setServiceWorker({
            getRegistration: vi.fn().mockResolvedValue({ active: null, showNotification }),
        });

        const result = await deliverNotification('Title', { body: 'Body' });

        expect(result).toBe(true);
        expect(showNotification).not.toHaveBeenCalled();
        expect(constructorCalls).toHaveLength(1);
    });

    it('falls back to the constructor when getRegistration rejects', async () => {
        setServiceWorker({ getRegistration: vi.fn().mockRejectedValue(new Error('boom')) });

        const result = await deliverNotification('Title', { body: 'Body' });

        expect(result).toBe(true);
        expect(constructorCalls).toHaveLength(1);
    });

    it('falls back to the constructor when showNotification throws', async () => {
        const showNotification = vi.fn().mockRejectedValue(new Error('boom'));

        setServiceWorker({
            getRegistration: vi.fn().mockResolvedValue({ active: {}, showNotification }),
        });

        const result = await deliverNotification('Title', { body: 'Body' });

        expect(result).toBe(true);
        expect(constructorCalls).toHaveLength(1);
    });

    it('falls back to the constructor when navigator.serviceWorker is absent', async () => {
        const result = await deliverNotification('Title', { body: 'Body' });

        expect(result).toBe(true);
        expect(constructorCalls).toHaveLength(1);
    });

    it('returns false without delivering when permission is not granted', async () => {
        FakeNotification.permission = 'default';

        const result = await deliverNotification('Title', { body: 'Body' });

        expect(result).toBe(false);
        expect(constructorCalls).toHaveLength(0);
    });

    it('returns false when notifications are unsupported', async () => {
        vi.stubGlobal('Notification', undefined);

        const result = await deliverNotification('Title', { body: 'Body' });

        expect(result).toBe(false);
    });

    it('returns false rather than throwing when the constructor throws', async () => {
        vi.stubGlobal(
            'Notification',
            class {
                static permission: NotificationPermission = 'granted';

                constructor() {
                    throw new Error('blocked');
                }
            },
        );

        const result = await deliverNotification('Title', { body: 'Body' });

        expect(result).toBe(false);
    });
});
