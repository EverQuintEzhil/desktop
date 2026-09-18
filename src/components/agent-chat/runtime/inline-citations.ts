import type { ChatSource } from '@/components/agent-chat/types';
import { CITATION_HREF_SUFFIX } from '@/components/assistant-ui/citation-sources-context';

// OpenAI Responses citation markers are wrapped in Unicode private-use chars:
// U+E200 opens a marker region, U+E201 closes it, U+E202 separates tokens.
const REGION_START = '\uE200';
const REGION_END = '\uE201';
const MARKER_REGION_PATTERN = /\uE200([\s\S]*?)\uE201/g;
const CITATION_TOKEN_PATTERN = /turn(\d+)(?:search|news)(\d+)/g;
const PRIVATE_USE_AREA_PATTERN = /[\uE000-\uF8FF]/g;

const trimIncompleteMarker = (text: string): string => {
    const lastStart = text.lastIndexOf(REGION_START);

    if (lastStart === -1 || text.indexOf(REGION_END, lastStart) !== -1) return text;

    return text.slice(0, lastStart);
};

const buildCitationLinks = (
    body: string,
    resolve: (turn: number, index: number) => ChatSource | undefined,
): string[] => {
    const links: string[] = [];
    const seenUrls = new Set<string>();
    const seenSiteNames = new Set<string>();

    for (const match of body.matchAll(CITATION_TOKEN_PATTERN)) {
        const source = resolve(Number(match[1]), Number(match[2]));

        if (!source || seenUrls.has(source.url) || seenSiteNames.has(source.siteName.toLowerCase())) continue;

        seenUrls.add(source.url);
        seenSiteNames.add(source.siteName.toLowerCase());
        links.push(`[${source.siteName}](${source.url}${CITATION_HREF_SUFFIX})`);
    }

    return links;
};

export const replaceInlineCitations = (
    text: string,
    resolve: (turn: number, index: number) => ChatSource | undefined,
): string => {
    const trimmed = trimIncompleteMarker(text);
    const replaced = trimmed.replace(MARKER_REGION_PATTERN, (_region, body: string, offset: number) => {
        if (typeof body !== 'string' || !body.startsWith('cite')) return '';

        const links = buildCitationLinks(body, resolve);

        if (links.length === 0) return '';

        const previousChar = offset > 0 ? trimmed.charAt(offset - 1) : '';
        const separator = previousChar !== '' && !/\s/.test(previousChar) ? ' ' : '';

        return `${separator}${links.join(' ')}`;
    });

    return replaced.replace(PRIVATE_USE_AREA_PATTERN, '');
};
