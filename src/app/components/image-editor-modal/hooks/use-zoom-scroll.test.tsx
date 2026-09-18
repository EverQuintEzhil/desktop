import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_ZOOM, MIN_ZOOM } from '../utils/zoom-utils';

import { useZoomScroll } from './use-zoom-scroll';

const IMAGE = { width: 400, height: 200 };
const CONTAINER = { width: 240, height: 240 };

const createScrollArea = () => {
    const element = document.createElement('div');

    element.getBoundingClientRect = () => ({
        left: 20,
        top: 10,
        right: 260,
        bottom: 250,
        width: 240,
        height: 240,
        x: 20,
        y: 10,
        toJSON: () => ({}),
    });

    return element;
};

const wheel = (init: WheelEventInit) => new WheelEvent('wheel', { cancelable: true, ...init });

interface SetupOptions {
    zoomLevel?: number;
    contentPadding?: number;
    withScrollArea?: boolean;
}

const setup = ({ zoomLevel = 200, contentPadding = 0, withScrollArea = true }: SetupOptions = {}) => {
    const onZoomChange = vi.fn();
    const onFitZoomComputed = vi.fn();
    const scrollAreaRef = createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement | null>;

    if (withScrollArea) {
        scrollAreaRef.current = createScrollArea();
    }

    const view = renderHook(
        (props: { zoomLevel: number }) =>
            useZoomScroll({
                imageDimensions: IMAGE,
                containerSize: CONTAINER,
                zoomLevel: props.zoomLevel,
                onZoomChange,
                onFitZoomComputed,
                scrollAreaRef,
                contentPadding,
            }),
        { initialProps: { zoomLevel } },
    );

    return {
        ...view,
        onZoomChange,
        onFitZoomComputed,
        scrollAreaRef,
    };
};

const flushFrames = () =>
    act(() => {
        vi.advanceTimersByTime(32);
    });

describe('useZoomScroll', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('scales the display size by the zoom level', () => {
        const { result } = setup({ zoomLevel: 50 });

        expect(result.current.displaySize).toEqual({ width: 200, height: 100 });
    });

    it('reports the zoom level that fits the image inside the padded container', () => {
        const { onFitZoomComputed } = setup({ zoomLevel: 200 });

        expect(onFitZoomComputed).toHaveBeenLastCalledWith(60);
    });

    it('subtracts the content padding from the container when computing the fit level', () => {
        const { onFitZoomComputed } = setup({ zoomLevel: 200, contentPadding: 20 });

        expect(onFitZoomComputed).toHaveBeenLastCalledWith(50);
    });

    it('snaps an untouched 100% zoom to the fit level', () => {
        const { onZoomChange } = setup({ zoomLevel: 100 });

        expect(onZoomChange).toHaveBeenCalledWith(60);
    });

    it('ignores a wheel event without the meta key', () => {
        const { result, onZoomChange } = setup();
        const event = wheel({ deltaY: -100 });

        act(() => result.current.handleWheel(event));
        flushFrames();

        expect(event.defaultPrevented).toBe(false);
        expect(onZoomChange).not.toHaveBeenCalled();
    });

    it('zooms in on a meta-wheel scroll up and consumes the event', () => {
        const { result, onZoomChange } = setup();
        const event = wheel({ deltaY: -100, metaKey: true });

        act(() => result.current.handleWheel(event));

        expect(event.defaultPrevented).toBe(true);

        flushFrames();

        expect(onZoomChange).toHaveBeenCalledTimes(1);
        expect(onZoomChange.mock.calls[0][0]).toBeCloseTo(244.2805516, 5);
    });

    it('zooms out on a meta-wheel scroll down', () => {
        const { result, onZoomChange } = setup();

        act(() => result.current.handleWheel(wheel({ deltaY: 100, metaKey: true })));
        flushFrames();

        expect(onZoomChange.mock.calls[0][0]).toBeLessThan(200);
    });

    it('coalesces a burst of wheel events into a single zoom change', () => {
        const { result, onZoomChange } = setup();

        act(() => {
            result.current.handleWheel(wheel({ deltaY: -10, metaKey: true }));
            result.current.handleWheel(wheel({ deltaY: -10, metaKey: true }));
            result.current.handleWheel(wheel({ deltaY: -10, metaKey: true }));
        });
        flushFrames();

        expect(onZoomChange).toHaveBeenCalledTimes(1);
    });

    it('clamps the zoom to the maximum', () => {
        const { result, onZoomChange } = setup({ zoomLevel: MAX_ZOOM });

        act(() => result.current.handleWheel(wheel({ deltaY: -5000, metaKey: true })));
        flushFrames();

        expect(onZoomChange).toHaveBeenCalledWith(MAX_ZOOM);
    });

    it('clamps the zoom to the minimum', () => {
        const { result, onZoomChange } = setup({ zoomLevel: MIN_ZOOM });

        act(() => result.current.handleWheel(wheel({ deltaY: 5000, metaKey: true })));
        flushFrames();

        expect(onZoomChange).toHaveBeenCalledWith(MIN_ZOOM);
    });

    it('scrolls the viewport so the cursor keeps its place once the new zoom lands', () => {
        const { result, rerender, onZoomChange, scrollAreaRef } = setup({ zoomLevel: 200 });

        act(() =>
            result.current.handleWheel(
                wheel({
                    deltaY: -100,
                    metaKey: true,
                    clientX: 140,
                    clientY: 110,
                }),
            ),
        );
        flushFrames();

        const nextZoom = onZoomChange.mock.calls[0][0];

        act(() => rerender({ zoomLevel: nextZoom }));

        expect(scrollAreaRef.current?.scrollLeft).toBeGreaterThan(0);
        expect(scrollAreaRef.current?.scrollTop).toBeGreaterThan(0);
    });

    it('still changes the zoom when there is no scroll area to anchor', () => {
        const { result, onZoomChange } = setup({ zoomLevel: 200, withScrollArea: false });

        act(() => result.current.handleWheel(wheel({ deltaY: -100, metaKey: true })));
        flushFrames();

        expect(onZoomChange).toHaveBeenCalledTimes(1);
    });

    it('cancels a queued frame on unmount', () => {
        const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
        const { result, unmount, onZoomChange } = setup();

        act(() => result.current.handleWheel(wheel({ deltaY: -100, metaKey: true })));
        unmount();
        flushFrames();

        expect(cancel).toHaveBeenCalled();
        expect(onZoomChange).not.toHaveBeenCalled();
    });
});
