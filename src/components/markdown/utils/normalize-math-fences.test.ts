import { escapeCurrencyDollars, normalizeMathDelimiters } from '@assistant-ui/react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

import { KATEX_OPTIONS } from '../constants';

import { applyEdits, collectEdits, collectSelfClosingEdits } from './fence-edits';
import { collectFences } from './fence-scanner';
import { hideIncompleteMath } from './hide-incomplete-math';
import { longerRunSpan } from './longer-runs';
import { normalizeMathFences } from './normalize-math-fences';
import { rehypeKatexFallback } from './rehype-katex-fallback';

const mathParser = unified().use(remarkParse).use(remarkMath);

type MdastNode = {
    type: string;
    position?: { start: { offset?: number }; end: { offset?: number } };
    children?: MdastNode[];
};

type MathNode = { inline: boolean; start: number; end: number };

const mathNodes = (text: string): MathNode[] => {
    const nodes: MathNode[] = [];
    const walk = (node: MdastNode) => {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;

        if ((node.type === 'math' || node.type === 'inlineMath') && start !== undefined && end !== undefined) {
            nodes.push({ inline: node.type === 'inlineMath', start, end });
        }
        for (const child of node.children ?? []) walk(child);
    };

    walk(mathParser.parse(text) as MdastNode);

    return nodes;
};

const CLOSED_FLOW = /\n[ \t>]{0,3}\$\$[ \t]*\r?$/;

const firstLineEnd = (text: string, start: number): number => {
    const newline = text.indexOf('\n', start);

    return newline === -1 ? text.length : newline;
};

const GLUED_RUN = /[^\s$]\$\$|\$\$[^\s$]/;
const META_BREAK = /(?:^|\n)[ \t>]*\$\$$/;
const DISPLAY_DELIMITED = /^\$\$[^\n]*\$\$$/;

/**
 * The body of a math node micromark already read correctly, which the repair must leave alone;
 * `null` for a node carrying the glued-fence symptom itself, which is the one it must re-cut.
 */
const settledBody = (text: string, node: MathNode): [number, number] | null => {
    if (node.inline) return DISPLAY_DELIMITED.test(text.slice(node.start, node.end)) ? null : [node.start, node.end];
    if (!CLOSED_FLOW.test(text.slice(node.start, node.end))) return null;

    const body: [number, number] = [firstLineEnd(text, node.start), node.end];
    const lines = text
        .slice(...body)
        .split('\n')
        .slice(0, -1);

    return lines.some((line) => GLUED_RUN.test(line)) ? null : body;
};

type EditPhase = { text: string; offsets: number[] };

/** `normalizeMathFences` splits self-closing runs on the paired output, so each phase is reported against the text it is actually given. */
const editPhases = (text: string): EditPhase[] => {
    const pairing = collectEdits(text, collectFences(text), longerRunSpan(text));
    const paired = applyEdits(text, pairing);

    return [
        { text, offsets: pairing.map((edit) => edit.start) },
        {
            text: paired,
            offsets: collectSelfClosingEdits(paired, collectFences(paired), longerRunSpan(paired)).map(
                (edit) => edit.start,
            ),
        },
    ];
};

/** A break behind a run that leads its line is the meta repair, which micromark drops from the rendered output either way, so it is the one edit a settled body may receive. */
const phaseEditsInsideSettledMath = ({ text, offsets }: EditPhase): boolean => {
    const outside = offsets.filter((offset) => !META_BREAK.test(text.slice(0, offset)));
    const bodies = mathNodes(text)
        .map((node) => settledBody(text, node))
        .filter((body) => body !== null);

    return outside.some((offset) => bodies.some(([start, end]) => start < offset && offset < end));
};

const editsInsideSettledMath = (text: string): boolean => editPhases(text).some(phaseEditsInsideSettledMath);

const codeParser = unified().use(remarkParse).use(remarkGfm, { singleTilde: false }).use(remarkMath);

const codeRanges = (text: string): [number, number][] => {
    const ranges: [number, number][] = [];
    const walk = (node: MdastNode) => {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;

        if ((node.type === 'code' || node.type === 'inlineCode') && start !== undefined && end !== undefined) {
            ranges.push([start, end]);
        }
        for (const child of node.children ?? []) walk(child);
    };

    walk(codeParser.parse(text) as MdastNode);

    return ranges;
};

const phaseEditsInsideCode = ({ text, offsets }: EditPhase): boolean => {
    const ranges = codeRanges(text);

    return offsets.some((offset) => ranges.some(([start, end]) => start < offset && offset < end));
};

const editsInsideCode = (text: string): boolean => editPhases(text).some(phaseEditsInsideCode);

const preprocess = (text: string) => escapeCurrencyDollars(normalizeMathFences(normalizeMathDelimiters(text)));

const deferredPreprocess = (text: string) =>
    escapeCurrencyDollars(normalizeMathFences(normalizeMathDelimiters(text), true));

const baselinePreprocess = (text: string) => escapeCurrencyDollars(normalizeMathDelimiters(text));

const hiddenPreprocess = (text: string) =>
    escapeCurrencyDollars(normalizeMathFences(normalizeMathDelimiters(hideIncompleteMath(text)), true));

const prefixBreaks = (full: string, transform: (text: string) => string): number => {
    let breaks = 0;
    let previous = transform('');

    for (let length = 1; length <= full.length; length += 1) {
        const current = transform(full.slice(0, length));

        if (!current.startsWith(previous)) breaks += 1;
        previous = current;
    }

    return breaks;
};

type RevealBreaks = { streaming: number; atSettle: number };

/**
 * `useSmooth` answers a prefix break by restarting its reveal from an empty string, so `streaming`
 * must be zero; on a non-running status it commits the whole text in one render instead, which is
 * the exemption `atSettle` records.
 */
const revealBreaks = (full: string): RevealBreaks => ({
    streaming: prefixBreaks(full, deferredPreprocess),
    atSettle: preprocess(full).startsWith(deferredPreprocess(full)) ? 0 : 1,
});

const structurePipeline = unified()
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

const BLOCK_TAGS = new Set([
    'p',
    'blockquote',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'table',
    'thead',
    'tbody',
    'tr',
    'td',
    'th',
    'pre',
    'code',
    'hr',
]);
const MATH_CLASSES = ['katex-display', 'katex', 'math-error', 'katex-error'];

const classesOf = (node: HastNode): string[] => {
    const className = node.properties?.className;

    return Array.isArray(className) ? className.map(String) : [];
};

const pushToken = (tokens: string[], path: string[], label: string) => tokens.push(`${path.join('>')}|${label}`);

const walkSkeleton = (node: HastNode, path: string[], tokens: string[]) => {
    if (node.type === 'text') {
        const text = (node.value ?? '').trim();

        if (text !== '') pushToken(tokens, path, text);

        return;
    }

    if (classesOf(node).some((name) => MATH_CLASSES.includes(name))) {
        pushToken(tokens, path, 'MATH');

        return;
    }

    const next = node.tagName !== undefined && BLOCK_TAGS.has(node.tagName) ? [...path, node.tagName] : path;

    for (const child of node.children ?? []) walkSkeleton(child, next, tokens);
};

/** Comparing block-element chains rather than the html is what catches a repair that moved a paragraph, blockquote, list item, heading or table row rather than only re-cutting math inside one. */
const blockSkeleton = (markdown: string): string[] => {
    const tokens: string[] = [];

    walkSkeleton(structurePipeline.runSync(structurePipeline.parse(markdown)) as HastNode, [], tokens);

    return tokens;
};

const promotedFrom = (path: string): string => (path === '' ? 'p' : `${path}>p`);

/** Promoting inline math to a display block drops the paragraph micromark had wrapped it in, and nothing else. */
const isPromotion = (before: string, after: string): boolean =>
    after.endsWith('|MATH') && before === `${promotedFrom(after.slice(0, -'|MATH'.length))}|MATH`;

const structuralRegressions = (input: string): string[] => {
    const before = blockSkeleton(baselinePreprocess(input));
    const after = blockSkeleton(preprocess(input));

    if (before.length !== after.length)
        return [`${JSON.stringify(input)} token count ${before.length} -> ${after.length}`];

    return before
        .map((token, index) => [token, after[index]] as const)
        .filter(([left, right]) => left !== right && !isPromotion(left, right))
        .map(([left, right]) => `${JSON.stringify(input)} ${left} -> ${right}`);
};

const pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm, { singleTilde: false })
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex, KATEX_OPTIONS)
    .use(rehypeKatexFallback)
    .use(rehypeStringify);

const render = (markdown: string) => String(pipeline.processSync(preprocess(markdown)));

const GLUED_CLOSING_FENCE = [
    '$$',
    "\\langle J'(u), v\\rangle",
    '= \\int_\\Omega \\nabla u\\cdot\\nabla v\\,dx -\\lambda\\int_\\Omega uv\\,dx -\\int_\\Omega |u|^{p-1}uv\\,dx.$$',
    '',
    'So we conclude.',
    '',
].join('\n');

const UNBALANCED_INLINE = [
    'We obtain $c < \\frac{1}{n}S^{n/2}.$$',
    '',
    '### Next step',
    '',
    '**Bold** text and:',
    '',
    '- a bullet',
    '',
].join('\n');

const LATEX_BRACKET_BLOCK = ['Intro.', '', '\\[', '### Head', '- item', '\\]', '', 'After.', ''].join('\n');

const DOUBLE_BACKSLASH_BRACKET_BLOCK = LATEX_BRACKET_BLOCK.replace('\\[', '\\\\[').replace('\\]', '\\\\]');

const SINGLE_LINE_BRACKET_BLOCK = 'Intro.\n\n\\[ x^2 + y^2 = z^2 \\]\n\nAfter.\n';

const DOUBLE_BACKSLASH_SINGLE_LINE = SINGLE_LINE_BRACKET_BLOCK.replace('\\[', '\\\\[').replace('\\]', '\\\\]');

const MULTI_BLOCK = [
    '## Setup',
    '',
    '$$',
    'a^2 + b^2 = c^2',
    '$$',
    '',
    'Then, inline $x + y$ and:',
    '',
    '$$',
    '\\int_0^1 x\\,dx = \\frac{1}{2}',
    '$$',
    '',
    'Finally $$e^{i\\pi} = -1$$ inline display.',
    '',
].join('\n');

describe('normalizeMathFences', () => {
    it('moves a closing fence glued to the last content line onto its own line', () => {
        expect(normalizeMathFences('$$\nx = 1\ny = 2.$$\n')).toBe('$$\nx = 1\ny = 2.\n$$\n');
    });

    it('moves content glued after an opening fence onto its own line', () => {
        expect(normalizeMathFences('$$x = 1\ny = 2\n$$\n')).toBe('$$\nx = 1\ny = 2\n$$\n');
    });

    it('leaves a well-formed own-line fence untouched', () => {
        const text = '$$\na^2 + b^2 = c^2\n$$\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves same-line inline display math untouched', () => {
        const text = 'Euler wrote $$e^{i\\pi} = -1$$ once.\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves a fence without a partner alone', () => {
        const text = 'We obtain $c < 1.$$\n\n### Next\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('does not escape a valid closer when a stray run shifts the pairing', () => {
        const text = '$$\na=1\n$$\n\nstray.$$\n\n$$\nb=2\n$$\n\nConclusion paragraph.\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('does not escape valid inline display math after a stray run', () => {
        const text = 'Oops.$$\n\nEuler $$e^{i\\pi}=-1$$ here.\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves the opener of an in flight display block alone', () => {
        const partial = 'Result:\n\n$$\n\\int_0^1 x';

        expect(normalizeMathFences(partial)).toBe(partial);
    });

    it('leaves a closed display block alone once its fence arrives', () => {
        const text = 'Intro.\n\n$$\na = 1\n$$\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves a line start run that closes an inline run from the same paragraph alone', () => {
        const text = 'See $$\nx = 1\n$$\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves fences inside an indented code block untouched', () => {
        const text = 'Example:\n\n    $$\n    x = 1.$$\n\ntail\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('keeps a repaired fence inside its list item indentation', () => {
        expect(normalizeMathFences('- item\n\n  $$\n  x = 1.$$\n\ntail\n')).toBe(
            '- item\n\n  $$\n  x = 1.\n  $$\n\ntail\n',
        );
    });

    it('does not insert a break in front of a code fence run', () => {
        const text = '$$```\r\n$$\nx`~~~\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('treats a carriage return as a line terminator and inserts the document line ending', () => {
        expect(normalizeMathFences('$$\r\nx=1\r\ny=2.$$\r\n')).toBe('$$\r\nx=1\r\ny=2.\r\n$$\r\n');
    });

    it('inserts a bare newline into a document that uses them', () => {
        expect(normalizeMathFences('a\n\n$$\nx.$$\n')).toBe('a\n\n$$\nx.\n$$\n');
    });

    it('inserts a carriage return pair into a document that uses them', () => {
        expect(normalizeMathFences('a\r\n\r\n$$\r\nx.$$\r\n')).toBe('a\r\n\r\n$$\r\nx.\r\n$$\r\n');
    });

    it('repairs every glued block in a message, not just the first', () => {
        expect(normalizeMathFences('$$\na.$$\n\ntext\n\n$$\nb.$$\n')).toBe('$$\na.\n$$\n\ntext\n\n$$\nb.\n$$\n');
    });

    it('repairs three glued blocks', () => {
        expect(normalizeMathFences('$$\na.$$\n\nx\n\n$$\nb.$$\n\ny\n\n$$\nc.$$\n')).toBe(
            '$$\na.\n$$\n\nx\n\n$$\nb.\n$$\n\ny\n\n$$\nc.\n$$\n',
        );
    });

    it('repairs four glued blocks', () => {
        expect(normalizeMathFences('$$\na.$$\n\n$$\nb.$$\n\n$$\nc.$$\n\n$$\nd.$$\n')).toBe(
            '$$\na.\n$$\n\n$$\nb.\n$$\n\n$$\nc.\n$$\n\n$$\nd.\n$$\n',
        );
    });

    it('repairs a glued block that follows a well formed one', () => {
        expect(normalizeMathFences('$$\na = 1\n$$\n\ntext\n\n$$\nb.$$\n\ntail\n')).toBe(
            '$$\na = 1\n$$\n\ntext\n\n$$\nb.\n$$\n\ntail\n',
        );
    });

    it('repairs a glued block that precedes a well formed one', () => {
        expect(normalizeMathFences('$$\na.$$\n\ntext\n\n$$\nb = 2\n$$\n\ntail\n')).toBe(
            '$$\na.\n$$\n\ntext\n\n$$\nb = 2\n$$\n\ntail\n',
        );
    });

    it('repairs two glued blocks inside a blockquote', () => {
        expect(normalizeMathFences('> $$\n> a.$$\n>\n> $$\n> b.$$\n\ntail\n')).toBe(
            '> $$\n> a.\n> $$\n>\n> $$\n> b.\n> $$\n\ntail\n',
        );
    });

    it('repairs two glued blocks inside list items', () => {
        expect(normalizeMathFences('- one\n\n  $$\n  a.$$\n\n- two\n\n  $$\n  b.$$\n\ntail\n')).toBe(
            '- one\n\n  $$\n  a.\n  $$\n\n- two\n\n  $$\n  b.\n  $$\n\ntail\n',
        );
    });

    it('repairs a glued block and splits an earlier self closing display run onto its own lines', () => {
        expect(
            normalizeMathFences('The formula:\n\n$$E = mc^2$$\n\nNow:\n\n$$\n\\int x\\,dx.$$\n\nMore prose.\n'),
        ).toBe('The formula:\n\n$$\nE = mc^2\n$$\n\nNow:\n\n$$\n\\int x\\,dx.\n$$\n\nMore prose.\n');
    });

    it('repairs a glued block when prose merely mentions the delimiter', () => {
        expect(normalizeMathFences('Use $$ for math.\n\n$$\nx.$$\n')).toBe('Use $$ for math.\n\n$$\nx.\n$$\n');
    });

    it('leaves a fence inside an html block alone', () => {
        const text = '<div>\n$$\n</div>\n\nCost is 5$$ total.\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves fences inside an html comment alone', () => {
        const text = '<!--\n$$\nx = 1.$$\n-->\n\ntail\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves fences inside a raw text html block alone', () => {
        const text = '<script>\n$$\nx = 1.$$\n</script>\n\ntail\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('still repairs a glued fence that follows an html block', () => {
        expect(normalizeMathFences('<div>\nhi\n</div>\n\n$$\nx = 1.$$\n\ntail\n')).toBe(
            '<div>\nhi\n</div>\n\n$$\nx = 1.\n$$\n\ntail\n',
        );
    });

    it('leaves a mid line opener alone', () => {
        const text = 'See $$\nx = 1.$$\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves an inline fence pair inside a list item alone', () => {
        const text = '- We get $$\n  x = 1.$$\n\ntail\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves dollar signs used as price tiers in bullets alone', () => {
        const text = '- Cafe A: $$ (cheap)\n- Cafe B: $$ (mid)\n\ntail\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves dollar signs used as price tiers in a table alone', () => {
        const text = '| Name | Price |\n| - | - |\n| A | $$ |\n| B | $$ |\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves a well formed blockquoted block alone', () => {
        const text = '> $$\n> \\int_0^1 x\\,dx = \\frac{1}{2}\n> $$\n\ntail\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('repairs a glued blockquoted fence inside the quote', () => {
        expect(normalizeMathFences('> $$\n> x = 1.$$\n\ntail\n')).toBe('> $$\n> x = 1.\n> $$\n\ntail\n');
    });

    it('repairs a glued fence inside a nested quote', () => {
        expect(normalizeMathFences('> > $$\n> > x = 1.$$\n\ntail\n')).toBe('> > $$\n> > x = 1.\n> > $$\n\ntail\n');
    });

    it('leaves fences inside a tab indented code block untouched', () => {
        const text = 'Example:\n\n\t$$\n\tx = 1.$$\n\ntail\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves fences inside an indented code block that follows a heading untouched', () => {
        const text = '# H\n    $$\n    x=1.$$\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves fences inside an indented code block that follows a table untouched', () => {
        const text = '| a |\n| - |\n    $$\n    x=1.$$\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves fences inside a tilde fenced code block opened after a hard break line untouched', () => {
        const text = 'Note \\\n~~~\n$$\nx = 1.$$\n~~~\n\ntail\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves fences inside a fenced code block opened after an unclosed inline code span untouched', () => {
        const text = 'a `b\n```\n$$\nx = 1$$\n```';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('repairs a glued closer whose block body holds an unclosed inline code span', () => {
        expect(normalizeMathFences('$$\na `b\nx = 1$$\nc ` d')).toBe('$$\na `b\nx = 1\n$$\nc ` d');
    });

    it('repairs past an odd currency run a blank line away, which can never be a delimiter for it', () => {
        expect(normalizeMathFences('Cost is $$5 per unit.\n\n$$\nE=mc^2\n$$more text')).toBe(
            'Cost is $$5 per unit.\n\n$$\nE=mc^2\n$$\nmore text',
        );
    });

    it('accepts that a run behind a blockquote marker is reflowed even though it still cannot close the block', () => {
        expect(normalizeMathFences('$$\nx=1\n> $$ tail')).toBe('$$\nx=1\n> $$\n tail');
    });

    it('leaves fences inside a fenced code block untouched', () => {
        const text = '```md\n$$\nx = 1.$$\n```\n\ntail\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves fences inside a tilde fenced code block untouched', () => {
        const text = '~~~\n$$ glued.$$\n~~~\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves fences inside an inline code span untouched', () => {
        const text = 'Type `$$x.$$` to start.\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('does not process an already escaped dollar pair', () => {
        const text = 'Costs \\$\\$ a lot.\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('does not pair a mid line run with a run that starts a line', () => {
        const text = 'See $$\nx = 1\n$$\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('does not pair a mid line run with a line start run on the next line', () => {
        const text = 'x = 1- item$$\n$$```\n\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('does not throw on text that ends mid math and keeps earlier content', () => {
        const partial = 'Intro text.\n\n$$\n\\int_\\Omega ';

        expect(() => normalizeMathFences(partial)).not.toThrow();
        expect(normalizeMathFences(partial)).toContain('Intro text.');
    });

    it('splits the single line block normalizeMathDelimiters produces from a latex bracket block', () => {
        expect(normalizeMathFences(normalizeMathDelimiters(LATEX_BRACKET_BLOCK))).toBe(
            'Intro.\n\n$$\n### Head\n- item\n$$\n\nAfter.\n',
        );
    });

    it('splits the double backslash bracket form the same way', () => {
        expect(normalizeMathFences(normalizeMathDelimiters(DOUBLE_BACKSLASH_BRACKET_BLOCK))).toBe(
            'Intro.\n\n$$\n### Head\n- item\n$$\n\nAfter.\n',
        );
    });

    it('leaves a stray fence separated by blank lines paired with a later one', () => {
        const text = 'Intro.\n\n$$\n\nTail.\n\n$$\n\nEnd.\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('does not promote trailing content that carries another dollar run', () => {
        const text = '$$\n\n$$ $$- \n$$x';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves text containing a longer dollar run untouched', () => {
        const text = '$$**b**$$$$- item$$$$**b**\n$$\\,- item\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('repairs a glued closer in a message whose prose mentions a dollar tier', () => {
        const text = 'Result:\n\n$$\nE = mc^2.$$\n\nPricing tiers are $, $$ and $$$ respectively.\n';

        expect(normalizeMathFences(text)).toBe(
            'Result:\n\n$$\nE = mc^2.\n$$\n\nPricing tiers are $, $$ and $$$ respectively.\n',
        );
    });

    it('repairs the blocks on either side of a longer run in prose', () => {
        const text = '$$\na = 1.$$\n\nTiers $$$ here.\n\n$$\nb = 2.$$\n';

        expect(normalizeMathFences(text)).toBe('$$\na = 1.\n$$\n\nTiers $$$ here.\n\n$$\nb = 2.\n$$\n');
    });

    it('is not disabled by a longer run inside a fenced code block or a code span', () => {
        expect(normalizeMathFences('```\n$$$\n```\n\n$$\na = 1.$$\n')).toBe('```\n$$$\n```\n\n$$\na = 1.\n$$\n');
        expect(normalizeMathFences('Use `$$$` inline.\n\n$$\na = 1.$$\n')).toBe(
            'Use `$$$` inline.\n\n$$\na = 1.\n$$\n',
        );
    });

    it('leaves a message whose longer run opens a fence of its own length untouched', () => {
        const text = '$$$\nx\n$$$\n\n$$\na = 1.$$\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves a message whose longer run opens a fence at a list item content start untouched', () => {
        const text = '* $$$\n  $$ a\n  b $$\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves fences inside an indented code block that follows a thematic break untouched', () => {
        for (const rule of ['---', '***', '___']) {
            const text = `${rule}\n    $$\n    x = 1.$$\n\ntail\n`;

            expect(normalizeMathFences(text)).toBe(text);
        }
    });

    it('leaves fences inside an indented code block that follows a setext underline untouched', () => {
        for (const underline of ['=====', '-----']) {
            const text = `Title\n${underline}\n    $$\n    x = 1.$$\n\ntail\n`;

            expect(normalizeMathFences(text)).toBe(text);
        }
    });

    it('repairs a glued closer whose trailing text carries a currency amount', () => {
        expect(
            normalizeMathFences('Total:\n\n$$\nc = 3.$$ which comes to $42 per unit.\n\nThanks for reading.\n'),
        ).toBe('Total:\n\n$$\nc = 3.\n$$\n which comes to $42 per unit.\n\nThanks for reading.\n');
    });

    it('leaves a glued closer whose trailing text carries another dollar pair alone', () => {
        const text = 'Total:\n\n$$\nc = 3.$$ and $$d = 4$$ too.\n\ntail\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('returns the text unchanged while the message is still streaming', () => {
        for (const input of [
            GLUED_CLOSING_FENCE,
            '> $$\n> x = 1.$$\n\ntail\n',
            '- item\n\n  $$\n  x = 1.$$\n\ntail\n',
        ]) {
            expect(normalizeMathFences(input, true)).toBe(input);
            expect(normalizeMathFences(input, false)).not.toBe(input);
        }
    });

    it('repairs by default, so a caller that omits the flag gets the settled path', () => {
        expect(normalizeMathFences(GLUED_CLOSING_FENCE)).toBe(normalizeMathFences(GLUED_CLOSING_FENCE, false));
        expect(normalizeMathFences(GLUED_CLOSING_FENCE)).not.toBe(GLUED_CLOSING_FENCE);
    });

    it('leaves a run that opens a list item alone rather than picking it as a closer', () => {
        expect(normalizeMathFences('$$\na = 1\n\n$$\nx\n$$\n\n- $$\n- b.$$\n')).toBe(
            '$$\na = 1\n\n$$\nx\n$$\n\n- $$\n- b.\n$$\n',
        );
    });

    it('leaves a display block opening a list item alone for every marker form', () => {
        for (const marker of ['- ', '* ', '+ ', '1. ', '1) ']) {
            const input = `${marker}$$\n${' '.repeat(marker.length)}a.$$\n\ntail\n`;

            expect(normalizeMathFences(input)).toBe(input);
        }
    });

    it('leaves a display block opening a nested or quoted list item alone', () => {
        for (const input of ['- a\n  - $$\n    x.$$\n\ntail\n', '> - $$\n>   x.$$\n\ntail\n']) {
            expect(normalizeMathFences(input)).toBe(input);
        }
    });

    it('repairs a shallower block that follows a quoted one, in either order', () => {
        expect(normalizeMathFences('> $$\n> a.$$\n>\n> text\n\n$$\nb.$$\n\ntail\n')).toBe(
            '> $$\n> a.\n> $$\n>\n> text\n\n$$\nb.\n$$\n\ntail\n',
        );
        expect(normalizeMathFences('$$\na.$$\n\n> $$\n> b.$$\n')).toBe('$$\na.\n$$\n\n> $$\n> b.\n> $$\n');
    });

    it('keeps a raw text html block open until its full closing tag', () => {
        const input = '<pre>\nliteral\n</preview>\n\n$$\na.$$\n\ntail\n';

        expect(normalizeMathFences(input)).toBe(input);
    });

    it('repairs a block whose paragraph holds a line starting with a tag', () => {
        expect(normalizeMathFences('<b>x</b> y\n<br/>\n$$\na.$$\n\ntail\n')).toBe(
            '<b>x</b> y\n<br/>\n$$\na.\n$$\n\ntail\n',
        );
    });

    it('splits a self closing display run that is its line whole content', () => {
        expect(normalizeMathFences(normalizeMathDelimiters(SINGLE_LINE_BRACKET_BLOCK))).toBe(
            'Intro.\n\n$$\nx^2 + y^2 = z^2\n$$\n\nAfter.\n',
        );
    });

    it('splits the double backslash single line form the same way', () => {
        expect(normalizeMathFences(normalizeMathDelimiters(DOUBLE_BACKSLASH_SINGLE_LINE))).toBe(
            'Intro.\n\n$$\nx^2 + y^2 = z^2\n$$\n\nAfter.\n',
        );
    });

    it('leaves a self closing run inside a fenced code block untouched', () => {
        for (const fence of ['```', '~~~']) {
            const text = `${fence}\n$$a = b$$\n${fence}\n`;

            expect(normalizeMathFences(text)).toBe(text);
        }
    });

    it('leaves a self closing run inside a code span untouched', () => {
        const text = 'Use `$$a = b$$` here.\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves a self closing run inside an open display block untouched', () => {
        const text = '$$\na = 1\n$$x$$\nb = 2\n$$\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('leaves a self closing run after a list marker untouched', () => {
        for (const marker of ['- ', '* ', '1. ', '> - ']) {
            const text = `${marker}$$a = b$$\n`;

            expect(normalizeMathFences(text)).toBe(text);
        }
    });

    it('leaves a self closing run on a paragraph continuation line untouched', () => {
        for (const text of [
            'Text `code\n$$a = b$$\nmore` text\n',
            '> quote\n$$a = b$$\n',
            '- item\n$$a = b$$\n',
            '1. one\n$$a = b$$\n',
            'Head\n$$a = b$$\n---\n',
            '$$a = b$$\n===\n',
            '| a |\n| - |\n$$a = b$$\n',
            'Text before\n$$a = b$$\ntext after\n',
            '## Head\n$$a = b$$\n',
        ]) {
            expect(normalizeMathFences(text)).toBe(text);
        }
    });

    it('splits a self closing run whose neighbours are its container blank line', () => {
        expect(normalizeMathFences('> quote\n>\n> $$a = b$$\n')).toBe('> quote\n>\n> $$\n> a = b\n> $$\n');
        expect(normalizeMathFences('- item\n\n  $$a = b$$\n\ntail\n')).toBe('- item\n\n  $$\n  a = b\n  $$\n\ntail\n');
    });

    it('leaves a mid paragraph self closing run untouched', () => {
        for (const text of ['We get $$a = b$$ and then more.\n', '$$a = b$$ and then more.\n']) {
            expect(normalizeMathFences(text)).toBe(text);
        }
    });

    it('leaves a self closing run indented past the fence column untouched', () => {
        const text = 'Head\n\n    $$a = b$$\n\ntail\n';

        expect(normalizeMathFences(text)).toBe(text);
    });

    it('keeps the container prefix on the lines it inserts for a self closing run', () => {
        expect(normalizeMathFences('> $$a = b$$\n')).toBe('> $$\n> a = b\n> $$\n');
        expect(normalizeMathFences('> > $$a = b$$\n')).toBe('> > $$\n> > a = b\n> > $$\n');
    });

    it('splits a self closing run left inside the flow block a glued closer had held open', () => {
        expect(normalizeMathFences('Intro.\n\n$$\nF = ma.$$\n\n$$E = mc^2$$\n\nClosing.\n')).toBe(
            'Intro.\n\n$$\nF = ma.\n$$\n\n$$\nE = mc^2\n$$\n\nClosing.\n',
        );
    });

    it('keeps carriage return line endings when splitting a self closing run', () => {
        expect(normalizeMathFences('Intro.\r\n\r\n$$a = b$$\r\n\r\nAfter.\r\n')).toBe(
            'Intro.\r\n\r\n$$\r\na = b\r\n$$\r\n\r\nAfter.\r\n',
        );
    });

    it('is idempotent', () => {
        const inputs = [
            GLUED_CLOSING_FENCE,
            UNBALANCED_INLINE,
            MULTI_BLOCK,
            normalizeMathDelimiters(LATEX_BRACKET_BLOCK),
            normalizeMathDelimiters(SINGLE_LINE_BRACKET_BLOCK),
            normalizeMathDelimiters(DOUBLE_BACKSLASH_SINGLE_LINE),
            '> $$a = b$$\n',
            '> > $$a = b$$\n',
            'Intro.\r\n\r\n$$a = b$$\r\n\r\nAfter.\r\n',
            '$$\na = 1\n$$x$$\nb = 2\n$$\n',
            '- $$a = b$$\n',
            'We get $$a = b$$ and then more.\n',
            'Head\n\n    $$a = b$$\n\ntail\n',
            '```\n$$a = b$$\n```\n',
            'Use `$$a = b$$` here.\n',
            'Intro.\n\n$$\nF = ma.$$\n\n$$E = mc^2$$\n\nClosing.\n',
            '$$x = 1\ny = 2.$$\n',
            'Intro text.\n\n$$\n\\int_\\Omega ',
            '```\n$$ x.$$\n```\n',
            '$$```\r\n$$\nx`~~~\n',
            'Oops.$$\n\nEuler $$e^{i\\pi}=-1$$ here.\n',
            '$$\na=1\n$$\n\nstray.$$\n\n$$\nb=2\n$$\n\nConclusion paragraph.\n',
            'Example:\n\n    $$\n    x = 1.$$\n\ntail\n',
            '- item\n\n  $$\n  x = 1.$$\n\ntail\n',
            'See $$\nx = 1.$$\n',
            '> $$\n> x = 1.$$\n\ntail\n',
            '> > $$\n> > x = 1.$$\n\ntail\n',
            '- Cafe A: $$ (cheap)\n- Cafe B: $$ (mid)\n\ntail\n',
            '| Name | Price |\n| - | - |\n| A | $$ |\n| B | $$ |\n',
            'Example:\n\n\t$$\n\tx = 1.$$\n\ntail\n',
            '# H\n    $$\n    x=1.$$\n',
            '$$\n\n$$ $$- \n$$x',
            'x = 1- item$$\n$$```\n\n',
            '$$\r\nx=1\r\ny=2.$$\r\n',
            '---\n    $$\n    x = 1.$$\n\ntail\n',
            'Title\n=====\n    $$\n    x = 1.$$\n\ntail\n',
            'Total:\n\n$$\nc = 3.$$ which comes to $42 per unit.\n\nThanks for reading.\n',
            'Result:\n\n$$\n\\int_0^1 x',
            '$$\na = 1\n$$\n\nNext:\n\n$$\nb = \\frac{1',
            'a `b\n```\n$$\nx = 1$$\n```',
            '$$\na `b\nx = 1$$\nc ` d',
            '- $$\n  a.$$\n\ntail\n',
            '1. $$\n   a.$$\n\ntail\n',
            '> - $$\n>   x.$$\n\ntail\n',
            '$$\na = 1\n\n$$\nx\n$$\n\n- $$\n- b.$$\n',
            '<pre>\nliteral\n</preview>\n\n$$\na.$$\n\ntail\n',
            '<b>x</b> y\n<br/>\n$$\na.$$\n\ntail\n',
        ];

        for (const input of inputs) {
            const once = normalizeMathFences(input);

            expect(normalizeMathFences(once)).toBe(once);
        }
    });
});

const BLOCK_SEEDS = 2500;
const PREFIX_SEEDS = 80;

const PREFIXES = [
    '',
    'Intro text.\n\n',
    '## Setup\n\n',
    '- item\n\n',
    '---\n\n',
    'Title\n=====\n\n',
    '| a |\n| - |\n\n',
    '```\nfenced\n```\n\n',
    'Given \\(a_1\\).\n\n',
    'Given \\\\(a_1\\\\).\n\n',
];
const INDENTS = ['', '  ', '   ', '    ', '> ', '> > '];
const OPENERS = ['$$', '$$x = 1', '$$ label', '$$\\alpha'];
const BODIES = ['a^2 + b^2 = c^2', '\\int_0^1 x\\,dx', '### Head', '- item', 'x + y'];
const CLOSERS = ['$$', 'y = 2.$$', 'y = 2.$$ trailing text', 'y = 2.$$ costs $5', 'y = 2.$$ and $$z$$', '\\,dx.$$'];
const TRAILERS = [
    '',
    '\ntail\n',
    '\nEuler $$e^{i\\pi}$$ here.\n',
    '\n`$$x.$$`\n',
    '\nAlso \\(x_1\\) here.\n',
    '\n\\[\na = b\n\\]\n',
    '\nTag [/math]c[/math] here.\n',
];

const build = (seed: number) => {
    let state = seed;
    const pick = <T>(list: T[]): T => {
        state = (state + 0x6d2b79f5) | 0;
        let mixed = Math.imul(state ^ (state >>> 15), state | 1);

        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

        return list[Math.floor((((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296) * list.length)];
    };
    const indent = pick(INDENTS);
    const block = [pick(OPENERS), pick(BODIES), pick(CLOSERS)].map((line) => `${indent}${line}\n`).join('');

    return pick(PREFIXES) + block + pick(TRAILERS);
};

describe('normalizeMathFences fuzz', () => {
    it('rewrites the majority of generated blocks and is idempotent over them', () => {
        const failures: string[] = [];
        let rewritten = 0;

        for (let seed = 1; seed <= BLOCK_SEEDS; seed += 1) {
            const input = build(seed);
            const once = normalizeMathFences(input);

            if (once !== input) rewritten += 1;
            if (normalizeMathFences(once) !== once) failures.push(JSON.stringify(input));
        }

        expect(failures).toEqual([]);
        expect(rewritten / BLOCK_SEEDS).toBeGreaterThan(0.5);
    });

    const TOKENS = [
        '$$',
        '$',
        '\n',
        '\r\n',
        '```',
        '~~~',
        '`',
        'x',
        ' ',
        '    ',
        '\t',
        '> ',
        '\\',
        '\\$',
        '- ',
        '#',
        '| a |',
        '\n\n',
        '$$$',
    ];

    const soup = (seed: number) => {
        let state = seed;
        const next = () => {
            state = (state * 1103515245 + 12345) % 2147483648;

            return state;
        };
        const length = 3 + (next() % 9);
        let out = '';

        for (let index = 0; index < length; index += 1) out += TOKENS[next() % TOKENS.length];

        return out;
    };

    it('is idempotent over generated token soup', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= BLOCK_SEEDS; seed += 1) {
            const once = normalizeMathFences(soup(seed));

            if (normalizeMathFences(once) !== once) failures.push(JSON.stringify(once));
        }

        expect(failures).toEqual([]);
    });

    it('never inserts a break inside a math node the baseline parse already closed', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= BLOCK_SEEDS; seed += 1) {
            for (const input of [build(seed), soup(seed)]) {
                if (editsInsideSettledMath(input)) failures.push(JSON.stringify(input));
            }
        }

        expect(failures).toEqual([]);
    });

    it('never inserts such a break at any prefix of a generated block', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= PREFIX_SEEDS; seed += 1) {
            const full = build(seed);

            for (let length = 0; length <= full.length; length += 1) {
                if (editsInsideSettledMath(full.slice(0, length))) failures.push(JSON.stringify(full.slice(0, length)));
            }
        }

        expect(failures).toEqual([]);
    });

    it('leaves the streaming pipeline byte identical to the baseline that repairs nothing', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= BLOCK_SEEDS; seed += 1) {
            const input = build(seed);

            if (deferredPreprocess(input) !== baselinePreprocess(input)) failures.push(JSON.stringify(input));
        }

        expect(failures).toEqual([]);
    });

    /** The residual breaks belong to `escapeCurrencyDollars` and `normalizeMathDelimiters` upstream, both of which shorten text already shown with or without this repair. */
    it('adds no prefix break of its own beyond the ones the upstream transforms already contribute', () => {
        const failures: string[] = [];
        let breaking = 0;

        for (let seed = 1; seed <= PREFIX_SEEDS; seed += 1) {
            const full = build(seed);
            const { streaming } = revealBreaks(full);

            if (streaming > 0) breaking += 1;
            if (streaming !== prefixBreaks(full, baselinePreprocess)) failures.push(JSON.stringify(full));
        }

        expect(failures).toEqual([]);
        expect(breaking).toBe(45);
    });

    it('spends far fewer of those breaks once incomplete math is hidden', () => {
        let breaking = 0;

        for (let seed = 1; seed <= PREFIX_SEEDS; seed += 1) {
            if (prefixBreaks(build(seed), hiddenPreprocess) > 0) breaking += 1;
        }

        expect(breaking).toBeLessThan(10);
    });

    it('never spends more than the one settle transition over the generated corpus', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= PREFIX_SEEDS; seed += 1) {
            const full = build(seed);
            const { atSettle } = revealBreaks(full);
            const repairs = preprocess(full) !== deferredPreprocess(full);

            if (atSettle === 1 && !repairs && failures.length < 5) failures.push(JSON.stringify(full));
        }

        expect(failures).toEqual([]);
    });
});

const MULTI_INDENTS = ['', '  ', '> ', '> > '];
const MULTI_OPENERS = ['$$', '$$ label', '$$x = 1'];
const MULTI_BODIES = ['a^2 + b^2 = c^2', '\\int_0^1 x\\,dx', 'E = mc^2', '\\sum_n \\frac{1}{n^2}'];
const MULTI_CLOSERS = ['$$', 'y = 2.$$', '\\,dx.$$', 'y = 2.$$ trailing text', '$$'];
const MULTI_JOINS = [
    '\n',
    '\nSo far so good.\n\n',
    '\n### Next\n\n',
    '\n- one\n- two\n\n',
    '\nThen \\(a_1\\) holds.\n\n',
    '\nThen \\[\nb_2\n\\] holds.\n\n',
];

const random = (seed: number) => {
    let state = seed;

    return <T>(list: T[]): T => {
        state = (state + 0x6d2b79f5) | 0;
        let mixed = Math.imul(state ^ (state >>> 15), state | 1);

        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

        return list[Math.floor((((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296) * list.length)];
    };
};

const buildMulti = (seed: number): string => {
    const pick = random(seed);
    const count = 2 + (Math.abs(seed * 2654435761) % 4);
    let out = pick(['', 'Here is the derivation.\n\n', '## Derivation\n\n']);

    for (let block = 0; block < count; block += 1) {
        const indent = pick(MULTI_INDENTS);

        out += [pick(MULTI_OPENERS), pick(MULTI_BODIES), pick(MULTI_CLOSERS)]
            .map((line) => `${indent}${line}\n`)
            .join('');
        out += block === count - 1 ? pick(['', '\nDone.\n']) : pick(MULTI_JOINS);
    }

    return out;
};

const LIST_MARKERS = ['- ', '* ', '1. ', '  - ', '> - '];
const LIST_TAILS = ['', '\nAlso \\(a_1\\) here.\n', '\nAlso \\[\nb_2\n\\] here.\n'];
const LIST_CONTINUATIONS: Record<string, string> = {
    '- ': '  ',
    '* ': '  ',
    '1. ': '   ',
    '  - ': '    ',
    '> - ': '>   ',
};

const buildList = (seed: number): string => {
    const pick = random(seed);
    const count = 1 + (Math.abs(seed * 2654435761) % 3);
    let out = pick(['', 'Steps:\n\n']);

    for (let item = 0; item < count; item += 1) {
        const marker = pick(LIST_MARKERS);
        const continuation = LIST_CONTINUATIONS[marker];

        out += `${marker}${pick(MULTI_OPENERS)}\n${continuation}${pick(MULTI_BODIES)}\n${continuation}${pick(MULTI_CLOSERS)}\n`;
        out += item === count - 1 ? pick(['', '\nDone.\n']) : pick(MULTI_JOINS);
    }

    return out + pick(LIST_TAILS);
};

describe('normalizeMathFences list container fuzz', () => {
    const SEEDS = 1500;

    it('is idempotent over generated list item blocks', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            const once = normalizeMathFences(buildList(seed));

            if (normalizeMathFences(once) !== once) failures.push(JSON.stringify(buildList(seed)));
        }

        expect(failures).toEqual([]);
    });

    it('never inserts a break inside a math node the baseline parse already closed', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            if (editsInsideSettledMath(buildList(seed))) failures.push(JSON.stringify(buildList(seed)));
        }

        expect(failures).toEqual([]);
    });

    it('never inserts a break inside a code block or code span', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            if (editsInsideCode(buildList(seed))) failures.push(JSON.stringify(buildList(seed)));
        }

        expect(failures).toEqual([]);
    });

    it('leaves the deferred pipeline byte identical to the baseline that repairs nothing', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            const input = buildList(seed);

            if (deferredPreprocess(input) !== baselinePreprocess(input)) failures.push(JSON.stringify(input));
        }

        expect(failures).toEqual([]);
    });

    it('adds no prefix break of its own beyond the ones escapeCurrencyDollars already contributes', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= PREFIX_SEEDS; seed += 1) {
            const full = buildList(seed);

            if (prefixBreaks(full, deferredPreprocess) !== prefixBreaks(full, baselinePreprocess))
                failures.push(JSON.stringify(full));
        }

        expect(failures).toEqual([]);
    });
});

const RUN_INDENTS = ['', ' ', '  ', '   ', '    ', '> ', '> > ', '- ', '1. '];
const RUN_BODIES = [
    'a^2 + b^2 = c^2',
    '\\int_0^1 x\\,dx',
    '### Head',
    '- item',
    'x + y',
    ' spaced ',
    '```',
    '\\frac{a',
    '>',
];
const RUN_CONTEXTS = [
    '%\n',
    'Intro.\n\n%\n\nAfter.\n',
    'Text before\n%\ntext after\n',
    '```\n%\n```\n',
    'Use `%` here.\n',
    'Text `code\n%\nmore` text\n',
    '$$\nopen\n%\nmore\n$$\n',
    'We get % and more.\n',
    '| a |\n| - |\n| % |\n',
    '| a |\n| - |\n%\n',
    '%\r\n',
    'Given \\(a_1\\).\n\n%\n',
    'Given \\\\[\nb_2\n\\\\]\n\n%\n',
    'Tag [/math]c[/math].\n\n%\n',
    '> quote\n%\n',
    '> quote\n>\n> %\n',
    '- item\n%\n',
    '- item\n\n  %\n\ntail\n',
    '1. one\n%\n',
    'Head\n%\n---\n',
    '%\n===\n',
    '## Head\n%\n',
];

/** A glued closer swallows the rest of the message, so its repair legitimately restores text the baseline lost. */
const GLUED_CLOSER_CONTEXT = '$$\na.$$\n\n%\n';

const runIn = (seed: number, contexts: string[]): string => {
    const pick = random(seed);

    return pick(contexts).replace('%', () => `${pick(RUN_INDENTS)}$$${pick(RUN_BODIES)}$$`);
};

const buildRun = (seed: number): string => runIn(seed, [...RUN_CONTEXTS, GLUED_CLOSER_CONTEXT]);

describe('normalizeMathFences self closing run fuzz', () => {
    const SEEDS = 2500;

    it('is idempotent over generated self closing runs', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            const once = normalizeMathFences(buildRun(seed));

            if (normalizeMathFences(once) !== once) failures.push(JSON.stringify(once));
        }

        expect(failures).toEqual([]);
    });

    it('never inserts a break inside a math node the baseline parse already closed', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            const input = buildRun(seed);

            if (editsInsideSettledMath(input)) failures.push(JSON.stringify(input));
        }

        expect(failures).toEqual([]);
    });

    it('never inserts a break inside a code block or code span', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            const input = buildRun(seed);

            if (editsInsideCode(input)) failures.push(JSON.stringify(input));
        }

        expect(failures).toEqual([]);
    });

    it('keeps every character of the input as a subsequence of the output', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            const input = buildRun(seed);
            const output = normalizeMathFences(input);
            let cursor = 0;

            for (const char of input) {
                cursor = output.indexOf(char, cursor) + 1;
                if (cursor === 0) break;
            }

            if (cursor === 0) failures.push(JSON.stringify(input));
        }

        expect(failures).toEqual([]);
    });

    it('leaves the deferred pipeline byte identical to the baseline that repairs nothing', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            const input = buildRun(seed);

            if (deferredPreprocess(input) !== baselinePreprocess(input)) failures.push(JSON.stringify(input));
        }

        expect(failures).toEqual([]);
    });

    it('adds no prefix break of its own beyond the ones escapeCurrencyDollars already contributes', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= PREFIX_SEEDS; seed += 1) {
            const full = buildRun(seed);

            if (revealBreaks(full).streaming !== prefixBreaks(full, baselinePreprocess))
                failures.push(JSON.stringify(full));
        }

        expect(failures).toEqual([]);
    });

    it('re-parents nothing but the math it promotes', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= 300; seed += 1) failures.push(...structuralRegressions(runIn(seed, RUN_CONTEXTS)));

        expect(failures.slice(0, 10)).toEqual([]);
    });
});

describe('normalizeMathFences multi block fuzz', () => {
    const SEEDS = 1250;

    it('rewrites most generated multi block messages and is idempotent over them', () => {
        const failures: string[] = [];
        let rewritten = 0;

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            const input = buildMulti(seed);
            const once = normalizeMathFences(input);

            if (once !== input) rewritten += 1;
            if (normalizeMathFences(once) !== once) failures.push(JSON.stringify(input));
        }

        expect(failures).toEqual([]);
        expect(rewritten / SEEDS).toBeGreaterThan(0.55);
    });

    it('repairs every glued closer in a message whose blocks are all glued', () => {
        const failures: string[] = [];

        for (let count = 2; count <= 5; count += 1) {
            const input = `${Array.from({ length: count }, (_, i) => `$$\nx_${i}.$$\n`).join('\n')}`;
            const expected = `${Array.from({ length: count }, (_, i) => `$$\nx_${i}.\n$$\n`).join('\n')}`;

            if (normalizeMathFences(input) !== expected) failures.push(JSON.stringify(normalizeMathFences(input)));
        }

        expect(failures).toEqual([]);
    });

    it('never inserts a break inside a math node the baseline parse already closed', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            if (editsInsideSettledMath(buildMulti(seed))) failures.push(JSON.stringify(buildMulti(seed)));
        }

        expect(failures).toEqual([]);
    });

    it('never inserts a break inside a code block or code span', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            if (editsInsideCode(buildMulti(seed))) failures.push(JSON.stringify(buildMulti(seed)));
        }

        expect(failures).toEqual([]);
    });

    it('leaves the deferred pipeline byte identical to the baseline that repairs nothing', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= SEEDS; seed += 1) {
            const input = buildMulti(seed);

            if (deferredPreprocess(input) !== baselinePreprocess(input)) failures.push(JSON.stringify(input));
        }

        expect(failures).toEqual([]);
    });

    it('adds no prefix break of its own beyond the ones escapeCurrencyDollars already contributes', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= PREFIX_SEEDS; seed += 1) {
            const full = buildMulti(seed);

            if (prefixBreaks(full, deferredPreprocess) !== prefixBreaks(full, baselinePreprocess))
                failures.push(JSON.stringify(full));
        }

        expect(failures).toEqual([]);
    });
});

describe('rendered markdown', () => {
    it('renders the glued closing fence from the report without a katex error', () => {
        const html = render(GLUED_CLOSING_FENCE);

        expect(html).not.toContain('katex-error');
        expect(html).not.toContain('math-error');
        expect(html).toContain('katex-display');
        expect(html).toContain('<p>So we conclude.</p>');
    });

    it('keeps markdown after an unbalanced dollar run parsing', () => {
        const html = render(UNBALANCED_INLINE);

        expect(html).toContain('<h3>Next step</h3>');
        expect(html).toContain('<strong>Bold</strong>');
        expect(html).toContain('<li>a bullet</li>');
    });

    it('renders every block of a long multi block response', () => {
        const html = render(MULTI_BLOCK);

        expect(html).not.toContain('katex-error');
        expect(html).not.toContain('math-error');
        expect(html.match(/katex-display/g) ?? []).toHaveLength(2);
        expect(html).toContain('<h2>Setup</h2>');
    });

    it('contains the failure of a latex bracket block whose body is markdown, not the rest of the message', () => {
        const html = render(LATEX_BRACKET_BLOCK);

        expect(html).toContain('<p>Intro.</p>');
        expect(html).toContain('<p>After.</p>');
        expect(html.match(/math-error/g) ?? []).toHaveLength(1);
        expect(html).not.toContain('katex-error');
    });

    it('contains the failure of the double backslash bracket form the same way', () => {
        const html = render(DOUBLE_BACKSLASH_BRACKET_BLOCK);

        expect(html).toContain('<p>After.</p>');
        expect(html.match(/math-error/g) ?? []).toHaveLength(1);
    });

    it('keeps a code span that crosses the run line intact', () => {
        const html = render('Text `code\n\\[ a = b \\]\nmore` text\n');

        expect(html).toContain('<code>code $$a = b$$ more</code>');
        expect(countOf(html, DISPLAY_ELEMENT)).toBe(0);
    });

    it('keeps a run on a blockquote continuation line inside the quote', () => {
        const html = render('> quote\n\\[ a = b \\]\n');

        expect(html).toContain('<blockquote>\n<p>quote');
        expect(countOf(html, DISPLAY_ELEMENT)).toBe(0);
        expect(countOf(html, INLINE_ELEMENT)).toBe(1);
        expect(html.indexOf('katex')).toBeLessThan(html.indexOf('</blockquote>'));
    });

    it('keeps a run on a list continuation line inside its item', () => {
        for (const [input, close] of [
            ['- item\n\\[ a = b \\]\n', '</ul>'],
            ['1. one\n\\[ a = b \\]\n', '</ol>'],
        ]) {
            const html = render(input);

            expect(countOf(html, DISPLAY_ELEMENT)).toBe(0);
            expect(html.indexOf('katex')).toBeLessThan(html.indexOf(close));
        }
    });

    it('keeps a run on a setext underlined line inside the heading', () => {
        const under = render('Head\n\\[ a = b \\]\n---\n');

        expect(under).toContain('<h2>Head');
        expect(under).not.toContain('<hr>');
        expect(countOf(under, DISPLAY_ELEMENT)).toBe(0);

        const over = render('\\[ a = b \\]\n===\n');

        expect(over).toContain('<h1>');
        expect(countOf(over, DISPLAY_ELEMENT)).toBe(0);
    });

    it('keeps a run that forms a table body row in the table', () => {
        const html = render('| a |\n| - |\n$$a=b$$\n');

        expect(html).toContain('<tbody>');
        expect(html.indexOf('katex')).toBeLessThan(html.indexOf('</tbody>'));
        expect(countOf(html, DISPLAY_ELEMENT)).toBe(0);
    });

    it('promotes a run inside a blockquote without letting it leave the quote', () => {
        const html = render('> quote\n>\n> \\[ a = b \\]\n');

        expect(countOf(html, DISPLAY_ELEMENT)).toBe(1);
        expect(html.indexOf('katex-display')).toBeLessThan(html.indexOf('</blockquote>'));
    });

    it('promotes a run inside a list item without letting it leave the item', () => {
        const html = render('- item\n\n  \\[ a = b \\]\n\ntail\n');

        expect(countOf(html, DISPLAY_ELEMENT)).toBe(1);
        expect(html.indexOf('katex-display')).toBeLessThan(html.indexOf('</li>'));
        expect(html).toContain('<p>tail</p>');
    });

    it('renders a single line latex bracket block as one display block', () => {
        const html = render(SINGLE_LINE_BRACKET_BLOCK);

        expect(html).not.toContain('katex-error');
        expect(html).not.toContain('math-error');
        expect(countOf(html, DISPLAY_ELEMENT)).toBe(1);
        expect(countOf(html, INLINE_ELEMENT)).toBe(1);
        expect(html).toContain('<p>Intro.</p>');
        expect(html).toContain('<p>After.</p>');
    });

    it('renders the double backslash single line form as one display block too', () => {
        const html = render(DOUBLE_BACKSLASH_SINGLE_LINE);

        expect(countOf(html, DISPLAY_ELEMENT)).toBe(1);
        expect(countOf(html, ERROR_ELEMENT)).toBe(0);
        expect(html).toContain('<p>After.</p>');
    });

    it('keeps a self closing run inside a fenced code block verbatim', () => {
        const html = render('```md\n$$a = b$$\n```\n\ntail\n');

        expect(html).toContain('$$a = b$$');
        expect(countOf(html, DISPLAY_ELEMENT)).toBe(0);
        expect(html).toContain('<p>tail</p>');
    });

    it('keeps a mid paragraph self closing run in one paragraph', () => {
        const html = render('We get $$a = b$$ and then more.\n');

        expect(countOf(html, DISPLAY_ELEMENT)).toBe(0);
        expect(countOf(html, INLINE_ELEMENT)).toBe(1);
        expect(html).toContain('and then more.</p>');
    });

    it('renders a latex bracket display block with a real expression as display math', () => {
        const html = render('Intro.\n\n\\[\n\\int_0^1 x\\,dx\n= \\frac{1}{2}\n\\]\n\nAfter.\n');

        expect(html).not.toContain('katex-error');
        expect(html).not.toContain('math-error');
        expect(html).toContain('katex-display');
        expect(html).toContain('<p>After.</p>');
    });

    it('keeps a fenced code block with fences verbatim', () => {
        const html = render('```md\n$$\nx = 1.$$\n```\n\ntail\n');

        expect(html).toContain('$$\nx = 1.$$');
        expect(html).toContain('<p>tail</p>');
    });

    it('renders both valid blocks and the conclusion when a stray run shifts the pairing', () => {
        const html = render('$$\na=1\n$$\n\nstray.$$\n\n$$\nb=2\n$$\n\nConclusion paragraph.\n');

        expect(html.match(/katex-display/g) ?? []).toHaveLength(2);
        expect(html).toContain('<p>Conclusion paragraph.</p>');
        expect(html).not.toContain('math-error');
    });

    it('keeps a blockquoted block rendering as math inside the quote', () => {
        const html = render('> $$\n> \\int_0^1 x\\,dx = \\frac{1}{2}\n> $$\n\ntail\n');

        expect(html).toContain('<blockquote>');
        expect(html).toContain('katex-display');
        expect(html).not.toContain('math-error');
        expect(html).toContain('<p>tail</p>');
    });

    it('renders a repaired glued blockquoted fence as math inside the quote', () => {
        const html = render('> $$\n> x = 1.$$\n\ntail\n');

        expect(html).toContain('<blockquote>');
        expect(html).toContain('katex-display');
        expect(html).not.toContain('math-error');
        expect(html).toContain('<p>tail</p>');
    });

    it('keeps both price tier bullets on the page', () => {
        const html = render('- Cafe A: $$ (cheap)\n- Cafe B: $$ (mid)\n\ntail\n');

        expect(html).toContain('(cheap)');
        expect(html).toContain('Cafe B');
        expect(html).toContain('<p>tail</p>');
    });

    it('keeps both price tier table rows on the page', () => {
        const html = render('| Name | Price |\n| - | - |\n| A | $$ |\n| B | $$ |\n');

        expect(html.match(/<tr>/g) ?? []).toHaveLength(3);
        expect(html).toContain('B');
    });

    it('keeps inline math inside a list item rendering', () => {
        const html = render('- We get $$\n  x = 1.$$\n\ntail\n');

        expect(html).toContain('<li>');
        expect(html).not.toContain('math-error');
        expect(html).toContain('<p>tail</p>');
    });

    it('keeps a tab indented code block verbatim', () => {
        const html = render('Example:\n\n\t$$\n\tx = 1.$$\n\ntail\n');

        expect(html).toContain('<pre><code>$$\nx = 1.$$\n</code></pre>');
        expect(html).toContain('<p>tail</p>');
    });

    it('keeps an indented code block verbatim', () => {
        const html = render('Example:\n\n    $$\n    x = 1.$$\n\ntail\n');

        expect(html).toContain('<pre><code>$$\nx = 1.$$\n</code></pre>');
        expect(html).toContain('<p>tail</p>');
    });

    it('renders a repaired list item block inside the list', () => {
        const html = render('- item\n\n  $$\n  x = 1.$$\n\ntail\n');

        expect(html).toContain('katex-display');
        expect(html).toContain('<p>tail</p>');
        expect(html).not.toContain('math-error');
    });

    it('renders an inline math error inline rather than as a block', () => {
        const html = render('Before $\\frac{a$ after text.\n');

        expect(html).toContain('<code class="math-error" ');
        expect(html).not.toContain('scrollbar-controller');
    });

    it('renders an inline math error inside a tight list item inline', () => {
        const html = render('- item $\\frac{1$ trailing\n- second\n');

        expect(html).toContain('<code class="math-error" ');
        expect(html).not.toContain('scrollbar-controller');
    });

    it('renders a display math error as a block', () => {
        const html = render('$$\n\\frac{a\n$$\n');

        expect(html).toContain('math-error block max-w-full scrollbar-controller scrollbar-horizontal');
    });

    it('does not render an unknown command as red raw source', () => {
        const html = render('Total $\\badcmd{x}$ here.\n');

        expect(html).not.toContain('#cc0000');
        expect(html).toContain('currentColor');
    });

    it('does not throw on partial streaming input', () => {
        expect(() => render('Intro text.\n\n$$\n\\int_\\Omega ')).not.toThrow();
        expect(render('Intro text.\n\n$$\n\\int_\\Omega ')).toContain('<p>Intro text.</p>');
    });
});

const REPRODUCERS = [
    'We get $$\\int f\\,dx.\n$$\nE = mc^2\n$$\n\nDone. Now the code:\n\n```js\nconst a = 1;\n```\n\n- one\n- two\n',
    '$$\na\n    $$\nb\n$$\n\nafter paragraph\n',
    '> Note:\n> $$\n> a^2 + b^2 = c^2\n$$\n\nThen:\n\n$$\nx = 1\n',
];

const PARITY_DESYNC = '- Kinetic energy: $$\n  E = \\frac{1}{2}mv^2\n  $$\n\n\nThen $$k =\n2$$ done';

const LEFT_IDENTICAL = [
    ...REPRODUCERS,
    PARITY_DESYNC,
    '- Cafe A: $$ (cheap)\n- Cafe B: $$ (mid)\n\ntail\n',
    '| Name | Price |\n| - | - |\n| A | $$ |\n| B | $$ |\n',
    '- We get $$\n  x = 1.$$\n\ntail\n',
    '$$\na=1\n$$\n\nstray.$$\n\n$$\nb=2\n$$\n\nConclusion paragraph.\n',
    'Oops.$$\n\nEuler $$e^{i\\pi}=-1$$ here.\n',
    'Example:\n\n\t$$\n\tx = 1.$$\n\ntail\n',
    '# H\n    $$\n    x=1.$$\n\ntail\n',
    '---\n    $$\n    x = 1.$$\n\ntail\n',
    'a `b\n```\n$$\nx = 1$$\n```',
    '- $$\n  a.$$\n\ntail\n',
    '* $$\n  a.$$\n\ntail\n',
    '1. $$\n   a.$$\n\ntail\n',
    '- a\n  - $$\n    x.$$\n\ntail\n',
    '> - $$\n>   x.$$\n\ntail\n',
    '<pre>\nliteral\n</preview>\n\n$$\na.$$\n\ntail\n',
];

const REPAIRED: [string, string][] = [
    [
        "$$\n\\langle J'(u), v\\rangle\n= \\int_\\Omega \\nabla u\\cdot\\nabla v\\,dx.$$\n\nSo we conclude.\n",
        "$$\n\\langle J'(u), v\\rangle\n= \\int_\\Omega \\nabla u\\cdot\\nabla v\\,dx.\n$$\n\nSo we conclude.\n",
    ],
    ['> $$\n> x = 1.$$\n\ntail\n', '> $$\n> x = 1.\n> $$\n\ntail\n'],
    ['- item\n\n  $$\n  x = 1.$$\n\ntail\n', '- item\n\n  $$\n  x = 1.\n  $$\n\ntail\n'],
    ['$$\na `b\nx = 1$$\nc ` d', '$$\na `b\nx = 1\n$$\nc ` d'],
    ['> $$\n> a.$$\n>\n> text\n\n$$\nb.$$\n\ntail\n', '> $$\n> a.\n> $$\n>\n> text\n\n$$\nb.\n$$\n\ntail\n'],
    ['$$\na.$$\n\n> $$\n> b.$$\n', '$$\na.\n$$\n\n> $$\n> b.\n> $$\n'],
    ['<b>x</b> y\n<br/>\n$$\na.$$\n\ntail\n', '<b>x</b> y\n<br/>\n$$\na.\n$$\n\ntail\n'],
];

describe('normalizeMathFences fence pairing', () => {
    it('does not let an unclosed mid line run consume a fence that starts a line', () => {
        expect(normalizeMathFences(REPRODUCERS[0])).toBe(REPRODUCERS[0]);
    });

    it('does not treat a fence indented past three columns as a closer', () => {
        expect(normalizeMathFences(REPRODUCERS[1])).toBe(REPRODUCERS[1]);
    });

    it('does not treat a fence that dropped its blockquote marker as a closer', () => {
        expect(normalizeMathFences(REPRODUCERS[2])).toBe(REPRODUCERS[2]);
    });

    it('does not let one mid line run shift the pairing of the blocks after it', () => {
        expect(normalizeMathFences(PARITY_DESYNC)).toBe(PARITY_DESYNC);
    });

    it('leaves ambiguous dollar runs untouched', () => {
        for (const text of LEFT_IDENTICAL) expect(normalizeMathFences(text)).toBe(text);
    });

    it('repairs a glued closing fence', () => {
        for (const [input, repaired] of REPAIRED) expect(normalizeMathFences(input)).toBe(repaired);
    });
});

type StreamReport = { flips: number; errorFrames: number; final: string };

const ERROR_ELEMENT = /math-error|katex-error/g;
const DISPLAY_ELEMENT = /katex-display/g;
const INLINE_ELEMENT = /class="katex"/g;

const countOf = (html: string, pattern: RegExp): number => (html.match(pattern) ?? []).length;

const visualSignature = (html: string): string =>
    [countOf(html, ERROR_ELEMENT), countOf(html, DISPLAY_ELEMENT), countOf(html, INLINE_ELEMENT)].join(':');

const streamReport = (full: string, preprocessText: (text: string) => string): StreamReport => {
    let flips = 0;
    let errorFrames = 0;
    let previous = '';

    for (let length = 0; length <= full.length; length += 1) {
        const html = String(pipeline.processSync(preprocessText(full.slice(0, length))));
        const signature = visualSignature(html);

        if (length > 0 && signature !== previous) flips += 1;
        if (countOf(html, ERROR_ELEMENT) > 0) errorFrames += 1;
        previous = signature;
    }

    return { flips, errorFrames, final: previous };
};

const SINGLE_BLOCK = 'Result:\n\n$$\n\\int_0^1 x\\,dx = \\frac{1}{2}\n$$\n\nDone.\n';

const THREE_BLOCKS = [
    'First:',
    '',
    '$$',
    'a^2 + b^2 = c^2',
    '$$',
    '',
    'Then the integral:',
    '',
    '$$',
    '\\int_0^1 x\\,dx = \\frac{1}{2}',
    '$$',
    '',
    'And finally:',
    '',
    '$$',
    '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}',
    '$$',
    '',
    'Done.',
    '',
].join('\n');

const UNKNOWN_COMMAND_BLOCK = '$$\n\\badcmd{x}\n$$\n';
const UNPARSEABLE_BLOCK = '$$\n\\frac{a\n$$\n';
const INLINE_MATH = 'We know $a^2 + b^2$ and $\\frac{1}{2}$ and $\\sum_{n}^{k} x$ here.\n';

describe('display math streaming', () => {
    it('reports how often a streaming display block changes element type', () => {
        expect(streamReport(SINGLE_BLOCK, preprocess)).toMatchObject({ flips: 15, errorFrames: 12 });
    });

    it('reports the same for a three block answer', () => {
        expect(streamReport(THREE_BLOCKS, preprocess)).toMatchObject({ flips: 41, errorFrames: 51, final: '0:3:3' });
    });

    it('settles an unknown command as its own raw source', () => {
        const html = String(pipeline.processSync(preprocess(UNKNOWN_COMMAND_BLOCK)));

        expect(html).toContain('katex-display');
        expect(html).toContain('\\badcmd');
    });

    it('surfaces one error element for latex that cannot be parsed', () => {
        expect(streamReport(UNPARSEABLE_BLOCK, preprocess).final).toBe('1:0:0');
    });

    it('leaves inline math alone, which already settles once per expression', () => {
        expect(streamReport(INLINE_MATH, preprocess)).toMatchObject({ flips: 3, errorFrames: 0 });
    });

    it('reports the same counts on the streaming path, which no longer rewrites the text', () => {
        expect(streamReport(SINGLE_BLOCK, deferredPreprocess)).toMatchObject({ flips: 15, errorFrames: 12 });
        expect(streamReport(THREE_BLOCKS, deferredPreprocess)).toMatchObject({
            flips: 41,
            errorFrames: 51,
            final: '0:3:3',
        });
    });
});

const PREFIX_INVARIANT_CORPUS = [
    'Here it is:\n\n$$\nE = mc^2\n$$\n\nDone.',
    SINGLE_BLOCK,
    THREE_BLOCKS,
    MULTI_BLOCK,
    GLUED_CLOSING_FENCE,
    UNBALANCED_INLINE,
    INLINE_MATH,
    PARITY_DESYNC,
    ...REPRODUCERS,
    ...LEFT_IDENTICAL,
    ...REPAIRED.map(([input]) => input),
];

describe('prefix invariant', () => {
    it('never rewrites a prefix the reveal has already committed', () => {
        expect(
            PREFIX_INVARIANT_CORPUS.filter((text) => revealBreaks(text).streaming > 0).map((t) => JSON.stringify(t)),
        ).toEqual([]);
    });

    it('rewrites nothing at all while the part is still running', () => {
        expect(PREFIX_INVARIANT_CORPUS.filter((text) => deferredPreprocess(text) !== baselinePreprocess(text))).toEqual(
            [],
        );
    });

    it('breaks nothing, settle included, for text the repair leaves alone', () => {
        for (const text of LEFT_IDENTICAL) expect(revealBreaks(text)).toEqual({ streaming: 0, atSettle: 0 });
    });

    it('spends its one exempt transition on settle for the ticket, blockquote and list cases', () => {
        for (const [input] of REPAIRED) expect(revealBreaks(input)).toEqual({ streaming: 0, atSettle: 1 });
    });

    it('holds for the block whose deferral broke it twice', () => {
        expect(revealBreaks('Here it is:\n\n$$\nE = mc^2\n$$\n\nDone.')).toEqual({ streaming: 0, atSettle: 0 });
    });
});

describe('no error count regression against the baseline preprocess', () => {
    const errorCount = (text: string, transform: (input: string) => string): number =>
        countOf(String(pipeline.processSync(transform(text))), ERROR_ELEMENT);

    const CORPUS = [
        PARITY_DESYNC,
        ...REPRODUCERS,
        ...LEFT_IDENTICAL,
        ...REPAIRED.map(([input]) => input),
        SINGLE_BLOCK,
        THREE_BLOCKS,
        MULTI_BLOCK,
        GLUED_CLOSING_FENCE,
        UNBALANCED_INLINE,
    ];

    it('renders the positional parity reproducer with the baseline error count', () => {
        expect(errorCount(PARITY_DESYNC, preprocess)).toBe(errorCount(PARITY_DESYNC, baselinePreprocess));
        expect(render(PARITY_DESYNC)).toContain('Then');
    });

    it('never raises the error count over the corpus', () => {
        for (const text of CORPUS) {
            expect(errorCount(text, preprocess)).toBeLessThanOrEqual(errorCount(text, baselinePreprocess));
        }
    });

    it('never raises the error count over the fuzz corpus', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= 800; seed += 1) {
            const input = build(seed);

            if (errorCount(input, preprocess) > errorCount(input, baselinePreprocess))
                failures.push(JSON.stringify(input));
        }

        expect(failures).toEqual([]);
    });

    it('never raises the error count over the multi block corpus', () => {
        const failures: string[] = [];
        let lowered = 0;

        for (let seed = 1; seed <= 250; seed += 1) {
            const input = buildMulti(seed);
            const repaired = errorCount(input, preprocess);
            const baseline = errorCount(input, baselinePreprocess);

            if (repaired > baseline) failures.push(JSON.stringify(input));
            if (repaired < baseline) lowered += 1;
        }

        expect(failures).toEqual([]);
        expect(lowered).toBeGreaterThan(200);
    });

    it('never raises the error count over the list container corpus', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= 150; seed += 1) {
            const input = buildList(seed);

            if (errorCount(input, preprocess) > errorCount(input, baselinePreprocess))
                failures.push(JSON.stringify(input));
        }

        expect(failures).toEqual([]);
    });

    it('never drops visible text over the list container corpus', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= 150; seed += 1) {
            const input = buildList(seed);

            for (const word of ['So far so good', 'Done.', 'Next', 'trailing text']) {
                if (input.includes(word) && !render(input).includes(word)) failures.push(JSON.stringify(input));
            }
        }

        expect(failures).toEqual([]);
    });

    it('never drops visible text over the multi block corpus', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= 250; seed += 1) {
            const input = buildMulti(seed);

            for (const word of ['So far so good', 'Done.', 'Next', 'trailing text']) {
                if (input.includes(word) && !render(input).includes(word)) failures.push(JSON.stringify(input));
            }
        }

        expect(failures).toEqual([]);
    });

    it('never drops visible text that the baseline rendered cleanly', () => {
        const failures: string[] = [];

        for (let seed = 1; seed <= 800; seed += 1) {
            const input = build(seed);
            const baselineHtml = String(pipeline.processSync(baselinePreprocess(input)));

            if (countOf(baselineHtml, ERROR_ELEMENT) > 0) continue;
            for (const word of ['tail', 'Euler', 'trailing text']) {
                if (baselineHtml.includes(word) && !render(input).includes(word)) failures.push(JSON.stringify(input));
            }
        }

        expect(failures).toEqual([]);
    });
});
