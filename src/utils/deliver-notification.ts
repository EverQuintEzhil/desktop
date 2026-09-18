const isNotificationSupported = (): boolean =>
    typeof window !== 'undefined' && 'Notification' in window && Boolean(window.Notification);

const deliverViaServiceWorker = async (title: string, options: NotificationOptions): Promise<boolean> => {
    try {
        const registration = await navigator.serviceWorker?.getRegistration?.();

        if (!registration?.active) {
            return false;
        }

        await registration.showNotification(title, options);

        return true;
    } catch {
        return false;
    }
};

const deliverViaConstructor = (title: string, options: NotificationOptions): boolean => {
    try {
        const notification = new Notification(title, options);

        notification.onclick = () => {
            window.focus();

            // The service-worker path routes on click; this one has to do it itself, and the url
            // is not always this page — a notification about a conversation the reader left names
            // that conversation.
            const target = (options.data as { url?: unknown } | undefined)?.url;

            // Compared by path, not by href: a query or hash the reader picked up since would
            // otherwise make this reload the page they are already on, losing an in-flight draft.
            if (
                typeof target === 'string' &&
                new URL(target, window.location.href).pathname !== window.location.pathname
            ) {
                window.location.assign(target);
            }

            notification.close();
        };

        return true;
    } catch {
        return false;
    }
};

/**
 * Shows a desktop notification, preferring the service worker registration. Chromium silently
 * drops constructor-created notifications from a hidden tab, so the SW path is required for the
 * background case; the constructor is the fallback for Safari and engines without the SW registered.
 */
export const deliverNotification = async (title: string, options: NotificationOptions): Promise<boolean> => {
    if (!isNotificationSupported() || Notification.permission !== 'granted') {
        return false;
    }

    if (await deliverViaServiceWorker(title, options)) {
        return true;
    }

    return deliverViaConstructor(title, options);
};
