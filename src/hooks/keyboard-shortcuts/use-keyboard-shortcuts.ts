import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { accountApi, ME_QUERY_KEY, type MeProfile } from '@/lib/api';

import { bindingsEqual } from './binding';
import { SHORTCUTS, SHORTCUTS_BY_ID } from './registry';
import type {
    KeyboardPreferences,
    KeyBinding,
    ResolvedShortcut,
    ShortcutDef,
    ShortcutId,
    ShortcutOverride,
} from './types';

const readKeyboardPrefs = (me?: MeProfile | null): KeyboardPreferences => me?.preferences?.keyboard ?? {};

const resolveShortcut = (def: ShortcutDef, override?: ShortcutOverride): ResolvedShortcut => {
    const binding = override?.keys ?? def.defaultBinding;
    const enabled = override?.enabled ?? true;
    const isCustomized = !enabled || (override?.keys != null && !bindingsEqual(override.keys, def.defaultBinding));

    return {
        ...def,
        binding,
        enabled,
        isCustomized,
    };
};

/**
 * Collapse an override back to only the fields that differ from defaults, so the
 * stored blob stays minimal and "Restore defaults" is simply an empty map.
 */
const pruneOverride = (def: ShortcutDef, override: ShortcutOverride): ShortcutOverride | null => {
    const next: ShortcutOverride = {};

    if (override.enabled === false) {
        next.enabled = false;
    }

    if (override.keys != null && !bindingsEqual(override.keys, def.defaultBinding)) {
        next.keys = override.keys;
    }

    return Object.keys(next).length > 0 ? next : null;
};

export interface UseKeyboardShortcutsResult {
    shortcuts: ResolvedShortcut[];
    isSaving: boolean;
    setEnabled: (id: ShortcutId, enabled: boolean) => void;
    setBinding: (id: ShortcutId, keys: KeyBinding) => void;
    restoreDefaults: () => void;
    findConflict: (binding: KeyBinding, excludeId: ShortcutId) => ResolvedShortcut | undefined;
}

export const useKeyboardShortcuts = (): UseKeyboardShortcutsResult => {
    const queryClient = useQueryClient();
    const { data: me } = useQuery({ queryKey: ME_QUERY_KEY, queryFn: () => accountApi.getMe() });

    const prefs = readKeyboardPrefs(me);

    const shortcuts = useMemo(() => SHORTCUTS.map((def) => resolveShortcut(def, prefs[def.id])), [prefs]);

    const mutation = useMutation({
        mutationFn: (nextKeyboard: KeyboardPreferences) => {
            // Read the freshest profile from cache so sibling preferences.* keys
            // are preserved even across rapid successive edits.
            const current = queryClient.getQueryData<MeProfile>(ME_QUERY_KEY);

            return accountApi.updateMe({
                preferences: { ...(current?.preferences ?? {}), keyboard: nextKeyboard },
            });
        },
        onMutate: async (nextKeyboard) => {
            await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY });

            const previous = queryClient.getQueryData<MeProfile>(ME_QUERY_KEY);

            queryClient.setQueryData<MeProfile>(ME_QUERY_KEY, (old) =>
                old ? { ...old, preferences: { ...(old.preferences ?? {}), keyboard: nextKeyboard } } : old,
            );

            return { previous };
        },
        onError: (_error, _next, context) => {
            if (context?.previous) {
                queryClient.setQueryData(ME_QUERY_KEY, context.previous);
            }

            toast.error("Couldn't update shortcuts. Please try again.");
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
    });

    const writeOverride = useCallback(
        (id: ShortcutId, patch: ShortcutOverride) => {
            const current = readKeyboardPrefs(queryClient.getQueryData<MeProfile>(ME_QUERY_KEY));
            const merged = pruneOverride(SHORTCUTS_BY_ID[id], { ...current[id], ...patch });
            const next: KeyboardPreferences = { ...current };

            if (merged) {
                next[id] = merged;
            } else {
                delete next[id];
            }

            mutation.mutate(next);
        },
        [mutation, queryClient],
    );

    const setEnabled = useCallback(
        (id: ShortcutId, enabled: boolean) => writeOverride(id, { enabled }),
        [writeOverride],
    );

    const setBinding = useCallback((id: ShortcutId, keys: KeyBinding) => writeOverride(id, { keys }), [writeOverride]);

    const restoreDefaults = useCallback(() => mutation.mutate({}), [mutation]);

    const findConflict = useCallback(
        (binding: KeyBinding, excludeId: ShortcutId) =>
            shortcuts.find((shortcut) => shortcut.id !== excludeId && bindingsEqual(shortcut.binding, binding)),
        [shortcuts],
    );

    return {
        shortcuts,
        isSaving: mutation.isPending,
        setEnabled,
        setBinding,
        restoreDefaults,
        findConflict,
    };
};

/** Lightweight read-only selector for components that only gate on enablement. */
export const useShortcutEnabled = (id: ShortcutId): boolean => {
    const { data: me } = useQuery({ queryKey: ME_QUERY_KEY, queryFn: () => accountApi.getMe() });

    return readKeyboardPrefs(me)[id]?.enabled ?? true;
};
