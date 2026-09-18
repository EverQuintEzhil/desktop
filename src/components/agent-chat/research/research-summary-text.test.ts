import { describe, expect, it } from 'vitest';

import { toPlainSummary } from './research-summary-text';

describe('toPlainSummary', () => {
    it('keeps a citation label and drops its href', () => {
        expect(toPlainSummary('Apple confirmed the event ([Forbes, Aug 31](https://www.forbes.com/a/b)).')).toBe(
            'Apple confirmed the event (Forbes, Aug 31).',
        );
    });

    it('falls back to the host when the citation has no label', () => {
        expect(toPlainSummary('Reported by [](https://www.macrumors.com/x) today.')).toBe(
            'Reported by macrumors.com today.',
        );
    });

    it('cuts a citation the preview truncation left open', () => {
        expect(
            toPlainSummary(
                'Apple Park ([Forbes, Aug 31, 2026](https://www.forbes.com/sites/davidphelan/2026/08/31/ap…',
            ),
        ).toBe('Apple Park…');
    });

    it('cuts a bare URL the truncation left open', () => {
        expect(toPlainSummary('See https://9to5mac.co…')).toBe('See…');
    });

    it('strips emphasis and list markers', () => {
        expect(toPlainSummary('- The **A20 Pro** uses `2nm` _packaging_')).toBe('The A20 Pro uses 2nm packaging');
    });

    it('collapses the whitespace a stripped link leaves behind', () => {
        expect(toPlainSummary('Two sources agreed https://example.com/a on the date.')).toBe(
            'Two sources agreed on the date.',
        );
    });

    it('returns an empty string for a summary that was only a link', () => {
        expect(toPlainSummary('https://example.com/a')).toBe('');
    });
});
