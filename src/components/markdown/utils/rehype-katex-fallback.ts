import type { Element, Root, RootContent } from 'hast';

const KATEX_ERROR_CLASS = 'katex-error';
const FALLBACK_TITLE = 'This math expression could not be rendered';
const DISPLAY_CLASSES = ['math-error', 'block', 'max-w-full', 'scrollbar-controller', 'scrollbar-horizontal'];
const INLINE_CLASSES = ['math-error'];
/** KaTeX drops its `katex-display` wrapper on a parse error, so the host element is the only signal left. */
const INLINE_HOSTS = new Set([
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'td',
    'th',
    'li',
    'dd',
    'figcaption',
    'a',
    'em',
    'strong',
    'del',
    'span',
    'b',
    'i',
    'small',
    'sup',
    'sub',
]);

const classNames = (element: Element): string[] => {
    const value: unknown = element.properties?.className;

    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return value.split(/\s+/);

    return [];
};

const textOf = (node: RootContent): string => {
    if (node.type === 'text') return node.value;
    if (node.type !== 'element') return '';

    return node.children.map(textOf).join('');
};

const toFallback = (element: Element, display: boolean): Element => {
    const katexMessage = typeof element.properties?.title === 'string' ? element.properties.title : '';

    return {
        type: 'element',
        tagName: 'code',
        properties: {
            className: display ? [...DISPLAY_CLASSES] : [...INLINE_CLASSES],
            title: katexMessage ? `${FALLBACK_TITLE}: ${katexMessage}` : FALLBACK_TITLE,
        },
        children: [{ type: 'text', value: element.children.map(textOf).join('') }],
    };
};

const replaceErrors = (node: Root | Element): void => {
    const display = node.type === 'root' || !INLINE_HOSTS.has(node.tagName);

    node.children = node.children.map((child) => {
        if (child.type !== 'element') return child;
        if (classNames(child).includes(KATEX_ERROR_CLASS)) return toFallback(child, display);
        replaceErrors(child);

        return child;
    });
};

/** rehype-katex renders a KaTeX ParseError as the raw LaTeX source in a `katex-error` span styled `color: #cc0000`, which reads as a failure of the whole answer rather than of one expression. */
export const rehypeKatexFallback =
    () =>
    (tree: Root): void => {
        replaceErrors(tree);
    };
