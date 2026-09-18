import { DownloadIcon, Loader2Icon, MessageSquareIcon, MoreVerticalIcon, TrashIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { artifactConversationPath } from '@/components/agent-chat/artifact/artifact-url';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ArtifactHead } from '@/lib/api/app/artifact';
import { cn } from '@/lib/utils';

import { artifactTypeMeta } from './artifact-type-meta';
import { formatFileDate } from './file-preview';
import { getLibraryListGridCols } from './library-file-row';

interface Props {
    artifact: ArtifactHead;
    onOpen: (artifact: ArtifactHead) => void;
    onDownload: (artifact: ArtifactHead) => void;
    onDelete: (artifact: ArtifactHead) => void;
    downloadingId: string | null;
    agentSlug?: string;
    currentUserId?: string;
    selectable?: boolean;
    allSelected?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
}

const LibraryArtifactRow = (props: Props) => {
    const {
        artifact,
        onOpen,
        onDownload,
        onDelete,
        downloadingId,
        agentSlug,
        currentUserId,
        selectable = false,
        allSelected = false,
        isFirst = false,
        isLast = false,
    } = props;
    const { label, Icon } = artifactTypeMeta(artifact.artifactType);
    const dateLabel = formatFileDate(artifact.updatedAt) || '—';
    const chatPath = agentSlug
        ? artifactConversationPath(agentSlug, artifact.conversationId, artifact.slug)
        : undefined;
    const isMine = Boolean(currentUserId) && artifact.creatorId === currentUserId;

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen(artifact);
        }
    };

    const renderActions = () => (
        <div
            className="flex shrink-0 items-center justify-end opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
        >
            <DropdownMenuRoot>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${artifact.title}`}
                        className="cursor-pointer text-text-secondary hover:text-foreground"
                    >
                        <MoreVerticalIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                    {chatPath ? (
                        <DropdownMenuItem asChild className="cursor-pointer">
                            <Link to={chatPath} className="text-foreground!">
                                <MessageSquareIcon />
                                <span>Open chat</span>
                            </Link>
                        </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                        className="cursor-pointer"
                        disabled={downloadingId === artifact.artifactId}
                        onSelect={(e) => e.preventDefault()}
                        onClick={() => onDownload(artifact)}
                    >
                        {downloadingId === artifact.artifactId ? (
                            <Loader2Icon className="animate-spin" />
                        ) : (
                            <DownloadIcon />
                        )}
                        <span>Download</span>
                    </DropdownMenuItem>
                    {isMine ? (
                        <DropdownMenuItem
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => onDelete(artifact)}
                        >
                            <TrashIcon />
                            <span>Delete</span>
                        </DropdownMenuItem>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenuRoot>
        </div>
    );

    return (
        <div
            className={cn(
                'library-artifact-row group grid cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-140',
                getLibraryListGridCols(selectable),
                allSelected && 'rounded-none',
                allSelected && isFirst && 'rounded-t-lg',
                allSelected && isLast && 'rounded-b-lg',
            )}
            role="button"
            tabIndex={0}
            aria-label={`Open ${artifact.title}`}
            onClick={() => onOpen(artifact)}
            onKeyDown={handleKeyDown}
        >
            {selectable ? <span aria-hidden /> : null}

            <div className="library-artifact-row-content flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="line-clamp-1 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                            {artifact.title}
                        </span>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Artifact
                        </span>
                    </span>
                    <span className="line-clamp-1 text-xs text-text-secondary">{label}</span>
                </div>
            </div>

            <span className="hidden text-sm text-text-secondary sm:block">{dateLabel}</span>
            <span className="hidden text-sm text-text-secondary sm:block">—</span>

            {renderActions()}
        </div>
    );
};

export default LibraryArtifactRow;
