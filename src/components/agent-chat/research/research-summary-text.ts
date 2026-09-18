/**
 * Round summaries arrive as the model wrote them — Markdown, mid-sentence citations and all —
 * and the backend truncates them to a preview length, which cuts a citation in half as often
 * as not. The trace prints them as one plain line, so the markup has to come off first:
 * left in, a summary reads as `([Forbes, Aug 31](https://www.forbes.com/sites/davidphelan/20…`,
 * which is a URL the reader cannot open and a sentence they cannot finish.
 */

const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g;
/** A citation the truncation cut open: everything from its bracket to the end is unusable. */
const TRUNCATED_CITATION = /\s*\(?\[[^\]]*\](?:\([^)]*)?[…\s]*$/;
const TRUNCATED_URL = /\s*\(?https?:\/\/\S*$/;
const BARE_URL = /https?:\/\/\S+/g;
const EMPHASIS = /(\*\*|__|\*|_|`)/g;
const LEADING_MARKS = /^\s*(#{1,6}\s+|[-*+]\s+|>\s+)/;
const EMPTY_CITATION = /\(\s*[;,]*\s*\)/g;
const SPACE_BEFORE_PUNCTUATION = /\s+([),.;:])/g;

/** A citation whose text was only the link keeps the site, never the raw href. */
const toLinkText = (label: string, href: string): string => {
    const text = label.trim();

    if (text.length > 0) return text;

    try {
        return new URL(href).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
};

/** One round summary as a single plain-text line, safe to truncate anywhere. */
export const toPlainSummary = (text: string): string =>
    text
        .replace(MARKDOWN_LINK, (_match, label: string, href: string) => toLinkText(label, href))
        .replace(TRUNCATED_CITATION, '…')
        .replace(TRUNCATED_URL, '…')
        .replace(BARE_URL, '')
        .replace(EMPHASIS, '')
        .replace(LEADING_MARKS, '')
        .replace(EMPTY_CITATION, '')
        .replace(SPACE_BEFORE_PUNCTUATION, '$1')
        .replace(/\s+/g, ' ')
        .replace(/^[…\s.,;:)]+$/, '')
        .trim();
