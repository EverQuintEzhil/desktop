import { DownloadIcon, Loader2Icon, MessageSquareIcon, TrashIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { artifactConversationPath } from '@/components/agent-chat/artifact/artifact-url';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { ArtifactHead } from '@/lib/api/app/artifact';
import { cn } from '@/lib/utils';

import { artifactTypeMeta } from './artifact-type-meta';
import { FileIconTile, formatFileDate } from './file-preview';

const SURFACE_HOVER_CLASS_NAME = 'hover:bg-(--surface-hover) hover:shadow-(--shadow-surface)';

interface Props {
    artifact: ArtifactHead;
    onOpen: (artifact: ArtifactHead) => void;
    onDownload: (artifact: ArtifactHead) => void;
    onDelete: (artifact: ArtifactHead) => void;
    downloadingId: string | null;
    agentSlug?: string;
    currentUserId?: string;
}

const LibraryArtifactCard = (props: Props) => {
    const { artifact, onOpen, onDownload, onDelete, downloadingId, agentSlug, currentUserId } = props;
    const { label, Icon } = artifactTypeMeta(artifact.artifactType);
    const meta = [label, formatFileDate(artifact.updatedAt)].filter(Boolean).join(' · ');
    const chatPath = agentSlug
        ? artifactConversationPath(agentSlug, artifact.conversationId, artifact.slug)
        : undefined;
    const isMine = Boolean(currentUserId) && artifact.creatorId === currentUserId;

    const renderOpenChat = () => {
        if (!chatPath) return null;

        return (
            <SimpleTooltip content="Open chat" side="bottom">
                <Button
                    asChild
                    variant="black"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={`Open chat for ${artifact.title}`}
                >
                    <Link to={chatPath} className="text-white!">
                        <MessageSquareIcon />
                    </Link>
                </Button>
            </SimpleTooltip>
        );
    };

    const renderDelete = () => {
        if (!isMine) return null;

        return (
            <SimpleTooltip content="Delete" side="bottom">
                <Button
                    variant="black"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={`Delete ${artifact.title}`}
                    onClick={() => onDelete(artifact)}
                >
                    <TrashIcon />
                </Button>
            </SimpleTooltip>
        );
    };

    const renderActions = () => (
        <div
            className={cn(
                'library-artifact-card-actions absolute top-4 right-4 flex items-center gap-1 rounded-full bg-black/45 p-0.5',
                'opacity-100 transition-opacity focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100',
            )}
        >
            {renderOpenChat()}
            <SimpleTooltip content="Download" side="bottom">
                <Button
                    variant="black"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={`Download ${artifact.title}`}
                    disabled={downloadingId === artifact.artifactId}
                    onClick={() => onDownload(artifact)}
                >
                    {downloadingId === artifact.artifactId ? (
                        <Loader2Icon className="animate-spin" />
                    ) : (
                        <DownloadIcon />
                    )}
                </Button>
            </SimpleTooltip>
            {renderDelete()}
        </div>
    );

    return (
        <div
            className={cn(
                'library-artifact-card group relative flex h-full flex-col overflow-hidden rounded-2xl bg-card transition-[background-color,box-shadow] duration-140',
                SURFACE_HOVER_CLASS_NAME,
            )}
        >
            <button
                type="button"
                onClick={() => onOpen(artifact)}
                aria-label={`Open ${artifact.title}`}
                className={cn(
                    'relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden bg-background',
                    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                )}
            >
                <FileIconTile Icon={Icon} />
            </button>

            <span className="library-artifact-card-tag absolute top-4 left-4 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Artifact
            </span>

            {renderActions()}

            <div className="library-artifact-card-content flex flex-1 flex-col p-4">
                <h4 className="truncate leading-5 font-medium text-foreground transition-colors group-hover:text-primary">
                    {artifact.title}
                </h4>
                <span className="line-clamp-1 text-xs text-text-secondary">{meta}</span>
            </div>
        </div>
    );
};

export default LibraryArtifactCard;
