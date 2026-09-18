import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import type { CropBox } from '../../utils/crop-utils';

import CropOverlay, { KEYBOARD_NUDGE_IDLE_MS } from './crop-overlay';

// displaySize === imageDimensions, so scaleX/scaleY are 1 and a pointer delta in
// client pixels is the same number of image pixels.
export const IMAGE = { width: 400, height: 400 };
export const CROP: CropBox = {
    x: 100,
    y: 100,
    width: 200,
    height: 200,
};

export type Props = Parameters<typeof CropOverlay>[0];

export const renderOverlay = (overrides: Partial<Props> = {}) => {
    const onCropChange = vi.fn();
    const onCropStart = vi.fn();

    const view = render(
        <CropOverlay
            crop={CROP}
            imageDimensions={IMAGE}
            displaySize={IMAGE}
            aspectRatio={null}
            onCropChange={onCropChange}
            onCropStart={onCropStart}
            {...overrides}
        />,
    );

    return { ...view, onCropChange, onCropStart };
};

export const flushFrame = () =>
    act(() => {
        vi.advanceTimersByTime(32);
    });

export const idleOutKeyboardBurst = () =>
    act(() => {
        vi.advanceTimersByTime(KEYBOARD_NUDGE_IDLE_MS + 50);
    });

export const HANDLE_NAMES: Record<string, string> = {
    nw: 'Resize crop from the top left corner',
    n: 'Resize crop from the top edge',
    ne: 'Resize crop from the top right corner',
    e: 'Resize crop from the right edge',
    se: 'Resize crop from the bottom right corner',
    s: 'Resize crop from the bottom edge',
    sw: 'Resize crop from the bottom left corner',
    w: 'Resize crop from the left edge',
};

export const cropBox = () => screen.getByRole('group', { name: 'Crop area' });
export const handleControl = (handle: string) => screen.getByRole('group', { name: HANDLE_NAMES[handle] });
export const handleNames = () =>
    within(cropBox())
        .getAllByRole('group')
        .map((node) => node.getAttribute('aria-label'));

export const pressLeftMouse = (target: HTMLElement, clientX: number, clientY: number) => {
    fireEvent.pointerDown(target, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX,
        clientY,
    });
};

export const registerFakeCropTimers = () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });
};
