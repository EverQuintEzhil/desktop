/**
 * Layers that own the keyboard ahead of find. Deliberately by role rather than
 * by Radix's popper wrapper: the bar's own tooltips are poppers too, and they
 * portal to the body, so no containment test can tell them apart.
 */
const OVERLAY_ON_TOP_SELECTOR = '[role="menu"], [role="listbox"], [role="dialog"][data-state="open"]';

export const isOverlayOnTop = (): boolean => document.querySelector(OVERLAY_ON_TOP_SELECTOR) !== null;
