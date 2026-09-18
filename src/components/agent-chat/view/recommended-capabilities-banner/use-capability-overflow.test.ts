import { describe, expect, it } from 'vitest';

import { countFittedChildren } from './use-capability-overflow';

// The numbers below are hand-derived from the module's reserves, so a changed constant or a
// flipped sign fails here rather than silently widening the row.
const CHIP_GAP = 8;
const OVERFLOW_RESERVE_WIDTH = 44;
const DISMISS_RESERVE_WIDTH = 24 + CHIP_GAP;

const makeChild = (offsetWidth: number): HTMLElement => {
    const child = document.createElement('div');

    Object.defineProperty(child, 'offsetWidth', { value: offsetWidth, configurable: true });

    return child;
};

const makeContainer = (clientWidth: number, padding: number): HTMLElement => {
    const container = document.createElement('div');

    container.style.paddingLeft = `${padding}px`;
    container.style.paddingRight = `${padding}px`;
    Object.defineProperty(container, 'clientWidth', { value: clientWidth, configurable: true });

    return container;
};

const countFitted = (clientWidth: number, widths: number[], padding = 0) =>
    countFittedChildren(makeContainer(clientWidth, padding), widths.map(makeChild));

// Three 100px children need 100 + (100 + gap) + (100 + gap) of content, and every child but
// the last is also charged the "+N" button it might have to make room for.
const THREE_CHIPS = [100, 100, 100];
const THREE_CHIPS_CONTENT = 100 + (100 + CHIP_GAP) + (100 + CHIP_GAP);
const FIRST_OF_THREE_CONTENT = 100 + OVERFLOW_RESERVE_WIDTH;
const TWO_OF_THREE_CONTENT = 100 + (100 + CHIP_GAP) + OVERFLOW_RESERVE_WIDTH;

describe('countFittedChildren', () => {
    it('counts nothing when there is nothing to lay out', () => {
        expect(countFitted(1000, [])).toBe(0);
    });

    it('fits every child at the exact width they need', () => {
        expect(countFitted(THREE_CHIPS_CONTENT + DISMISS_RESERVE_WIDTH, THREE_CHIPS)).toBe(3);
    });

    it('drops the last child one pixel below the exact fit', () => {
        expect(countFitted(THREE_CHIPS_CONTENT + DISMISS_RESERVE_WIDTH - 1, THREE_CHIPS)).toBe(2);
    });

    it('fits some children and hides the rest at an in-between width', () => {
        expect(countFitted(TWO_OF_THREE_CONTENT + DISMISS_RESERVE_WIDTH, THREE_CHIPS)).toBe(2);
        expect(countFitted(TWO_OF_THREE_CONTENT + DISMISS_RESERVE_WIDTH - 1, THREE_CHIPS)).toBe(1);
        expect(countFitted(FIRST_OF_THREE_CONTENT + DISMISS_RESERVE_WIDTH, THREE_CHIPS)).toBe(1);
        expect(countFitted(FIRST_OF_THREE_CONTENT + DISMISS_RESERVE_WIDTH - 1, THREE_CHIPS)).toBe(0);
    });

    it('charges the overflow reserve to every child but the last', () => {
        // A lone child is the last one, so it is never charged for a "+N" button it cannot need.
        expect(countFitted(100 + DISMISS_RESERVE_WIDTH, [100])).toBe(1);
        expect(countFitted(100 + DISMISS_RESERVE_WIDTH - 1, [100])).toBe(0);

        // The same width with a second child behind it does have to pay for the button.
        expect(countFitted(100 + DISMISS_RESERVE_WIDTH, [100, 100])).toBe(0);
        expect(countFitted(100 + OVERFLOW_RESERVE_WIDTH + DISMISS_RESERVE_WIDTH, [100, 100])).toBe(1);
    });

    it('subtracts the container padding from the available width', () => {
        const exactWidth = THREE_CHIPS_CONTENT + DISMISS_RESERVE_WIDTH;

        expect(countFitted(exactWidth + 30, THREE_CHIPS, 15)).toBe(3);
        expect(countFitted(exactWidth + 29, THREE_CHIPS, 15)).toBe(2);
    });

    it('fits nothing in a container that has no measured width', () => {
        expect(countFitted(0, THREE_CHIPS)).toBe(0);
    });

    it('stops at the first child that does not fit rather than packing a later narrow one', () => {
        expect(countFitted(300 + DISMISS_RESERVE_WIDTH, [100, 400, 10])).toBe(1);
    });
});
