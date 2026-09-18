import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getComposerSpaceId, setComposerSpaceId, subscribeToComposerSpace } from './composer-space-store';

beforeEach(() => {
    setComposerSpaceId(null);
});

describe('composer space store', () => {
    it('round-trips the selection and notifies subscribers once per change', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeToComposerSpace(listener);

        setComposerSpaceId('space-1');

        expect(getComposerSpaceId()).toBe('space-1');
        expect(listener).toHaveBeenCalledTimes(1);

        // Same value → no notification (useSyncExternalStore snapshot stability).
        setComposerSpaceId('space-1');
        expect(listener).toHaveBeenCalledTimes(1);

        setComposerSpaceId(null);
        expect(getComposerSpaceId()).toBeNull();
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        setComposerSpaceId('space-2');
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
