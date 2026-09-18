import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';

import { MarkdownLiteralEntities } from './extensions/markdown-literal-entities';

const roundTrip = (source: string): string => {
    const editor = new Editor({
        extensions: [StarterKit, MarkdownLiteralEntities],
        content: source,
        contentType: 'markdown',
    });
    const out = editor.getMarkdown().replace(/\\_/g, '_');

    editor.destroy();

    return out;
};

describe('markdown round trip', () => {
    it.each([
        ['prose ampersand', 'Perkins&Will document generator'],
        ['inline code path', 'Script paths are relative to `perkins&will/skill/doc/template-docx/`.'],
        ['fenced shell operator', ['```', 'cd unpacked && rm -f ../filled.docx', '```'].join('\n')],
        ['literal entity in a fence', ['```', 'x &amp; y', '```'].join('\n')],
        ['literal entity in a code span', 'a `x &amp; y` b'],
        ['fence carrying an info string', ['```', 'x & y', '```js', 'z & w', '```'].join('\n')],
        ['xml tag in prose', 'Edit the <w:t> text in the original XML.'],
        ['html tags in prose', 'Use <b>bold</b> and <i>italic</i>.'],
        ['block html in prose', 'Wrap it in <div class="x">x</div> first.'],
        ['html comment in prose', 'Set <!-- a comment --> aside.'],
        ['angle-bracket placeholder', 'Placeholder <Insert name> here.'],
    ])('%s survives an edit unchanged', (_name, source) => {
        expect(roundTrip(source)).toBe(source);
    });

    it('leaves a whole document byte-identical', () => {
        const source = [
            'Perkins&Will document generator',
            '',
            'Paths are relative to `perkins&will/skill/doc/`.',
            '',
            '```bash',
            'cd unpacked && zip -Xr ../filled.docx .',
            '```',
            '',
            'Never pretty-print <w:t> by hand.',
        ].join('\n');

        expect(roundTrip(source)).toBe(source);
    });

    // TipTap normalises these shapes on its own — what matters is that the ampersand comes back
    // as the character the author typed rather than an entity.
    it.each([
        ['indented code block', 'Text:\n\n    perkins&will -x'],
        ['tab indented code block', 'Text:\n\n\tperkins&will -x'],
        ['code span wrapped across a line', 'a `b & c\nd` e'],
        ['indented code after a blockquote', '> note\n\n    perkins&will -x'],
    ])('%s keeps its ampersand literal', (_name, source) => {
        const out = roundTrip(source);

        expect(out).toContain('&');
        expect(out).not.toContain('&amp;');
    });

    it('leaves an html entity written in prose exactly as the author typed it', () => {
        expect(roundTrip('a &amp; b')).toBe('a &amp; b');
        expect(roundTrip('In XML escape ampersand as &amp; always.')).toBe('In XML escape ampersand as &amp; always.');
        expect(roundTrip('Use &lt;div&gt; not <div>')).toBe('Use &lt;div&gt; not <div>');
    });
});
