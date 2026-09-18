import { format } from 'date-fns';

const DEFAULT_MAX_BASENAME_LENGTH = 80;
const PROMPT_SLUG_MAX_WORDS = 4;

const MEDIA_EXTENSIONS = new Set([
    'apng',
    'avif',
    'gif',
    'jpeg',
    'jpg',
    'm4v',
    'mov',
    'mp4',
    'mpeg',
    'mpg',
    'png',
    'svg',
    'webm',
    'webp',
]);

interface MakeSafeDownloadFilenameOptions {
    extension?: string;
    fallbackBaseName?: string;
    maxBaseNameLength?: number;
    agentName?: string;
    createdAt?: number;
    promptSummary?: string;
}

const normalizeExtension = (extension?: string): string => {
    if (!extension) return '';

    const trimmed = extension.trim().replace(/^\.+/, '').toLowerCase();

    return trimmed ? `.${trimmed}` : '';
};

const splitKnownExtension = (name: string): { baseName: string; extension: string } => {
    const lastDotIndex = name.lastIndexOf('.');

    if (lastDotIndex <= 0 || lastDotIndex === name.length - 1) {
        return { baseName: name, extension: '' };
    }

    const extension = name.slice(lastDotIndex + 1).toLowerCase();

    if (!MEDIA_EXTENSIONS.has(extension)) {
        return { baseName: name, extension: '' };
    }

    return {
        baseName: name.slice(0, lastDotIndex),
        extension: `.${extension}`,
    };
};

const stripControlCharacters = (name: string): string => {
    return Array.from(name)
        .filter((character) => {
            const code = character.charCodeAt(0);

            return code > 31 && code !== 127;
        })
        .join('');
};

const sanitizeBaseName = (name: string, fallbackBaseName: string): string => {
    const baseName = stripControlCharacters(name)
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-. ]+/, '')
        .replace(/[-. ]+$/, '')
        .trim();

    return baseName || fallbackBaseName;
};

const truncateBaseName = (baseName: string, maxLength: number): string => {
    const characters = Array.from(baseName);

    if (characters.length <= maxLength) {
        return baseName;
    }

    return characters.slice(0, maxLength).join('').replace(/-+$/g, '');
};

const buildPromptSlug = (prompt: string): string => {
    return prompt
        .trim()
        .split(/\s+/)
        .slice(0, PROMPT_SLUG_MAX_WORDS)
        .join('-')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
};

const buildMediaBaseName = (agentName: string, createdAt?: number, promptSummary?: string): string => {
    const datePart = createdAt ? `-${format(new Date(createdAt), 'yyyyMMdd')}` : '';
    const promptSlug = promptSummary ? buildPromptSlug(promptSummary) : '';
    const promptPart = promptSlug ? `-${promptSlug}` : '';

    return `${agentName}${datePart}${promptPart}`;
};

export const makeSafeDownloadFilename = (
    name: string | null | undefined,
    options: MakeSafeDownloadFilenameOptions = {},
): string => {
    const { agentName, createdAt, promptSummary } = options;
    const resolvedName = agentName != null ? buildMediaBaseName(agentName, createdAt, promptSummary) : name;
    const fallbackBaseName = options.fallbackBaseName || (agentName != null ? 'media' : 'download');
    const maxBaseNameLength = options.maxBaseNameLength || DEFAULT_MAX_BASENAME_LENGTH;
    const { baseName, extension: existingExtension } = splitKnownExtension(resolvedName || '');
    const safeBaseName = sanitizeBaseName(baseName, fallbackBaseName);
    const truncatedBaseName = truncateBaseName(safeBaseName, maxBaseNameLength);
    const extension = existingExtension || normalizeExtension(options.extension);

    return `${truncatedBaseName.toLowerCase()}${extension}`;
};
