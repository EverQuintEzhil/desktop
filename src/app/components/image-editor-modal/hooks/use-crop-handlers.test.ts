import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_CROP_STATE } from '../constants';
import type { CropState } from '../types';

import { useCropHandlers } from './use-crop-handlers';

const VIEW = { width: 400, height: 200 };

const renderHandlers = (cropState: Partial<CropState> = {}, imageWidth = 400, imageHeight = 200) => {
    const updateCropState = vi.fn();
    const resetCropState = vi.fn();
    const recordSnapshot = vi.fn();

    const view = renderHook(() =>
        useCropHandlers({
            imageWidth,
            imageHeight,
            viewImageDimensions: VIEW,
            cropState: { ...DEFAULT_CROP_STATE, ...cropState } as CropState,
            updateCropState,
            resetCropState,
            recordSnapshot,
        }),
    );

    return {
        ...view,
        updateCropState,
        resetCropState,
        recordSnapshot,
    };
};

describe('useCropHandlers', () => {
    it('constrains an incoming crop into the view bounds', () => {
        const { result, updateCropState } = renderHandlers();

        result.current.handleCropChange({
            x: -50,
            y: -50,
            width: 900,
            height: 900,
        });

        const next = updateCropState.mock.calls[0][0];

        expect(next.x).toBeGreaterThanOrEqual(0);
        expect(next.y).toBeGreaterThanOrEqual(0);
        expect(next.x + next.width).toBeLessThanOrEqual(VIEW.width + 1e-6);
        expect(next.y + next.height).toBeLessThanOrEqual(VIEW.height + 1e-6);
    });

    it('does not snapshot a plain crop drag', () => {
        const { result, recordSnapshot } = renderHandlers();

        result.current.handleCropChange({
            x: 10,
            y: 10,
            width: 100,
            height: 100,
        });

        expect(recordSnapshot).not.toHaveBeenCalled();
    });

    it('rotates by 90 degrees and recomputes the crop', () => {
        const { result, updateCropState, recordSnapshot } = renderHandlers({
            x: 0,
            y: 0,
            width: 400,
            height: 200,
        });

        result.current.handleRotate90();

        expect(recordSnapshot).toHaveBeenCalledTimes(1);

        const next = updateCropState.mock.calls[0][0];

        expect(next.rotation).toBe(90);
        expect(next.width).toBeGreaterThan(0);
        expect(next.height).toBeGreaterThan(0);
    });

    it('wraps the rotation back to zero past a full turn', () => {
        const { result, updateCropState } = renderHandlers({ rotation: 270 });

        result.current.handleRotate90();

        expect(updateCropState.mock.calls[0][0].rotation).toBe(0);
    });

    it('only updates the angle when the image has no size', () => {
        const { result, updateCropState } = renderHandlers({}, 0, 0);

        result.current.handleRotate90();

        expect(updateCropState).toHaveBeenCalledWith({ rotation: 90 });
    });

    it('keeps the locked aspect ratio when rotating in fit mode', () => {
        const { result, updateCropState } = renderHandlers({ mode: 'fit', lockedAspectRatio: 1 });

        result.current.handleRotate90();

        const next = updateCropState.mock.calls[0][0];

        expect(next.rotation).toBe(90);
        expect(next.width / next.height).toBeCloseTo(1, 4);
    });

    it('falls back to the image ratio in fit mode when nothing is locked', () => {
        const { result, updateCropState } = renderHandlers({ mode: 'fit', lockedAspectRatio: null });

        result.current.handleRotate90();

        const next = updateCropState.mock.calls[0][0];

        // A quarter turn makes the view 200x400, so the frame follows that ratio.
        expect(next.width / next.height).toBeCloseTo(200 / 400, 4);
    });

    it('flips horizontally and vertically, snapshotting each flip', () => {
        const { result, updateCropState, recordSnapshot } = renderHandlers({ flipX: false, flipY: true });

        result.current.handleToggleFlipX();
        result.current.handleToggleFlipY();

        expect(updateCropState).toHaveBeenNthCalledWith(1, { flipX: true });
        expect(updateCropState).toHaveBeenNthCalledWith(2, { flipY: false });
        expect(recordSnapshot).toHaveBeenCalledTimes(2);
    });

    it('sets the straighten angle without a snapshot', () => {
        const { result, updateCropState, recordSnapshot } = renderHandlers();

        result.current.handleStraightenChange(7.5);

        expect(updateCropState).toHaveBeenCalledWith({ straightenAngle: 7.5 });
        expect(recordSnapshot).not.toHaveBeenCalled();
    });

    it('snapshots before resetting the crop', () => {
        const { result, resetCropState, recordSnapshot } = renderHandlers();

        result.current.handleResetCrop();

        expect(recordSnapshot).toHaveBeenCalledTimes(1);
        expect(resetCropState).toHaveBeenCalledTimes(1);
    });

    it('ignores a mode change to the mode already active', () => {
        const { result, updateCropState, recordSnapshot } = renderHandlers({ mode: 'crop' });

        result.current.handleModeChange('crop');

        expect(updateCropState).not.toHaveBeenCalled();
        expect(recordSnapshot).not.toHaveBeenCalled();
    });

    it('switching to fit builds the smallest frame that contains the image', () => {
        const { result, updateCropState } = renderHandlers({ mode: 'crop', lockedAspectRatio: 1 });

        result.current.handleModeChange('fit');

        const next = updateCropState.mock.calls[0][0];

        expect(next.mode).toBe('fit');
        expect(next.width).toBeCloseTo(400, 4);
        expect(next.height).toBeCloseTo(400, 4);
        expect(next.y).toBeCloseTo((200 - 400) / 2, 4);
    });

    it('switching to fit with no locked ratio matches the image exactly', () => {
        const { result, updateCropState } = renderHandlers({ mode: 'crop', lockedAspectRatio: null });

        result.current.handleModeChange('fit');

        const next = updateCropState.mock.calls[0][0];

        expect(next.width).toBeCloseTo(400, 4);
        expect(next.height).toBeCloseTo(200, 4);
        expect(next.x).toBeCloseTo(0, 4);
    });

    it('switching to crop keeps the frame inside the image', () => {
        const { result, updateCropState } = renderHandlers({ mode: 'fit', lockedAspectRatio: 1 });

        result.current.handleModeChange('crop');

        const next = updateCropState.mock.calls[0][0];

        expect(next.mode).toBe('crop');
        expect(next.width).toBeLessThanOrEqual(400 + 1e-6);
        expect(next.height).toBeLessThanOrEqual(200 + 1e-6);
        expect(next.width / next.height).toBeCloseTo(1, 4);
    });
});
