import { useEffect, useState } from 'react';

const TICK_MS = 1000;

/**
 * Milliseconds a run has been going, ticking once a second and freezing at the final
 * reading when it ends.
 *
 * `reportedMs` is a duration the backend measured, and it wins outright: our own clock can
 * only ever start when this component mounts, so a run opened mid-flight would otherwise
 * report seconds when the backend is minutes in. `startedAtMs` anchors the measured
 * fallback to the run rather than to this mount, so navigating away and back mid-run does
 * not restart it; without it the reading is measured from mount. Returns 0 for a run that
 * reported nothing and never streamed here, so a reloaded message falls back to its
 * persisted duration instead of a measured one.
 */
export const useElapsedMs = (isRunning: boolean, startedAtMs?: number, reportedMs?: number): number => {
    const [measuredMs, setMeasuredMs] = useState(0);

    useEffect(() => {
        if (!isRunning) return;

        const startedAt = startedAtMs ?? Date.now();
        const tick = () => setMeasuredMs(Math.max(0, Date.now() - startedAt));

        tick();

        const timer = window.setInterval(tick, TICK_MS);

        return () => {
            window.clearInterval(timer);
        };
    }, [isRunning, startedAtMs]);

    // An anchored measurement outranks the backend's number while the run is live: status
    // parts arrive every few seconds, so preferring `reportedMs` would freeze the clock
    // between them. Unanchored, our clock starts at mount and the backend's is the honest one.
    return startedAtMs !== undefined && measuredMs > 0 ? measuredMs : (reportedMs ?? measuredMs);
};
