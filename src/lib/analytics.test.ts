import { afterEach, describe, expect, it, vi } from 'vitest';

import { setAnalyticsTracker, trackEvent } from './analytics';

afterEach(() => {
    setAnalyticsTracker(null);
    vi.restoreAllMocks();
});

describe('trackEvent', () => {
    it('sends the event to the registered tracker', () => {
        const tracker = vi.fn();

        setAnalyticsTracker(tracker);
        trackEvent('recommendation_dismissed', { surface: 'chat_composer' });

        expect(tracker).toHaveBeenCalledWith('recommendation_dismissed', { surface: 'chat_composer' });
    });

    it('drops the event while no tracker is registered', () => {
        expect(() => trackEvent('recommendation_dismissed')).not.toThrow();
    });

    it('stops sending once the tracker is cleared', () => {
        const tracker = vi.fn();

        setAnalyticsTracker(tracker);
        setAnalyticsTracker(null);
        trackEvent('recommendation_dismissed');

        expect(tracker).not.toHaveBeenCalled();
    });

    it('does not let a failing tracker break the caller', () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

        setAnalyticsTracker(() => {
            throw new Error('network down');
        });

        expect(() => trackEvent('recommendation_dismissed')).not.toThrow();
        expect(logged).toHaveBeenCalled();
    });
});
