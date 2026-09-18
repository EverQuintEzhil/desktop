/**
 * WCAG contrast maths, shared by the blog editor's colour menus and the reader's article
 * colours. Nothing here may import from `@blocknote/*` — the reader's page reads this file.
 */

const RGB_CHANNELS = /-?[\d.]+/g;

/** getComputedStyle hands back `rgb(...)` or `rgba(...)`, never a hex and never a var(). */
export const parseRgb = (value: string): number[] | undefined => {
    const channels = value.match(RGB_CHANNELS)?.map(Number);

    return channels && channels.length >= 3 && channels.every(Number.isFinite) ? channels.slice(0, 3) : undefined;
};

/** WCAG 2.1 relative luminance. */
export const luminance = (channels: number[]): number => {
    const [red, green, blue] = channels.map((channel) => {
        const ratio = channel / 255;

        return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

export const contrastRatio = (a: number[], b: number[]): number => {
    const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Where black and white swap places on the WCAG contrast formula. Contrast against white
 * is 1.05 / (L + 0.05) and against black is (L + 0.05) / 0.05; they meet where
 * (L + 0.05)² = 0.0525, so L = 0.179. Above it black wins, below it white does.
 */
export const LUMINANCE_CROSSOVER = 0.179;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const toHsl = ([red, green, blue]: number[]): [number, number, number] => {
    const [r, g, b] = [red / 255, green / 255, blue / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const delta = max - min;

    if (delta === 0) return [0, 0, lightness];

    const saturation = delta / (1 - Math.abs(2 * lightness - 1));

    let hue: number;

    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;

    return [(((hue * 60) % 360) + 360) % 360, saturation, lightness];
};

const fromHsl = ([hue, saturation, lightness]: [number, number, number]): number[] => {
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const sector = hue / 60;
    const second = chroma * (1 - Math.abs((sector % 2) - 1));
    const offset = lightness - chroma / 2;

    const table: [number, number, number][] = [
        [chroma, second, 0],
        [second, chroma, 0],
        [0, chroma, second],
        [0, second, chroma],
        [second, 0, chroma],
        [chroma, 0, second],
    ];

    const [r, g, b] = table[clamp(Math.floor(sector), 0, 5)];

    return [r, g, b].map((channel) => Math.round((channel + offset) * 255));
};

const rgbString = (channels: number[]): string => `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;

/**
 * `color` re-toned until it clears `target` against `background`, keeping its hue and
 * saturation so an author's choice still reads as the colour they picked. Undefined when
 * the pair already passes, or when either value is not a colour this can read — a caller
 * should then leave the element alone rather than guess.
 */
export const readableAgainst = (color: string, background: string, target: number): string | undefined => {
    const foreground = parseRgb(color);
    const backdrop = parseRgb(background);

    if (!foreground || !backdrop) return undefined;
    if (contrastRatio(foreground, backdrop) >= target) return undefined;

    const [hue, saturation] = toHsl(foreground);
    // Away from the backdrop: lighten on a dark page, darken on a light one.
    const towardsLight = luminance(backdrop) <= LUMINANCE_CROSSOVER;

    let best: number[] | undefined;

    // 1% lightness steps — fine enough to stop at the first shade that passes, so the
    // result stays as close to the author's colour as the target allows.
    for (let step = 1; step <= 100; step += 1) {
        const lightness = clamp(towardsLight ? step / 100 : 1 - step / 100, 0, 1);
        const candidate = fromHsl([hue, saturation, lightness]);

        if (contrastRatio(candidate, backdrop) >= target) {
            best = candidate;
            break;
        }
    }

    return best ? rgbString(best) : undefined;
};
