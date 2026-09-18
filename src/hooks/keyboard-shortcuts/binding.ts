import type { KeyBinding } from './types';

export const IS_MAC =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

/**
 * The primary modifier used by app-level default shortcuts: Cmd on macOS,
 * Ctrl elsewhere. Composer defaults that intentionally use Control on every
 * platform declare `ctrl` directly instead.
 */
export const primaryModifier = (): Pick<KeyBinding, 'meta' | 'ctrl'> => (IS_MAC ? { meta: true } : { ctrl: true });

const CODE_KEY_MAP: Record<string, string> = {
    Slash: '/',
    Comma: ',',
    Period: '.',
    Semicolon: ';',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Minus: '-',
    Equal: '=',
    Backquote: '`',
    Space: 'space',
    Enter: 'enter',
    Escape: 'escape',
    Tab: 'tab',
    Backspace: 'backspace',
    ArrowUp: 'arrowup',
    ArrowDown: 'arrowdown',
    ArrowLeft: 'arrowleft',
    ArrowRight: 'arrowright',
};

const MODIFIER_CODES = new Set([
    'ShiftLeft',
    'ShiftRight',
    'MetaLeft',
    'MetaRight',
    'ControlLeft',
    'ControlRight',
    'AltLeft',
    'AltRight',
]);

/**
 * Map a physical `KeyboardEvent.code` to a stable logical key. Using `code`
 * keeps matching layout- and modifier-independent (Shift+Comma still reports
 * `Comma`, so `⌘⇧,` matches regardless of the glyph the OS produces).
 */
const codeToKey = (code: string): string | null => {
    if (MODIFIER_CODES.has(code)) {
        return null;
    }

    const letter = /^Key([A-Z])$/.exec(code);

    if (letter) {
        return letter[1].toLowerCase();
    }

    const digit = /^Digit(\d)$/.exec(code);

    if (digit) {
        return digit[1];
    }

    return CODE_KEY_MAP[code] ?? code.toLowerCase();
};

export const normalizeKeyEvent = (event: KeyboardEvent | React.KeyboardEvent): KeyBinding | null => {
    const key = codeToKey(event.code);

    if (!key) {
        return null;
    }

    return {
        key,
        meta: event.metaKey,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
    };
};

/**
 * Global shortcuts must carry a primary modifier (Cmd/Ctrl) so a rebind can
 * never collide with plain typing in the composer or elsewhere.
 */
export const hasPrimaryModifier = (binding: KeyBinding): boolean => Boolean(binding.meta || binding.ctrl);

export const bindingsEqual = (a: KeyBinding, b: KeyBinding): boolean =>
    a.key === b.key &&
    Boolean(a.meta) === Boolean(b.meta) &&
    Boolean(a.ctrl) === Boolean(b.ctrl) &&
    Boolean(a.shift) === Boolean(b.shift) &&
    Boolean(a.alt) === Boolean(b.alt);

export const matchBinding = (event: KeyboardEvent | React.KeyboardEvent, binding: KeyBinding): boolean => {
    const normalized = normalizeKeyEvent(event);

    return normalized ? bindingsEqual(normalized, binding) : false;
};

const KEY_LABELS: Record<string, string> = {
    enter: 'Enter',
    space: 'Space',
    escape: 'Esc',
    tab: 'Tab',
    backspace: '⌫',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
};

const formatKeyLabel = (key: string): string => {
    if (KEY_LABELS[key]) {
        return KEY_LABELS[key];
    }

    return key.length === 1 ? key.toUpperCase() : key;
};

/** Produce ordered key caps for rendering (Ctrl, Alt, Shift, Meta, then key). */
export const formatBinding = (binding: KeyBinding): string[] => {
    const caps: string[] = [];

    if (binding.ctrl) {
        caps.push(IS_MAC ? '⌃' : 'Ctrl');
    }
    if (binding.alt) {
        caps.push(IS_MAC ? '⌥' : 'Alt');
    }
    if (binding.shift) {
        caps.push('⇧');
    }
    if (binding.meta) {
        caps.push(IS_MAC ? '⌘' : 'Win');
    }

    caps.push(formatKeyLabel(binding.key));

    return caps;
};
