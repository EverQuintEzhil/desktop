import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface PersistentSearchParamOptions<T extends string> {
    allowed: readonly T[];
    fallback: T;
    storageKey?: string;
    /** Push a history entry per change, so browser back/forward walks the values. */
    pushHistory?: boolean;
    /** Mirror the value in sessionStorage and restore it when the URL carries none. */
    persist?: boolean;
}

export function usePersistentSearchParam<T extends string>(
    paramKey: string,
    options: PersistentSearchParamOptions<T>,
): [T, (value: T) => void] {
    const { allowed, fallback, storageKey = `search-param:${paramKey}`, pushHistory = false, persist = true } = options;
    const [searchParams, setSearchParams] = useSearchParams();

    const readStored = (): T | null => {
        if (!persist) return null;

        try {
            const stored = sessionStorage.getItem(storageKey);

            return allowed.includes(stored as T) ? (stored as T) : null;
        } catch {
            return null;
        }
    };

    const raw = searchParams.get(paramKey);
    // Resolve the stored value synchronously so the first render already reflects
    // the persisted scope. Deferring it to the effect below paints the fallback
    // first and then flips once the URL is rewritten — a visible glitch.
    const value = allowed.includes(raw as T) ? (raw as T) : (readStored() ?? fallback);

    const setValue = useCallback(
        (next: T) => {
            if (persist) {
                sessionStorage.setItem(storageKey, next);
            }

            setSearchParams(
                (prev) => {
                    const params = new URLSearchParams(prev);

                    if (next === fallback) {
                        params.delete(paramKey);
                    } else {
                        params.set(paramKey, next);
                    }

                    return params;
                },
                { replace: !pushHistory },
            );
        },
        [paramKey, fallback, storageKey, pushHistory, persist, setSearchParams],
    );

    useEffect(() => {
        if (!persist || searchParams.get(paramKey)) return;

        const stored = sessionStorage.getItem(storageKey);

        if (!stored || stored === fallback || !allowed.includes(stored as T)) return;

        setSearchParams(
            (prev) => {
                const params = new URLSearchParams(prev);

                params.set(paramKey, stored);

                return params;
            },
            { replace: true },
        );
    }, [paramKey, fallback, storageKey, persist, allowed, searchParams, setSearchParams]);

    return [value, setValue];
}
