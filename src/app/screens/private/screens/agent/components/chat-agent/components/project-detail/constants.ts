import { FileIcon, LockIcon, MessageSquareIcon, SparklesIcon, UsersIcon, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ProjectTab } from './types';

export const PROJECT_TABS: { value: ProjectTab; label: string }[] = [
    { value: 'chats', label: 'Your chats' },
    { value: 'shared', label: 'Shared with you' },
    { value: 'sources', label: 'Knowledge' },
    { value: 'files', label: 'Files' },
    { value: 'activity', label: 'Activity' },
];

export const TAB_TRIGGER_CLASS_NAME = cn(
    'h-10 flex-none rounded-none px-0 text-sm font-medium text-text-secondary',
    'after:bg-primary group-data-[orientation=horizontal]/tabs:after:-bottom-px!',
    'group-data-[orientation=horizontal]/tabs:after:h-px! hover:text-primary data-[state=active]:text-primary',
);

// Pins a tab's search bar directly under the sticky tabs bar. `--space-tabs-h` is published by
// useStickyTabsOffset; the 0px fallback covers ProjectFiles on its own `/spaces/:id/files` route,
// where there is no tabs bar above it.
//
// `py-3` is what keeps the input off the tabs bar's border once pinned: the wrapper's box stays
// flush with the bar (so no hairline lets rows scroll through the seam) while the padding holds
// the input 12px clear of it, top and bottom. Deliberately NOT paired with `-mt-3` to claw the
// 12px back at rest — a negative top margin shifts the sticky margin box, which would re-open
// that seam. `-mb-3` is safe because only the top edge is constrained.
export const STICKY_TAB_SEARCH_CLASS_NAME = cn(
    'sticky top-[var(--space-tabs-h,0px)] z-1 -mb-3 flex w-full items-center bg-background py-3',
);

export const ROW_HOVER_CLASS_NAME = cn(
    'transition-colors duration-140',
    'hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]',
);

export const CARD_LIST_CLASS_NAME = 'flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card';

export const CARD_ROW_CLASS_NAME = cn(
    'flex items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0',
    ROW_HOVER_CLASS_NAME,
);

export const CARD_STATE_ROW_CLASS_NAME =
    'flex items-center justify-center px-4 py-6 text-center text-sm text-muted-foreground';

export const CHAT_EMPTY_STATE_ITEMS: { label: string; Icon: LucideIcon }[] = [
    { label: 'Start from the composer', Icon: MessageSquareIcon },
    { label: 'Private until shared', Icon: LockIcon },
    { label: 'Organized in this space', Icon: SparklesIcon },
];

export const ACTIVITY_EMPTY_STATE_ITEMS: { label: string; Icon: LucideIcon }[] = [
    { label: 'Member updates', Icon: UsersIcon },
    { label: 'Knowledge changes', Icon: FileIcon },
    { label: 'Shared chats', Icon: MessageSquareIcon },
];

export const SHARED_CHAT_EMPTY_STATE_ITEMS: { label: string; Icon: LucideIcon }[] = [
    { label: 'Shared by members', Icon: UsersIcon },
    { label: 'Read alongside your chats', Icon: MessageSquareIcon },
    { label: 'Organized in this space', Icon: SparklesIcon },
];
