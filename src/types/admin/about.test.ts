import { describe, expect, it } from 'vitest';

import { ROUTINES_HIDDEN_WHEN_UNSET } from '@/lib/tenant/tenant-state';

import { KEY_LIST } from './about';

const keyDef = (value: string) => KEY_LIST.find((key) => key.value === value);

describe('KEY_LIST unset visibility defaults', () => {
    it('declares the same unset default for Routines that the tenant reader applies', () => {
        expect(keyDef('hide-routines')?.hiddenWhenUnset).toBe(ROUTINES_HIDDEN_WHEN_UNSET);
    });

    it('leaves every other visibility key on the visible-when-unset default', () => {
        const others = KEY_LIST.filter(
            (key) => key.inputType === 'visibility-check-box' && key.value !== 'hide-routines',
        );

        expect(others.length).toBeGreaterThan(0);
        expect(others.filter((key) => key.hiddenWhenUnset)).toEqual([]);
    });
});
