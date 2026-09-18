import { BotIcon, DatabaseIcon, Plug, WrenchIcon, ZapIcon, type LucideIcon } from 'lucide-react';

import type { NoAccessKind } from './types';

/**
 * Both banner rows are the same component in two variants: everything structural is shared
 * from here and only the colour treatment differs, so the rows cannot drift apart.
 */
export const ROW_CLASSES = 'flex items-center gap-2 px-4 py-2.5 overflow-hidden';

/** The measured copy must keep the visible row's padding and gap, or the fit maths is wrong. */
export const MEASUREMENT_ROW_CLASSES = `absolute inset-0 opacity-0 pointer-events-none ${ROW_CLASSES}`;

/**
 * The row's scrolling-free content. The chips share this box and are clipped by it when a
 * label grows mid-write, so the trailing dismiss button can never be pushed out of the row.
 */
export const ROW_CONTENT_CLASSES = 'flex min-w-0 flex-1 items-center gap-2 overflow-hidden';

export const ROW_FIRST_CLASS = 'recommended-capabilities-row-first';

export const ROW_LABEL_CLASSES = 'flex items-center gap-1.5 shrink-0 text-xs font-medium text-muted-foreground';

export const CHIP_GEOMETRY_CLASSES =
    'flex shrink-0 items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium whitespace-nowrap';

/** The surface both chip variants sit on. Only the text and border hue may differ between them. */
export const CHIP_SURFACE_CLASSES = 'bg-[var(--card)] border';

/** Inert: muted family, same border weight as the accented variant. */
export const CHIP_MUTED_CLASSES =
    'text-muted-foreground border-[color-mix(in_srgb,var(--muted-foreground)_22%,transparent)]';

/** Actionable: accented family, plus the hover tint that says it can be clicked. */
export const CHIP_ACCENT_CLASSES = [
    'text-[var(--primary)] border-[color-mix(in_srgb,var(--primary)_22%,transparent)]',
    'hover:bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))]',
].join(' ');

export const CHIP_ICON_CLASSES = 'size-3.5 shrink-0 opacity-70';

export const ROW_LABEL_ICON_CLASSES = 'size-3.5 text-muted-foreground';

export const CHIP_NAME_CLASSES = 'truncate max-w-[220px]';

export const FOCUS_RING_CLASSES =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)]';

export const TRAILING_SLOT_CLASSES = 'ml-auto flex shrink-0 items-center';

export const CAPABILITY_ICON_BY_KIND: Record<NoAccessKind, LucideIcon> = {
    connector: Plug,
    skill: ZapIcon,
    'data-store': DatabaseIcon,
    tool: WrenchIcon,
    agent: BotIcon,
};
