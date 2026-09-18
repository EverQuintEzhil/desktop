import { cn } from '@/lib/utils';

export const SPACES_EXPANDED_STORAGE_KEY = 'sidebarSpacesExpanded';
export const UNPINNED_SPACES_LIST_ID = 'sidebar-unpinned-spaces';

export const ROUTINES_EXPANDED_STORAGE_KEY = 'sidebarRoutinesExpanded';
export const SIDEBAR_ROUTINES_LIST_ID = 'sidebar-routines';

export const CHAT_SIDEBAR_ACCORDION_TRIGGER_CLASS = cn(
    'rounded-lg px-2 py-2 text-sm font-medium text-(--sidebar-foreground)',
    // the accordion default rings with --ring, which is near-black and unreadable on the
    // sidebar; ring rather than outline because the trigger sets outline-none, and no
    // offset because the offset colour would paint a white gap over the sidebar
    'focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:ring-offset-0',
    'hover:bg-(--sidebar-primary) hover:text-(--sidebar-primary-foreground) hover:no-underline',
    '[&>svg:last-child]:text-(--sidebar-foreground) hover:[&>svg:last-child]:text-(--sidebar-primary-foreground)',
);

export const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebarWidth';
export const SIDEBAR_DEFAULT_WIDTH = 280;
export const SIDEBAR_MIN_WIDTH = 240;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_KEYBOARD_STEP = 16;
export const SIDEBAR_KEYBOARD_STEP_LARGE = 64;
