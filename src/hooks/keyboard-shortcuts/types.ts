export type ShortcutId =
    | 'send'
    | 'recall-messages'
    | 'select-model'
    | 'upload'
    | 'new-chat'
    | 'incognito'
    | 'edit-agent'
    | 'show-shortcuts'
    | 'search'
    | 'find-in-chat'
    | 'settings';

export type ShortcutSection = 'composer' | 'app';

/**
 * A shortcut binding stores literal modifiers plus a layout-independent logical
 * key derived from `KeyboardEvent.code` (see `normalizeKeyEvent`). Storing the
 * literal modifiers keeps "what the user recorded" identical to "what fires".
 */
export interface KeyBinding {
    key: string;
    meta?: boolean;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
}

export interface ShortcutDef {
    id: ShortcutId;
    section: ShortcutSection;
    description: string;
    defaultBinding: KeyBinding;
    rebindable: boolean;
}

export interface ShortcutOverride {
    enabled?: boolean;
    keys?: KeyBinding | null;
}

/** Persisted under `user.preferences.keyboard`; only diffs from defaults. */
export type KeyboardPreferences = Partial<Record<ShortcutId, ShortcutOverride>>;

export interface ResolvedShortcut extends ShortcutDef {
    enabled: boolean;
    binding: KeyBinding;
    isCustomized: boolean;
}
