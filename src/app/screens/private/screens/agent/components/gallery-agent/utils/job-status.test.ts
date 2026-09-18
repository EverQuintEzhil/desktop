import { describe, expect, it } from 'vitest';

import { isPendingStatus } from './job-status';

describe('isPendingStatus', () => {
    it('treats running, queued, and retry-queued as pending', () => {
        expect(isPendingStatus('running')).toBe(true);
        expect(isPendingStatus('QUEUED')).toBe(true);
        expect(isPendingStatus('retry-queued')).toBe(true);
    });

    it('treats completed, failed, and empty values as not pending', () => {
        expect(isPendingStatus('completed')).toBe(false);
        expect(isPendingStatus('failed')).toBe(false);
        expect(isPendingStatus(null)).toBe(false);
        expect(isPendingStatus(undefined)).toBe(false);
    });
});
