import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CropBox } from '../../utils/crop-utils';

import CropOverlay from './crop-overlay';
import {
    CROP,
    IMAGE,
    cropBox,
    handleControl,
    idleOutKeyboardBurst,
    registerFakeCropTimers,
    renderOverlay,
} from './crop-overlay-test-harness';

describe('CropOverlay keyboard', () => {
    registerFakeCropTimers();

    it('exposes every control to the keyboard', () => {
        renderOverlay();

        expect(cropBox()).toHaveAttribute('tabindex', '0');
        expect(handleControl('se')).toHaveAttribute('tabindex', '0');
    });

    it('does not advertise the handles as buttons, since Enter and Space do nothing', () => {
        renderOverlay();

        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(handleControl('se')).toHaveAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight');
    });

    it('moves the crop with the arrow keys', () => {
        const { onCropChange, onCropStart } = renderOverlay();

        fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });

        expect(onCropStart).toHaveBeenCalledTimes(1);
        expect(onCropChange).toHaveBeenCalledWith({
            x: 101,
            y: 100,
            width: 200,
            height: 200,
        });
    });

    it('nudges by a constant on-screen distance when the image is scaled down', () => {
        // scaleX = scaleY = 200/400 = 0.5, so one display pixel is two image pixels.
        const { onCropChange } = renderOverlay({ displaySize: { width: 200, height: 200 } });

        fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });

        expect(onCropChange).toHaveBeenCalledWith({
            x: 102,
            y: 100,
            width: 200,
            height: 200,
        });
    });

    it('scales the x and y nudge independently when the axes are scaled differently', () => {
        // scaleX = 200/400 = 0.5 (2 image px), scaleY = 100/400 = 0.25 (4 image px).
        const { onCropChange } = renderOverlay({ displaySize: { width: 200, height: 100 } });

        fireEvent.keyDown(cropBox(), { key: 'ArrowDown' });

        expect(onCropChange).toHaveBeenCalledWith({
            x: 100,
            y: 104,
            width: 200,
            height: 200,
        });
    });

    it('takes a ten-pixel step when shift is held', () => {
        const { onCropChange } = renderOverlay();

        fireEvent.keyDown(cropBox(), { key: 'ArrowUp', shiftKey: true });

        expect(onCropChange).toHaveBeenCalledWith({
            x: 100,
            y: 90,
            width: 200,
            height: 200,
        });
    });

    it('resizes from a focused handle with the arrow keys without also moving the crop', () => {
        const { onCropChange } = renderOverlay();

        fireEvent.keyDown(handleControl('se'), { key: 'ArrowRight' });

        expect(onCropChange).toHaveBeenCalledTimes(1);
        expect(onCropChange).toHaveBeenCalledWith({
            x: 100,
            y: 100,
            width: 201,
            height: 200,
        });
    });

    it('keeps a locked aspect ratio while resizing from a corner with the keyboard', () => {
        const { onCropChange } = renderOverlay({ aspectRatio: 1 });

        // ArrowUp drives the height branch of applyCropResize, the pointer tests only cover width.
        fireEvent.keyDown(handleControl('se'), { key: 'ArrowUp', shiftKey: true });

        expect(onCropChange).toHaveBeenCalledWith({
            x: 100,
            y: 100,
            width: 190,
            height: 190,
        });
    });

    it('records one undo snapshot per key repeat burst', () => {
        const { onCropStart } = renderOverlay();

        fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });
        fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });
        fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });

        expect(onCropStart).toHaveBeenCalledTimes(1);
    });

    it('records one undo snapshot for a burst of separate taps', () => {
        const { onCropStart } = renderOverlay();

        for (let press = 0; press < 4; press += 1) {
            fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });
            fireEvent.keyUp(cropBox(), { key: 'ArrowRight' });
        }

        expect(onCropStart).toHaveBeenCalledTimes(1);
    });

    it('starts a new undo snapshot once the keyboard burst goes idle', () => {
        const { onCropStart } = renderOverlay();

        fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });
        fireEvent.keyUp(cropBox(), { key: 'ArrowRight' });

        expect(onCropStart).toHaveBeenCalledTimes(1);

        idleOutKeyboardBurst();
        fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });

        expect(onCropStart).toHaveBeenCalledTimes(2);
    });

    it('keeps the burst open when a modifier is released while an arrow is held', () => {
        const { onCropStart } = renderOverlay();

        fireEvent.keyDown(cropBox(), { key: 'ArrowRight', shiftKey: true });
        fireEvent.keyUp(cropBox(), { key: 'Shift' });
        idleOutKeyboardBurst();
        fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });

        expect(onCropStart).toHaveBeenCalledTimes(1);
    });

    it('ends the burst immediately when the crop box loses focus', () => {
        const { onCropStart } = renderOverlay();

        fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });
        fireEvent.blur(cropBox());
        fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });

        expect(onCropStart).toHaveBeenCalledTimes(2);
    });

    it('accumulates repeated nudges when the new crop is fed back as a prop', () => {
        const onCropStart = vi.fn();
        let latest: CropBox = CROP;
        const onCropChange = vi.fn((next: CropBox) => {
            latest = next;
        });

        const overlay = (crop: CropBox) => (
            <CropOverlay
                crop={crop}
                imageDimensions={IMAGE}
                displaySize={IMAGE}
                aspectRatio={null}
                onCropChange={onCropChange}
                onCropStart={onCropStart}
            />
        );

        const { rerender } = render(overlay(latest));

        for (let press = 0; press < 3; press += 1) {
            fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });
            fireEvent.keyUp(cropBox(), { key: 'ArrowRight' });
            rerender(overlay(latest));
        }

        expect(latest).toEqual({
            x: 103,
            y: 100,
            width: 200,
            height: 200,
        });
        expect(onCropStart).toHaveBeenCalledTimes(1);
    });

    it('clears a pending burst timer on unmount', () => {
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        const { unmount } = renderOverlay();

        fireEvent.keyDown(cropBox(), { key: 'ArrowRight' });
        fireEvent.keyUp(cropBox(), { key: 'ArrowRight' });
        clearSpy.mockClear();
        unmount();

        expect(clearSpy).toHaveBeenCalled();
    });

    it('leaves non-arrow keys alone', () => {
        const { onCropChange, onCropStart } = renderOverlay();

        fireEvent.keyDown(cropBox(), { key: 'Enter' });

        expect(onCropStart).not.toHaveBeenCalled();
        expect(onCropChange).not.toHaveBeenCalled();
    });
});
