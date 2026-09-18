import DOMPurify from 'dompurify';

import { BLOCKNOTE_CELL_COLORS, CALLOUT_THEME_COLOR_NAMES, isThemeColor } from './article-colors';

// Tiptap WYSIWYG output — used by blog posts, agent descriptions, launchers.
const RICH_TEXT_ALLOWED_TAGS = [
    'a',
    'blockquote',
    'br',
    'code',
    'em',
    'h1',
    'h2',
    'h3',
    'hr',
    'li',
    'ol',
    'p',
    'pre',
    's',
    'strong',
    'u',
    'ul',
];

const RICH_TEXT_ALLOWED_ATTR = ['href', 'rel', 'target'];

// LLM/tool HTML viewer output — broader allowlist for structured content.
// h4–h6, sup and sub are emitted by mammoth's default docx style map (headings, footnote marks).
const HTML_VIEWER_ALLOWED_TAGS = [
    ...RICH_TEXT_ALLOWED_TAGS,
    'caption',
    'div',
    'h4',
    'h5',
    'h6',
    'img',
    'span',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
];

// colspan/rowspan carry no script surface and merged docx table cells collapse without them.
const HTML_VIEWER_ALLOWED_ATTR = [...RICH_TEXT_ALLOWED_ATTR, 'alt', 'class', 'colspan', 'rowspan', 'src'];

// Blog article content — BlockNote output. Its image block serialises to
// figure/img/figcaption, its video block to figure/video/figcaption, and its table block
// to table/colgroup/tr/th/td, none of which the rich-text list allows. The data-*
// round-trip hints BlockNote also writes are dropped by ALLOW_DATA_ATTR, leaving plain
// semantic markup for the reader.
//
// `span` is here for inline colour. Colouring a whole block writes the colour onto the
// paragraph, but colouring a phrase is an inline style mark that serialises to a span —
// without it a coloured word arrived as plain text while a coloured paragraph survived.
const ARTICLE_CONTENT_ALLOWED_TAGS = [
    ...RICH_TEXT_ALLOWED_TAGS,
    'aside',
    'audio',
    'col',
    'colgroup',
    'details',
    'figcaption',
    'figure',
    'img',
    'input',
    'span',
    'summary',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'video',
];

// autoplay, loop and muted are left off on purpose: a knowledge base article must not
// start playing on its own. `style` is here because BlockNote stores block alignment and
// colours as inline style (style.textAlign, style.backgroundColor, style.color) — without
// it every alignment and colour a writer picks is silently discarded on the reader.
const ARTICLE_CONTENT_ALLOWED_ATTR = [
    ...RICH_TEXT_ALLOWED_ATTR,
    'alt',
    'aria-label',
    'checked',
    'class',
    // ProseMirror's marker for a column the writer resized. Not a rendering attribute —
    // it is what lets the reader stylesheet apply BlockNote's default column width to
    // untouched columns only, with the same `:not([colwidth])` guard BlockNote uses.
    'colwidth',
    'colspan',
    'controls',
    'disabled',
    'open',
    'poster',
    'preload',
    'role',
    'rowspan',
    'src',
    'start',
    'style',
    'type',
    'width',
];

// Callout variants the editor can produce. The icon and the visible label are drawn by
// CSS from these class names, so this list is also what decides which boxes can render —
// see the callout mixin in _mixins.scss and callout-block.tsx.
const ARTICLE_CALLOUT_VARIANTS = ['note', 'tip', 'important', 'warning', 'troubleshooting'];

// The colour a writer picked from the drag handle's Colors menu, if any. The first nine
// names are BlockNote's; the hues they resolve to are in the callout mixin, for both
// themes. The `theme-` names are the tenant's own tokens — see article-colors.ts — and
// resolve in that same mixin to a `var(--token)` rather than a fixed hue.
const ARTICLE_CALLOUT_COLORS = [
    'gray',
    'brown',
    'red',
    'orange',
    'yellow',
    'green',
    'blue',
    'purple',
    'pink',
    ...CALLOUT_THEME_COLOR_NAMES,
];

const ARTICLE_CALLOUT_LABELS: Record<string, string> = {
    note: 'Note',
    tip: 'Tip',
    important: 'Important',
    warning: 'Warning',
    troubleshooting: 'Troubleshooting',
};

// Short text snippets from external search sources — inline only, no links.
const SOURCE_DESCRIPTION_ALLOWED_TAGS = ['br', 'em', 'mark', 'strong'];

// DOMPurify passes an allowed `style` value through untouched, so a stray
// `position: fixed` or `background-image: url(...)` would survive. BlockNote only ever
// writes these three, so the hook below rewrites style down to them and drops the rest.
const ARTICLE_ALLOWED_CSS_PROPERTIES = ['text-align', 'background-color', 'color'];

// Word and Google Docs stamp every pasted run with the source document's default body
// colour — `windowtext` is a legacy CSS system keyword those editors emit, not something a
// writer can choose here. Neither it nor a literal black carries authorial intent.
const ARTICLE_DEFAULT_TEXT_COLORS = new Set(['windowtext', 'black', '#000', '#000000', 'rgb(0, 0, 0)', 'rgb(0,0,0)']);

const isDefaultTextColor = (value: string): boolean => ARTICLE_DEFAULT_TEXT_COLORS.has(value.trim().toLowerCase());

// A paragraph mirrors its alignment into inline style, but an image or video block only
// ever writes data-text-alignment — so without translating it, every centred screenshot
// renders flush left. 'left' is BlockNote's default and needs no declaration.
const ARTICLE_TEXT_ALIGNMENTS = ['center', 'right', 'justify'];

// A table cell is the one block whose colour BlockNote never mirrors into inline style —
// it writes `data-text-color` / `data-background-color` and nothing else, so with
// ALLOW_DATA_ATTR off every colour a writer picked in a table reached the reader as no
// colour at all. These two pairs are what the hook below translates.
const ARTICLE_CELL_COLOR_ATTRIBUTES = [
    ['data-text-color', 'color', 'text'],
    ['data-background-color', 'background-color', 'background'],
] as const;

// A colour the cell already carries, from an earlier save that this hook wrote out. It
// comes back through BlockNote's parse as the literal string, so the second save has to
// recognise it or a table loses its colour the moment someone edits the post again.
const ARTICLE_CELL_COLOR_VALUE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\))$/i;

const cellColorStyleValue = (value: string, channel: 'text' | 'background'): string | undefined => {
    // A theme colour is already a CSS value, and the only one that answers for both
    // themes — it goes through untouched.
    if (isThemeColor(value) || ARTICLE_CELL_COLOR_VALUE.test(value)) return value;

    return BLOCKNOTE_CELL_COLORS[value]?.[channel];
};

// Isolated instance — avoids mutating the global DOMPurify singleton.
const purify = DOMPurify(window);

// Runs before attribute filtering, which is the only point where BlockNote's data-*
// attributes still exist — ALLOW_DATA_ATTR: false removes them moments later.
purify.addHook('beforeSanitizeAttributes', (node) => {
    if (!(node instanceof HTMLElement) || !node.hasAttribute('data-text-alignment')) {
        return;
    }

    const alignment = node.getAttribute('data-text-alignment') ?? '';

    // An alignment already in inline style is the more specific of the two; leave it.
    if (node.style.textAlign === '' && ARTICLE_TEXT_ALIGNMENTS.includes(alignment)) {
        node.style.setProperty('text-align', alignment);
    }
});

// Same window as the alignment hook above, and for the same reason: after this runs,
// ALLOW_DATA_ATTR removes the attribute being read. Left ungated by isSanitizingArticle
// like that one — the other three configs leave `style` off their ALLOWED_ATTR, so a
// declaration written here is dropped moments later anyway.
purify.addHook('beforeSanitizeAttributes', (node) => {
    if (!(node instanceof HTMLElement) || (node.tagName !== 'TD' && node.tagName !== 'TH')) {
        return;
    }

    for (const [attribute, property, channel] of ARTICLE_CELL_COLOR_ATTRIBUTES) {
        const value = cellColorStyleValue(node.getAttribute(attribute) ?? '', channel);

        // An inline colour is the more specific of the two; leave it, as with alignment.
        if (value && node.style.getPropertyValue(property) === '') {
            node.style.setProperty(property, value);
        }
    }
});

// The hooks below are shared by every config on this instance, and `class` is on the
// HTML viewer's allowlist as well as the article one — so the callout rule has to know
// which call it is running inside or it would strip classes off tool output too.
// A plain flag is enough: purify.sanitize is synchronous, so no second call can begin
// before this one has finished and reset it.
let isSanitizingArticle = false;

// Prevent tabnapping: force rel="noopener noreferrer" on any _blank link.
purify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer');
    }

    // `class`, `role` and `aria-label` are on the article allowlist for one element: the
    // callout box. Left as they arrived, a pasted `<p class="callout callout-warning">`
    // would borrow the styling of a warning it is not, and a stray aria-label could
    // rename any element for a screen reader. Rebuilding all three from the variant is
    // what keeps the three in agreement — a box cannot be drawn as a Warning and
    // announced as a Note — and drops them from everything that is not a callout.
    if (
        isSanitizingArticle &&
        node instanceof HTMLElement &&
        (node.hasAttribute('class') || node.hasAttribute('role') || node.hasAttribute('aria-label'))
    ) {
        const variant =
            node.tagName === 'ASIDE'
                ? ARTICLE_CALLOUT_VARIANTS.find((name) => node.classList.contains(`callout-${name}`))
                : undefined;

        // Read before the class goes, and only kept when the variant stands up — a
        // colour on its own is not a callout.
        const color = variant
            ? ARTICLE_CALLOUT_COLORS.find((name) => node.classList.contains(`callout-color-${name}`))
            : undefined;

        node.removeAttribute('class');
        node.removeAttribute('role');
        node.removeAttribute('aria-label');

        if (variant) {
            node.setAttribute('class', `callout callout-${variant}${color ? ` callout-color-${color}` : ''}`);
            node.setAttribute('role', 'note');
            node.setAttribute('aria-label', ARTICLE_CALLOUT_LABELS[variant]);

            // A callout's colour comes from the class, which answers for both themes.
            // background-color is on the allowed-CSS list for paragraphs and headings,
            // so without this a pasted `style="background-color: rgb(221, 235, 241)"` —
            // BlockNote's own light-only value — would sit on top of the class and give
            // a dark reader a pale box under light text.
            node.style.removeProperty('background-color');
        }
    }

    // BlockNote's blocksToHTMLLossy writes the src but not `controls`, so media would
    // render as a dead frame with no way to play it. preload="metadata" keeps a poster
    // frame and duration without pulling the whole file on page load.
    if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
        node.setAttribute('controls', '');
        node.setAttribute('preload', 'metadata');
    }

    // The only input a checklist block needs is an inert checkbox. Anything else — a text
    // field, a submit button — would be a form control smuggled into article content.
    // Lower-cased because `type` is case-insensitive in HTML: BlockNote always writes it
    // lowercase, but content pasted out of another editor can carry `type="CHECKBOX"`.
    if (node.tagName === 'INPUT') {
        if (node.getAttribute('type')?.toLowerCase() !== 'checkbox') {
            node.remove();

            return;
        }

        node.setAttribute('disabled', '');
    }

    // HTMLElement, not Element, is what scopes this to article content. The SVG profile
    // allows `style` and keeps its value untouched, so an SVGElement reaching here would
    // lose the fill and stroke a model-emitted diagram is drawn with. The four HTML
    // configs all leave `style` off their ALLOWED_ATTR, so only articles get this far.
    if (node instanceof HTMLElement && node.hasAttribute('style')) {
        // A resized table column is the one place an inline width has to survive.
        // BlockNote writes the writer's drag as `<col style="width: 320px">`, and that
        // element is the only thing on the page carrying the column's size — drop it and
        // every column the writer sized reverts to the default on the reader. Scoped to
        // <col> so a paragraph still cannot smuggle a width in.
        const allowed =
            node.tagName === 'COL' ? [...ARTICLE_ALLOWED_CSS_PROPERTIES, 'width'] : ARTICLE_ALLOWED_CSS_PROPERTIES;

        const kept = allowed
            .map((property) => [property, node.style.getPropertyValue(property)] as const)
            .filter(([, value]) => value !== '')
            .filter(([property, value]) => !(property === 'color' && isDefaultTextColor(value)));

        node.removeAttribute('style');

        for (const [property, value] of kept) {
            node.style.setProperty(property, value);
        }
    }
});

export const sanitizeRichText = (html: string): string =>
    purify.sanitize(html, {
        ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
        ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
    });

export const sanitizeArticleContent = (html: string): string => {
    isSanitizingArticle = true;

    // finally, not a plain reset after the call: a throw inside DOMPurify would otherwise
    // leave the flag raised and let the next viewer or rich-text call lose its classes.
    try {
        return purify.sanitize(html, {
            ALLOWED_TAGS: ARTICLE_CONTENT_ALLOWED_TAGS,
            ALLOWED_ATTR: ARTICLE_CONTENT_ALLOWED_ATTR,
            ALLOW_DATA_ATTR: false,
        });
    } finally {
        isSanitizingArticle = false;
    }
};

export const sanitizeHtmlViewer = (html: string): string =>
    purify.sanitize(html, {
        ALLOWED_TAGS: HTML_VIEWER_ALLOWED_TAGS,
        ALLOWED_ATTR: HTML_VIEWER_ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
    });

export const sanitizeSourceDescription = (html: string): string =>
    purify.sanitize(html, {
        ALLOWED_TAGS: SOURCE_DESCRIPTION_ALLOWED_TAGS,
        ALLOWED_ATTR: [],
        ALLOW_DATA_ATTR: false,
    });

// Model-emitted SVG rendered inline in chat markdown — SVG profile only, no HTML.
export const sanitizeSvgPreview = (svg: string): string =>
    purify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
    });
