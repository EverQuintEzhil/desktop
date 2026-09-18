/**
 * The tenant's own colours, offered in the blog editor's colour menus beside BlockNote's
 * nine. The token list is `tenant.branding`'s — see design-tokens.ts — narrowed to the
 * ones that mean something in prose.
 *
 * Which those are is decided by the design-system screen's own descriptions. Five surface
 * colours a writer would reach for, each followed by the token that screen calls "text on
 * <that> backgrounds" — so highlighting a phrase Primary leaves the readable pairing one
 * row below it. Then the three that are text on the page itself: Foreground ("primary text
 * colour"), Text secondary and Muted Foreground.
 *
 * Deliberately left out: card-, popover-, sidebar-, sidebar-primary- and
 * sidebar-accent-foreground. That screen calls all five text too, but each is text on a
 * surface this editor does not offer as a background, so there is nothing here to pair
 * them with — card, popover and sidebar are app chrome, not article colours.
 *
 * Stored as `var(--primary)` rather than a hex, because that is the only form that both
 * survives the round trip and answers for two themes. BlockNote writes a colour it does
 * not recognise straight into the inline style it emits, so `var(--primary)` reaches the
 * reader as `style="color: var(--primary)"` and resolves against whatever `applyBranding`
 * put on `:root` and `html.dark`. Its own nine are resolved to a hardcoded light-mode hex
 * on the way out — which is why a yellow paragraph is still a pale wash on a dark reader
 * page, and why these are not modelled the same way.
 *
 * Nothing here may import from `@blocknote/*`: sanitize-html.ts reads this file, and the
 * public blog screen reads sanitize-html.ts. The editor bundle has no business being
 * pulled onto the reader's page.
 */
export interface ThemeColor {
    /** The design token, without the leading `--`. */
    token: string;
    /** Menu label. Matches the admin design-system screen, so both name a colour alike. */
    label: string;
    /** What is stored on the block, and what reaches the reader as an inline style. */
    value: string;
}

export const THEME_COLORS: readonly ThemeColor[] = [
    { token: 'primary', label: 'Primary', value: 'var(--primary)' },
    { token: 'primary-foreground', label: 'Primary Foreground', value: 'var(--primary-foreground)' },
    { token: 'secondary', label: 'Secondary', value: 'var(--secondary)' },
    { token: 'secondary-foreground', label: 'Secondary Foreground', value: 'var(--secondary-foreground)' },
    { token: 'accent', label: 'Accent', value: 'var(--accent)' },
    { token: 'accent-foreground', label: 'Accent Foreground', value: 'var(--accent-foreground)' },
    { token: 'destructive', label: 'Destructive', value: 'var(--destructive)' },
    { token: 'destructive-foreground', label: 'Destructive Foreground', value: 'var(--destructive-foreground)' },
    { token: 'success', label: 'Success', value: 'var(--success)' },
    { token: 'success-foreground', label: 'Success Foreground', value: 'var(--success-foreground)' },
    { token: 'foreground', label: 'Foreground', value: 'var(--foreground)' },
    { token: 'text-secondary', label: 'Text secondary', value: 'var(--text-secondary)' },
    { token: 'muted-foreground', label: 'Muted Foreground', value: 'var(--muted-foreground)' },
];

const THEME_VALUES = new Set(THEME_COLORS.map(({ value }) => value));

const CALLOUT_NAME_BY_VALUE = new Map(THEME_COLORS.map(({ token, value }) => [value, `theme-${token}`]));

const VALUE_BY_CALLOUT_NAME = new Map(THEME_COLORS.map(({ token, value }) => [`theme-${token}`, value]));

/** Whether a stored colour is one of ours rather than one of BlockNote's names. */
export const isThemeColor = (value: string): boolean => THEME_VALUES.has(value);

/**
 * A callout writes its colour as a class rather than an inline style, so that one box can
 * answer for both themes (see callout-block.tsx). `var(--primary)` is not something a
 * class name can spell, so the six get a name of their own there. The `theme-` prefix
 * keeps them clear of BlockNote's nine, which share the same `callout-color-` namespace.
 */
export const CALLOUT_THEME_COLOR_NAMES: readonly string[] = [...VALUE_BY_CALLOUT_NAME.keys()];

/** `var(--primary)` → `theme-primary`. Undefined for anything that is not one of ours. */
export const calloutColorName = (value: string): string | undefined => CALLOUT_NAME_BY_VALUE.get(value);

/** `theme-primary` → `var(--primary)`. Undefined for anything that is not one of ours. */
export const calloutColorValue = (name: string): string | undefined => VALUE_BY_CALLOUT_NAME.get(name);

/**
 * BlockNote's nine, copied rather than imported for the reason at the top of this file.
 * These are `COLORS_DEFAULT` from its defaultColors.ts — the light-mode set, which is the
 * only one its own serializer reads. A table cell is the one place the reader needs them:
 * BlockNote resolves every other block's colour to a hex itself, but writes a cell's as a
 * bare `data-` attribute that the sanitizer would otherwise drop.
 */
export const BLOCKNOTE_CELL_COLORS: Record<string, { text: string; background: string }> = {
    gray: { text: '#9b9a97', background: '#ebeced' },
    brown: { text: '#64473a', background: '#e9e5e3' },
    red: { text: '#e03e3e', background: '#fbe4e4' },
    orange: { text: '#d9730d', background: '#f6e9d9' },
    yellow: { text: '#dfab01', background: '#fbf3db' },
    green: { text: '#4d6461', background: '#ddedea' },
    blue: { text: '#0b6e99', background: '#ddebf1' },
    purple: { text: '#6940a5', background: '#eae4f2' },
    pink: { text: '#ad1a72', background: '#f4dfeb' },
};
