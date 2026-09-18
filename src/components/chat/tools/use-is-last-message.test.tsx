import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useIsLastMessage } from './use-is-last-message';

describe('useIsLastMessage', () => {
    it('reports answerable outside a message scope instead of throwing', () => {
        const { result } = renderHook(() => useIsLastMessage());

        expect(result.current).toBe(true);
    });
});
