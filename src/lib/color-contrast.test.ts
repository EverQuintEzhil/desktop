import { describe, expect, it } from 'vitest';

import { contrastRatio, parseRgb, readableAgainst } from './color-contrast';

const DARK_CARD = 'rgb(45, 45, 45)';
const LIGHT_CARD = 'rgb(255, 255, 255)';

const ratioAgainst = (color: string, background: string): number =>
    contrastRatio(parseRgb(color)!, parseRgb(background)!);

describe('readableAgainst', () => {
    it('leaves a pair that already clears the target alone', () => {
        expect(readableAgainst('rgb(229, 229, 229)', DARK_CARD, 4.5)).toBeUndefined();
    });

    it('lifts a dark authored colour until it clears the target on a dark card', () => {
        const result = readableAgainst('rgb(15, 71, 97)', DARK_CARD, 4.5);

        expect(result).toBeDefined();
        expect(ratioAgainst(result!, DARK_CARD)).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps the hue of the colour it re-tones', () => {
        const result = readableAgainst('rgb(15, 71, 97)', DARK_CARD, 4.5)!;
        const [red, green, blue] = parseRgb(result)!;

        // The source is a blue-dominant teal; the re-toned shade has to stay one.
        expect(blue).toBeGreaterThan(red);
        expect(green).toBeGreaterThan(red);
    });

    it('darkens instead when the backdrop is light', () => {
        const result = readableAgainst('rgb(200, 230, 255)', LIGHT_CARD, 4.5);

        expect(result).toBeDefined();
        expect(ratioAgainst(result!, LIGHT_CARD)).toBeGreaterThanOrEqual(4.5);
    });

    it('accepts the lower large-text target and stays closer to the original', () => {
        const strict = readableAgainst('rgb(15, 71, 97)', DARK_CARD, 4.5)!;
        const large = readableAgainst('rgb(15, 71, 97)', DARK_CARD, 3)!;

        expect(ratioAgainst(large, DARK_CARD)).toBeGreaterThanOrEqual(3);
        expect(ratioAgainst(large, DARK_CARD)).toBeLessThan(ratioAgainst(strict, DARK_CARD));
    });

    it('returns undefined for a value it cannot read', () => {
        expect(readableAgainst('windowtext', DARK_CARD, 4.5)).toBeUndefined();
        expect(readableAgainst('rgb(15, 71, 97)', 'not-a-colour', 4.5)).toBeUndefined();
    });

    it('handles a pure grey, which has no hue to preserve', () => {
        const result = readableAgainst('rgb(50, 50, 50)', DARK_CARD, 4.5);

        expect(result).toBeDefined();
        expect(ratioAgainst(result!, DARK_CARD)).toBeGreaterThanOrEqual(4.5);
    });
});
