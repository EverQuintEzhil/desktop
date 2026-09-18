import { ZapIcon } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { routineIcon, routineIconByKey } from './routine-icon';

describe('routineIcon', () => {
    it('answers a picked key with its own icon', () => {
        expect(routineIcon('coffee')).toBe(routineIconByKey('coffee'));
    });

    it('falls back to the shared zap default when nothing was picked', () => {
        expect(routineIcon()).toBe(ZapIcon);
        expect(routineIcon(null)).toBe(ZapIcon);
    });

    it('falls back to zap for a key that no longer exists', () => {
        expect(routineIcon('retired-key')).toBe(ZapIcon);
    });
});
