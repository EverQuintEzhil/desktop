/**
 * jsdom gaps that the gallery screens depend on. Not global (`src/test/setup.ts`
 * is shared with every other suite) — each gallery test file opts in by calling
 * this at module scope.
 *
 * - `offsetWidth`: `MasonryView` gates its whole item map behind
 *   `containerWidth > 0`, measured from `offsetWidth`, which jsdom always
 *   reports as 0. Without a width no gallery item ever renders.
 * - `innerText`: jsdom does not implement it, and the contenteditable
 *   `TextArea` both reads and writes the composer value through it.
 */
export const installGalleryDomShims = (layoutWidth = 1200): void => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
            return layoutWidth;
        },
    });

    Object.defineProperty(HTMLElement.prototype, 'innerText', {
        configurable: true,
        get(this: HTMLElement) {
            return this.textContent ?? '';
        },
        set(this: HTMLElement, value: string) {
            this.textContent = value;
        },
    });
};

/**
 * jsdom gaps that ProseMirror/TipTap and `user-event` depend on. Opt-in per file,
 * like `installGalleryDomShims`.
 *
 * - `Text`/`Range` measurement: ProseMirror locates the caret by measuring the
 *   text node (or a `Range` over it). jsdom implements neither method, and the
 *   throw happens inside a DOM observer where a test cannot catch it — every
 *   keystroke in an instructions editor fails.
 * - `document.elementFromPoint`: `user-event` consults it during pointer
 *   dispatch; without it a click on a button next to a rich-text editor is
 *   silently dropped.
 */
export const installRichTextDomShims = (): void => {
    const zeroRect = {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    } as DOMRect;

    Object.defineProperty(Text.prototype, 'getClientRects', { configurable: true, value: () => [] });
    Object.defineProperty(Text.prototype, 'getBoundingClientRect', { configurable: true, value: () => zeroRect });
    Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => zeroRect });
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => document.body });
};

/**
 * `Element.prototype.scrollIntoView` — jsdom does not implement it, and several
 * components (cmdk, the mention picker's active-row tracking) call it on mount
 * or on every highlight move.
 */
export const installScrollIntoViewShim = (): void => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: () => {} });
};

/**
 * `DataTransfer` — jsdom does not implement the constructor at all, so any
 * production code that builds a synthetic `FileList` (`new DataTransfer()`,
 * `items.add(file)`, `.files`) throws a bare `ReferenceError` before its own
 * logic runs. Opt-in per file, like the other shims here.
 */
export const installDataTransferShim = (): void => {
    class DataTransferStub {
        private readonly entries: File[] = [];

        readonly items = {
            add: (file: File) => {
                this.entries.push(file);
            },
        };

        get files(): FileList {
            const list = [...this.entries];

            return Object.assign(list, {
                item: (index: number) => list[index] ?? null,
            }) as unknown as FileList;
        }
    }

    (globalThis as { DataTransfer?: unknown }).DataTransfer = DataTransferStub;
};

/**
 * The Web Animations API, which jsdom does not implement at all. `@dnd-kit/dom`
 * measures an element by first force-finishing any transform animation on it, so
 * all three are reached the moment a drag starts, and the throw happens inside
 * the sensor's own key/pointer handler where it escapes as an unhandled error
 * instead of failing an assertion. Opt-in per file.
 */
export const installWebAnimationsShims = (): void => {
    const createAnimationStub = () => ({
        finished: Promise.resolve(),
        currentTime: 0,
        playState: 'finished',
        effect: null,
        cancel: () => {},
        finish: () => {},
        play: () => {},
        pause: () => {},
    });

    Object.defineProperty(document, 'getAnimations', { configurable: true, value: () => [] });
    Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [] });
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: createAnimationStub });
};

/**
 * `document.elementFromPoint` — jsdom does not implement it. dnd-kit's auto-scroller resolves the
 * element under the pointer on every move of a live drag, from inside a reactive effect, so the
 * throw surfaces as an unhandled rejection rather than a test failure. Opt-in per file;
 * `installRichTextDomShims` already covers this for the editor suites.
 */
export const installElementFromPointShim = (): void => {
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => document.body });
};

/**
 * Undoes the `document.elementFromPoint` half of `installRichTextDomShims` for suites that also
 * drive a Radix `Select`: returning `document.body` makes Radix read every pointer as landing
 * outside the listbox, so choosing an option never commits. jsdom lays nothing out, so `null`
 * is the honest answer and leaves the Radix pointer path alone.
 */
export const installEmptyElementFromPointShim = (): void => {
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null });
};

/**
 * Pointer-capture APIs jsdom does not implement. Sonner's swipe-to-dismiss (and
 * several Radix drag primitives) call them from a pointer handler, where the
 * throw escapes as an unhandled error rather than failing the test.
 */
export const installPointerCaptureShims = (): void => {
    Object.defineProperty(Element.prototype, 'setPointerCapture', { configurable: true, value: () => {} });
    Object.defineProperty(Element.prototype, 'releasePointerCapture', { configurable: true, value: () => {} });
    Object.defineProperty(Element.prototype, 'hasPointerCapture', { configurable: true, value: () => false });
};
