import type { Element, Root } from 'hast';
import { describe, expect, it } from 'vitest';

import { rehypeKatexFallback } from './rehype-katex-fallback';

const errorSpan = (): Element => ({
    type: 'element',
    tagName: 'span',
    properties: {
        className: ['katex-error'],
        title: "ParseError: Can't use function '$' in math mode",
        style: 'color:#cc0000',
    },
    children: [{ type: 'text', value: '\\int_\\Omega uv$' }],
});

const displayErrorTree = (): Root => ({ type: 'root', children: [errorSpan()] });

const inlineErrorTree = (): Root => ({
    type: 'root',
    children: [
        {
            type: 'element',
            tagName: 'p',
            properties: {},
            children: [errorSpan()],
        },
    ],
});

const tightListErrorTree = (): Root => ({
    type: 'root',
    children: [
        {
            type: 'element',
            tagName: 'ul',
            properties: {},
            children: [
                {
                    type: 'element',
                    tagName: 'li',
                    properties: {},
                    children: [{ type: 'text', value: 'item ' }, errorSpan(), { type: 'text', value: ' trailing' }],
                },
            ],
        },
    ],
});

const listItemChild = (tree: Root): Element => {
    const list = tree.children[0];

    if (list.type !== 'element') throw new Error('expected a list element');
    const item = list.children[0];

    if (item.type !== 'element') throw new Error('expected a list item element');
    const child = item.children[1];

    if (child.type !== 'element') throw new Error('expected an element child');

    return child;
};

const firstChild = (tree: Root): Element => {
    const paragraph = tree.children[0];

    if (paragraph.type !== 'element') throw new Error('expected a paragraph element');
    const child = paragraph.children[0];

    if (child.type !== 'element') throw new Error('expected an element child');

    return child;
};

const rootChild = (tree: Root): Element => {
    const child = tree.children[0];

    if (child.type !== 'element') throw new Error('expected an element child');

    return child;
};

describe('rehypeKatexFallback', () => {
    it('replaces a display katex error span with a muted block code fallback', () => {
        const tree = displayErrorTree();

        rehypeKatexFallback()(tree);

        const fallback = rootChild(tree);

        expect(fallback.tagName).toBe('code');
        expect(fallback.properties.className).toEqual([
            'math-error',
            'block',
            'max-w-full',
            'scrollbar-controller',
            'scrollbar-horizontal',
        ]);
        expect(fallback.properties.style).toBeUndefined();
        expect(fallback.children).toEqual([{ type: 'text', value: '\\int_\\Omega uv$' }]);
    });

    it('keeps an inline katex error inline', () => {
        const tree = inlineErrorTree();

        rehypeKatexFallback()(tree);

        const fallback = firstChild(tree);

        expect(fallback.tagName).toBe('code');
        expect(fallback.properties.className).toEqual(['math-error']);
    });

    it('keeps a katex error inside a tight list item inline', () => {
        const tree = tightListErrorTree();

        rehypeKatexFallback()(tree);

        const fallback = listItemChild(tree);

        expect(fallback.tagName).toBe('code');
        expect(fallback.properties.className).toEqual(['math-error']);
    });

    it('keeps the katex parse error in the title', () => {
        const tree = displayErrorTree();

        rehypeKatexFallback()(tree);

        expect(rootChild(tree).properties.title).toBe(
            "This math expression could not be rendered: ParseError: Can't use function '$' in math mode",
        );
    });

    it('leaves other elements untouched', () => {
        const tree: Root = {
            type: 'root',
            children: [
                {
                    type: 'element',
                    tagName: 'p',
                    properties: {},
                    children: [
                        {
                            type: 'element',
                            tagName: 'span',
                            properties: { className: ['katex'] },
                            children: [{ type: 'text', value: 'x' }],
                        },
                    ],
                },
            ],
        };

        rehypeKatexFallback()(tree);

        expect(firstChild(tree).tagName).toBe('span');
    });
});
