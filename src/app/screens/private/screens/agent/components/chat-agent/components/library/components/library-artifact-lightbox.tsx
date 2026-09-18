import { MessageSquareIcon, TrashIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ArtifactFav, ArtifactVisibilityChip } from '@/app/components/artifact-file-meta';
import { useOverlayManager } from '@/app/hooks';
import { ArtifactCopySplit } from '@/components/agent-chat/artifact/artifact-copy-split';
import { artifactFileName } from '@/components/agent-chat/artifact/artifact-download';
import { ArtifactSkeleton } from '@/components/agent-chat/artifact/artifact-skeleton';
import { type ArtifactViewMode, PREVIEWABLE_ARTIFACT_TYPES } from '@/components/agent-chat/artifact/artifact-types';
import { artifactConversationPath } from '@/components/agent-chat/artifact/artifact-url';
import { ArtifactVersionMenu } from '@/components/agent-chat/artifact/artifact-version-menu';
import { ArtifactView } from '@/components/agent-chat/artifact/artifact-view';
import { ArtifactViewToggle } from '@/components/agent-chat/artifact/artifact-view-toggle';
import { isMenuLayerOpen } from '@/components/agent-chat/artifact/is-menu-layer-open';
import { useArtifactVersion, useArtifactVersions } from '@/components/agent-chat/artifact/use-artifact';
import { useArtifactFileMeta } from '@/components/agent-chat/artifact/use-artifact-file-meta';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { ArtifactHead } from '@/lib/api/app/artifact';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';

import { formatFileDate } from '../file-preview';

const VERSION_ERROR = 'This artifact could not be opened. Please try again.';

interface Props {
    artifact: ArtifactHead;
    agentId: string;
    agentSlug?: string;
    currentUserId?: string;
    onDelete?: (artifact: ArtifactHead) => void;
    onClose: () => void;
}

const LibraryArtifactLightbox = (props: Props) => {
    const { artifact, agentId, agentSlug: agentSlugProp, currentUserId, onDelete, onClose } = props;

    const { agentId: routeAgentSlug } = useParams();
    const agentSlug = agentSlugProp ?? routeAgentSlug;
    const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
    const [view, setView] = useState<ArtifactViewMode>('preview');

    const displayedVersionNumber = selectedVersionNumber ?? artifact.latestVersion;

    useOverlayManager(true);

    const { data: versions } = useArtifactVersions(agentId, artifact.artifactId);
    const versionQuery = useArtifactVersion(agentId, artifact.artifactId, displayedVersionNumber);
    const fileMeta = useArtifactFileMeta(artifact.artifactId, currentUserId);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || isMenuLayerOpen()) return;

            onClose();
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [onClose]);

    const version = versionQuery.data;
    const artifactType = version?.artifactType ?? artifact.artifactType;
    const canPreview = PREVIEWABLE_ARTIFACT_TYPES.has(artifactType);
    const mode: ArtifactViewMode = canPreview ? view : 'code';
    const fileName = artifactFileName({
        title: artifact.title || artifact.slug,
        artifactType,
        language: version?.language ?? artifact.language,
    });

    const authorName = versions?.find((meta) => meta.versionNumber === displayedVersionNumber)?.authorName;
    const chatPath = agentSlug
        ? artifactConversationPath(agentSlug, artifact.conversationId, artifact.slug)
        : undefined;
    const canDelete = Boolean(onDelete) && Boolean(currentUserId) && artifact.creatorId === currentUserId;

    const renderHeading = () => {
        const chips = [
            authorName,
            fileName,
            formatFileDate(artifact.updatedAt),
            artifact.lastAuthorKind === 'user' ? 'Edited' : 'Generated',
        ].filter(Boolean);

        return (
            <div className="library-artifact-lightbox-heading flex min-w-0 flex-1 flex-col gap-0.5">
                <h4 className="truncate text-sm font-medium text-foreground">{artifact.title}</h4>
                <div className="library-artifact-lightbox-details flex min-w-0 items-center gap-2 text-xs whitespace-nowrap text-text-secondary">
                    {chips.map((chip, index) => (
                        <span key={chip} className="flex min-w-0 items-center gap-2">
                            {index > 0 ? (
                                <span aria-hidden className="opacity-50">
                                    ·
                                </span>
                            ) : null}
                            <span className="truncate">{chip}</span>
                        </span>
                    ))}
                    {fileMeta ? (
                        <>
                            {chips.length > 0 ? (
                                <span aria-hidden className="opacity-50">
                                    ·
                                </span>
                            ) : null}
                            <ArtifactVisibilityChip meta={fileMeta} />
                        </>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderOpenChat = () => {
        if (!chatPath) return null;

        return (
            <SimpleTooltip content="Open chat" side="bottom">
                <Button asChild variant="ghost" size="icon-sm" aria-label="Open chat" className="text-muted-foreground">
                    <Link to={chatPath}>
                        <MessageSquareIcon />
                    </Link>
                </Button>
            </SimpleTooltip>
        );
    };

    const renderDelete = () => {
        if (!canDelete) return null;

        return (
            <SimpleTooltip content="Delete" side="bottom">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete"
                    className="text-muted-foreground"
                    onClick={() => {
                        onClose();
                        onDelete?.(artifact);
                    }}
                >
                    <TrashIcon />
                </Button>
            </SimpleTooltip>
        );
    };

    const renderFav = () => {
        if (!fileMeta || !currentUserId) return null;

        return <ArtifactFav artifactId={artifact.artifactId} meta={fileMeta} userId={currentUserId} />;
    };

    const renderHeaderActions = () => (
        <div className="library-artifact-lightbox-actions flex shrink-0 items-center gap-1">
            {renderFav()}
            {canPreview ? <ArtifactViewToggle view={view} onViewChange={setView} /> : null}
            <ArtifactVersionMenu
                versions={versions}
                versionNumber={displayedVersionNumber}
                latestVersion={artifact.latestVersion}
                onVersionChange={setSelectedVersionNumber}
            />
            {version ? (
                <ArtifactCopySplit version={version} agentSlug={agentSlug} artifactId={artifact.artifactId} />
            ) : null}
            {renderOpenChat()}
            {renderDelete()}
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={onClose}
                className="text-muted-foreground hover:bg-background hover:text-foreground"
            >
                <XIcon />
            </Button>
        </div>
    );

    const renderBody = () => {
        if (versionQuery.isPending) return <ArtifactSkeleton />;

        if (!version) {
            return (
                <div
                    role="alert"
                    className="flex min-h-0 flex-1 items-center justify-center border-t border-border px-6 text-center text-sm text-muted-foreground"
                >
                    {getApiErrorMessage(versionQuery.error, VERSION_ERROR)}
                </div>
            );
        }

        return (
            <div className="library-artifact-lightbox-document relative min-h-0 flex-1 overflow-hidden border-t border-border">
                <ArtifactView version={version} mode={mode} className="absolute inset-0" />
            </div>
        );
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={artifact.title}
            data-slot="library-artifact-lightbox"
            className="library-artifact-lightbox fixed inset-0 z-51 flex flex-col bg-card"
        >
            <div className="library-artifact-lightbox-header flex min-h-12 items-center justify-between gap-3 border-b border-border py-2 pr-3 pl-3">
                {renderHeading()}
                {renderHeaderActions()}
            </div>
            <div className="library-artifact-lightbox-body flex min-h-0 flex-1 flex-col overflow-hidden">
                {renderBody()}
            </div>
        </div>
    );
};

export default LibraryArtifactLightbox;
