import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';

import { useBuilderChatWidth } from '../../../hooks/use-builder-chat-width';

import BuilderResizeHandle from './builder-resize-handle';

installPointerCaptureShims();

const STORAGE_KEY = 'builder-chat-width';

/** Window width the suite runs at; keeps the min/max maths readable. */
const VIEWPORT = 1200;
const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 260;
const MAX_WIDTH = 660; // 55% of 1200

/**
 * The handle is presentational; every rule that matters (clamping, saving,
 * keyboard steps, reset) lives in `useBuilderChatWidth`. The two are exercised
 * together through this host, which is how `builder.tsx` wires them up.
 */
const Host = ({ hideHandle = false }: { hideHandle?: boolean }) => {
    const { containerRef, isResizing, handleProps } = useBuilderChatWidth();

    return (
        <div ref={containerRef} data-testid="host" data-resizing={isResizing || undefined}>
            {/* `builder.tsx` drops the handle the same way when the preview opens. */}
            {!hideHandle && <BuilderResizeHandle {...handleProps} />}
        </div>
    );
};

const getHandle = () => screen.getByRole('separator', { name: 'Resize chat panel' });

/** The width the panel is actually laid out at, read off the CSS variable. */
const paintedWidth = () => screen.getByTestId('host').style.getPropertyValue('--builder-chat-width');

const widthOf = () => Number(getHandle().getAttribute('aria-valuenow'));

const drag = (toClientX: number, { release = true } = {}) => {
    const handle = getHandle();

    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: DEFAULT_WIDTH });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: toClientX });

    if (release) fireEvent.pointerUp(handle, { pointerId: 1, clientX: toClientX });
};

const resizeWindowTo = (innerWidth: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: innerWidth });
    fireEvent(window, new Event('resize'));
};

describe('BuilderResizeHandle', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: VIEWPORT });
        localStorage.clear();
    });

    it('starts at the default width and reports its limits', () => {
        renderWithProviders(<Host />);

        expect(widthOf()).toBe(DEFAULT_WIDTH);
        expect(getHandle()).toHaveAttribute('aria-valuemin', String(MIN_WIDTH));
        expect(getHandle()).toHaveAttribute('aria-valuemax', String(MAX_WIDTH));
        expect(paintedWidth()).toBe('420px');
    });

    it('widens the panel as the pointer moves right and saves the result', () => {
        renderWithProviders(<Host />);

        drag(DEFAULT_WIDTH + 100);

        expect(widthOf()).toBe(520);
        expect(paintedWidth()).toBe('520px');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('520');
    });

    it('follows the pointer live, without saving until it is released', () => {
        renderWithProviders(<Host />);

        drag(DEFAULT_WIDTH + 60, { release: false });

        expect(paintedWidth()).toBe('480px');
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

        fireEvent.pointerUp(getHandle(), { pointerId: 1, clientX: DEFAULT_WIDTH + 60 });

        expect(localStorage.getItem(STORAGE_KEY)).toBe('480');
    });

    it('marks the host as resizing only while the pointer is down', () => {
        renderWithProviders(<Host />);

        drag(DEFAULT_WIDTH + 40, { release: false });
        expect(screen.getByTestId('host')).toHaveAttribute('data-resizing', 'true');

        fireEvent.pointerUp(getHandle(), { pointerId: 1, clientX: DEFAULT_WIDTH + 40 });
        expect(screen.getByTestId('host')).not.toHaveAttribute('data-resizing');
    });

    it('stops at the minimum and maximum width', () => {
        renderWithProviders(<Host />);

        drag(-5000);
        expect(widthOf()).toBe(MIN_WIDTH);

        drag(5000);
        expect(widthOf()).toBe(MAX_WIDTH);
    });

    it('restores the saved width on the next mount', () => {
        localStorage.setItem(STORAGE_KEY, '540');

        renderWithProviders(<Host />);

        expect(widthOf()).toBe(540);
    });

    it('falls back to the default when the saved width is junk', () => {
        localStorage.setItem(STORAGE_KEY, 'not-a-number');

        renderWithProviders(<Host />);

        expect(widthOf()).toBe(DEFAULT_WIDTH);
    });

    it('clamps a saved width that no longer fits the window', () => {
        localStorage.setItem(STORAGE_KEY, '900');

        renderWithProviders(<Host />);

        expect(widthOf()).toBe(MAX_WIDTH);
        // The saved value is left alone, so the old width returns on a wider window.
        expect(localStorage.getItem(STORAGE_KEY)).toBe('900');
    });

    it('gives the chosen width back when the window is widened again', () => {
        localStorage.setItem(STORAGE_KEY, String(MAX_WIDTH));

        renderWithProviders(<Host />);
        expect(widthOf()).toBe(MAX_WIDTH);

        resizeWindowTo(800);
        expect(widthOf()).toBe(440); // 55% of 800
        expect(localStorage.getItem(STORAGE_KEY)).toBe(String(MAX_WIDTH));

        resizeWindowTo(VIEWPORT);
        expect(widthOf()).toBe(MAX_WIDTH);
        expect(paintedWidth()).toBe(`${MAX_WIDTH}px`);
    });

    it('leaves a live drag alone when the window resizes', () => {
        // Start wide, then drag narrow. A re-clamp for the smaller window would
        // land on 440 and wipe out where the pointer actually is.
        localStorage.setItem(STORAGE_KEY, String(MAX_WIDTH));

        renderWithProviders(<Host />);

        drag(DEFAULT_WIDTH - 260, { release: false });
        expect(paintedWidth()).toBe('400px');

        resizeWindowTo(800);

        // The drag owns the width until it is released.
        expect(paintedWidth()).toBe('400px');
        expect(screen.getByTestId('host')).toHaveAttribute('data-resizing', 'true');

        fireEvent.pointerUp(getHandle(), { pointerId: 1, clientX: DEFAULT_WIDTH - 260 });
        expect(localStorage.getItem(STORAGE_KEY)).toBe('400');
    });

    it('ends the drag when pointer capture is lost', () => {
        renderWithProviders(<Host />);

        drag(DEFAULT_WIDTH + 100, { release: false });
        fireEvent.lostPointerCapture(getHandle(), { pointerId: 1 });

        expect(screen.getByTestId('host')).not.toHaveAttribute('data-resizing');
        expect(widthOf()).toBe(520);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('520');
    });

    it('ends the drag when the handle is taken away mid-drag', () => {
        const { rerender } = renderWithProviders(<Host />);

        drag(DEFAULT_WIDTH + 100, { release: false });

        // The preview opening removes the handle, so no pointerup can reach it.
        rerender(<Host hideHandle />);
        fireEvent.pointerUp(window, { pointerId: 1 });

        expect(screen.getByTestId('host')).not.toHaveAttribute('data-resizing');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('520');
    });

    it('resizes with the arrow keys', () => {
        renderWithProviders(<Host />);

        getHandle().focus();

        fireEvent.keyDown(getHandle(), { key: 'ArrowRight' });
        expect(widthOf()).toBe(DEFAULT_WIDTH + 16);

        fireEvent.keyDown(getHandle(), { key: 'ArrowLeft' });
        expect(widthOf()).toBe(DEFAULT_WIDTH);

        fireEvent.keyDown(getHandle(), { key: 'ArrowRight', shiftKey: true });
        expect(widthOf()).toBe(DEFAULT_WIDTH + 64);

        fireEvent.keyDown(getHandle(), { key: 'Home' });
        expect(widthOf()).toBe(MIN_WIDTH);

        fireEvent.keyDown(getHandle(), { key: 'End' });
        expect(widthOf()).toBe(MAX_WIDTH);
        expect(localStorage.getItem(STORAGE_KEY)).toBe(String(MAX_WIDTH));
    });

    it('resets to the default on double-click', () => {
        localStorage.setItem(STORAGE_KEY, '600');

        renderWithProviders(<Host />);
        expect(widthOf()).toBe(600);

        fireEvent.doubleClick(getHandle());

        expect(widthOf()).toBe(DEFAULT_WIDTH);
        expect(localStorage.getItem(STORAGE_KEY)).toBe(String(DEFAULT_WIDTH));
    });

    it('ignores a drag started with a non-primary button', () => {
        renderWithProviders(<Host />);

        fireEvent.pointerDown(getHandle(), { button: 2, pointerId: 1, clientX: DEFAULT_WIDTH });
        fireEvent.pointerMove(getHandle(), { pointerId: 1, clientX: DEFAULT_WIDTH + 120 });

        expect(widthOf()).toBe(DEFAULT_WIDTH);
    });
});
