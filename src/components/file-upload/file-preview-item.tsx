import { TriangleAlertIcon, XIcon } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import FileTypeIcon from '@/components/file-type-icon';
import { Button } from '@/components/ui/button';
import '@/styles/file-preview.scss';
import '@/components/chat/primitives/use-file-renders.scss';
import { cn } from '@/lib/utils';
import type { FileType } from '@/types/chat';

import FileUploadRetryButton from './file-upload-retry-button';

export type FilePreviewTone = 'dark' | 'light';

interface Props {
    file: FileType;
    tone?: FilePreviewTone;
    onRemove?: () => void;
    onRetry?: (tempId: string) => void;
    onPreview?: (file: FileType) => void;
    disableRemove?: boolean;
}

const isImageFile = (file: FileType) => file.type?.toLowerCase() === 'image';

const FilePreviewItem = ({ file, tone = 'dark', onRemove, onRetry, onPreview, disableRemove }: Props) => {
    const progress = file.uploadProgress || 0;
    const canPreview = Boolean(onPreview) && !file.isUploading && !file.uploadError;

    const handlePreview = () => {
        onPreview?.(file);
    };

    const handlePreviewKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handlePreview();
    };

    const renderErrorAction = (iconClassName?: string) => {
        if (onRetry) {
            return (
                <FileUploadRetryButton
                    message={file.uploadErrorMessage}
                    onRetry={() => file.tempId && onRetry(file.tempId)}
                    iconClassName={iconClassName}
                />
            );
        }

        return <TriangleAlertIcon className="size-4" />;
    };

    const progressRingBackground = `conic-gradient(var(--text-primary) calc(${progress} * 1deg * 3.6), var(--border-secondary) 0deg)`;

    const renderStateRing = () => {
        if (tone === 'light') {
            return (
                <div className="uploading-state flex items-center justify-center">
                    <div
                        className="upload-progress-ring flex h-8 w-8 items-center justify-center rounded-circle"
                        style={{ background: progressRingBackground }}
                    />
                </div>
            );
        }

        return (
            <div className="uploading-state flex h-8 w-8 items-center justify-center">
                <div
                    className="upload-progress-ring relative flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ background: progressRingBackground }}
                />
            </div>
        );
    };

    const renderFileState = () => {
        if (file.isUploading) {
            return renderStateRing();
        }

        if (file.uploadError) {
            return (
                <div className="error-state flex items-center justify-center">
                    {renderErrorAction(tone === 'dark' ? 'text-(--text-primary)!' : undefined)}
                </div>
            );
        }

        // No tone colour here: the glyph carries its own per-family accent in both themes.
        return (
            <div className="thumbnail flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
                <FileTypeIcon file={file} />
            </div>
        );
    };

    const renderImageOverlay = () => {
        if (file.isUploading) {
            return (
                <div className="file-preview-overlay absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                    <div
                        className="upload-progress-ring relative flex h-6 w-6 items-center justify-center rounded-full"
                        style={{
                            background: `conic-gradient(#fff calc(${progress} * 1deg * 3.6), rgba(255,255,255,0.3) 0deg)`,
                        }}
                    />
                </div>
            );
        }

        if (file.uploadError) {
            return (
                <div className="file-preview-overlay absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                    {renderErrorAction('text-white')}
                </div>
            );
        }

        return null;
    };

    const renderContent = () => {
        if (isImageFile(file)) {
            return (
                <figure
                    className={cn(
                        tone === 'light' ? 'upload-file-thumbnail' : 'file-preview-figure',
                        'relative block h-[42px] w-[42px] shrink-0 overflow-hidden rounded-md',
                        canPreview ? 'cursor-pointer' : '',
                    )}
                    role={canPreview ? 'button' : undefined}
                    tabIndex={canPreview ? 0 : undefined}
                    aria-label={canPreview ? `Preview ${file.name}` : undefined}
                    onClick={canPreview ? handlePreview : undefined}
                    onKeyDown={canPreview ? handlePreviewKeyDown : undefined}
                >
                    <img src={file.url} alt={file.name} className={file.isUploading ? 'opacity-50' : 'opacity-100'} />
                    {renderImageOverlay()}
                </figure>
            );
        }

        return (
            <div
                className={cn(
                    tone === 'light'
                        ? 'custom-thumbnail-wrapper ask-here flex w-full max-w-[240px] items-center gap-2 rounded-md p-1'
                        : 'custom-thumbnail-wrapper thumbnail-wrapper flex min-h-10 w-full max-w-[240px] items-center rounded-lg',
                    canPreview ? 'file-preview-activatable' : '',
                )}
                role={canPreview ? 'button' : undefined}
                tabIndex={canPreview ? 0 : undefined}
                aria-label={canPreview ? `Preview ${file.name}` : undefined}
                onClick={canPreview ? handlePreview : undefined}
                onKeyDown={canPreview ? handlePreviewKeyDown : undefined}
            >
                {renderFileState()}
                <span className={tone === 'light' ? 'text-sm' : 'text-xs'}>{file.name}</span>
            </div>
        );
    };

    return (
        <div className="image-list-item relative flex">
            {renderContent()}
            {onRemove ? (
                <Button size="icon-sm" variant="outline" disabled={disableRemove} onClick={onRemove}>
                    <XIcon />
                </Button>
            ) : null}
        </div>
    );
};

export default FilePreviewItem;
