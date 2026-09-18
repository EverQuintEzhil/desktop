import {
    buildDeepResearchCustom,
    buildMissingResearchParts,
    isResearchPartType,
} from '@/components/agent-chat/research/research-contract';
import type {
    FluentMindMessageMetadata,
    FluentMindUIMessage,
    ConversationMessage,
    MessageFile,
    RawFilePart,
    RawImagePart,
    RawMessagePart,
} from '@/components/agent-chat/types';

function mapRating(rating: 'positive' | 'negative' | null | undefined): FluentMindMessageMetadata['submittedFeedback'] {
    if (rating === 'positive' || rating === 'negative') return { type: rating };

    return undefined;
}

const getSubmittedFeedback = (
    item: ConversationMessage,
    userId?: string,
): FluentMindMessageMetadata['submittedFeedback'] => {
    const metadataRating = mapRating(item.metadata?.rating);

    if (metadataRating) return metadataRating;
    if (item.liked === true) return { type: 'positive' };
    if (item.disliked === true) return { type: 'negative' };
    if (!userId) return undefined;
    if (item.liked_by_user_ids?.includes(userId)) return { type: 'positive' };
    if (item.disliked_by_user_ids?.includes(userId)) return { type: 'negative' };

    return undefined;
};

const hasPartType = (parts: FluentMindUIMessage['parts'], type: string): boolean =>
    parts.some((part) => part.type === type);

const extractFileIdFromUrl = (url: string): string | null => {
    try {
        const pathname = new URL(url).pathname;
        const segments = pathname.split('/').filter(Boolean);

        return segments.at(-1) ?? null;
    } catch {
        return null;
    }
};

const buildFileLookup = (files: MessageFile[]): Map<string, MessageFile> => {
    const lookup = new Map<string, MessageFile>();

    for (const file of files) {
        lookup.set(file._id, file);
    }

    return lookup;
};

const normalizeFilePart = (part: RawFilePart, filename?: string): FluentMindUIMessage['parts'][number] =>
    ({
        type: 'file',
        url: part.data,
        mediaType: part.mediaType,
        ...(filename && { filename }),
    }) as FluentMindUIMessage['parts'][number];

/**
 * The AI SDK's UIMessage format does not support `type: "image"` parts — the
 * convertMessage pipeline drops them silently. Images must be stored as
 * `type: "file"` parts with an image MIME type. The pipeline then converts those
 * into thread attachments (type "image"), which UserAttachmentRenderer renders.
 */
const getImageMimeType = (extension?: string): string => {
    const ext = extension?.toLowerCase().replace(/^\./, '');
    const mimeTypes: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
    };

    return (ext && mimeTypes[ext]) || 'image/jpeg';
};

const normalizeImagePartAsFilePart = (part: RawImagePart, file?: MessageFile): FluentMindUIMessage['parts'][number] =>
    ({
        type: 'file',
        url: part.image,
        mediaType: getImageMimeType(file?.extension),
        ...(file?.name && { filename: file.name }),
    }) as FluentMindUIMessage['parts'][number];

// App-pane context markers (see create-fluentmind-transport): the transport
// appends a <app_context> block to outgoing user text for the MODEL; persisted
// history therefore carries it, and rendering strips it back out.
export const APP_CONTEXT_OPEN = '<app_context>';
export const APP_CONTEXT_CLOSE = '</app_context>';

const APP_CONTEXT_PATTERN = /\n*<app_context>[\s\S]*?<\/app_context>\s*/g;

const stripAppContext = (text: string): string => text.replace(APP_CONTEXT_PATTERN, '').trimEnd();

const enrichUserParts = (parts: RawMessagePart[], files: MessageFile[] | undefined): FluentMindUIMessage['parts'] => {
    const fileLookup = files?.length ? buildFileLookup(files) : null;

    return parts.map((part) => {
        if (part.type === 'text' && typeof (part as { text?: unknown }).text === 'string') {
            const raw = (part as { text: string }).text;
            const stripped = stripAppContext(raw);

            if (stripped !== raw) return { ...part, text: stripped } as FluentMindUIMessage['parts'][number];
        }

        if (part.type === 'file') {
            const filePart = part as RawFilePart;
            const fileId = extractFileIdFromUrl(filePart.data);
            const matched = fileId && fileLookup ? fileLookup.get(fileId) : undefined;

            return normalizeFilePart(filePart, matched?.name);
        }

        if (part.type === 'image') {
            const imagePart = part as RawImagePart;
            const fileId = extractFileIdFromUrl(imagePart.image);
            const matched = fileId && fileLookup ? fileLookup.get(fileId) : undefined;

            return normalizeImagePartAsFilePart(imagePart, matched);
        }

        return part as FluentMindUIMessage['parts'][number];
    });
};

const withPersistedDataParts = (item: ConversationMessage): FluentMindUIMessage['parts'] => {
    const content = [...item.content] as FluentMindUIMessage['parts'];
    const research = buildMissingResearchParts(item.metadata, content) as FluentMindUIMessage['parts'];
    // Spliced against the run rather than the message head. The grouping spans from the first
    // research part to the last, so rebuilt phases at index 0 would stretch that span over any
    // reasoning or tool step in between — and the card drops the children it swallows.
    const runAt = content.findIndex((part) => isResearchPartType((part as { type?: unknown } | null)?.type));
    const at = runAt === -1 ? 0 : runAt;
    const parts = [...content.slice(0, at), ...research, ...content.slice(at)];

    if (item.metadata?.sources?.length && !hasPartType(parts, 'data-sources')) {
        parts.push({
            type: 'data-sources',
            id: 'web-sources',
            data: item.metadata.sources,
        });
    }

    if (item.metadata?.related_questions?.length && !hasPartType(parts, 'data-suggestions')) {
        parts.push({
            type: 'data-suggestions',
            id: 'related-questions',
            data: item.metadata.related_questions,
        });
    }

    return parts;
};

export function mapHistoryToUIMessages(items: ConversationMessage[], userId?: string): FluentMindUIMessage[] {
    return (
        items
            .map((item): FluentMindUIMessage => {
                if (item.role === 'user') {
                    const deepResearch = buildDeepResearchCustom(item.metadata);

                    return {
                        id: item._id,
                        role: 'user',
                        parts: enrichUserParts(item.content, item.metadata?.files),
                        metadata: deepResearch.deepResearch ? { custom: deepResearch } : undefined,
                    };
                }

                const submittedFeedback = getSubmittedFeedback(item, userId);

                return {
                    id: item._id,
                    role: 'assistant',
                    parts: withPersistedDataParts(item),
                    metadata: {
                        conversationId: item.conversation_id,
                        messageId: item._id,
                        generationStatus: 'completed',
                        ...(submittedFeedback && { submittedFeedback }),
                        custom: {
                            ...(item.created_at && { createdAt: item.created_at }),
                            ...(item.ai_info?.token_usage && { usage: item.ai_info.token_usage }),
                            ...(item.ai_info?.provider && { aiProvider: item.ai_info.provider }),
                            ...(item.ai_info?.model && { aiModel: item.ai_info.model }),
                            // Rehydrate persisted GenUI widget state (spec D5) under `custom`
                            // — assistant-ui only preserves metadata.custom through
                            // importExternalState; top-level fields are dropped on reopen.
                            ...(item.metadata?.genui_state && { genuiState: item.metadata.genui_state }),
                            ...(item.metadata?.partial && { partial: true }),
                            ...(item.metadata?.pending && { pending: true }),
                            ...(item.metadata?.error && { error: item.metadata.error }),
                            ...(item.metadata?.tool_durations && { toolDurations: item.metadata.tool_durations }),
                            ...(item.metadata?.reasoning_ms != null && { reasoningMs: item.metadata.reasoning_ms }),
                            ...buildDeepResearchCustom(item.metadata),
                        },
                    },
                };
            })
            // Only a pending placeholder is dropped: the live stream renders that turn.
            // An aborted turn's zero-part message is real history and stays the leaf.
            .filter(
                (message) =>
                    !(
                        message.role === 'assistant' &&
                        message.parts.length === 0 &&
                        message.metadata?.custom?.pending === true
                    ),
            )
    );
}
