const RAW_TEXT_TAGS = ['script', 'pre', 'style', 'textarea'];

const RAW_TEXT_START = /^<(script|pre|style|textarea)(?:[ \t>]|$)/i;
const COMMENT_START = /^<!--/;
const INSTRUCTION_START = /^<\?/;
const CDATA_START = /^<!\[CDATA\[/;
const DECLARATION_START = /^<![A-Za-z]/;
const NAMED_BLOCK_START = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?:[ \t/>]|$)/;
const ATTRIBUTE = '[^=\\s/>"\'`]+(?:\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s"\'=<>`]+))?';
const LONE_TAG = new RegExp(
    `^(?:<[A-Za-z][A-Za-z0-9-]*(?:\\s+${ATTRIBUTE})*\\s*/?>|</[A-Za-z][A-Za-z0-9-]*\\s*>)[ \\t\\r]*$`,
);

const NAMED_BLOCKS = new Set([
    'address',
    'article',
    'aside',
    'base',
    'basefont',
    'blockquote',
    'body',
    'caption',
    'center',
    'col',
    'colgroup',
    'dd',
    'details',
    'dialog',
    'dir',
    'div',
    'dl',
    'dt',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'frame',
    'frameset',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hr',
    'html',
    'iframe',
    'legend',
    'li',
    'link',
    'main',
    'menu',
    'menuitem',
    'nav',
    'noframes',
    'ol',
    'optgroup',
    'option',
    'p',
    'param',
    'search',
    'section',
    'summary',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'title',
    'tr',
    'track',
    'ul',
]);

const lineEndAt = (text: string, index: number): number => {
    const newline = text.indexOf('\n', index);

    return newline === -1 ? text.length : newline;
};

const endOfBlankLine = (text: string, from: number): number => {
    let cursor = from;

    while (cursor < text.length) {
        const end = lineEndAt(text, cursor);

        if (text.slice(cursor, end).trim() === '') return cursor === from ? from : cursor - 1;
        if (end === text.length) return text.length;
        cursor = end + 1;
    }

    return text.length;
};

const endOfCloser = (text: string, from: number, closers: string[]): number => {
    const lower = text.toLowerCase();
    const offsets = closers.map((closer) => lower.indexOf(closer, from)).filter((offset) => offset !== -1);

    return offsets.length === 0 ? text.length : lineEndAt(text, Math.min(...offsets));
};

const namedBlockName = (line: string): string | null => {
    const match = NAMED_BLOCK_START.exec(line);

    return match ? match[1].toLowerCase() : null;
};

/** CommonMark HTML blocks, so a `$$` inside one is not read as a flow-math fence: conditions 1-5 end on their own closing string, conditions 6 and 7 at the next blank line. */
export const htmlBlockEnd = (text: string, contentStart: number, atBlockStart: boolean): number => {
    if (text[contentStart] !== '<') return -1;
    const line = text.slice(contentStart, lineEndAt(text, contentStart));

    if (RAW_TEXT_START.test(line))
        return endOfCloser(
            text,
            contentStart,
            RAW_TEXT_TAGS.map((tag) => `</${tag}>`),
        );
    if (COMMENT_START.test(line)) return endOfCloser(text, contentStart + 4, ['-->']);
    if (INSTRUCTION_START.test(line)) return endOfCloser(text, contentStart + 2, ['?>']);
    if (CDATA_START.test(line)) return endOfCloser(text, contentStart + 9, [']]>']);
    if (DECLARATION_START.test(line)) return endOfCloser(text, contentStart + 2, ['>']);

    const name = namedBlockName(line);

    if (name !== null && NAMED_BLOCKS.has(name)) return endOfBlankLine(text, contentStart);
    if (atBlockStart && LONE_TAG.test(line)) return endOfBlankLine(text, contentStart);

    return -1;
};
