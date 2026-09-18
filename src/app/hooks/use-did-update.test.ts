import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useDidUpdate from './use-did-update';

describe('useDidUpdate', () => {
    it('does not invoke the callback on the initial mount', () => {
        const callback = vi.fn();

        renderHook(({ dep }) => useDidUpdate(callback, [dep]), { initialProps: { dep: 0 } });

        expect(callback).not.toHaveBeenCalled();
    });

    it('invokes the callback when a dependency changes', () => {
        const callback = vi.fn();
        const { rerender } = renderHook(({ dep }) => useDidUpdate(callback, [dep]), { initialProps: { dep: 0 } });

        rerender({ dep: 1 });

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not invoke the callback again when re-rendered with the same dependency', () => {
        const callback = vi.fn();
        const { rerender } = renderHook(({ dep }) => useDidUpdate(callback, [dep]), { initialProps: { dep: 0 } });

        rerender({ dep: 1 });
        rerender({ dep: 1 });

        expect(callback).toHaveBeenCalledTimes(1);
    });
});
