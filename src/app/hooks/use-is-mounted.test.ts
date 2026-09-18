import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useIsMounted from './use-is-mounted';

describe('useIsMounted', () => {
    it('is true while the component is mounted', () => {
        const { result } = renderHook(() => useIsMounted());

        expect(result.current.current).toBe(true);
    });

    it('becomes false after the component unmounts', () => {
        const { result, unmount } = renderHook(() => useIsMounted());

        unmount();

        expect(result.current.current).toBe(false);
    });
});
