import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type BlogSearchParamPatch = Record<string, string | null>;

export const useBlogSearchParams = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Filter churn replaces rather than pushes, so the back button leaves the blog area instead of
    // stepping back through every keystroke.
    const patchSearchParams = useCallback(
        (values: BlogSearchParamPatch) => {
            setSearchParams(
                (previous) => {
                    const next = new URLSearchParams(previous);

                    for (const [key, value] of Object.entries(values)) {
                        if (value === null || value === '') {
                            next.delete(key);
                        } else {
                            next.set(key, value);
                        }
                    }

                    return next;
                },
                { replace: true },
            );
        },
        [setSearchParams],
    );

    return { searchParams, patchSearchParams };
};
