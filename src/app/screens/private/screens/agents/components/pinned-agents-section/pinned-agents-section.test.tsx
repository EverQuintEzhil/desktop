import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installElementFromPointShim, installPointerCaptureShims } from '@/test/dom-shims';
import { sampleLauncher } from '@/test/fixtures/agents';
import { renderWithProviders } from '@/test/test-utils';
import type { LauncherType } from '@/types/admin';

import PinnedAgentsSection from './pinned-agents-section';

// dnd-kit's pointer sensor calls setPointerCapture on drag start and cancels the drag if it throws,
// and its auto-scroller resolves the element under the pointer on every move.
installPointerCaptureShims();
installElementFromPointShim();

const TILE_WIDTH = 260;
const TILE_HEIGHT = 200;
const TILE_CENTRE_Y = 100;
const DRAGGING_BODY_CLASS = 'agent-drag-active';

const launcherAt = (index: number) =>
    ({
        ...sampleLauncher,
        _id: `launcher-${index}`,
        name: `Agent ${index}`,
        urlOrSlug: `agent-${index}`,
        description: `Description ${index}`,
    }) as LauncherType;

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
    ({
        x: left,
        y: top,
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        toJSON: () => ({}),
    }) as DOMRect;

/**
 * dnd-kit resolves collisions from real geometry and jsdom reports every rect as zero, so the whole
 * sort is a no-op unless the tiles are given a layout. Only `getBoundingClientRect` is faked; the
 * library, its sensors, the sortable plugins and the component's handlers all run for real.
 *
 * The drag preview borrows the dragged tile's rect and is measured before React has re-rendered that
 * tile with `is-dragging`, so the focused grip is the fallback identification.
 *
 * Everything else reports a page-sized rect: the keyboard plugin clips every candidate rect against
 * its scroll ancestors, and `getComputedStyle(div).overflow` is `''` in jsdom, which the library
 * reads as a clipping container — left at zero, every tile clips away and no drop target is found.
 */
const installRowLayout = () => {
    const original = Element.prototype.getBoundingClientRect;

    Element.prototype.getBoundingClientRect = function measure(this: Element): DOMRect {
        const tiles = Array.from(document.querySelectorAll('.agents-block > .agent-pinned-tile'));
        const dragged =
            document.querySelector('.agents-block > .agent-pinned-tile.is-dragging') ??
            document.activeElement?.closest('.agents-block > .agent-pinned-tile') ??
            null;
        const owner = this.closest('[data-dnd-overlay]') ? dragged : this.closest('.agents-block > .agent-pinned-tile');
        const index = owner ? tiles.indexOf(owner) : -1;

        if (index === -1) return rect(0, 0, 2000, 1000);

        return rect(index * TILE_WIDTH, 0, TILE_WIDTH, TILE_HEIGHT);
    };

    return () => {
        Element.prototype.getBoundingClientRect = original;
    };
};

interface AnimationHarness {
    /** Elements `animate` was called on, in order. */
    animated: Element[];
    /** Leaves every drop animation running, so the drop window can be asserted mid-flight. */
    hold: () => void;
}

/**
 * dnd-kit moves the neighbours and the drop preview through the Web Animations API, which jsdom does
 * not implement. `document.getAnimations` is read while measuring, so it has to exist too.
 */
const installAnimationHarness = (): AnimationHarness => {
    const animated: Element[] = [];
    let finished = Promise.resolve();

    const animation = {
        get finished() {
            return finished;
        },
        pause: () => {},
        finish: () => {},
        cancel: () => {},
    };

    Object.defineProperty(Element.prototype, 'animate', {
        configurable: true,
        writable: true,
        value(this: Element) {
            animated.push(this);

            return animation;
        },
    });

    for (const target of [Element.prototype, Document.prototype]) {
        Object.defineProperty(target, 'getAnimations', {
            configurable: true,
            writable: true,
            value: () => [],
        });
    }

    Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        writable: true,
        value: () => {},
    });

    return {
        animated,
        hold: () => {
            finished = new Promise<void>(() => {});
        },
    };
};

/** setup.ts stubs matchMedia to always report `matches: false`; override per test. */
const stubReducedMotion = (prefersReducedMotion: boolean) => {
    vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
            ({
                matches: prefersReducedMotion && query === '(prefers-reduced-motion: reduce)',
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }) as unknown as MediaQueryList,
    );
};

const renderSection = (agents: LauncherType[], editToPrefix?: string) => {
    const handlers = {
        onTogglePin: vi.fn<(agentId: string) => void>(),
        onReorder: vi.fn<(activeId: string, overId: string) => void>(),
    };

    const view = renderWithProviders(
        <PinnedAgentsSection
            agents={agents}
            editToPrefix={editToPrefix}
            onTogglePin={handlers.onTogglePin}
            onReorder={handlers.onReorder}
        />,
    );

    return { ...view, handlers };
};

const pinnedRegion = () => screen.getByRole('region', { name: 'Pinned' });

const gripFor = (name: string) => screen.getByRole('button', { name: `Reorder ${name}` });

const tileFor = (name: string) => gripFor(name).closest('.agent-pinned-tile') as HTMLElement;

const overlayTile = () => document.querySelector('.is-drag-preview');

const overlayRoot = () => document.querySelector('[data-dnd-overlay]') as HTMLElement;

const isDragActive = () => document.querySelector('[data-dnd-dragging]') !== null;

const pointer = (clientX: number) => ({
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    isPrimary: true,
    clientX,
    clientY: TILE_CENTRE_Y,
});

const press = (element: HTMLElement, clientX: number) => fireEvent.pointerDown(element, pointer(clientX));

const movePointer = (clientX: number) => fireEvent.pointerMove(document, pointer(clientX));

const release = (clientX: number) => fireEvent.pointerUp(document, pointer(clientX));

// The KeyboardSensor binds its document listener from the keydown that starts the drag, the
// sortable keyboard plugin resolves the next target in a microtask, and the collisions are measured
// on the next frame, so a drag step is only fully applied once the queue drains.
const flush = () =>
    new Promise((resolve) => {
        setTimeout(resolve, 30);
    });

describe('PinnedAgentsSection', () => {
    let restoreLayout = () => {};
    let animation: AnimationHarness;

    beforeEach(() => {
        restoreLayout = installRowLayout();
        animation = installAnimationHarness();
    });

    afterEach(() => {
        restoreLayout();
        document.body.classList.remove(DRAGGING_BODY_CLASS);
    });

    it('renders one tile per pinned agent under the Pinned heading', () => {
        renderSection([launcherAt(1), launcherAt(2)]);

        expect(screen.getByRole('heading', { name: 'Pinned' })).toBeInTheDocument();
        expect(within(pinnedRegion()).getAllByRole('link')).toHaveLength(2);
        expect(gripFor('Agent 1')).toBeInTheDocument();
        expect(overlayTile()).toBeNull();
    });

    it('collapses and reopens the section from its heading', async () => {
        renderSection([launcherAt(1), launcherAt(2)]);

        const trigger = screen.getByRole('button', { name: 'Pinned' });

        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        await userEvent.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await userEvent.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(within(pinnedRegion()).getAllByRole('link')).toHaveLength(2);
    });

    it('reports the agent id of the tile whose pin control is pressed', async () => {
        const { handlers } = renderSection([launcherAt(1), launcherAt(2)]);

        await userEvent.click(screen.getByRole('button', { name: 'Unpin Agent 2' }));

        expect(handlers.onTogglePin).toHaveBeenCalledWith('launcher-2');
    });

    it('renders an edit control per tile only when an edit prefix is given', () => {
        const { unmount } = renderSection([launcherAt(1)]);

        expect(screen.queryByRole('button', { name: 'Edit Agent 1' })).not.toBeInTheDocument();

        unmount();
        renderSection([launcherAt(1)], '/agent-builder');

        expect(screen.getByRole('button', { name: 'Edit Agent 1' })).toBeInTheDocument();
    });

    describe('arrow-key move', () => {
        it('reorders against the neighbour on the side the arrow points to', () => {
            const { handlers } = renderSection([launcherAt(1), launcherAt(2), launcherAt(3)]);

            fireEvent.keyDown(gripFor('Agent 2'), { key: 'ArrowLeft' });

            expect(handlers.onReorder).toHaveBeenCalledWith('launcher-2', 'launcher-1');

            fireEvent.keyDown(gripFor('Agent 2'), { key: 'ArrowRight' });

            expect(handlers.onReorder).toHaveBeenLastCalledWith('launcher-2', 'launcher-3');
        });

        it('steps to the next rendered tile, not the next id of the stored order', () => {
            // The section is only ever given the pins it can render: an id whose agent sits on an
            // unfetched page has no tile.
            const { handlers } = renderSection([launcherAt(1), launcherAt(3)]);

            fireEvent.keyDown(gripFor('Agent 1'), { key: 'ArrowRight' });

            expect(handlers.onReorder).toHaveBeenCalledWith('launcher-1', 'launcher-3');
        });

        it('does nothing at either end of the rendered row', () => {
            const { handlers } = renderSection([launcherAt(1), launcherAt(2)]);

            fireEvent.keyDown(gripFor('Agent 1'), { key: 'ArrowLeft' });
            fireEvent.keyDown(gripFor('Agent 2'), { key: 'ArrowRight' });

            expect(handlers.onReorder).not.toHaveBeenCalled();
        });
    });

    describe('pointer drag activation', () => {
        /*
         * dnd-kit 0.5's pointer sensor returns no activation constraints at all for a mouse press
         * that lands on the draggable's own handle, so it activates the drag on `pointerdown`.
         *
         * `[data-dnd-dragging]` is stamped on the preview once `dragstart` has been dispatched. The
         * live-region announcement cannot be asserted: its text node is populated through the
         * library's rAF scheduler and stays empty in jsdom.
         */
        it('does not start a drag when the grip is clicked without moving', async () => {
            const { handlers } = renderSection([launcherAt(1), launcherAt(2)]);

            press(gripFor('Agent 1'), 40);
            await flush();

            // Asserted while the button is still down: the drag an unconstrained sensor starts here
            // is over by the time the pointer is released.
            expect(isDragActive()).toBe(false);
            expect(tileFor('Agent 1')).not.toHaveClass('is-dragging');
            expect(overlayTile()).toBeNull();
            expect(document.body).not.toHaveClass(DRAGGING_BODY_CLASS);

            release(40);
            await flush();

            expect(isDragActive()).toBe(false);
            expect(handlers.onReorder).not.toHaveBeenCalled();
        });

        it('starts a drag once the pointer passes the threshold', async () => {
            renderSection([launcherAt(1), launcherAt(2)]);

            press(gripFor('Agent 1'), 40);
            movePointer(48);

            // dnd-kit stamps its own attribute a frame before React re-renders the tile, so the
            // rendered class is the later signal and the one worth waiting on.
            await waitFor(() => {
                expect(tileFor('Agent 1')).toHaveClass('is-dragging');
                expect(isDragActive()).toBe(true);
                expect(overlayTile()).not.toBeNull();
            });

            release(48);
            await flush();

            expect(isDragActive()).toBe(false);
            expect(document.body).not.toHaveClass(DRAGGING_BODY_CLASS);
        });
    });

    describe('keyboard drag', () => {
        const startDrag = async (name: string) => {
            gripFor(name).focus();
            await userEvent.keyboard(' ');
            await flush();
        };

        it('marks the body and shows an overlay preview while a drag is active', async () => {
            renderSection([launcherAt(1), launcherAt(2)]);

            await startDrag('Agent 1');

            expect(document.body).toHaveClass(DRAGGING_BODY_CLASS);

            const overlay = overlayTile();

            expect(overlay).not.toBeNull();
            expect(overlay).toHaveAttribute('aria-hidden', 'true');
            expect(within(overlay as HTMLElement).getByText('Agent 1')).toBeInTheDocument();
        });

        it('renders the overlay preview without a link or any control', async () => {
            renderSection([launcherAt(1), launcherAt(2)], '/agent-builder');

            await startDrag('Agent 1');

            const overlay = overlayTile() as HTMLElement;

            // If the overlay kept the anchor, the trailing click of a drag would open the agent.
            expect(overlay.querySelector('a')).toBeNull();
            expect(within(overlay).queryAllByRole('link')).toHaveLength(0);
            expect(within(overlay).queryAllByRole('button')).toHaveLength(0);
        });

        it('marks the dragged tile as the placeholder and leaves its neighbour unmarked', async () => {
            renderSection([launcherAt(1), launcherAt(2)]);

            await startDrag('Agent 1');

            expect(tileFor('Agent 1')).toHaveClass('is-dragging');
            expect(tileFor('Agent 2')).not.toHaveClass('is-dragging');
        });

        it('keeps the placeholder marked for the whole drop window', async () => {
            // The preview is still flying towards the tile's new slot after the key is released, so
            // the placeholder class has to survive until the drop animation finishes.
            animation.hold();
            renderSection([launcherAt(1), launcherAt(2), launcherAt(3)]);

            await startDrag('Agent 1');
            await userEvent.keyboard('{ArrowRight}');
            await flush();
            await userEvent.keyboard(' ');
            await flush();

            expect(tileFor('Agent 1')).toHaveClass('is-dragging');
        });

        it('leaves the arrow keys to dnd-kit once a drag is live', async () => {
            const { handlers } = renderSection([launcherAt(1), launcherAt(2)]);

            await startDrag('Agent 1');
            await userEvent.keyboard('{ArrowRight}');
            await flush();

            expect(handlers.onReorder).not.toHaveBeenCalled();
        });

        it('reorders the two ids the drag moved between', async () => {
            const { handlers } = renderSection([launcherAt(1), launcherAt(2), launcherAt(3)]);

            await startDrag('Agent 1');
            await userEvent.keyboard('{ArrowRight}');
            await flush();
            await userEvent.keyboard(' ');
            await flush();

            expect(handlers.onReorder).toHaveBeenCalledWith('launcher-1', 'launcher-2');
            expect(document.body).not.toHaveClass(DRAGGING_BODY_CLASS);
            expect(overlayTile()).toBeNull();
        });

        it('does not reorder when the drag ends where it started', async () => {
            const { handlers } = renderSection([launcherAt(1), launcherAt(2)]);

            await startDrag('Agent 1');
            await userEvent.keyboard(' ');
            await flush();

            expect(handlers.onReorder).not.toHaveBeenCalled();
            expect(document.body).not.toHaveClass(DRAGGING_BODY_CLASS);
            expect(overlayTile()).toBeNull();
        });

        it('does not reorder when the drag has no drop target left', async () => {
            const { handlers, rerender } = renderSection([launcherAt(1), launcherAt(2)]);

            await startDrag('Agent 1');

            // A list refresh mid-drag unmounts every droppable, so the drop resolves against
            // nothing at all.
            rerender(
                <PinnedAgentsSection agents={[]} onTogglePin={handlers.onTogglePin} onReorder={handlers.onReorder} />,
            );
            await flush();
            await userEvent.keyboard(' ');
            await flush();

            expect(handlers.onReorder).not.toHaveBeenCalled();
            expect(document.body).not.toHaveClass(DRAGGING_BODY_CLASS);
        });

        it('clears the drag state when the drag is cancelled', async () => {
            const { handlers } = renderSection([launcherAt(1), launcherAt(2)]);

            await startDrag('Agent 1');
            await userEvent.keyboard('{ArrowRight}');
            await flush();
            await userEvent.keyboard('{Escape}');
            await flush();

            expect(handlers.onReorder).not.toHaveBeenCalled();
            expect(overlayTile()).toBeNull();
            expect(document.body).not.toHaveClass(DRAGGING_BODY_CLASS);
        });

        it('unmarks the body when the section unmounts mid-drag', async () => {
            const { unmount } = renderSection([launcherAt(1), launcherAt(2)]);

            await startDrag('Agent 1');

            expect(document.body).toHaveClass(DRAGGING_BODY_CLASS);

            unmount();

            expect(document.body).not.toHaveClass(DRAGGING_BODY_CLASS);
        });

        it('animates the preview into its slot on drop', async () => {
            stubReducedMotion(false);
            renderSection([launcherAt(1), launcherAt(2), launcherAt(3)]);

            await startDrag('Agent 1');
            await userEvent.keyboard('{ArrowRight}');
            await flush();

            const overlay = overlayRoot();

            await userEvent.keyboard(' ');
            await flush();

            expect(animation.animated).toContain(overlay);
        });

        it('drops the preview into place without animating it when reduced motion is preferred', async () => {
            stubReducedMotion(true);
            renderSection([launcherAt(1), launcherAt(2), launcherAt(3)]);

            await startDrag('Agent 1');
            await userEvent.keyboard('{ArrowRight}');
            await flush();

            const overlay = overlayRoot();

            await userEvent.keyboard(' ');
            await flush();

            expect(animation.animated).not.toContain(overlay);
            expect(overlayTile()).toBeNull();
        });
    });
});
