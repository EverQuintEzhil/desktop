import { z } from 'zod';

const STORAGE_KEY = 'fluentmind:design-tokens';
const STYLE_ID = 'fluentmind-design-tokens';

const HEX_COLOR = /^#[0-9A-Fa-f]{3,8}$/;
/** Reference to a CSS custom property on :root (e.g. primitive scale from index.css). */
const CSS_VAR_REF = /^var\(--[a-z0-9-]+\)$/i;
const CSS_LENGTH = /^(-?0|-?\d+(\.\d+)?(px|rem|em|%|ch|ex|vw|vh))$/;
const CSS_OPACITY = /^\d+(\.\d+)?$/;

type TokenValidator = (value: string) => boolean;

const COLOR_KEYS = new Set<string>([
    'background',
    'foreground',
    'text-secondary',
    'card',
    'card-foreground',
    'surface-hover',
    'popover',
    'popover-foreground',
    'primary',
    'primary-foreground',
    'secondary',
    'secondary-foreground',
    'muted',
    'muted-foreground',
    'accent',
    'accent-foreground',
    'destructive',
    'destructive-foreground',
    'success',
    'success-foreground',
    'border',
    'input',
    'ring',
    'chart-1',
    'chart-2',
    'chart-3',
    'chart-4',
    'chart-5',
    'sidebar',
    'sidebar-foreground',
    'sidebar-primary',
    'sidebar-primary-foreground',
    'sidebar-accent',
    'sidebar-accent-foreground',
    'sidebar-border',
    'sidebar-ring',
    'shadow-color',
]);

const LENGTH_KEYS = new Set<string>([
    'radius',
    'spacing',
    'letter-spacing',
    'shadow-blur',
    'shadow-spread',
    'shadow-offset-x',
    'shadow-offset-y',
]);

const OPACITY_KEYS = new Set<string>(['shadow-opacity']);

/** Full `box-shadow` token (not a single colour). */
const BOX_SHADOW_KEYS = new Set<string>(['surface-shadow', 'shadow-dark']);

function isSafeBoxShadowTokenValue(v: string): boolean {
    const t = v.trim();

    if (t.length < 5 || t.length > 500) return false;
    if (/[{}]|<\s*script|url\s*\(|expression\s*\(/i.test(t)) return false;

    return true;
}

function getTokenValidator(key: string): TokenValidator {
    if (COLOR_KEYS.has(key)) return (v) => HEX_COLOR.test(v) || CSS_VAR_REF.test(v);
    if (LENGTH_KEYS.has(key)) return (v) => CSS_LENGTH.test(v);
    if (OPACITY_KEYS.has(key)) return (v) => CSS_OPACITY.test(v);
    if (BOX_SHADOW_KEYS.has(key)) return isSafeBoxShadowTokenValue;

    return () => false;
}

function sanitizeCssValue(key: string, value: string, fallback: string | undefined): string {
    const validate = getTokenValidator(key);
    const safeFallback = fallback ?? '';

    if (validate(value)) return value;
    if (validate(safeFallback)) return safeFallback;

    return safeFallback;
}

export type ThemeMode = 'light' | 'dark';

const themeStylePropsSchema = z.object({
    background: z.string(),
    foreground: z.string(),
    'text-secondary': z.string(),
    card: z.string(),
    'card-foreground': z.string(),
    'surface-hover': z.string(),
    'surface-shadow': z.string(),
    'shadow-dark': z.string(),
    popover: z.string(),
    'popover-foreground': z.string(),
    primary: z.string(),
    'primary-foreground': z.string(),
    secondary: z.string(),
    'secondary-foreground': z.string(),
    muted: z.string(),
    'muted-foreground': z.string(),
    accent: z.string(),
    'accent-foreground': z.string(),
    destructive: z.string(),
    'destructive-foreground': z.string(),
    success: z.string(),
    'success-foreground': z.string(),
    border: z.string(),
    input: z.string(),
    ring: z.string(),
    'chart-1': z.string(),
    'chart-2': z.string(),
    'chart-3': z.string(),
    'chart-4': z.string(),
    'chart-5': z.string(),
    sidebar: z.string(),
    'sidebar-foreground': z.string(),
    'sidebar-primary': z.string(),
    'sidebar-primary-foreground': z.string(),
    'sidebar-accent': z.string(),
    'sidebar-accent-foreground': z.string(),
    'sidebar-border': z.string(),
    'sidebar-ring': z.string(),
    'letter-spacing': z.string(),
    radius: z.string(),
    spacing: z.string(),
    'shadow-color': z.string(),
    'shadow-opacity': z.string(),
    'shadow-blur': z.string(),
    'shadow-spread': z.string(),
    'shadow-offset-x': z.string(),
    'shadow-offset-y': z.string(),
});

export type ThemeStyleProps = z.infer<typeof themeStylePropsSchema>;

export type DesignTokens = {
    light: ThemeStyleProps;
    dark: ThemeStyleProps;
};

const designTokensSchema = z
    .object({
        light: themeStylePropsSchema.partial(),
        dark: themeStylePropsSchema.partial(),
    })
    .partial();

export function parseDesignTokens(data: unknown): Partial<DesignTokens> | null {
    const result = designTokensSchema.safeParse(data);

    return result.success ? (result.data as Partial<DesignTokens>) : null;
}

export const SHARED_KEYS: ReadonlyArray<keyof ThemeStyleProps> = [
    'letter-spacing',
    'radius',
    'spacing',
    'shadow-color',
    'shadow-opacity',
    'shadow-blur',
    'shadow-spread',
    'shadow-offset-x',
    'shadow-offset-y',
];

export const DEFAULT_LIGHT: ThemeStyleProps = {
    background: '#ffffff', // brand-bg
    foreground: '#0a0a0a', // neutral-dark
    'text-secondary': '#6b6b6b', // neutral-mid — secondary body / caption text
    card: '#ffffff', // surface
    'card-foreground': '#0a0a0a',
    'surface-hover': '#f5f5f5',
    'surface-shadow': 'rgba(0, 0, 0, 0.35) 0px 0px 7px',
    'shadow-dark': 'rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.04) 0px 10px 10px -5px',
    popover: '#ffffff',
    'popover-foreground': '#0a0a0a',
    primary: '#171717', // brand-primary
    'primary-foreground': '#fafafa',
    secondary: '#f5f5f5', // brand-secondary
    'secondary-foreground': '#171717',
    muted: '#f5f5f5', // neutral-light
    'muted-foreground': '#6b6b6b', // neutral-mid
    accent: '#f5f5f5', // brand-bg
    'accent-foreground': '#171717',
    destructive: '#e7000b', // danger
    'destructive-foreground': '#ffffff',
    success: '#15803d',
    'success-foreground': '#ffffff',
    border: '#e5e5e5', // neutral-border
    input: '#e5e5e5', // neutral-border
    ring: '#171717', // neutral-dark
    'chart-1': '#f54900',
    'chart-2': '#009689',
    'chart-3': '#104e64',
    'chart-4': '#ffb900',
    'chart-5': '#fe9a00',
    sidebar: '#fafafa', // var(--primary)
    'sidebar-foreground': '#0a0a0a', // var(--brand-primary-foreground)
    'sidebar-primary': '#171717',
    'sidebar-primary-foreground': '#fafafa', // var(--primary)
    'sidebar-accent': '#f5f5f5',
    'sidebar-accent-foreground': '#171717',
    'sidebar-border': '#e5e5e5', // neutral-border
    'sidebar-ring': '#171717',
    'letter-spacing': '0em',
    radius: '8px',
    spacing: '0.25rem',
    'shadow-color': '#000000',
    'shadow-opacity': '0.08',
    'shadow-blur': '8px',
    'shadow-spread': '-2px',
    'shadow-offset-x': '0px',
    'shadow-offset-y': '4px',
};

// Mirrors the .dark token block in src/index.css — applyDesignTokens injects these as
// html.dark, which outranks .dark, so a value drifting between the two files shows up
// as a palette snap right after hydration.
export const DEFAULT_DARK: ThemeStyleProps = {
    background: '#1a1a1a', // brand-bg dark
    foreground: '#f2f1f4', // neutral-dark dark
    'text-secondary': '#b0aeb5', // neutral-mid dark
    card: '#2d2d2d', // surface dark
    'card-foreground': '#f2f1f4',
    'surface-hover': '#404040',
    'surface-shadow': 'rgba(0, 0, 0, 0.35) 0px 0px 7px',
    'shadow-dark': 'rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.04) 0px 10px 10px -5px',
    popover: '#2d2d2d',
    'popover-foreground': '#f2f1f4',
    primary: '#fafafa', // brand-primary dark
    'primary-foreground': '#171717',
    secondary: '#262626', // brand-secondary dark
    'secondary-foreground': '#fafafa',
    muted: '#262626', // neutral-light dark
    'muted-foreground': '#b0aeb5', // neutral-mid dark
    accent: '#1a1a1a', // brand-bg dark
    'accent-foreground': '#f2f1f4',
    destructive: '#ff6467',
    'destructive-foreground': '#2d2d2d', // surface dark — white on #ff6467 fails AA
    success: '#22c55e',
    'success-foreground': '#171717',
    border: '#3b3b3b', // neutral-border dark
    input: '#262626', // neutral-light dark
    ring: '#f2f1f4', // neutral-dark dark
    'chart-1': '#1447e6',
    'chart-2': '#00bc7d',
    'chart-3': '#fe9a00',
    'chart-4': '#ad46ff',
    'chart-5': '#ff2056',
    sidebar: '#242424', // dark sidebar step between bg and card
    'sidebar-foreground': '#f2f1f4',
    'sidebar-primary': '#fafafa',
    'sidebar-primary-foreground': '#171717',
    'sidebar-accent': '#262626',
    'sidebar-accent-foreground': '#f2f1f4',
    'sidebar-border': '#262626', // neutral-light dark
    'sidebar-ring': '#f2f1f4',
    'letter-spacing': '0em',
    radius: '8px',
    spacing: '0.25rem',
    'shadow-color': '#000000',
    'shadow-opacity': '0.08',
    'shadow-blur': '8px',
    'shadow-spread': '-2px',
    'shadow-offset-x': '0px',
    'shadow-offset-y': '4px',
};

function syncSharedKeys(tokens: DesignTokens): DesignTokens {
    const dark = { ...tokens.dark };

    for (const key of SHARED_KEYS) {
        dark[key] = tokens.light[key];
    }

    return { light: tokens.light, dark };
}

export function mergeDesignTokensWithDefaults(
    branding: Partial<DesignTokens> | DesignTokens | null | undefined,
): DesignTokens {
    const merged = !branding
        ? { light: { ...DEFAULT_LIGHT }, dark: { ...DEFAULT_DARK } }
        : {
              light: { ...DEFAULT_LIGHT, ...branding.light },
              dark: { ...DEFAULT_DARK, ...branding.dark },
          };

    return syncSharedKeys(merged);
}

export function areTokensEqual(a: DesignTokens, b: DesignTokens): boolean {
    for (const mode of ['light', 'dark'] as const) {
        const aMode = a[mode];
        const bMode = b[mode];
        const keys = Object.keys(aMode) as (keyof ThemeStyleProps)[];

        if (keys.length !== Object.keys(bMode).length) return false;

        for (const key of keys) {
            if (aMode[key] !== bMode[key]) return false;
        }
    }

    return true;
}

export function saveDesignTokens(tokens: DesignTokens): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } catch (error) {
        console.error('[design-tokens] Failed to save tokens:', error instanceof Error ? error.message : error);
    }
}

export const CSS_VAR_MAP: Partial<Record<keyof ThemeStyleProps, string>> = {
    spacing: '--spacing-value',
    'shadow-dark': '--shadow-dark-value',
};

// Exported for the chat SDK, which emits the same var blocks under its own
// `.fm-chat` scope instead of the app's `:root`/`html.dark`.
export function buildVarBlock(styles: ThemeStyleProps, defaults: ThemeStyleProps, excludeShared = false): string {
    return (Object.entries(styles) as [keyof ThemeStyleProps, string][])
        .filter(([key]) => !excludeShared || !SHARED_KEYS.includes(key))
        .map(([key, value]) => {
            const cssVar = CSS_VAR_MAP[key] ?? `--${key}`;
            const fallback = defaults[key];

            return `  ${cssVar}: ${sanitizeCssValue(key, value, fallback)};`;
        })
        .join('\n');
}

// Same mapping as buildVarBlock but as a { cssVar: value } record, for callers
// that apply the vars inline (e.g. the chat SDK, where inline style beats any
// stylesheet-ordering / <style>-hoisting ambiguity). Mirrors buildVarBlock's
// key filtering + sanitization exactly.
export function buildVarRecord(
    styles: ThemeStyleProps,
    defaults: ThemeStyleProps,
    excludeShared = false,
): Record<string, string> {
    const record: Record<string, string> = {};

    (Object.entries(styles) as [keyof ThemeStyleProps, string][])
        .filter(([key]) => !excludeShared || !SHARED_KEYS.includes(key))
        .forEach(([key, value]) => {
            const cssVar = CSS_VAR_MAP[key] ?? `--${key}`;

            record[cssVar] = sanitizeCssValue(key, value, defaults[key]);
        });

    return record;
}

export function applyDesignTokens(tokens: DesignTokens): void {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

    if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }

    const lightVars = buildVarBlock(tokens.light, DEFAULT_LIGHT);
    const darkVars = buildVarBlock(tokens.dark, DEFAULT_DARK, true);

    el.textContent = `:root {\n${lightVars}\n}\n\nhtml.dark {\n${darkVars}\n}`;
}

export function applyBranding(branding: unknown): void {
    const validated = parseDesignTokens(branding);
    const effective = mergeDesignTokensWithDefaults(validated);

    applyDesignTokens(effective);
    saveDesignTokens(effective);
}

export function resetDesignTokens(): void {
    const defaults = mergeDesignTokensWithDefaults(null);

    saveDesignTokens(defaults);
    applyDesignTokens(defaults);
}
