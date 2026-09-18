import { escapeCurrencyDollars, normalizeMathDelimiters } from '@assistant-ui/react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

import { KATEX_OPTIONS } from '../constants';

import { codeSpanEnd } from './fence-scanner';
import { hideIncompleteMath } from './hide-incomplete-math';
import { normalizeMathFences } from './normalize-math-fences';
import { rehypeKatexFallback } from './rehype-katex-fallback';

const pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm, { singleTilde: false })
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex, KATEX_OPTIONS)
    .use(rehypeKatexFallback);

type HastNode = {
    type: string;
    tagName?: string;
    value?: string;
    properties?: { className?: unknown };
    children?: HastNode[];
};

/** KaTeX ships the LaTeX source in a MathML `annotation` that its stylesheet hides, so it is not visible text. */
const HIDDEN_TAGS = new Set(['annotation', 'style', 'script']);
const HIDDEN_CLASS = 'katex-mathml';
const CODE_TAGS = new Set(['code', 'pre']);
const BLOCK_TAGS = new Set([
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'ul',
    'ol',
    'li',
    'pre',
    'table',
    'hr',
    'em',
    'strong',
    'del',
    'code',
    'a',
]);

const LATEX_CONTROL = /\\[a-zA-Z]+/;
const STRAY_DELIMITER = /[([]/g;

type Frame = { text: string; blocks: Map<string, number> };

const classesOf = (node: HastNode): string[] => {
    const className = node.properties?.className;

    return Array.isArray(className) ? className.map(String) : [];
};

const walk = (node: HastNode, inCode: boolean, frame: { text: string[]; blocks: Map<string, number> }) => {
    if (node.type === 'text') {
        if (!inCode) frame.text.push(node.value ?? '');

        return;
    }
    if (node.tagName !== undefined && HIDDEN_TAGS.has(node.tagName)) return;
    if (classesOf(node).includes(HIDDEN_CLASS)) return;
    if (node.tagName !== undefined && BLOCK_TAGS.has(node.tagName)) {
        frame.blocks.set(node.tagName, (frame.blocks.get(node.tagName) ?? 0) + 1);
    }

    const nested = inCode || (node.tagName !== undefined && CODE_TAGS.has(node.tagName));

    for (const child of node.children ?? []) walk(child, nested, frame);
};

/** Text a reader actually sees, and the block elements around it. Code is excluded: raw LaTeX inside a code sample is content. */
const frameOf = (markdown: string): Frame => {
    const collected = { text: [] as string[], blocks: new Map<string, number>() };

    walk(pipeline.runSync(pipeline.parse(markdown)) as HastNode, false, collected);

    return { text: collected.text.join(''), blocks: collected.blocks };
};

const settled = (text: string) => escapeCurrencyDollars(normalizeMathFences(normalizeMathDelimiters(text)));
const unhidden = (text: string) => escapeCurrencyDollars(normalizeMathFences(normalizeMathDelimiters(text), true));
const hidden = (text: string) =>
    escapeCurrencyDollars(normalizeMathFences(normalizeMathDelimiters(hideIncompleteMath(text)), true));

const countOf = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

type StreamFaults = { rawLatex: number; strayDelimiters: number; transientBlocks: number; prefixBreaks: number };

const EMPTY: StreamFaults = {
    rawLatex: 0,
    strayDelimiters: 0,
    transientBlocks: 0,
    prefixBreaks: 0,
};

const add = (left: StreamFaults, right: StreamFaults): StreamFaults => ({
    rawLatex: left.rawLatex + right.rawLatex,
    strayDelimiters: left.strayDelimiters + right.strayDelimiters,
    transientBlocks: left.transientBlocks + right.transientBlocks,
    prefixBreaks: left.prefixBreaks + right.prefixBreaks,
});

/** A backtick run whose partner has not arrived shows its body verbatim in plain markdown too, so those frames are not counted. */
const insideUnclosedCodeSpan = (text: string): boolean => {
    let index = 0;

    while (index < text.length) {
        if (text[index] !== '`') {
            index += 1;
            continue;
        }

        const end = codeSpanEnd(text, index);

        if (end === -1) return true;
        index = end;
    }

    return false;
};

/**
 * What a reader would have seen frame by frame: every counter is measured against the frame the same
 * transform produces for the whole message, so a fault is something an intermediate frame shows that
 * the final frame does not.
 */
const streamFaults = (source: string, transform: (text: string) => string): StreamFaults => {
    const target = frameOf(transform(source));
    const strayBudget = countOf(target.text, STRAY_DELIMITER);
    const settledRaw = LATEX_CONTROL.test(target.text);
    const faults = { ...EMPTY };
    let previous = transform('');

    for (let length = 1; length <= source.length; length += 1) {
        const output = transform(source.slice(0, length));
        const frame = insideUnclosedCodeSpan(source.slice(0, length))
            ? { text: '', blocks: new Map<string, number>() }
            : frameOf(output);

        if (!settledRaw && LATEX_CONTROL.test(frame.text)) faults.rawLatex += 1;
        if (countOf(frame.text, STRAY_DELIMITER) > strayBudget) faults.strayDelimiters += 1;
        const onLineBoundary = length === source.length || source[length - 1] === '\n';

        if (onLineBoundary && [...frame.blocks].some(([tag, count]) => count > (target.blocks.get(tag) ?? 0)))
            faults.transientBlocks += 1;
        if (!output.startsWith(previous)) faults.prefixBreaks += 1;
        previous = output;
    }

    return faults;
};

const USER_REPORT = 'Let \\(f\\in\\mathcal{H}\\) be given.';

const STREAMED = [
    USER_REPORT,
    'Let \\\\(f\\\\in\\\\mathcal{H}\\\\) be given.',
    'Given:\n\n\\[\na_1 + b_2 = c_3\n\\]\n\nDone.\n',
    'Given:\n\n\\\\[\na_1 + b_2 = c_3\n\\\\]\n\nDone.\n',
    'Given:\n\n\\[\n---\n\\]\n\nDone.\n',
    'Result:\n\n$$\n\\int_0^1 x\\,dx = \\frac{1}{2}\n$$\n\nDone.\n',
    'Result:\n\n$$\\int_0^1 x\\,dx$$\n\nDone.\n',
    'We know $\\frac{a}{b}$ here.\n',
    'Then [/math]\\alpha + \\beta[/math] ends.\n',
    'Then [/inline]\\alpha[/inline] ends.\n',
    'Costs $5 and $10 total.\n',
    'The plan costs $5 per month for everyone.\n',
    'Radius \\(2\\pi r\\) grows.\n',
    '- Energy \\(E = mc^2\\) here\n- Next item\n',
    '> Quote \\(a_1\\) inside\n',
    'A \\(x\\) then \\[\ny_2\n\\] then $z^3$ done.\n',
    'Use `\\alpha` and `$x$` inline.\n',
    'Run:\n\n```\nprice = "$5"\nlatex = "\\alpha"\n```\n\nDone.\n',
    'Example:\n\n    \\[ a = b \\]\n\ntail\n',
    'Mixed \\(a\\) and $$b$$ and [/math]c[/math].\n',
];

const SPANS: [string, string][] = [
    ['\\(', '\\)'],
    ['\\\\(', '\\\\)'],
    ['\\[', '\\]'],
    ['\\\\[', '\\\\]'],
    ['$', '$'],
    ['$$', '$$'],
    ['[/math]', '[/math]'],
    ['[/inline]', '[/inline]'],
];

const MATH_BODIES = ['a_1', '\\frac{a}{b}', 'E = mc^2', '\\int_0^1 x\\,dx', '\\alpha + \\beta'];
const PROSE = [
    'Intro text.',
    '## Heading',
    '- bullet one\n- bullet two',
    '> a quote',
    'Costs $5 total.',
    'Use `code` here.',
];
const SHAPES = ['%', 'A sentence with % inside it.'];

/** A body on its own line is what turns `_` into emphasis and a dash run into a heading while it streams. */
const BLOCK_BODIES = ['a_1 + b_2 = c_3', '---', '\\frac{a}{b}\n= c_1'];
const DISPLAY_OPENERS = ['\\[', '\\\\[', '$$', '[/math]'];
const BLOCK_SPANS = SPANS.filter(([open]) => DISPLAY_OPENERS.includes(open));

const generated = (): string[] => {
    const messages: string[] = [];

    for (const [open, close] of SPANS) {
        for (let index = 0; index < MATH_BODIES.length; index += 1) {
            const span = `${open}${MATH_BODIES[index]}${close}`;
            const shape = SHAPES[index % SHAPES.length].replace('%', () => span);

            messages.push(`${PROSE[index % PROSE.length]}\n\n${shape}\n\n${PROSE[(index + 1) % PROSE.length]}\n`);
        }
    }

    for (const [open, close] of BLOCK_SPANS) {
        for (let index = 0; index < BLOCK_BODIES.length; index += 1) {
            messages.push(`Given:\n\n${open}\n${BLOCK_BODIES[index]}\n${close}\n\n${PROSE[index % PROSE.length]}\n`);
        }
    }

    return messages;
};

const GENERATED = generated();

describe('hideIncompleteMath', () => {
    it('hides an inline bracket span until its closer arrives', () => {
        expect(hideIncompleteMath('Let \\(f\\in')).toBe('Let ');
        expect(hideIncompleteMath('Let \\(f\\in\\mathcal{H}\\)')).toBe('Let \\(f\\in\\mathcal{H}\\)');
    });

    it('hides the double backslash bracket forms too', () => {
        expect(hideIncompleteMath('Let \\\\(f\\\\in')).toBe('Let ');
        expect(hideIncompleteMath('Let \\\\[f\\\\in')).toBe('Let ');
        expect(hideIncompleteMath('Let \\\\(x\\\\) done')).toBe('Let \\\\(x\\\\) done');
    });

    it('hides a display bracket span until its closer arrives', () => {
        expect(hideIncompleteMath('Given:\n\n\\[\na_1')).toBe('Given:\n\n');
        expect(hideIncompleteMath('Given:\n\n\\[\na_1\n\\]\n')).toBe('Given:\n\n\\[\na_1\n\\]\n');
    });

    it('hides a display dollar block until its closer arrives', () => {
        expect(hideIncompleteMath('Result:\n\n$$\n\\int_0')).toBe('Result:\n\n');
        expect(hideIncompleteMath('Result:\n\n$$\n\\int_0\n$$\n')).toBe('Result:\n\n$$\n\\int_0\n$$\n');
    });

    it('hides an inline dollar span until its closer arrives', () => {
        expect(hideIncompleteMath('We know $\\frac{a')).toBe('We know ');
        expect(hideIncompleteMath('We know $\\frac{a}{b}$ here')).toBe('We know $\\frac{a}{b}$ here');
    });

    it('hides a custom math tag until its closing tag arrives', () => {
        expect(hideIncompleteMath('Then [/math]\\alpha')).toBe('Then ');
        expect(hideIncompleteMath('Then [/inline]\\alpha')).toBe('Then ');
        expect(hideIncompleteMath('Then [/math]a[/math] ends')).toBe('Then [/math]a[/math] ends');
    });

    it('hides a partial opener the next delta may still complete', () => {
        for (const [input, shown] of [
            ['Let \\', 'Let '],
            ['Let \\\\', 'Let '],
            ['Then [', 'Then '],
            ['Then [/', 'Then '],
            ['Then [/ma', 'Then '],
            ['Then [/math', 'Then '],
            ['Then [/inl', 'Then '],
            ['We know $', 'We know '],
        ]) {
            expect(hideIncompleteMath(input)).toBe(shown);
        }
    });

    it('leaves an inline bracket alone once its line has ended without a closer', () => {
        expect(hideIncompleteMath('Use \\( to open math.\nNext line.\n')).toBe('Use \\( to open math.\nNext line.\n');
    });

    it('leaves a settled price showing', () => {
        expect(hideIncompleteMath('The plan costs $5 per')).toBe('The plan costs $5 per');
        expect(hideIncompleteMath('Costs $5 and $10 tot')).toBe('Costs $5 and $10 tot');
    });

    it('leaves a dollar followed by whitespace showing, which never opens inline math', () => {
        expect(hideIncompleteMath('Roughly $ 40 in total')).toBe('Roughly $ 40 in total');
    });

    it('hides a price word still being typed rather than answering it twice', () => {
        expect(hideIncompleteMath('Costs $5')).toBe('Costs ');
        expect(hideIncompleteMath('Costs $5 ')).toBe('Costs $5 ');
    });

    it('hides a digit led span that turns out to carry latex', () => {
        expect(hideIncompleteMath('Radius \\(2\\pi r')).toBe('Radius ');
        expect(hideIncompleteMath('Radius $2\\pi r')).toBe('Radius ');
    });

    it('leaves math delimiters inside a fenced code block alone', () => {
        for (const fence of ['```', '~~~']) {
            const text = `Run:\n\n${fence}\nlatex = "\\alpha"\nprice = "$5"\nopen = "\\("\n${fence}\n\nDone.\n`;

            expect(hideIncompleteMath(text)).toBe(text);
        }
    });

    it('leaves math delimiters inside an unterminated fenced code block alone', () => {
        const text = 'Run:\n\n```\nlatex = "\\alpha\nopen = "\\(';

        expect(hideIncompleteMath(text)).toBe(text);
    });

    it('leaves math delimiters inside a code span alone', () => {
        expect(hideIncompleteMath('Use `\\alpha` and `$x$` inline.')).toBe('Use `\\alpha` and `$x$` inline.');
        expect(hideIncompleteMath('Use `\\(a\\)` then')).toBe('Use `\\(a\\)` then');
    });

    it('leaves math delimiters inside an indented code block alone', () => {
        const text = 'Example:\n\n    \\[ a = b\n    $5 and \\alpha\n';

        expect(hideIncompleteMath(text)).toBe(text);
    });

    it('leaves a stray display run showing once its paragraph has closed', () => {
        const text =
            'A single $$ appears here.\n\nAnd a whole second paragraph that should still render.\n\nAnd a third.';

        expect(hideIncompleteMath(text)).toBe(text);
    });

    it('leaves a stray display run followed by whitespace showing', () => {
        expect(hideIncompleteMath('A single $$ appears here.')).toBe('A single $$ appears here.');
    });

    it('still hides a display block opened at a fence column, whose body may cross a blank line', () => {
        expect(hideIncompleteMath('$$\nE = mc')).toBe('');
        expect(hideIncompleteMath('$$\na = 1\n\nb = 2')).toBe('');
    });

    it('hides a display block a list marker opens, whose body may cross a blank line too', () => {
        expect(hideIncompleteMath('- $$\n  \\frac{a}{b}\n\n  \\frac{c}{d}')).toBe('- ');
        expect(hideIncompleteMath('1. $$\n   a = 1\n\n   b = 2')).toBe('1. ');
    });

    it('hides a span whose leading capitals run into latex rather than reading it as a shell variable', () => {
        expect(hideIncompleteMath('We have $AB_1 = 2')).toBe('We have ');
        expect(hideIncompleteMath('Let $NP\\subset P')).toBe('Let ');
        expect(hideIncompleteMath('Then $XY^2 = 4')).toBe('Then ');
    });

    it('leaves a shell variable showing rather than blanking the paragraph after it', () => {
        const path = 'Set the $PATH variable first, then run the installer.';
        const home = 'Edit $HOME/.zshrc and reload your shell.';

        expect(hideIncompleteMath(path)).toBe(path);
        expect(hideIncompleteMath(home)).toBe(home);
    });

    it('leaves a cents-only price showing', () => {
        expect(hideIncompleteMath('Costs $.99 today.')).toBe('Costs $.99 today.');
    });

    it('still hides a single letter span, which is inline math being typed', () => {
        expect(hideIncompleteMath('We know $x')).toBe('We know ');
        expect(hideIncompleteMath('Inline $a + b')).toBe('Inline ');
    });

    it('hides only the tail, so the result is always a prefix of its input', () => {
        for (const source of STREAMED) {
            for (let length = 0; length <= source.length; length += 1) {
                const input = source.slice(0, length);

                expect(input.startsWith(hideIncompleteMath(input))).toBe(true);
            }
        }
    });

    it('never pulls back text it has already shown over the streamed corpus', () => {
        const failures: string[] = [];

        for (const source of STREAMED) {
            let previous = '';

            for (let length = 1; length <= source.length; length += 1) {
                const shown = hideIncompleteMath(source.slice(0, length));

                if (!shown.startsWith(previous))
                    failures.push(
                        `${JSON.stringify(source)} @${length}: ${JSON.stringify(previous)} -> ${JSON.stringify(shown)}`,
                    );
                previous = shown;
            }
        }

        expect(failures).toEqual([]);
    });

    it('is a no-op once the text has settled', () => {
        for (const source of STREAMED) expect(hideIncompleteMath(source)).toBe(source);
    });
});

describe('streaming math frames', () => {
    it('shows no raw latex for the reported inline span, and still typesets it on the same frame', () => {
        const before = streamFaults(USER_REPORT, unhidden);
        const after = streamFaults(USER_REPORT, hidden);

        expect(before.rawLatex).toBe(14);
        expect(before.strayDelimiters).toBe(17);
        expect(after.rawLatex).toBe(0);
        expect(after.strayDelimiters).toBe(0);

        const firstMath = (transform: (text: string) => string) => {
            for (let length = 1; length <= USER_REPORT.length; length += 1) {
                if (frameOf(transform(USER_REPORT.slice(0, length))).text.includes('\u2208')) return length;
            }

            return -1;
        };

        expect(firstMath(unhidden)).toBe(23);
        expect(firstMath(hidden)).toBe(23);
    });

    it('shows nothing but the paragraph before it while the reported span streams', () => {
        const shown = new Set<string>();

        for (let length = 1; length <= USER_REPORT.length; length += 1) {
            const text = frameOf(hidden(USER_REPORT.slice(0, length))).text;

            if (!text.includes('\u2208')) shown.add(text);
        }

        expect([...shown]).toEqual(['L', 'Le', 'Let']);
    });

    it('leaks raw latex, stray delimiters and transient blocks without the fix', () => {
        const total = STREAMED.reduce((acc, source) => add(acc, streamFaults(source, unhidden)), EMPTY);

        expect(total.rawLatex).toBeGreaterThan(0);
        expect(total.strayDelimiters).toBeGreaterThan(0);
        expect(total.transientBlocks).toBeGreaterThan(0);
    });

    it('leaks none of them with the fix', () => {
        const failures: string[] = [];

        for (const source of STREAMED) {
            const faults = streamFaults(source, hidden);

            if (faults.rawLatex > 0) failures.push(`${JSON.stringify(source)} rawLatex=${faults.rawLatex}`);
            if (faults.strayDelimiters > 0) failures.push(`${JSON.stringify(source)} stray=${faults.strayDelimiters}`);
            if (faults.transientBlocks > 0)
                failures.push(`${JSON.stringify(source)} transientBlocks=${faults.transientBlocks}`);
        }

        expect(failures).toEqual([]);
    });

    it('adds no prefix break of its own over the streamed corpus', () => {
        const failures: string[] = [];

        for (const source of STREAMED) {
            const before = streamFaults(source, unhidden).prefixBreaks;
            const after = streamFaults(source, hidden).prefixBreaks;

            if (after > before) failures.push(`${JSON.stringify(source)} ${before} -> ${after}`);
        }

        expect(failures).toEqual([]);
    });

    it('keeps every settled character, so hiding only ever delays text', () => {
        for (const source of STREAMED) {
            expect(frameOf(hidden(source)).text).toBe(frameOf(settled(source)).text);
        }
    });
});

describe('streaming math frames over a generated corpus', () => {
    it('covers every opener form, inline and with a body on its own line', () => {
        expect(GENERATED).toHaveLength(SPANS.length * MATH_BODIES.length + BLOCK_SPANS.length * BLOCK_BODIES.length);
    });

    it('leaks raw latex and stray delimiters without the fix', () => {
        const total = GENERATED.reduce((acc, source) => add(acc, streamFaults(source, unhidden)), EMPTY);

        expect(total.rawLatex).toBeGreaterThan(300);
        expect(total.strayDelimiters).toBeGreaterThan(100);
        expect(total.transientBlocks).toBeGreaterThan(0);
    });

    it('leaks none of them with the fix', () => {
        const failures: string[] = [];

        for (const source of GENERATED) {
            const faults = streamFaults(source, hidden);

            if (faults.rawLatex > 0) failures.push(`${JSON.stringify(source)} rawLatex=${faults.rawLatex}`);
            if (faults.strayDelimiters > 0) failures.push(`${JSON.stringify(source)} stray=${faults.strayDelimiters}`);
            if (faults.transientBlocks > 0)
                failures.push(`${JSON.stringify(source)} transientBlocks=${faults.transientBlocks}`);
        }

        expect(failures).toEqual([]);
    });

    it('never pulls back text it has already shown over the generated corpus', () => {
        const failures: string[] = [];

        for (const source of GENERATED) {
            let previous = '';

            for (let length = 1; length <= source.length; length += 1) {
                const shown = hideIncompleteMath(source.slice(0, length));

                if (!shown.startsWith(previous)) failures.push(`${JSON.stringify(source)} @${length}`);
                previous = shown;
            }
        }

        expect(failures).toEqual([]);
    });

    it('is a no-op once the text has settled', () => {
        for (const source of GENERATED) expect(hideIncompleteMath(source)).toBe(source);
    });
});
