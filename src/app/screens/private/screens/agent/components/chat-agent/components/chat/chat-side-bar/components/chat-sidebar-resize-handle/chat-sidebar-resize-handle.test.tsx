import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';

import {
    SIDEBAR_DEFAULT_WIDTH,
    SIDEBAR_MAX_WIDTH,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_WIDTH_STORAGE_KEY,
} from '../../constants';
import { useChatSidebarWidth } from '../../hooks/use-chat-sidebar-width';

import ChatSidebarResizeHandle from './chat-sidebar-resize-handle';

installPointerCaptureShims();

/**
 * The handle is presentational; the clamping, saving, keyboard steps and reset
 * all live in `useChatSidebarWidth`. The two are exercised together through this
 * host, which is how `chat-side-bar.tsx` wires them up.
 */
const Host = ({ hideHandle = false }: { hideHandle?: boolean }) => {
    const { asideRef, isResizing, handleProps, style } = useChatSidebarWidth();

    return (
        <>
            <aside ref={asideRef} style={style} data-testid="aside" data-resizing={isResizing || undefined} />
            {!hideHandle && <ChatSidebarResizeHandle {...handleProps} />}
        </>
    );
};

const getHandle = () => screen.getByRole('separator', { name: 'Resize sidebar' });

/** The width the sidebar is actually laid out at, read off the CSS variable. */
const paintedWidth = () => screen.getByTestId('aside').style.getPropertyValue('--chat-sidebar-width');

const widthOf = () => Number(getHandle().getAttribute('aria-valuenow'));

const drag = (toClientX: number, { release = true, from = SIDEBAR_DEFAULT_WIDTH, pointerId = 1 } = {}) => {
    const handle = getHandle();

    fireEvent.pointerDown(handle, { button: 0, pointerId, clientX: from });
    fireEvent.pointerMove(handle, { pointerId, clientX: toClientX });

    if (release) fireEvent.pointerUp(handle, { pointerId, clientX: toClientX });
};

describe('ChatSidebarResizeHandle', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('starts at the default width and reports its limits', () => {
        renderWithProviders(<Host />);

        expect(widthOf()).toBe(SIDEBAR_DEFAULT_WIDTH);
        expect(getHandle()).toHaveAttribute('aria-valuemin', String(SIDEBAR_MIN_WIDTH));
        expect(getHandle()).toHaveAttribute('aria-valuemax', String(SIDEBAR_MAX_WIDTH));
        expect(paintedWidth()).toBe('280px');
    });

    it('widens the sidebar as the pointer moves right and saves the result', () => {
        renderWithProviders(<Host />);

        drag(SIDEBAR_DEFAULT_WIDTH + 100);

        expect(widthOf()).toBe(380);
        expect(paintedWidth()).toBe('380px');
        expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('380');
    });

    it('follows the pointer live, without saving until it is released', () => {
        renderWithProviders(<Host />);

        drag(SIDEBAR_DEFAULT_WIDTH + 60, { release: false });

        expect(paintedWidth()).toBe('340px');
        expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBeNull();

        fireEvent.pointerUp(getHandle(), { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 60 });

        expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('340');
    });

    it('does not take focus on pointer down, so the highlight clears after a click', () => {
        renderWithProviders(<Host />);

        fireEvent.pointerDown(getHandle(), { button: 0, pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH });

        expect(document.activeElement).not.toBe(getHandle());

        fireEvent.pointerUp(getHandle(), { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH });
    });

    it('marks the sidebar as resizing only while the pointer is down', () => {
        renderWithProviders(<Host />);

        drag(SIDEBAR_DEFAULT_WIDTH + 40, { release: false });
        expect(screen.getByTestId('aside')).toHaveAttribute('data-resizing', 'true');
        expect(document.body.style.cursor).toBe('col-resize');

        fireEvent.pointerUp(getHandle(), { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 40 });
        expect(screen.getByTestId('aside')).not.toHaveAttribute('data-resizing');
        expect(document.body.style.cursor).toBe('');
    });

    it('stops at the minimum and maximum width', () => {
        renderWithProviders(<Host />);

        drag(-5000);
        expect(widthOf()).toBe(SIDEBAR_MIN_WIDTH);

        drag(5000);
        expect(widthOf()).toBe(SIDEBAR_MAX_WIDTH);
    });

    it('restores the saved width on the next mount', () => {
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '360');

        renderWithProviders(<Host />);

        expect(widthOf()).toBe(360);
        expect(paintedWidth()).toBe('360px');
    });

    it('falls back to the default when the saved width is junk', () => {
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, 'not-a-number');

        renderWithProviders(<Host />);

        expect(widthOf()).toBe(SIDEBAR_DEFAULT_WIDTH);
    });

    it('clamps a saved width that sits outside the allowed range', () => {
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '9000');

        renderWithProviders(<Host />);

        expect(widthOf()).toBe(SIDEBAR_MAX_WIDTH);
    });

    it('ends the drag when pointer capture is lost', () => {
        renderWithProviders(<Host />);

        drag(SIDEBAR_DEFAULT_WIDTH + 100, { release: false });
        fireEvent.lostPointerCapture(getHandle(), { pointerId: 1 });

        expect(screen.getByTestId('aside')).not.toHaveAttribute('data-resizing');
        expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('380');
    });

    it('ends the drag when the handle is taken away mid-drag', () => {
        const { rerender } = renderWithProviders(<Host />);

        drag(SIDEBAR_DEFAULT_WIDTH + 100, { release: false });

        // Collapsing the sidebar removes the handle, so no pointerup can reach it.
        rerender(<Host hideHandle />);
        fireEvent.pointerUp(window, { pointerId: 1 });

        expect(screen.getByTestId('aside')).not.toHaveAttribute('data-resizing');
        expect(document.body.style.cursor).toBe('');
        expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('380');
    });

    it('resizes with the arrow keys', () => {
        renderWithProviders(<Host />);

        getHandle().focus();

        fireEvent.keyDown(getHandle(), { key: 'ArrowRight' });
        expect(widthOf()).toBe(SIDEBAR_DEFAULT_WIDTH + 16);

        fireEvent.keyDown(getHandle(), { key: 'ArrowLeft' });
        expect(widthOf()).toBe(SIDEBAR_DEFAULT_WIDTH);

        fireEvent.keyDown(getHandle(), { key: 'ArrowRight', shiftKey: true });
        expect(widthOf()).toBe(SIDEBAR_DEFAULT_WIDTH + 64);

        fireEvent.keyDown(getHandle(), { key: 'Home' });
        expect(widthOf()).toBe(SIDEBAR_MIN_WIDTH);

        fireEvent.keyDown(getHandle(), { key: 'End' });
        expect(widthOf()).toBe(SIDEBAR_MAX_WIDTH);
        expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe(String(SIDEBAR_MAX_WIDTH));
    });

    it('resets to the default on double-click', () => {
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '400');

        renderWithProviders(<Host />);
        expect(widthOf()).toBe(400);

        fireEvent.doubleClick(getHandle());

        expect(widthOf()).toBe(SIDEBAR_DEFAULT_WIDTH);
        expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe(String(SIDEBAR_DEFAULT_WIDTH));
    });

    it('captures the pointer on the handle for the drag', () => {
        const setPointerCapture = vi.spyOn(Element.prototype, 'setPointerCapture');

        renderWithProviders(<Host />);

        drag(SIDEBAR_DEFAULT_WIDTH + 20, { release: false, pointerId: 7 });

        expect(setPointerCapture).toHaveBeenCalledWith(7);
        expect(setPointerCapture.mock.instances[0]).toBe(getHandle());

        fireEvent.pointerUp(getHandle(), { pointerId: 7, clientX: SIDEBAR_DEFAULT_WIDTH + 20 });
        setPointerCapture.mockRestore();
    });

    it('starts a second drag from the width the first one committed', () => {
        renderWithProviders(<Host />);

        drag(SIDEBAR_DEFAULT_WIDTH + 100);
        expect(widthOf()).toBe(380);

        drag(60, { from: 0 });

        expect(widthOf()).toBe(440);
        expect(paintedWidth()).toBe('440px');
        expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('440');
    });

    it('ignores a second pointer pressed during a live drag', () => {
        renderWithProviders(<Host />);

        drag(SIDEBAR_DEFAULT_WIDTH + 100, { release: false });

        // A rebase onto this origin would make the next move read as a ~380px delta.
        fireEvent.pointerDown(getHandle(), { button: 0, pointerId: 2, clientX: 0 });
        fireEvent.pointerMove(getHandle(), { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 100 });

        expect(paintedWidth()).toBe('380px');

        fireEvent.pointerUp(getHandle(), { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 100 });
        expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('380');
    });

    it('reverts to the width it started from when the gesture is cancelled', () => {
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '360');

        renderWithProviders(<Host />);

        drag(SIDEBAR_DEFAULT_WIDTH + 100, { release: false });
        expect(paintedWidth()).toBe('460px');

        fireEvent.pointerCancel(getHandle(), { pointerId: 1 });

        expect(widthOf()).toBe(360);
        expect(paintedWidth()).toBe('360px');
        expect(screen.getByTestId('aside')).not.toHaveAttribute('data-resizing');
        expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('360');
    });

    it('keeps the painted width when the host re-renders mid-drag', () => {
        const { rerender } = renderWithProviders(<Host />);

        drag(SIDEBAR_DEFAULT_WIDTH + 100, { release: false });
        expect(paintedWidth()).toBe('380px');

        rerender(<Host />);
        expect(paintedWidth()).toBe('380px');

        fireEvent.pointerUp(getHandle(), { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 100 });
        expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('380');
    });

    it('ignores a drag started with a non-primary button', () => {
        renderWithProviders(<Host />);

        fireEvent.pointerDown(getHandle(), { button: 2, pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH });
        fireEvent.pointerMove(getHandle(), { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 120 });

        expect(widthOf()).toBe(SIDEBAR_DEFAULT_WIDTH);
    });
});
