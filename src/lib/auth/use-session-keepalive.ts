import { useEffect } from 'react';

import { sessionApi } from '@/lib/api';
import { handleSessionExpired } from '@/lib/auth/handle-session-expired';
import { createStoredUserState, mapSessionUserinfoToUserState } from '@/lib/auth/user-state';
import { safeLocalStorageSetItem } from '@/utils';

const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;
const MIN_CHECK_GAP_MS = 30 * 1000;

/** Revalidate the cookie session on tab focus and periodically while visible. */
export const useSessionKeepalive = (enabled: boolean): void => {
    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return undefined;

        let lastCheckAt = 0;
        let inFlight = false;

        const check = async () => {
            const now = Date.now();

            if (inFlight || now - lastCheckAt < MIN_CHECK_GAP_MS) return;

            inFlight = true;
            lastCheckAt = now;

            try {
                const userinfo = await sessionApi.getUserinfo();

                safeLocalStorageSetItem(
                    'user',
                    JSON.stringify(createStoredUserState(mapSessionUserinfoToUserState(userinfo))),
                );
            } catch {
                handleSessionExpired();
            } finally {
                inFlight = false;
            }
        };

        const onVisibility = () => {
            if (document.visibilityState === 'visible') void check();
        };

        document.addEventListener('visibilitychange', onVisibility);
        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') void check();
        }, KEEPALIVE_INTERVAL_MS);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.clearInterval(intervalId);
        };
    }, [enabled]);
};
