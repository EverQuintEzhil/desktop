import { describe, expect, it } from 'vitest';

import {
    sanitizeArticleContent,
    sanitizeHtmlViewer,
    sanitizeRichText,
    sanitizeSourceDescription,
    sanitizeSvgPreview,
} from './sanitize-html';

/**
 * BlockNote's image and table blocks serialise to figure/table markup that
 * sanitizeRichText throws away, so knowledge base articles need their own config.
 * The strings below are BlockNote 0.54's real `blocksToHTMLLossy` output, not
 * hand-written markup — an upgrade that changes the shape fails here.
 */

describe('sanitizeArticleContent', () => {
    it('keeps a screenshot with its alt text and caption', () => {
        const blockNoteOutput =
            '<figure data-name="Alt words" data-url="https://x.dev/a.png" data-caption="Cap" data-preview-width="400">' +
            '<img src="https://x.dev/a.png" alt="Alt words" width="400"><figcaption>Cap</figcaption></figure>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe(
            '<figure><img src="https://x.dev/a.png" alt="Alt words" width="400"><figcaption>Cap</figcaption></figure>',
        );
    });

    it('keeps a screenshot that has no caption', () => {
        const blockNoteOutput =
            '<img src="https://x.dev/a.png" alt="Alt words" data-name="Alt words" data-url="https://x.dev/a.png">';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe('<img src="https://x.dev/a.png" alt="Alt words">');
    });

    // BlockNote emits <tr> directly under <table>; the HTML parser inserts the <tbody>
    // the spec requires, which is why tbody has to be on the allowlist too.
    it('keeps a table with its column spans', () => {
        const blockNoteOutput =
            '<table><colgroup><col><col></colgroup>' +
            '<tr><th colspan="1" rowspan="1"><p>H</p></th><td colspan="1" rowspan="1"><p>C</p></td></tr></table>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe(
            '<table><colgroup><col><col></colgroup><tbody><tr><th colspan="1" rowspan="1"><p>H</p></th>' +
                '<td colspan="1" rowspan="1"><p>C</p></td></tr></tbody></table>',
        );
    });

    it('drops a pasted default body colour so the article inherits the theme', () => {
        const wordPaste =
            '<p style="color: windowtext">Body</p>' +
            '<h2 style="color: rgb(0, 0, 0)">Heading</h2>' +
            '<p style="color: #000000">Black</p>';

        expect(sanitizeArticleContent(wordPaste)).toBe('<p>Body</p><h2>Heading</h2><p>Black</p>');
    });

    it('keeps a colour a writer actually chose', () => {
        const blockNoteOutput = '<p style="color: rgb(15, 71, 97)">Teal</p>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe('<p style="color: rgb(15, 71, 97);">Teal</p>');
    });

    // blocksToHTMLLossy leaves `controls` off, so without the hook the reader would get
    // a static first frame and no way to press play.
    it('keeps a video and gives it player controls', () => {
        const blockNoteOutput = '<video src="https://x.dev/a.mp4" data-url="https://x.dev/a.mp4"></video>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe(
            '<video src="https://x.dev/a.mp4" controls="" preload="metadata"></video>',
        );
    });

    it('keeps a video caption and its width', () => {
        const blockNoteOutput =
            '<figure data-url="https://x.dev/a.mp4" data-caption="Cap">' +
            '<video src="https://x.dev/a.mp4" width="600"></video><figcaption>Cap</figcaption></figure>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe(
            '<figure><video src="https://x.dev/a.mp4" width="600" controls="" preload="metadata"></video>' +
                '<figcaption>Cap</figcaption></figure>',
        );
    });

    it('never lets a video autoplay', () => {
        expect(sanitizeArticleContent('<video src="https://x.dev/a.mp4" autoplay loop muted></video>')).toBe(
            '<video src="https://x.dev/a.mp4" controls="" preload="metadata"></video>',
        );
    });

    it('drops a javascript: video source', () => {
        expect(sanitizeArticleContent('<video src="javascript:alert(1)"></video>')).toBe(
            '<video controls="" preload="metadata"></video>',
        );
    });

    it('keeps an audio clip and gives it player controls', () => {
        const blockNoteOutput =
            '<figure data-url="https://x.dev/a.mp3" data-caption="Cap">' +
            '<audio src="https://x.dev/a.mp3"></audio><figcaption>Cap</figcaption></figure>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe(
            '<figure><audio src="https://x.dev/a.mp3" controls="" preload="metadata"></audio>' +
                '<figcaption>Cap</figcaption></figure>',
        );
    });

    it('keeps a collapsible section', () => {
        const blockNoteOutput =
            '<details open="" data-level="2"><summary><h2>Troubleshooting</h2></summary>' + '<p>body</p></details>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe(
            '<details open=""><summary><h2>Troubleshooting</h2></summary><p>body</p></details>',
        );
    });

    // A checklist is the only block that emits a form control, and a reader must not be
    // able to change it — the state lives in the article, not in their session.
    it('keeps a checklist but makes the boxes inert', () => {
        const blockNoteOutput = '<ul><li data-checked="true"><input type="checkbox" checked=""><p>done</p></li></ul>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe(
            '<ul><li><input type="checkbox" checked="" disabled=""><p>done</p></li></ul>',
        );
    });

    // `type` is case-insensitive in HTML, and content pasted out of another editor can
    // arrive upper-cased — a case-sensitive match deleted the box and the tick with it.
    it('keeps a checkbox whose type is upper-cased', () => {
        expect(sanitizeArticleContent('<ul><li><input type="CHECKBOX" checked=""><p>done</p></li></ul>')).toBe(
            '<ul><li><input type="CHECKBOX" checked="" disabled=""><p>done</p></li></ul>',
        );
    });

    it('drops any input that is not a checkbox', () => {
        expect(sanitizeArticleContent('<p>a</p><input type="text" name="pw">')).toBe('<p>a</p>');
        expect(sanitizeArticleContent('<p>a</p><input type="submit">')).toBe('<p>a</p>');
    });

    it('keeps a file attachment as a plain link', () => {
        const blockNoteOutput =
            '<div data-name="guide.pdf" data-url="https://x.dev/a.pdf">' +
            '<a href="https://x.dev/a.pdf">guide.pdf</a><p>Cap</p></div>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe('<a href="https://x.dev/a.pdf">guide.pdf</a><p>Cap</p>');
    });

    it('keeps a code block', () => {
        const blockNoteOutput =
            '<pre data-language="javascript">' +
            '<code class="language-javascript" data-language="javascript">const a = 1;</code></pre>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe('<pre><code>const a = 1;</code></pre>');
    });

    // BlockNote stores block alignment and colours as inline style — style.textAlign,
    // style.backgroundColor, style.color — so dropping the attribute silently discards
    // every alignment and colour a writer set in the editor.
    it('keeps a centred block', () => {
        expect(sanitizeArticleContent('<p style="text-align: center;">mid</p>')).toBe(
            '<p style="text-align: center;">mid</p>',
        );
    });

    it('keeps a centred screenshot', () => {
        const blockNoteOutput = '<figure style="text-align: center;"><img src="https://x.dev/a.png" alt="a"></figure>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe(blockNoteOutput);
    });

    it('keeps a block background colour', () => {
        expect(sanitizeArticleContent('<p style="background-color: rgb(250, 226, 226);">warn</p>')).toBe(
            '<p style="background-color: rgb(250, 226, 226);">warn</p>',
        );
    });

    it('keeps a text colour', () => {
        expect(sanitizeArticleContent('<p style="color: rgb(203, 45, 45);">red</p>')).toBe(
            '<p style="color: rgb(203, 45, 45);">red</p>',
        );
    });

    it('drops a style value that tries to execute', () => {
        const out = sanitizeArticleContent('<p style="background-image: url(javascript:alert(1));">x</p>');

        expect(out).not.toContain('javascript');
    });

    it('drops position and z-index, so a block cannot escape the article', () => {
        const out = sanitizeArticleContent('<p style="position: fixed; top: 0; z-index: 99;">x</p>');

        expect(out).not.toContain('position');
        expect(out).not.toContain('z-index');
    });

    // An image block writes its alignment only as data-text-alignment — unlike a
    // paragraph, it never mirrors it into inline style — so the reader has to read the
    // data attribute or every centred screenshot renders flush left.
    it('centres an image whose alignment is only a data attribute', () => {
        const blockNoteOutput =
            '<img src="https://x.dev/a.png" alt="a" data-text-alignment="center"' +
            ' data-name="a" data-url="https://x.dev/a.png">';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe(
            '<img src="https://x.dev/a.png" alt="a" style="text-align: center;">',
        );
    });

    it('carries a right-aligned block through', () => {
        expect(sanitizeArticleContent('<p data-text-alignment="right">r</p>')).toBe(
            '<p style="text-align: right;">r</p>',
        );
    });

    it('leaves a default left alignment alone', () => {
        expect(sanitizeArticleContent('<p data-text-alignment="left">l</p>')).toBe('<p>l</p>');
    });

    it('ignores an alignment value it does not recognise', () => {
        expect(sanitizeArticleContent('<p data-text-alignment="url(javascript:alert(1))">x</p>')).toBe('<p>x</p>');
    });

    // A table cell is the one block BlockNote gives no inline style at all — it writes
    // data-text-color and stops — so before these were translated, every colour a writer
    // set in a table reached the reader as no colour.
    it('turns a cell text colour into a style the reader can use', () => {
        expect(sanitizeArticleContent('<table><tr><td data-text-color="red">c</td></tr></table>')).toContain(
            'style="color: rgb(224, 62, 62);"',
        );
    });

    it('turns a cell background into a style the reader can use', () => {
        expect(sanitizeArticleContent('<table><tr><th data-background-color="blue">h</th></tr></table>')).toContain(
            'style="background-color: rgb(221, 235, 241);"',
        );
    });

    it('passes a theme token through, so the cell answers for both modes', () => {
        expect(
            sanitizeArticleContent('<table><tr><td data-background-color="var(--accent)">c</td></tr></table>'),
        ).toContain('style="background-color: var(--accent);"');
    });

    it('ignores a cell colour that is neither a token, a hex nor one of the nine', () => {
        const out = sanitizeArticleContent(
            '<table><tr><td data-text-color="url(javascript:alert(1))">c</td></tr></table>',
        );

        expect(out).not.toContain('javascript');
        expect(out).not.toContain('style=');
    });

    it('leaves a colour off a paragraph wearing the same attribute', () => {
        expect(sanitizeArticleContent('<p data-text-color="red">x</p>')).toBe('<p>x</p>');
    });

    it('does not let the data attribute overwrite an explicit inline alignment', () => {
        expect(sanitizeArticleContent('<p data-text-alignment="right" style="text-align: center;">x</p>')).toBe(
            '<p style="text-align: center;">x</p>',
        );
    });

    // A list that does not begin at 1 carries its offset in `start`, and dropping the
    // attribute silently renumbers the reader's copy from 1.
    it('keeps the start offset on a numbered list', () => {
        expect(sanitizeArticleContent('<ol start="5"><li><p>five</p></li></ol>')).toBe(
            '<ol start="5"><li><p>five</p></li></ol>',
        );
    });

    // Colouring a phrase rather than a whole block is an inline style mark, and BlockNote
    // serialises that to a span. Dropping the span kept the words and lost the colour,
    // while a coloured paragraph survived — the same choice rendered two different ways.
    it('keeps a coloured phrase inside a paragraph', () => {
        const blockNoteOutput = '<p>plain <span style="color: rgb(203, 45, 45);">red</span> plain</p>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe(blockNoteOutput);
    });

    it('keeps a highlighted phrase', () => {
        const blockNoteOutput = '<p><span style="background-color: rgb(250, 226, 226);">warn</span></p>';

        expect(sanitizeArticleContent(blockNoteOutput)).toBe(blockNoteOutput);
    });

    it('strips everything but the three properties off a span too', () => {
        const out = sanitizeArticleContent('<p><span style="position: fixed; color: red;">x</span></p>');

        expect(out).not.toContain('position');
        expect(out).toContain('color: red');
    });

    it('still keeps the text blocks sanitizeRichText allowed', () => {
        const html = '<h2>Sub</h2><p><strong>bold</strong></p><ul><li><p>one</p></li></ul>';

        expect(sanitizeArticleContent(html)).toBe(html);
    });

    it('drops a script', () => {
        expect(sanitizeArticleContent('<p>a</p><script>alert(1)</script>')).toBe('<p>a</p>');
    });

    it('drops an iframe, so a raw video embed cannot slip in', () => {
        expect(sanitizeArticleContent('<p>a</p><iframe src="https://x.dev/e"></iframe>')).toBe('<p>a</p>');
    });

    it('drops an inline event handler on an image', () => {
        expect(sanitizeArticleContent('<img src="https://x.dev/a.png" onerror="alert(1)">')).toBe(
            '<img src="https://x.dev/a.png">',
        );
    });

    it('drops a javascript: image source', () => {
        expect(sanitizeArticleContent('<img src="javascript:alert(1)" alt="x">')).toBe('<img alt="x">');
    });

    it('forces rel on a link that opens in a new tab', () => {
        expect(sanitizeArticleContent('<p><a href="https://x.dev" target="_blank">l</a></p>')).toBe(
            '<p><a href="https://x.dev" target="_blank" rel="noopener noreferrer">l</a></p>',
        );
    });
});

/**
 * All five configs share one `purify` instance, so both module-level hooks run for every
 * call. These pin that the article-only work — the alignment rewrite and the style clamp —
 * cannot reach the other four, which is what makes a single shared instance safe.
 */
describe('table column widths', () => {
    // Real blocksToHTMLLossy output for a table whose first two columns the writer
    // dragged. The <col> style is the only thing on the page carrying the size, and
    // colwidth is what lets the reader stylesheet leave those columns alone.
    const RESIZED =
        '<table><colgroup><col style="width: 320px;"><col style="width: 90px;"><col></colgroup>' +
        '<tr><td colspan="1" rowspan="1" colwidth="320"><p>wide</p></td>' +
        '<td colspan="1" rowspan="1" colwidth="90"><p>narrow</p></td>' +
        '<td colspan="1" rowspan="1"><p>auto</p></td></tr></table>';

    it('keeps the width of a column the writer resized', () => {
        const clean = sanitizeArticleContent(RESIZED);

        expect(clean).toContain('<col style="width: 320px;">');
        expect(clean).toContain('<col style="width: 90px;">');
    });

    it('keeps colwidth, so the default width can skip those columns', () => {
        const clean = sanitizeArticleContent(RESIZED);

        expect(clean).toContain('colwidth="320"');
        expect(clean).toContain('colwidth="90"');
    });

    it('leaves an untouched column with no width of its own', () => {
        expect(sanitizeArticleContent(RESIZED)).toContain('<col></colgroup>');
    });

    // The width exception is scoped to <col>. Anywhere else an inline width is a way to
    // push a block past the article column.
    it('will not let a paragraph carry an inline width', () => {
        expect(sanitizeArticleContent('<p style="width: 4000px; color: red">x</p>')).toBe(
            '<p style="color: red;">x</p>',
        );
    });

    it('will not let a table carry an inline width', () => {
        expect(sanitizeArticleContent('<table style="width: 4000px"><tr><td>c</td></tr></table>')).not.toContain(
            'width',
        );
    });

    it('drops everything but the width from a col', () => {
        expect(
            sanitizeArticleContent('<table><colgroup><col style="width: 90px; position: fixed"></colgroup></table>'),
        ).toBe('<table><colgroup><col style="width: 90px;"></colgroup></table>');
    });
});

describe('callouts', () => {
    // Real blocksToHTMLLossy output for a Warning callout: the class, role and
    // aria-label the block renders, plus the data-variant BlockNote adds for its own
    // round trip and the bn-inline-content class on the paragraph.
    const BLOCKNOTE_WARNING =
        '<aside class="callout callout-warning" role="note" aria-label="Warning"' +
        ' data-variant="warning"><p class="bn-inline-content">Careful now</p></aside>';

    it('keeps a callout, and drops the classes that are only BlockNote plumbing', () => {
        expect(sanitizeArticleContent(BLOCKNOTE_WARNING)).toBe(
            '<aside class="callout callout-warning" role="note" aria-label="Warning">' + '<p>Careful now</p></aside>',
        );
    });

    it('keeps every variant the editor can produce', () => {
        for (const variant of ['note', 'tip', 'important', 'warning', 'troubleshooting']) {
            expect(sanitizeArticleContent(`<aside class="callout callout-${variant}"><p>x</p></aside>`)).toContain(
                `class="callout callout-${variant}"`,
            );
        }
    });

    // The label a reader hears has to be the box a reader sees. Trusting the incoming
    // aria-label would let a Warning announce itself as a Note.
    it('rebuilds the accessible name from the class, not from what arrived', () => {
        expect(
            sanitizeArticleContent('<aside class="callout callout-warning" aria-label="Note"><p>x</p></aside>'),
        ).toBe('<aside class="callout callout-warning" role="note" aria-label="Warning"><p>x</p></aside>');
    });

    it('strips a class the editor could not have written', () => {
        expect(
            sanitizeArticleContent('<aside class="callout callout-warning bn-drag" role="note"><p>x</p></aside>'),
        ).toBe('<aside class="callout callout-warning" role="note" aria-label="Warning"><p>x</p></aside>');
    });

    // Anything not on the variant list is a box whose meaning we cannot draw, so it
    // renders as a plain aside rather than borrowing the last variant's colour.
    it('leaves an unknown variant unstyled but keeps its words', () => {
        expect(sanitizeArticleContent('<aside class="callout callout-severe"><p>x</p></aside>')).toBe(
            '<aside><p>x</p></aside>',
        );
    });

    it('will not let a paragraph pass itself off as a callout', () => {
        expect(sanitizeArticleContent('<p class="callout callout-warning" role="note">x</p>')).toBe('<p>x</p>');
    });

    it('drops a role and a label from anything that is not a callout', () => {
        expect(sanitizeArticleContent('<h2 role="banner" aria-label="Nav">Heading</h2>')).toBe('<h2>Heading</h2>');
    });

    it('keeps a colour the writer picked', () => {
        expect(
            sanitizeArticleContent('<aside class="callout callout-warning callout-color-red"><p>x</p></aside>'),
        ).toBe(
            '<aside class="callout callout-warning callout-color-red" role="note"' +
                ' aria-label="Warning"><p>x</p></aside>',
        );
    });

    it('keeps a theme colour the writer picked', () => {
        expect(
            sanitizeArticleContent('<aside class="callout callout-tip callout-color-theme-primary"><p>x</p></aside>'),
        ).toBe(
            '<aside class="callout callout-tip callout-color-theme-primary" role="note"' +
                ' aria-label="Tip"><p>x</p></aside>',
        );
    });

    // The stylesheet has no rule for a colour outside the list, so the box would lose
    // its accent entirely. Dropping the class puts it back on its variant's colour.
    it('drops a colour that has no rule behind it', () => {
        expect(sanitizeArticleContent('<aside class="callout callout-note callout-color-neon"><p>x</p></aside>')).toBe(
            '<aside class="callout callout-note" role="note" aria-label="Note"><p>x</p></aside>',
        );
    });

    it('drops a theme colour for a token the stylesheet does not build', () => {
        expect(
            sanitizeArticleContent('<aside class="callout callout-note callout-color-theme-sidebar"><p>x</p></aside>'),
        ).toBe('<aside class="callout callout-note" role="note" aria-label="Note"><p>x</p></aside>');
    });

    it('will not take a colour without a variant to hang it on', () => {
        expect(sanitizeArticleContent('<aside class="callout callout-color-red"><p>x</p></aside>')).toBe(
            '<aside><p>x</p></aside>',
        );
    });

    // BlockNote writes a chosen background as a hardcoded light-mode rgb. The block does
    // not emit it, but a post saved by some future path might, and a pale box under
    // light text in dark mode is worse than no tint at all.
    it('drops an inline background from a callout', () => {
        expect(
            sanitizeArticleContent(
                '<aside class="callout callout-note" style="background-color: rgb(221, 235, 241)"><p>x</p></aside>',
            ),
        ).not.toContain('rgb(221, 235, 241)');
    });
});

describe('the article hooks stay off the other configs', () => {
    // The callout rule strips every class it did not build. The viewer allows `class`
    // for its own layout, so running that rule on both would empty tool output.
    it('leaves the html viewer its classes', () => {
        expect(sanitizeHtmlViewer('<div class="chart-row"><span class="cell">1</span></div>')).toBe(
            '<div class="chart-row"><span class="cell">1</span></div>',
        );
    });

    // The flag the callout rule reads is module-level, so a raised flag left behind by
    // one call would silently strip the next one's classes.
    it('does not leak the article rule into the next viewer call', () => {
        sanitizeArticleContent('<aside class="callout callout-tip"><p>x</p></aside>');

        expect(sanitizeHtmlViewer('<div class="chart-row">1</div>')).toBe('<div class="chart-row">1</div>');
    });

    it('leaves no style behind on rich text carrying an alignment', () => {
        expect(sanitizeRichText('<p data-text-alignment="center" style="color: red">x</p>')).toBe('<p>x</p>');
    });

    it('leaves no style behind on the html viewer', () => {
        expect(sanitizeHtmlViewer('<span data-text-alignment="right" style="position: fixed">x</span>')).toBe(
            '<span>x</span>',
        );
    });

    it('does not let the media and input hooks reach a source description', () => {
        expect(sanitizeSourceDescription('<em>a</em><input type="text"><video src="x.mp4"></video>')).toBe(
            '<em>a</em>',
        );
    });

    // The SVG profile allows `style` and keeps its value, so the clamp would strip a
    // diagram's fill and stroke. `node instanceof HTMLElement` is the only thing stopping
    // it — SVG nodes are SVGElement.
    it('leaves an inline SVG its fill and stroke', () => {
        expect(sanitizeSvgPreview('<svg data-text-alignment="center"><circle style="fill:blue"/></svg>')).toBe(
            '<svg data-text-alignment="center"><circle style="fill:blue"></circle></svg>',
        );
    });
});

describe('sanitizeRichText stays narrow', () => {
    it('still drops images, so agent descriptions and launchers are unaffected', () => {
        expect(sanitizeRichText('<p>before</p><img src="https://x.dev/a.png" alt="a"><p>after</p>')).toBe(
            '<p>before</p><p>after</p>',
        );
    });

    it('still drops tables', () => {
        expect(sanitizeRichText('<table><tr><td>c</td></tr></table>')).toBe('c');
    });

    it('still drops videos', () => {
        expect(sanitizeRichText('<p>a</p><video src="https://x.dev/a.mp4"></video>')).toBe('<p>a</p>');
    });
});
