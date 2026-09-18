import {
    FileArchiveIcon,
    FileAudioIcon,
    FileCodeIcon,
    FileIcon,
    FileSpreadsheetIcon,
    FileTextIcon,
    FileVideoIcon,
    ImageIcon,
    PresentationIcon,
    type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v', 'ogg'];
export const PDF_EXTENSIONS = ['pdf'];
export const HTML_EXTENSIONS = ['html', 'htm'];
export const MARKDOWN_EXTENSIONS = ['md', 'markdown'];
export const CODE_TEXT_EXTENSIONS = [
    'txt',
    'json',
    'js',
    'jsx',
    'ts',
    'tsx',
    'css',
    'scss',
    'less',
    'yaml',
    'yml',
    'xml',
    'sh',
    'py',
    'go',
    'java',
    'rb',
    'php',
    'sql',
    'log',
];
export const DOCUMENT_EXTENSIONS = ['docx', 'doc', 'rtf', 'odt', 'pages'];
export const SPREADSHEET_EXTENSIONS = ['xlsx', 'xls', 'csv', 'tsv', 'ods', 'numbers'];
// SheetJS cannot read .numbers and mammoth reads .docx only, so preview accepts these subsets.
export const PREVIEWABLE_SPREADSHEET_EXTENSIONS = ['csv', 'tsv', 'xls', 'xlsx', 'ods'];
export const PREVIEWABLE_DOC_EXTENSIONS = ['docx'];
export const PRESENTATION_EXTENSIONS = ['pptx', 'ppt', 'odp', 'key'];
export const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz'];
// `ogg` is also in VIDEO_EXTENSIONS, which drives previewing; a chat attachment with that extension
// is far more often audio, so the icon lookup checks this list first while previewing is unchanged.
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wma', 'aiff', 'mid'];

export const normalizeExt = (raw?: string): string => (raw ?? '').replace(/^\.+/, '').toLowerCase();

export const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }

    return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};

export const formatFileDate = (value?: number | string): string => {
    if (!value) return '';
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

export const fileIconFor = (ext?: string): LucideIcon => {
    const e = normalizeExt(ext);

    if (e === 'pdf') return FileTextIcon;
    if (IMAGE_EXTENSIONS.includes(e)) return ImageIcon;
    if (AUDIO_EXTENSIONS.includes(e)) return FileAudioIcon;
    if (VIDEO_EXTENSIONS.includes(e)) return FileVideoIcon;
    if (['doc', 'docx'].includes(e)) return FileTextIcon;
    if (['xls', 'xlsx', 'csv'].includes(e)) return FileSpreadsheetIcon;
    if (['ppt', 'pptx'].includes(e)) return PresentationIcon;
    if (e === 'txt') return FileTextIcon;
    if (MARKDOWN_EXTENSIONS.includes(e)) return FileTextIcon;
    if (HTML_EXTENSIONS.includes(e)) return FileCodeIcon;
    if (CODE_TEXT_EXTENSIONS.includes(e)) return FileCodeIcon;
    if (ARCHIVE_EXTENSIONS.includes(e)) return FileArchiveIcon;

    return FileIcon;
};

export interface SharedFileItem {
    extension?: string;
    name?: string;
    type?: string;
    url?: string;
}

export interface StagedFileStatus {
    id: string;
    file: File;
    isUploading: boolean;
    hasError: boolean;
    progress: number;
    abortController?: AbortController;
    isSuccess?: boolean;
    isAwaitingSync?: boolean;
    uploadedId?: string;
    syncStartedAt?: number;
}

export const isImageByExt = (ext?: string): boolean => IMAGE_EXTENSIONS.includes(normalizeExt(ext));
export const isVideoByExt = (ext?: string): boolean => VIDEO_EXTENSIONS.includes(normalizeExt(ext));
export const isPdfByExt = (ext?: string): boolean => PDF_EXTENSIONS.includes(normalizeExt(ext));
export const isHtmlByExt = (ext?: string): boolean => HTML_EXTENSIONS.includes(normalizeExt(ext));
export const isMarkdownByExt = (ext?: string): boolean => MARKDOWN_EXTENSIONS.includes(normalizeExt(ext));
export const isCodeTextByExt = (ext?: string): boolean => CODE_TEXT_EXTENSIONS.includes(normalizeExt(ext));
export const isSpreadsheetByExt = (ext?: string): boolean =>
    PREVIEWABLE_SPREADSHEET_EXTENSIONS.includes(normalizeExt(ext));
export const isDocByExt = (ext?: string): boolean => PREVIEWABLE_DOC_EXTENSIONS.includes(normalizeExt(ext));

export const extensionOf = (item: SharedFileItem): string =>
    normalizeExt(item.extension ?? item.name?.split('.').pop());

export const isImageFile = (item: SharedFileItem): boolean =>
    isImageByExt(extensionOf(item)) || (item.type?.toLowerCase().includes('image') ?? false);
export const isVideoFile = (item: SharedFileItem): boolean =>
    isVideoByExt(extensionOf(item)) || (item.type?.toLowerCase().includes('video') ?? false);
export const isPdfFile = (item: SharedFileItem): boolean =>
    isPdfByExt(extensionOf(item)) || (item.type?.toLowerCase().includes('pdf') ?? false);
export const isHtmlFile = (item: SharedFileItem): boolean => isHtmlByExt(extensionOf(item));
export const isMarkdownFile = (item: SharedFileItem): boolean => isMarkdownByExt(extensionOf(item));
export const isCodeTextFile = (item: SharedFileItem): boolean => isCodeTextByExt(extensionOf(item));
export const isSpreadsheetFile = (item: SharedFileItem): boolean => isSpreadsheetByExt(extensionOf(item));
export const isDocFile = (item: SharedFileItem): boolean => isDocByExt(extensionOf(item));

export const isPreviewableFile = (item: SharedFileItem): boolean =>
    isImageFile(item) ||
    isVideoFile(item) ||
    isPdfFile(item) ||
    isHtmlFile(item) ||
    isMarkdownFile(item) ||
    isCodeTextFile(item) ||
    isSpreadsheetFile(item) ||
    isDocFile(item);

export const SURFACE_HOVER_CLASS_NAME = 'hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]';
export const BORDER_HOVER_CLASS_NAME = 'hover:border-[color-mix(in_srgb,var(--primary)_20%,var(--border))]';

export const ACTION_BUTTON_CLASS_NAME = cn(
    'shrink-0 rounded-full text-text-secondary opacity-0',
    'transition-[opacity,color,background-color] duration-140',
    'group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100',
);
