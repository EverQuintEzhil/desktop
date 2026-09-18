import { useCallback, useEffect, useState } from 'react';

const DISMISS_STORAGE_KEY = 'fluentmind-notification-prompt-dismissed';

export type NotificationPermissionState = NotificationPermission | 'unsupported';

const isNotificationSupported = (): boolean =>
    typeof window !== 'undefined' && 'Notification' in window && Boolean(window.Notification);

const getCurrentPermission = (): NotificationPermissionState => {
    if (!isNotificationSupported()) {
        return 'unsupported';
    }

    return Notification.permission;
};

const readDismissed = (): boolean => {
    try {
        return window.localStorage.getItem(DISMISS_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};

interface NotificationPermissionResult {
    permission: NotificationPermissionState;
    canPrompt: boolean;
    request: () => Promise<NotificationPermissionState>;
    dismiss: () => void;
}

export const useNotificationPermission = (): NotificationPermissionResult => {
    const [permission, setPermission] = useState<NotificationPermissionState>(getCurrentPermission);
    const [isDismissed, setIsDismissed] = useState<boolean>(readDismissed);

    useEffect(() => {
        setPermission(getCurrentPermission());
        setIsDismissed(readDismissed());
    }, []);

    // Chromium can answer a permission request with a quiet omnibox chip instead of a modal, in
    // which case requestPermission() never settles and the page is only told about the outcome
    // through the Permissions API. Safari historically rejects query() for the 'notifications'
    // name, and the API is absent altogether in older engines.
    useEffect(() => {
        let isSubscriptionActive = true;
        let permissionStatus: PermissionStatus | undefined;

        const syncPermission = (): void => {
            if (isSubscriptionActive) {
                setPermission(getCurrentPermission());
            }
        };

        const subscribe = async (): Promise<void> => {
            if (typeof navigator === 'undefined' || typeof navigator.permissions?.query !== 'function') {
                return;
            }

            try {
                const status = await navigator.permissions.query({ name: 'notifications' as PermissionName });

                if (!isSubscriptionActive) {
                    return;
                }

                permissionStatus = status;
                status.addEventListener('change', syncPermission);
            } catch {
                // The engine does not recognise the 'notifications' permission name.
            }
        };

        void subscribe();

        return () => {
            isSubscriptionActive = false;
            permissionStatus?.removeEventListener('change', syncPermission);
        };
    }, []);

    // The Permissions API 'change' event does not fire reliably in every engine, so re-read the
    // permission whenever the user comes back to the tab after acting on a browser-level prompt.
    useEffect(() => {
        const syncPermission = (): void => setPermission(getCurrentPermission());

        window.addEventListener('focus', syncPermission);
        document.addEventListener('visibilitychange', syncPermission);

        return () => {
            window.removeEventListener('focus', syncPermission);
            document.removeEventListener('visibilitychange', syncPermission);
        };
    }, []);

    const request = useCallback(async (): Promise<NotificationPermissionState> => {
        if (!isNotificationSupported()) {
            return 'unsupported';
        }

        try {
            // A requestPermission() that a later call supersedes resolves 'default' whatever the
            // user chose, so the resolved value is not authoritative and a stale resolution would
            // clobber a real grant. Notification.permission is authoritative, and the engine has
            // already updated it by the time either promise settles.
            await Notification.requestPermission();
        } catch {
            // Older engines reject rather than resolve; the live permission is still correct.
        }

        const current = getCurrentPermission();

        setPermission(current);

        return current;
    }, []);

    const dismiss = useCallback((): void => {
        setIsDismissed(true);

        try {
            window.localStorage.setItem(DISMISS_STORAGE_KEY, 'true');
        } catch {
            // Ignore storage write failures.
        }
    }, []);

    const canPrompt = permission === 'default' && !isDismissed;

    return {
        permission,
        canPrompt,
        request,
        dismiss,
    };
};
