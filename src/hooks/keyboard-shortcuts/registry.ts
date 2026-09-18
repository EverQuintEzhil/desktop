import { primaryModifier } from './binding';
import type { ShortcutDef, ShortcutId } from './types';

/**
 * Single source of truth for every configurable shortcut. Defaults mirror the
 * bindings the app already ships; composer actions (select-model) use Control on
 * every platform to stay clear of the OS-level Cmd combos, matching the design.
 */
export const SHORTCUTS: ShortcutDef[] = [
    {
        id: 'send',
        section: 'composer',
        description: 'Send message',
        defaultBinding: { key: 'enter' },
        rebindable: false,
    },
    {
        id: 'recall-messages',
        section: 'composer',
        description: 'Recall previous / next message',
        defaultBinding: { key: 'arrowup' },
        rebindable: false,
    },
    {
        id: 'select-model',
        section: 'composer',
        description: 'Select model',
        defaultBinding: { ctrl: true, shift: true, key: 'm' },
        rebindable: true,
    },
    {
        id: 'upload',
        section: 'composer',
        description: 'Add photos & files',
        defaultBinding: { ...primaryModifier(), key: 'u' },
        rebindable: true,
    },
    {
        id: 'new-chat',
        section: 'app',
        description: 'Open new chat',
        defaultBinding: { ...primaryModifier(), shift: true, key: 'o' },
        rebindable: true,
    },
    {
        id: 'incognito',
        section: 'app',
        description: 'Incognito chat',
        defaultBinding: { ...primaryModifier(), shift: true, key: 'i' },
        rebindable: true,
    },
    {
        id: 'edit-agent',
        section: 'app',
        description: 'Edit agent',
        defaultBinding: { ...primaryModifier(), shift: true, key: 'e' },
        rebindable: true,
    },
    {
        id: 'search',
        section: 'app',
        description: 'Search',
        defaultBinding: { ...primaryModifier(), key: 'k' },
        rebindable: true,
    },
    {
        id: 'find-in-chat',
        section: 'app',
        description: 'Find in conversation',
        defaultBinding: { ...primaryModifier(), key: 'f' },
        rebindable: true,
    },
    {
        id: 'show-shortcuts',
        section: 'app',
        description: 'Show shortcuts',
        defaultBinding: { ...primaryModifier(), key: '/' },
        rebindable: true,
    },
    {
        id: 'settings',
        section: 'app',
        description: 'Settings',
        defaultBinding: { ...primaryModifier(), shift: true, key: ',' },
        rebindable: true,
    },
];

export const SHORTCUTS_BY_ID: Record<ShortcutId, ShortcutDef> = SHORTCUTS.reduce(
    (acc, shortcut) => ({ ...acc, [shortcut.id]: shortcut }),
    {} as Record<ShortcutId, ShortcutDef>,
);
