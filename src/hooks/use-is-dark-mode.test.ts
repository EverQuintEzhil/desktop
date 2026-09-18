import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useIsDarkMode } from './use-is-dark-mode';

const setDarkClass = (isDark: boolean) => {
    document.documentElement.classList.toggle('dark', isDark);
};

describe('useIsDarkMode', () => {
    afterEach(() => {
        setDarkClass(false);
    });

    it('reads the dark class already on the document', () => {
        setDarkClass(true);

        const { result } = renderHook(() => useIsDarkMode());

        expect(result.current).toBe(true);
    });

    it('reports light when the document carries no dark class', () => {
        const { result } = renderHook(() => useIsDarkMode());

        expect(result.current).toBe(false);
    });

    it('follows the class when appearance changes after mount', async () => {
        const { result } = renderHook(() => useIsDarkMode());

        expect(result.current).toBe(false);

        await act(async () => {
            setDarkClass(true);
            await Promise.resolve();
        });

        expect(result.current).toBe(true);

        await act(async () => {
            setDarkClass(false);
            await Promise.resolve();
        });

        expect(result.current).toBe(false);
    });

    it('stops watching once unmounted', async () => {
        const { result, unmount } = renderHook(() => useIsDarkMode());

        unmount();

        await act(async () => {
            setDarkClass(true);
            await Promise.resolve();
        });

        expect(result.current).toBe(false);
    });
});
