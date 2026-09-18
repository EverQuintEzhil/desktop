import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CropOverlay from './crop-overlay';
import {
    HANDLE_NAMES,
    IMAGE,
    cropBox,
    flushFrame,
    handleControl,
    handleNames,
    pressLeftMouse,
    registerFakeCropTimers,
    renderOverlay,
} from './crop-overlay-test-harness';

describe('CropOverlay', () => {
    registerFakeCropTimers();

    it('sizes the container and the crop box from the display size', () => {
        const { container } = renderOverlay();

        const overlay = container.querySelector('.crop-overlay-container') as HTMLElement;

        expect(overlay).toHaveStyle({ width: '400px', height: '400px' });
        expect(cropBox()).toHaveStyle({ width: '200px', height: '200px' });
    });

    it('scales the crop box when the display size differs from the image', () => {
        renderOverlay({ displaySize: { width: 200, height: 100 } });

        // scaleX = 200/400 = 0.5, scaleY = 100/400 = 0.25
        expect(cropBox()).toHaveStyle({ width: '100px', height: '50px' });
    });

    it('names all eight handles when no aspect ratio is locked', () => {
        renderOverlay({ aspectRatio: null });

        expect(handleNames()).toEqual([
            HANDLE_NAMES.nw,
            HANDLE_NAMES.n,
            HANDLE_NAMES.ne,
            HANDLE_NAMES.e,
            HANDLE_NAMES.se,
            HANDLE_NAMES.s,
            HANDLE_NAMES.sw,
            HANDLE_NAMES.w,
        ]);
    });

    it('names the four corner handles only while an aspect ratio is locked', () => {
        renderOverlay({ aspectRatio: 1 });

        expect(handleNames()).toEqual([HANDLE_NAMES.nw, HANDLE_NAMES.ne, HANDLE_NAMES.se, HANDLE_NAMES.sw]);
    });

    it('reports the drag start once when the crop box is pressed', () => {
        const { onCropStart, onCropChange } = renderOverlay();

        pressLeftMouse(cropBox(), 0, 0);

        expect(onCropStart).toHaveBeenCalledTimes(1);
        expect(onCropChange).not.toHaveBeenCalled();
    });

    it('focuses the crop box on pointer down so the arrow keys stay reachable after a drag', () => {
        renderOverlay();

        pressLeftMouse(cropBox(), 0, 0);

        expect(cropBox()).toHaveFocus();
    });

    it('focuses a handle on pointer down', () => {
        renderOverlay();

        pressLeftMouse(handleControl('se'), 0, 0);

        expect(handleControl('se')).toHaveFocus();
    });

    it('moves the crop by the pointer delta', () => {
        const { onCropChange } = renderOverlay();

        pressLeftMouse(cropBox(), 10, 10);
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 40, clientY: 30 });
        flushFrame();

        expect(onCropChange).toHaveBeenCalledTimes(1);
        expect(onCropChange).toHaveBeenCalledWith({
            x: 130,
            y: 120,
            width: 200,
            height: 200,
        });
    });

    it('constrains a move that would leave the image', () => {
        const { onCropChange } = renderOverlay();

        pressLeftMouse(cropBox(), 0, 0);
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 1000, clientY: 1000 });
        flushFrame();

        expect(onCropChange).toHaveBeenCalledWith({
            x: 200,
            y: 200,
            width: 200,
            height: 200,
        });
    });

    it('coalesces a burst of pointer moves into one change per frame', () => {
        const { onCropChange } = renderOverlay();

        pressLeftMouse(cropBox(), 0, 0);
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 5, clientY: 5 });
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 20, clientY: 20 });
        flushFrame();

        expect(onCropChange).toHaveBeenCalledTimes(1);
        expect(onCropChange).toHaveBeenCalledWith({
            x: 120,
            y: 120,
            width: 200,
            height: 200,
        });
    });

    it('resizes from a corner handle', () => {
        const { onCropChange } = renderOverlay();

        pressLeftMouse(handleControl('se'), 0, 0);
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 50, clientY: 20 });
        flushFrame();

        expect(onCropChange).toHaveBeenCalledWith({
            x: 100,
            y: 100,
            width: 250,
            height: 220,
        });
    });

    it('keeps a locked aspect ratio while resizing from a corner', () => {
        const { onCropChange } = renderOverlay({ aspectRatio: 1 });

        pressLeftMouse(handleControl('se'), 0, 0);
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 60, clientY: 0 });
        flushFrame();

        expect(onCropChange).toHaveBeenCalledWith({
            x: 100,
            y: 100,
            width: 260,
            height: 260,
        });
    });

    it('ignores a right-button mouse press', () => {
        const { onCropStart, onCropChange } = renderOverlay();

        fireEvent.pointerDown(cropBox(), {
            pointerId: 1,
            pointerType: 'mouse',
            button: 2,
            clientX: 0,
            clientY: 0,
        });
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 40, clientY: 40 });
        flushFrame();

        expect(onCropStart).not.toHaveBeenCalled();
        expect(onCropChange).not.toHaveBeenCalled();
    });

    it('starts a drag for a non-mouse pointer regardless of the button value', () => {
        const { onCropStart } = renderOverlay();

        fireEvent.pointerDown(cropBox(), {
            pointerId: 7,
            pointerType: 'touch',
            button: 2,
            clientX: 0,
            clientY: 0,
        });

        expect(onCropStart).toHaveBeenCalledTimes(1);
    });

    it('ignores moves from a different pointer than the one that started the drag', () => {
        const { onCropChange } = renderOverlay();

        pressLeftMouse(cropBox(), 0, 0);
        fireEvent.pointerMove(window, { pointerId: 2, clientX: 40, clientY: 40 });
        flushFrame();

        expect(onCropChange).not.toHaveBeenCalled();
    });

    it('stops tracking after pointerup', () => {
        const { onCropChange } = renderOverlay();

        pressLeftMouse(cropBox(), 0, 0);
        fireEvent.pointerUp(window, { pointerId: 1 });
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 40, clientY: 40 });
        flushFrame();

        expect(onCropChange).not.toHaveBeenCalled();
    });

    it('stops tracking after pointercancel', () => {
        const { onCropChange } = renderOverlay();

        pressLeftMouse(cropBox(), 0, 0);
        fireEvent.pointerCancel(window, { pointerId: 1 });
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 40, clientY: 40 });
        flushFrame();

        expect(onCropChange).not.toHaveBeenCalled();
    });

    it('drops a frame that was still pending when the drag ended', () => {
        const { onCropChange } = renderOverlay();

        pressLeftMouse(cropBox(), 0, 0);
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 40, clientY: 40 });
        fireEvent.pointerUp(window, { pointerId: 1 });
        flushFrame();

        expect(onCropChange).not.toHaveBeenCalled();
    });

    it('cancels a pending frame on unmount', () => {
        const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
        const { unmount, onCropChange } = renderOverlay();

        pressLeftMouse(cropBox(), 0, 0);
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 40, clientY: 40 });
        unmount();
        flushFrame();

        expect(cancelSpy).toHaveBeenCalled();
        expect(onCropChange).not.toHaveBeenCalled();
    });

    it('starts a second drag from the crop position it was given', () => {
        const { onCropChange, rerender } = renderOverlay();

        pressLeftMouse(cropBox(), 0, 0);
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 20, clientY: 0 });
        flushFrame();
        fireEvent.pointerUp(window, { pointerId: 1 });

        rerender(
            <CropOverlay
                crop={{
                    x: 120,
                    y: 100,
                    width: 200,
                    height: 200,
                }}
                imageDimensions={IMAGE}
                displaySize={IMAGE}
                aspectRatio={null}
                onCropChange={onCropChange}
                onCropStart={() => {}}
            />,
        );

        pressLeftMouse(cropBox(), 0, 0);
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 10, clientY: 0 });
        flushFrame();

        expect(onCropChange).toHaveBeenLastCalledWith({
            x: 130,
            y: 100,
            width: 200,
            height: 200,
        });
    });
});
