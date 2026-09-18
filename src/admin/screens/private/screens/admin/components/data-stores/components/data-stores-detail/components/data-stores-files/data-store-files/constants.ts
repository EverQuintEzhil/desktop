import { IS_MAC } from '@/hooks/keyboard-shortcuts/binding';

export const PAGE_SIZE = 10;
export const DELAY_AFTER_MUTATION = 2000;
export const SYNC_POLL_INTERVAL_MS = 3000;
export const SYNC_MAX_WAIT_MS = 60000;
export const SELECT_ALL_SHORTCUT_LABEL = IS_MAC ? '⌘ + A' : 'Ctrl + A';
