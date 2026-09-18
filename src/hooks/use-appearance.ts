import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '@/utils';

export type Appearance = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'fm-appearance';

const isAppearance = (value: string | null): value is Appearance =>
    value === 'system' || value === 'light' || value === 'dark';

export const getStoredAppearance = (): Appearance => {
    const stored = safeLocalStorageGetItem(STORAGE_KEY);

    return isAppearance(stored) ? stored : 'light';
};

const prefersDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches;

export const applyAppearance = (appearance: Appearance): void => {
    const isDark = appearance === 'dark' || (appearance === 'system' && prefersDark());

    document.documentElement.classList.toggle('dark', isDark);
};

const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

// The in-memory value wins over storage: safeLocalStorageSetItem swallows write failures
// (blocked storage, quota), and the choice must still apply for the session.
let sessionAppearance: Appearance | null = null;

const getAppearanceSnapshot = (): Appearance => sessionAppearance ?? getStoredAppearance();

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    // The browser fires 'storage' only in OTHER tabs, never the writing one — same-tab
    // consumers are reached through notify(). event.key is null for localStorage.clear().
    const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== STORAGE_KEY) return;

        sessionAppearance = null;
        listener();
    };

    window.addEventListener('storage', onStorage);

    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);

        if (listeners.size === 0) {
            sessionAppearance = null;
        }
    };
};

export const useAppearance = () => {
    const appearance = useSyncExternalStore(subscribe, getAppearanceSnapshot);

    useEffect(() => {
        applyAppearance(appearance);

        if (appearance !== 'system') return undefined;

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => applyAppearance('system');

        media.addEventListener('change', onChange);

        return () => media.removeEventListener('change', onChange);
    }, [appearance]);

    const setAppearance = useCallback((next: Appearance) => {
        sessionAppearance = next;
        safeLocalStorageSetItem(STORAGE_KEY, next);
        notify();
    }, []);

    return { appearance, setAppearance };
};
