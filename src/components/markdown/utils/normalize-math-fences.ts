import { applyEdits, collectEdits, collectSelfClosingEdits } from './fence-edits';
import { collectFences } from './fence-scanner';
import { longerRunSpan } from './longer-runs';

/**
 * remark-math closes flow math only on a `$$` that starts its own line, so a closing fence glued to
 * its content (`...uv\,dx.$$`) leaves the block open and swallows the rest of the message into one
 * math node that KaTeX re-emits as raw source.
 */
export const normalizeMathFences = (text: string, defer = false): string => {
    if (defer) return text;
    if (!text.includes('$$')) return text;

    const paired = applyEdits(text, collectEdits(text, collectFences(text), longerRunSpan(text)));

    return applyEdits(paired, collectSelfClosingEdits(paired, collectFences(paired), longerRunSpan(paired)));
};
