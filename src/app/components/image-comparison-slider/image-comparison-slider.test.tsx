import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, it, expect, beforeAll, vi } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';

import ImageComparisonSlider from './image-comparison-slider';

installPointerCaptureShims();

const CONTAINER_LEFT = 100;
const CONTAINER_WIDTH = 400;

beforeAll(() => {
    // The slider derives its position from the container rect, which jsdom reports as all zeros —
    // every drag would resolve to a division by zero without a measured width.
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
            left: CONTAINER_LEFT,
            right: CONTAINER_LEFT + CONTAINER_WIDTH,
            top: 0,
            bottom: 300,
            width: CONTAINER_WIDTH,
            height: 300,
            x: CONTAINER_LEFT,
            y: 0,
            toJSON: () => ({}),
        }),
    });
});

const renderSlider = (props?: Partial<ComponentProps<typeof ImageComparisonSlider>>) => {
    const { container } = render(
        <ImageComparisonSlider originalSrc="/original.png" editedSrc="/edited.png" alt="a mountain" {...props} />,
    );

    const sliderContainer = container.querySelector('.comparison-container') as HTMLElement;
    const line = container.querySelector('.slider-line') as HTMLElement;
    const editedLayer = container.querySelector('.edited-image') as HTMLElement;

    return { sliderContainer, line, editedLayer };
};

/** Percentage of the container width, expressed as the clientX a pointer event would carry. */
const clientXAtPercent = (percent: number) => CONTAINER_LEFT + (CONTAINER_WIDTH * percent) / 100;

/**
 * A press at `percent` across the track. jsdom's synthetic pointer events leave `isPrimary`
 * and `button` unset, where a browser always fills them in for the first contact — the
 * component reads both, so the defaults have to be spelled out here.
 */
const pressAt = (el: HTMLElement, percent: number, overrides: Record<string, unknown> = {}) => {
    fireEvent.pointerDown(el, {
        clientX: clientXAtPercent(percent),
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        isPrimary: true,
        ...overrides,
    });
};

describe('ImageComparisonSlider', () => {
    it('renders both images and starts centred', () => {
        const { line } = renderSlider();

        expect(screen.getByAltText('Original a mountain')).toHaveAttribute('src', '/original.png');
        expect(screen.getByAltText('Edited a mountain')).toHaveAttribute('src', '/edited.png');
        expect(line).toHaveStyle({ left: '50%' });
    });

    // The whole track is a drag target, not only the centre handle (FM-247).
    it('jumps the divider to a press anywhere on the track', () => {
        const { sliderContainer, line, editedLayer } = renderSlider();

        pressAt(sliderContainer, 25);

        expect(line).toHaveStyle({ left: '25%' });
        expect(editedLayer.style.clipPath).toBe('polygon(25% 0%, 100% 0%, 100% 100%, 25% 100%)');
    });

    it('tracks the pointer while dragging and stops after release', () => {
        const { sliderContainer, line } = renderSlider();

        pressAt(sliderContainer, 25);
        fireEvent.pointerMove(sliderContainer, { clientX: clientXAtPercent(75), pointerId: 1 });

        expect(line).toHaveStyle({ left: '75%' });

        fireEvent.pointerUp(sliderContainer, { clientX: clientXAtPercent(75), pointerId: 1 });
        fireEvent.pointerMove(sliderContainer, { clientX: clientXAtPercent(10), pointerId: 1 });

        expect(line).toHaveStyle({ left: '75%' });
    });

    it('ignores pointer movement that is not part of a drag', () => {
        const { sliderContainer, line } = renderSlider();

        fireEvent.pointerMove(sliderContainer, { clientX: clientXAtPercent(10), pointerId: 1 });

        expect(line).toHaveStyle({ left: '50%' });
    });

    it('stops tracking when the drag is cancelled', () => {
        const { sliderContainer, line } = renderSlider();

        pressAt(sliderContainer, 30);
        fireEvent.pointerCancel(sliderContainer, { pointerId: 1 });
        fireEvent.pointerMove(sliderContainer, { clientX: clientXAtPercent(90), pointerId: 1 });

        expect(line).toHaveStyle({ left: '30%' });
    });

    it('ignores a right-click so the context menu still opens', () => {
        const { sliderContainer, line } = renderSlider();

        pressAt(sliderContainer, 25, { button: 2 });

        expect(line).toHaveStyle({ left: '50%' });
    });

    it('ignores a non-primary contact so a second finger does not fight the drag', () => {
        const { sliderContainer, line } = renderSlider();

        pressAt(sliderContainer, 25, { pointerType: 'touch' });
        pressAt(sliderContainer, 80, { pointerId: 2, pointerType: 'touch', isPrimary: false });

        expect(line).toHaveStyle({ left: '25%' });
    });

    /**
     * A press and release that both land before React commits — dispatched natively inside one
     * `act` block, so nothing flushes in between, the way a fast tap arrives. Gating drag state on
     * React state leaves the gesture open here, and the divider then follows a pointer with no
     * button held. The `act` boundaries carry the test: an assertion straight after the dispatch
     * reads the DOM before the commit lands and passes whatever the component does.
     */
    it('does not stay in drag mode after a press and release in the same task', async () => {
        const { sliderContainer, line } = renderSlider();

        const dispatch = (type: string, props: Record<string, unknown>) => {
            const event = new Event(type, { bubbles: true, cancelable: true });

            Object.assign(event, {
                pointerId: 1,
                pointerType: 'mouse',
                button: 0,
                isPrimary: true,
                ...props,
            });
            sliderContainer.dispatchEvent(event);
        };

        await act(async () => {
            dispatch('pointerdown', { clientX: clientXAtPercent(30) });
            dispatch('pointerup', { clientX: clientXAtPercent(30) });
        });

        expect(line).toHaveStyle({ left: '30%' });
        expect(line).not.toHaveClass('slider-line-active');

        await act(async () => {
            dispatch('pointermove', { clientX: clientXAtPercent(90), buttons: 0 });
        });

        expect(line).toHaveStyle({ left: '30%' });
    });

    it('ends the drag when pointer capture is lost mid-gesture', async () => {
        const { sliderContainer, line } = renderSlider();

        pressAt(sliderContainer, 40);

        await act(async () => {
            sliderContainer.dispatchEvent(new Event('lostpointercapture', { bubbles: true }));
        });

        expect(line).not.toHaveClass('slider-line-active');

        await act(async () => {
            fireEvent.pointerMove(sliderContainer, { clientX: clientXAtPercent(90), pointerId: 1 });
        });

        expect(line).toHaveStyle({ left: '40%' });
    });

    it('clamps a drag that travels past either edge', () => {
        const { sliderContainer, line } = renderSlider();

        pressAt(sliderContainer, 50);

        fireEvent.pointerMove(sliderContainer, { clientX: CONTAINER_LEFT - 500, pointerId: 1 });
        expect(line).toHaveStyle({ left: '0%' });

        fireEvent.pointerMove(sliderContainer, { clientX: CONTAINER_LEFT + CONTAINER_WIDTH + 500, pointerId: 1 });
        expect(line).toHaveStyle({ left: '100%' });
    });

    it('keeps pointerdown from reaching the lightbox gesture handlers above it', () => {
        const onAncestorPointerDown = vi.fn();

        const { container } = render(
            <div onPointerDown={onAncestorPointerDown}>
                <ImageComparisonSlider originalSrc="/original.png" editedSrc="/edited.png" alt="a mountain" />
            </div>,
        );

        pressAt(container.querySelector('.comparison-container') as HTMLElement, 25);

        expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });

    it('forwards image load and error callbacks', () => {
        const onLoad = vi.fn();
        const onError = vi.fn();

        renderSlider({ onLoad, onError });

        fireEvent.load(screen.getByAltText('Edited a mountain'));
        fireEvent.error(screen.getByAltText('Original a mountain'));

        expect(onLoad).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
    });
});
