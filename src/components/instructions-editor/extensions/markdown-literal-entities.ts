import type { JSONContent } from '@tiptap/core';
import { Markdown, MarkdownManager } from '@tiptap/markdown';

type MarkdownMark = string | { type: string };
type MarkdownNode = JSONContent & { marks?: MarkdownMark[] };
type HtmlToken = { text?: string; raw?: string; block?: boolean };
type MarkdownToken = { type?: string; text?: string; tokens?: unknown[] };

/** Internals of MarkdownManager that decide how text and raw HTML cross the markdown boundary. */
interface ManagerInternals {
    codeTypes: Set<string>;
    escapeMarkdownSyntax: (text: string) => string;
    htmlAsLiteralText: (html: string, isBlock: boolean) => JSONContent | null;
    encodeTextForMarkdown: (text: string, node: MarkdownNode, parentNode?: MarkdownNode) => string;
    parseHTMLToken: (token: HtmlToken) => JSONContent | null;
    parseFallbackToken: (token: MarkdownToken) => JSONContent | JSONContent[] | null;
    parseInlineTokens: (tokens: MarkdownToken[]) => JSONContent[];
}

const prototype = MarkdownManager.prototype as unknown as ManagerInternals;

const parseFallbackToken = prototype.parseFallbackToken;
const parseInlineTokens = prototype.parseInlineTokens;

/**
 * Instructions are markdown a person wrote, not a page to render, so raw HTML in them has to survive
 * as the characters they typed. Two library defaults work against that, and they are a pair: the
 * parser feeds HTML through the schema, dropping a `<div>` or an HTML comment outright, and the
 * serialiser HTML-entity-encodes prose, which rewrote every `&` in a saved file as `&amp;`.
 *
 * Turning both off keeps a document byte-stable across an edit, and is what lets the source reach
 * the parser unescaped — pre-escaping it was why an ampersand inside a code span used to reach the
 * reader as a literal `&amp;` (AMP-559). Code is already left alone by the serialiser.
 *
 * This patches the prototype because the base extension parses the initial content inside its own
 * `onBeforeCreate`, before any instance is reachable. `MarkdownManager` has no other consumer in
 * this app. markdown-round-trip.test.ts is the guard: if a library upgrade renames either hook, the
 * entities come straight back and it fails.
 */
prototype.parseFallbackToken = function (token: MarkdownToken, ...rest: unknown[]) {
    // The default resolves `&amp;` to `&` here. With the serialiser no longer re-encoding, that
    // would rewrite a documented entity to the bare character on the next save.
    if (token?.type === 'text' && typeof token.text === 'string' && !token.tokens?.length) {
        return { type: 'text', text: token.text };
    }

    return (parseFallbackToken as (...args: unknown[]) => JSONContent | JSONContent[] | null).call(
        this,
        token,
        ...rest,
    );
};

// Inline text runs through a large method that decodes entities midway. Rather than reimplement
// it, hand it text with `&` pre-encoded so its own decode lands back on what the author typed.
prototype.parseInlineTokens = function (tokens: MarkdownToken[]) {
    const preserved = tokens.map((token) =>
        token?.type === 'text' && typeof token.text === 'string' && !token.tokens?.length
            ? { ...token, text: token.text.replace(/&/g, '&amp;') }
            : token,
    );

    return parseInlineTokens.call(this, preserved);
};

prototype.parseHTMLToken = function parseHTMLToken(token: HtmlToken) {
    const html = token.text || token.raw || '';

    return html.trim() ? this.htmlAsLiteralText(html, !!token.block) : null;
};

prototype.encodeTextForMarkdown = function encodeTextForMarkdown(
    text: string,
    node: MarkdownNode,
    parentNode?: MarkdownNode,
) {
    const isInsideCode =
        (parentNode?.type != null && this.codeTypes.has(parentNode.type)) ||
        (node.marks ?? []).some((mark) => this.codeTypes.has(typeof mark === 'string' ? mark : mark.type));

    return isInsideCode ? text : this.escapeMarkdownSyntax(text);
};

/** Re-exported so using the extension always pulls the patch above in with it. */
export const MarkdownLiteralEntities = Markdown;
