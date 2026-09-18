export interface LeadingQuote {
    quote: string | null;
    body: string;
}

const QUOTE_LINE = /^>\s?(.*)$/;

export const splitLeadingQuote = (text: string): LeadingQuote => {
    if (!text.startsWith('>')) {
        return { quote: null, body: text };
    }

    const lines = text.split('\n');
    const quoteLines: string[] = [];
    let index = 0;

    while (index < lines.length) {
        const match = QUOTE_LINE.exec(lines[index]);

        if (!match) break;

        quoteLines.push(match[1]);
        index += 1;
    }

    if (quoteLines.length === 0) {
        return { quote: null, body: text };
    }

    const remaining = lines.slice(index);

    while (remaining.length > 0 && remaining[0].trim() === '') {
        remaining.shift();
    }

    return {
        quote: quoteLines.join('\n').trim(),
        body: remaining.join('\n'),
    };
};
