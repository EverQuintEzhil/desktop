const MENU_LAYER_SELECTOR = '[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]';

export const isMenuLayerOpen = (): boolean => document.querySelector(MENU_LAYER_SELECTOR) !== null;
