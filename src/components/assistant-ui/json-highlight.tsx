import { type ReactNode } from 'react';

const TOKEN_PATTERN =
    /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([{}[\],:])/g;

const TOKEN_CLASS = {
    key: 'text-rose-700 dark:text-rose-300',
    string: 'text-emerald-700 dark:text-emerald-300',
    number: 'text-blue-700 dark:text-blue-300',
    keyword: 'text-violet-700 dark:text-violet-300',
    punctuation: 'text-muted-foreground',
} as const;

export const highlightJson = (value: string): ReactNode => {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    TOKEN_PATTERN.lastIndex = 0;

    while ((match = TOKEN_PATTERN.exec(value)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(value.slice(lastIndex, match.index));
        }

        const [token, key, string, number, keyword] = match;
        const className = key
            ? TOKEN_CLASS.key
            : string
              ? TOKEN_CLASS.string
              : number
                ? TOKEN_CLASS.number
                : keyword
                  ? TOKEN_CLASS.keyword
                  : TOKEN_CLASS.punctuation;

        nodes.push(
            <span key={`${match.index}-${token}`} className={className}>
                {token}
            </span>,
        );
        lastIndex = match.index + token.length;
    }

    if (lastIndex < value.length) {
        nodes.push(value.slice(lastIndex));
    }

    return nodes;
};
