import {
    ArrowUpRightIcon,
    BotIcon,
    CheckCircleIcon,
    CircleOffIcon,
    CircleXIcon,
    FileIcon,
    FileSpreadsheetIcon,
    FileTextIcon,
    FileVideoIcon,
    GlobeIcon,
    ImageIcon,
    Loader2Icon,
    LockIcon,
    PresentationIcon,
    UnlockIcon,
    type LucideIcon,
} from 'lucide-react';
import { type ReactNode, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import type { LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { appMediaApi } from '@/lib/api/app/media';
import { getFilesMultipleDownloadUrl } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { formatEmbeddingStatusLabel, isEmbeddingInProgress, showErrorToast, showSuccessToast } from '@/utils';
import { makeSafeDownloadFilename } from '@/utils/download-filename';

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

export const normalizeExtension = (raw?: string): string => (raw ?? '').replace(/^\.+/, '').toLowerCase();

export const isImageFile = (item: LibraryItem): boolean =>
    IMAGE_EXTENSIONS.includes(normalizeExtension(item.extension)) || item.type === 'Image';
export const isVideoFile = (item: LibraryItem): boolean =>
    VIDEO_EXTENSIONS.includes(normalizeExtension(item.extension)) || item.type === 'Video';
export const isPdfFile = (item: LibraryItem): boolean => PDF_EXTENSIONS.includes(normalizeExtension(item.extension));
export const isHtmlFile = (item: LibraryItem): boolean => HTML_EXTENSIONS.includes(normalizeExtension(item.extension));
export const isMarkdownFile = (item: LibraryItem): boolean =>
    MARKDOWN_EXTENSIONS.includes(normalizeExtension(item.extension));
export const isCodeTextFile = (item: LibraryItem): boolean =>
    CODE_TEXT_EXTENSIONS.includes(normalizeExtension(item.extension));
// SheetJS cannot read .numbers and mammoth reads .docx only, so preview accepts these subsets.
export const PREVIEWABLE_SPREADSHEET_EXTENSIONS = ['csv', 'tsv', 'xls', 'xlsx', 'ods'];
export const PREVIEWABLE_DOC_EXTENSIONS = ['docx'];
export const isSpreadsheetFile = (item: LibraryItem): boolean =>
    PREVIEWABLE_SPREADSHEET_EXTENSIONS.includes(normalizeExtension(item.extension));
export const isDocFile = (item: LibraryItem): boolean =>
    PREVIEWABLE_DOC_EXTENSIONS.includes(normalizeExtension(item.extension));
export const isPreviewable = (item: LibraryItem): boolean =>
    isImageFile(item) ||
    isVideoFile(item) ||
    isPdfFile(item) ||
    isHtmlFile(item) ||
    isMarkdownFile(item) ||
    isCodeTextFile(item) ||
    isSpreadsheetFile(item) ||
    isDocFile(item);

export const fileMeta = (ext: string): { label: string; Icon: LucideIcon } => {
    const e = normalizeExtension(ext);

    if (e === 'pdf') return { label: 'PDF', Icon: FileTextIcon };
    if (IMAGE_EXTENSIONS.includes(e)) return { label: 'Image', Icon: ImageIcon };
    if (VIDEO_EXTENSIONS.includes(e)) return { label: 'Video', Icon: FileVideoIcon };
    if (['doc', 'docx'].includes(e)) return { label: 'Word', Icon: FileTextIcon };
    if (['xls', 'xlsx', 'csv'].includes(e)) return { label: 'Excel', Icon: FileSpreadsheetIcon };
    if (['ppt', 'pptx'].includes(e)) return { label: 'PowerPoint', Icon: PresentationIcon };
    if (e === 'txt') return { label: 'Text', Icon: FileTextIcon };
    if (MARKDOWN_EXTENSIONS.includes(e)) return { label: 'Markdown', Icon: FileTextIcon };

    return { label: 'File', Icon: FileIcon };
};

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
    });
};

interface FileThumbProps {
    item: LibraryItem;
    Icon: LucideIcon;
    className?: string;
    iconClassName?: string;
    fallback?: ReactNode;
}

export const FileThumb = ({ item, Icon, className, iconClassName, fallback }: FileThumbProps) => {
    const [errored, setErrored] = useState(false);
    let imageSrc = '';

    if (isImageFile(item)) {
        imageSrc = item.thumbnailUrl || item.url;
    } else if (isVideoFile(item)) {
        imageSrc = item.thumbnailUrl;
    }
    const showImage = Boolean(imageSrc) && !errored;

    if (showImage) {
        return (
            <img
                src={imageSrc}
                alt=""
                loading="lazy"
                onError={() => setErrored(true)}
                className={className ?? 'size-9 shrink-0 rounded-lg object-cover'}
            />
        );
    }

    if (fallback) return <>{fallback}</>;

    return (
        <span
            className={`flex items-center justify-center rounded-lg bg-primary/10 text-primary ${className ?? 'size-9 shrink-0'}`}
        >
            <Icon className={iconClassName ?? 'size-5'} />
        </span>
    );
};

interface FileIconTileProps {
    Icon: LucideIcon;
    className?: string;
}

export const FileIconTile = ({ Icon, className }: FileIconTileProps) => (
    <span
        className={cn(
            'flex size-full flex-col items-center justify-center gap-2 bg-primary/10 text-primary',
            className,
        )}
    >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-background/80 text-primary shadow-xs">
            <Icon className="size-6" />
        </span>
    </span>
);

interface LibraryBadgesProps {
    item: LibraryItem;
    className?: string;
    showEmbeddingStatus?: boolean;
}

export const hasProminentEmbeddingStatus = (_item: LibraryItem): boolean => false;

const getEmbeddingStatusIcon = (status: string): LucideIcon => {
    const normalizedStatus = status.trim().toLowerCase();

    if (normalizedStatus === 'indexed') return CheckCircleIcon;
    if (normalizedStatus === 'failed') return CircleXIcon;
    if (normalizedStatus === 'not-available') return CircleOffIcon;

    return Loader2Icon;
};

const getEmbeddingStatusIconColor = (status: string): string => {
    const normalizedStatus = status.trim().toLowerCase();

    if (normalizedStatus === 'indexed') return 'text-primary';
    if (normalizedStatus === 'failed') return 'text-destructive';
    if (normalizedStatus === 'not-available') return 'text-text-secondary';

    return 'text-primary';
};

export const LibraryEmbeddingStatusBadge = ({ item, className }: LibraryBadgesProps) => {
    const embeddingStatus = item.embeddingStatus;

    if (!embeddingStatus) return null;

    const label = formatEmbeddingStatusLabel(embeddingStatus);
    const inProgress = isEmbeddingInProgress(embeddingStatus);
    const StatusIcon = getEmbeddingStatusIcon(embeddingStatus);
    const tooltip = item.embeddingError || label;
    const spin = StatusIcon === Loader2Icon;

    return (
        <SimpleTooltip content={tooltip} side="top">
            <span
                aria-label={label}
                className={cn(
                    'flex size-6 shrink-0 items-center justify-center',
                    getEmbeddingStatusIconColor(embeddingStatus),
                    className,
                )}
            >
                <StatusIcon className={cn('size-4', spin && 'animate-spin', inProgress && !spin && 'animate-pulse')} />
            </span>
        </SimpleTooltip>
    );
};

const getVisibilityBadge = (item: LibraryItem): { label: string; Icon: LucideIcon } => {
    if (!item.isPublic) return { label: 'Private', Icon: LockIcon };
    if (item.isMyItem) return { label: 'Public', Icon: UnlockIcon };

    return { label: 'Public', Icon: GlobeIcon };
};

export const LibraryBadges = ({ item, className, showEmbeddingStatus = true }: LibraryBadgesProps) => {
    const { label, Icon } = getVisibilityBadge(item);

    return (
        <div className={cn('flex flex-wrap items-center gap-1', className)}>
            <SimpleTooltip content={label} side="top">
                <span aria-label={label} className="flex size-6 shrink-0 items-center justify-center text-foreground">
                    <Icon className="size-4" />
                </span>
            </SimpleTooltip>
            {showEmbeddingStatus ? <LibraryEmbeddingStatusBadge item={item} /> : null}
        </div>
    );
};

interface LibraryAttributionProps {
    item: LibraryItem;
    className?: string;
    avatarClassName?: string;
    tone?: 'muted' | 'onDark';
    showAgentLink?: boolean;
    nowrap?: boolean;
    onNavigate?: () => void;
}

export const LibraryAttribution = ({
    item,
    className,
    tone = 'muted',
    showAgentLink = true,
    nowrap = false,
    onNavigate,
}: LibraryAttributionProps) => {
    const hasAgent = showAgentLink && Boolean(item.agentSlug && item.agentName);

    if (!item.creatorName && !hasAgent) return null;

    const isDark = tone === 'onDark';

    const agentTo = (() => {
        if (item.originType === 'project' && item.projectId) {
            return `/agent/${item.agentSlug}/spaces/${item.projectId}`;
        }

        if (item.conversationId) {
            return `/agent/${item.agentSlug}/chat/${item.conversationId}`;
        }

        if (item.originType === 'gallery' || item.isGenerated) {
            return `/agent/${item.agentSlug}?lightboxFileId=${item._id}`;
        }

        return `/agent/${item.agentSlug}`;
    })();

    return (
        <div
            className={cn(
                'library-attribution flex items-center gap-x-2 gap-y-0.5 text-xs',
                nowrap ? 'flex-nowrap' : 'flex-wrap',
                isDark ? 'text-white/70' : 'text-text-secondary',
                className,
            )}
        >
            {item.creatorName ? (
                <span className="flex min-w-0 items-center gap-1">
                    <span className="truncate">{item.creatorName}</span>
                </span>
            ) : null}
            {item.creatorName && hasAgent ? (
                <span aria-hidden className="inline-block size-1 shrink-0 rounded-full bg-muted-foreground" />
            ) : null}
            {hasAgent ? (
                <Link
                    to={agentTo}
                    onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.();
                    }}
                    className={cn(
                        'group/agent flex min-w-0 items-center gap-1 font-medium underline! hover:text-white!',
                        isDark ? 'text-white hover:text-white!' : 'text-primary hover:text-primary!',
                    )}
                >
                    <BotIcon className="size-3.5 shrink-0 group-hover/agent:hidden" />
                    <ArrowUpRightIcon className="hidden size-3.5 shrink-0 group-hover/agent:block" />
                    <span className="truncate">{item.agentName}</span>
                </Link>
            ) : null}
        </div>
    );
};

export const useLibraryDownload = () => {
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [isBulkDownloading, setIsBulkDownloading] = useState(false);

    const downloadOne = useCallback(async (item: LibraryItem) => {
        const blob = await appMediaApi.downloadBlob(item.url);
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        const rawName = item.name || item.title || '';
        const dotIndex = rawName.lastIndexOf('.');
        const baseName = dotIndex > 0 ? rawName.slice(0, dotIndex) : rawName;

        link.href = downloadUrl;
        link.download = makeSafeDownloadFilename(baseName, {
            extension: item.extension,
            fallbackBaseName: 'file',
        });
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
    }, []);

    const downloadFile = useCallback(
        async (item: LibraryItem) => {
            try {
                setDownloadingId(item._id);
                await downloadOne(item);
                showSuccessToast('File downloaded');
            } catch (error) {
                console.error('Error downloading file:', error);
                showErrorToast('Failed to download file. Please try again later.');
            } finally {
                setDownloadingId(null);
            }
        },
        [downloadOne],
    );

    const downloadZip = useCallback(async (items: LibraryItem[]) => {
        const url = getFilesMultipleDownloadUrl(items.map((item) => item._id));
        const blob = await appMediaApi.downloadBlob(url);
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = downloadUrl;
        link.download = 'files.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
    }, []);

    const downloadFiles = useCallback(
        async (items: LibraryItem[]) => {
            if (items.length === 0) return;
            if (items.length === 1) {
                await downloadFile(items[0]);

                return;
            }

            try {
                setIsBulkDownloading(true);
                await downloadZip(items);
                showSuccessToast(`Downloaded ${items.length} files`);
            } catch (error) {
                console.error('Error downloading files:', error);
                showErrorToast('Failed to download files. Please try again later.');
            } finally {
                setIsBulkDownloading(false);
            }
        },
        [downloadFile, downloadZip],
    );

    return {
        downloadFile,
        downloadFiles,
        downloadingId,
        isBulkDownloading,
    };
};
