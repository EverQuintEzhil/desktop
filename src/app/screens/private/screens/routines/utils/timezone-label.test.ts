import { describe, expect, it } from 'vitest';

import { timezoneLabel, timezoneSuffixForViewer } from './timezone-label';

describe('timezoneLabel', () => {
    it('renders an offset for a raw IANA id', () => {
        expect(timezoneLabel('Asia/Calcutta')).toBe('GMT+5:30');
    });

    it('falls back to the id for an unknown zone', () => {
        expect(timezoneLabel('Not/AZone')).toBe('Not/AZone');
    });
});

describe('timezoneSuffixForViewer', () => {
    const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    it('stays silent for the viewer own zone', () => {
        expect(timezoneSuffixForViewer(viewerZone)).toBeNull();
    });

    it('stays silent for an alias of the viewer zone with the same offset', () => {
        const alias = viewerZone === 'Asia/Kolkata' ? 'Asia/Calcutta' : viewerZone;

        expect(timezoneSuffixForViewer(alias)).toBeNull();
    });

    it('names the zone when it differs from the viewer', () => {
        const foreign = viewerZone === 'Pacific/Kiritimati' ? 'Pacific/Honolulu' : 'Pacific/Kiritimati';

        expect(timezoneSuffixForViewer(foreign)).toBe(timezoneLabel(foreign));
    });

    it('stays silent when the routine has no zone at all', () => {
        expect(timezoneSuffixForViewer(null)).toBeNull();
    });
});
