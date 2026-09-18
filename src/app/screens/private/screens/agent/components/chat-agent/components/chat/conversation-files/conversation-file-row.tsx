import {
    EmbeddingStatusBadge,
    FileThumb,
    SURFACE_HOVER_CLASS_NAME,
    formatFileDate,
    formatFileSize,
} from '@/components/file-list';
import { cn } from '@/lib/utils';

import { fileMeta } from '../../library/file-preview';

import type { ConversationFile } from './conversation-file';

interface Props {
    file: ConversationFile;
    onOpen: (file: ConversationFile) => void;
    /**
     * Off by default: inside a chat every file is the current user's, so the name is noise.
     * Shared, multi-member surfaces (a space's Files tab) turn it on.
     */
    showCreator?: boolean;
}

const ConversationFileRow = ({ file, onOpen, showCreator = false }: Props) => {
    const generatedLabel = file.modelName ? `Generated · ${file.modelName}` : 'Generated';
    const meta = [
        fileMeta(file.extension).label,
        formatFileSize(file.size),
        formatFileDate(file.createdAt),
        showCreator ? file.creatorName : null,
        file.isGenerated ? generatedLabel : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const isInteractive = file.previewable || Boolean(file.url);

    const handleOpen = () => {
        if (file.previewable) {
            onOpen(file);

            return;
        }

        if (file.url) window.open(file.url, '_blank', 'noopener');
    };

    return (
        <li
            className={cn(
                'group flex items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0',
                'transition-colors duration-140',
                SURFACE_HOVER_CLASS_NAME,
                isInteractive && 'cursor-pointer',
            )}
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            onClick={isInteractive ? handleOpen : undefined}
            onKeyDown={
                isInteractive
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleOpen();
                          }
                      }
                    : undefined
            }
        >
            <FileThumb
                thumbnailUrl={file.thumbnailUrl}
                extension={file.extension}
                fileName={file.name}
                isImage={file.isImage}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-1 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {file.name}
                </span>
                <span className="text-xs text-text-secondary">{meta}</span>
            </span>
            <EmbeddingStatusBadge status={file.embeddingStatus} error={file.embeddingError} />
        </li>
    );
};

export default ConversationFileRow;
