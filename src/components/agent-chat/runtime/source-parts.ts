import type {
    DataMessagePart,
    SourceMessagePart,
    ThreadAssistantMessagePart,
    ThreadUserMessagePart,
} from '@assistant-ui/react';

import type { ChatSource, WebSource } from '@/components/agent-chat/types';
import { getFaviconUrl, getHostname } from '@/lib/web-source-urls';

export { getFaviconUrl, getHostname };

type MessagePart = ThreadAssistantMessagePart | ThreadUserMessagePart;
type SourceUrlMessagePart = Extract<SourceMessagePart, { sourceType: 'url' }>;
type WebSearchToolCallPart = Extract<ThreadAssistantMessagePart, { type: 'tool-call' }>;

const isSourceMessagePart = (part: MessagePart): part is SourceUrlMessagePart =>
    part.type === 'source' && part.sourceType === 'url';

const isSourcesDataPart = (part: MessagePart): part is DataMessagePart =>
    part.type === 'data' && part.name === 'sources' && Array.isArray(part.data);

const fromStreamSource = (part: SourceUrlMessagePart): ChatSource => {
    const siteName = getHostname(part.url);

    return {
        id: part.id,
        title: part.title?.trim() || siteName,
        url: part.url,
        siteName,
        faviconUrl: getFaviconUrl(part.url),
    };
};

const fromSource = (source: WebSource, index: number): ChatSource => {
    const siteName = source.site_name?.trim() || getHostname(source.url);

    return {
        id: source.url || `web-source-${index}`,
        title: source.title?.trim() || siteName,
        url: source.url,
        description: source.description,
        siteName,
        faviconUrl: source.favicon || getFaviconUrl(source.url),
        thumbnailUrl: source.thumbnail,
    };
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;

    return undefined;
};

const readString = (value: unknown): string | undefined => {
    if (typeof value === 'string' && value.trim().length > 0) return value;

    return undefined;
};

const isWebSearchToolPart = (part: MessagePart): part is WebSearchToolCallPart =>
    part.type === 'tool-call' && typeof part.toolName === 'string' && part.toolName.includes('web_search');

const toolResultItems = (result: unknown): unknown[] => {
    if (Array.isArray(result)) return result;

    const record = asRecord(result);

    if (!record) return [];
    if (Array.isArray(record.web)) return record.web;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.content)) return record.content;

    const grounding = asRecord(record.groundingMetadata);

    if (grounding && Array.isArray(grounding.groundingChunks)) return grounding.groundingChunks;

    return [];
};

const fromToolResultItem = (value: unknown): ChatSource | undefined => {
    const item = asRecord(value);

    if (!item) return undefined;

    const groundingWeb = asRecord(item.web);
    const metadata = asRecord(item.metadata) ?? {};
    const url = readString(item.url) ?? readString(metadata.sourceURL) ?? readString(groundingWeb?.uri);

    if (!url) return undefined;

    const hostname = getHostname(url);

    return {
        id: url,
        url,
        title: readString(item.title) ?? readString(groundingWeb?.title) ?? readString(metadata.ogTitle) ?? hostname,
        description:
            readString(item.description) ?? readString(metadata.description) ?? readString(metadata.ogDescription),
        siteName: readString(metadata['og:site_name']) ?? readString(metadata.ogSiteName) ?? hostname,
        faviconUrl: readString(metadata.favicon) ?? getFaviconUrl(url),
        thumbnailUrl: readString(metadata.ogImage) ?? readString(metadata['og:image']),
    };
};

const fromToolResult = (result: unknown): ChatSource[] =>
    toolResultItems(result)
        .map(fromToolResultItem)
        .filter((source): source is ChatSource => source !== undefined);

export const getWebSearchTurns = (parts: readonly MessagePart[]): ChatSource[][] =>
    parts.filter(isWebSearchToolPart).map((part) => fromToolResult(part.result));

export const extractMessageSources = (parts: readonly MessagePart[]): ChatSource[] => {
    const seenUrls = new Set<string>();
    const sources = parts.flatMap((part) => {
        if (isSourceMessagePart(part)) return [fromStreamSource(part)];
        if (isWebSearchToolPart(part)) return fromToolResult(part.result);
        if (!isSourcesDataPart(part)) return [];

        return (part.data as WebSource[])
            .filter((source) => typeof source?.url === 'string' && source.url.length > 0)
            .map(fromSource);
    });

    return sources.filter((source) => {
        if (seenUrls.has(source.url)) return false;

        seenUrls.add(source.url);

        return true;
    });
};

export const extractMessageSuggestions = (parts: readonly MessagePart[]): string[] => {
    const suggestions = parts.flatMap((part) => {
        if (
            part.type !== 'data' ||
            !['suggestions', 'relatedQuestions'].includes(part.name) ||
            !Array.isArray(part.data)
        )
            return [];

        return part.data.filter(
            (suggestion): suggestion is string => typeof suggestion === 'string' && suggestion.trim().length > 0,
        );
    });

    return [...new Set(suggestions)];
};
