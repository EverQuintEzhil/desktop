import type { MermaidErrorLike } from '../types';

export const formatMermaidError = (error: unknown): string => {
    if (typeof error === 'string') {
        return error;
    }

    if (!error || typeof error !== 'object') {
        return 'Unable to render Mermaid diagram.';
    }

    const mermaidError = error as MermaidErrorLike;
    const details = Array.from(
        new Set(
            [error instanceof Error ? error.message : undefined, mermaidError.message, mermaidError.str].filter(
                (detail): detail is string => Boolean(detail),
            ),
        ),
    );

    if (mermaidError.hash?.loc?.first_line || mermaidError.hash?.line) {
        const line = mermaidError.hash.loc?.first_line ?? mermaidError.hash.line;
        const column = mermaidError.hash.loc?.first_column;

        details.push(column ? `Location: line ${line}, column ${column}` : `Location: line ${line}`);
    }

    if (mermaidError.hash?.token) {
        details.push(`Token: ${mermaidError.hash.token}`);
    }

    if (mermaidError.hash?.text) {
        details.push(`Text: ${mermaidError.hash.text}`);
    }

    if (mermaidError.hash?.expected?.length) {
        details.push(`Expected: ${mermaidError.hash.expected.slice(0, 6).join(', ')}`);
    }

    return details.join('\n') || 'Unable to render Mermaid diagram.';
};
