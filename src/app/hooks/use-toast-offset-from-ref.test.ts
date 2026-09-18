import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import useToastOffsetFromRef from './use-toast-offset-from-ref';

const TOAST_TOP_VAR = '--toast-top';
const TOAST_TOP_DEFAULT = '68px';

afterEach(() => {
    document.documentElement.style.removeProperty(TOAST_TOP_VAR);
});

describe('useToastOffsetFromRef', () => {
    it('does nothing when the ref has no current element', () => {
        const ref = createRef<HTMLElement>();

        renderHook(() => useToastOffsetFromRef(ref));

        expect(document.documentElement.style.getPropertyValue(TOAST_TOP_VAR)).toBe('');
    });

    it('sets --toast-top to the element bottom on mount', () => {
        const el = document.createElement('div');

        el.getBoundingClientRect = () => ({
            bottom: 120,
            top: 0,
            left: 0,
            right: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });

        const ref = { current: el };

        renderHook(() => useToastOffsetFromRef(ref));

        expect(document.documentElement.style.getPropertyValue(TOAST_TOP_VAR)).toBe('120px');
    });

    it('resets --toast-top to the default on unmount', () => {
        const el = document.createElement('div');

        el.getBoundingClientRect = () => ({
            bottom: 120,
            top: 0,
            left: 0,
            right: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });

        const ref = { current: el };
        const { unmount } = renderHook(() => useToastOffsetFromRef(ref));

        unmount();

        expect(document.documentElement.style.getPropertyValue(TOAST_TOP_VAR)).toBe(TOAST_TOP_DEFAULT);
    });

    it('clamps a negative bottom to 0', () => {
        const el = document.createElement('div');

        el.getBoundingClientRect = () => ({
            bottom: -50,
            top: 0,
            left: 0,
            right: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });

        const ref = { current: el };

        renderHook(() => useToastOffsetFromRef(ref));

        expect(document.documentElement.style.getPropertyValue(TOAST_TOP_VAR)).toBe('0px');
    });
});
