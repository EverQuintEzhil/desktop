import { MaximizeIcon, MinimizeIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { cn } from '@/lib/utils';

import { useIsPaneOverlay } from '../hooks/use-is-pane-overlay';
import { usePaneResize } from '../hooks/use-pane-resize';

import { ArtifactCopySplit } from './artifact-copy-split';
import { artifactFileName } from './artifact-download';
import { ArtifactSkeleton } from './artifact-skeleton';
import type { ArtifactPointer, ArtifactViewMode } from './artifact-types';
import { PREVIEWABLE_ARTIFACT_TYPES } from './artifact-types';
import { ArtifactVersionMenu } from './artifact-version-menu';
import { ArtifactView } from './artifact-view';
import { ArtifactViewToggle } from './artifact-view-toggle';
import { isMenuLayerOpen } from './is-menu-layer-open';
import { useArtifactHead, useArtifactVersion, useArtifactVersions } from './use-artifact';

const PANE_WIDTH_STORAGE_KEY = 'artifact-pane-width';

const VERSION_ERROR_FALLBACK = 'This artifact could not be loaded.';

interface ArtifactPaneBodyProps {
    isVisible: boolean;
    isNarrow: boolean;
    agentId: string;
    agentSlug?: string;
    artifactId: string;
    slug: string;
    title: string;
    versionNumber: number;
    onClose: () => void;
}

const ArtifactPaneBody = ({
    isVisible,
    isNarrow,
    agentId,
    agentSlug,
    artifactId,
    slug,
    title,
    versionNumber,
    onClose,
}: ArtifactPaneBodyProps) => {
    const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
    const [view, setView] = useState<ArtifactViewMode>('preview');
    const [isFullscreen, setIsFullscreen] = useState(false);

    const { width, isResizing, handleProps } = usePaneResize(PANE_WIDTH_STORAGE_KEY);

    const isOverlay = isNarrow || isFullscreen;

    const { data: head } = useArtifactHead(agentId, artifactId);
    const { data: versions } = useArtifactVersions(agentId, artifactId);

    const displayedVersionNumber = selectedVersionNumber ?? versionNumber;
    const { data: version, isPending, error } = useArtifactVersion(agentId, artifactId, displayedVersionNumber);

    const handleClose = useCallback(() => {
        setIsFullscreen(false);
        onClose();
    }, [onClose]);

    useEffect(() => {
        if (!isVisible) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || isMenuLayerOpen()) return;

            if (isFullscreen && !isNarrow) {
                setIsFullscreen(false);

                return;
            }

            handleClose();
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isVisible, isFullscreen, isNarrow, handleClose]);

    const artifactType = version?.artifactType ?? head?.artifactType;
    const canPreview = artifactType !== undefined && PREVIEWABLE_ARTIFACT_TYPES.has(artifactType);
    const mode: ArtifactViewMode = canPreview ? view : 'code';
    const displayTitle = head?.title || title || slug;
    const fileName = artifactType
        ? artifactFileName({ title: displayTitle, artifactType, language: version?.language })
        : null;

    const renderFullscreenButton = () => {
        if (isNarrow) return null;

        return (
            <SimpleTooltip content={isFullscreen ? 'Exit full screen' : 'Full screen'} side="bottom">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="justify-center"
                    aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
                    aria-pressed={isFullscreen}
                    onClick={() => setIsFullscreen((current) => !current)}
                >
                    {isFullscreen ? <MinimizeIcon aria-hidden="true" /> : <MaximizeIcon aria-hidden="true" />}
                </Button>
            </SimpleTooltip>
        );
    };

    const renderHeaderActions = () => (
        <div className="artifact-pane-header-actions flex shrink-0 items-center gap-1">
            <ArtifactVersionMenu
                versions={versions}
                versionNumber={displayedVersionNumber}
                latestVersion={head?.latestVersion}
                onVersionChange={setSelectedVersionNumber}
            />
            {version ? <ArtifactCopySplit version={version} agentSlug={agentSlug} artifactId={artifactId} /> : null}
            {renderFullscreenButton()}
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={handleClose}
                className="text-muted-foreground hover:bg-background hover:text-foreground"
            >
                <XIcon className="size-4" />
            </Button>
        </div>
    );

    const renderHeading = () => (
        <div className="artifact-pane-heading flex min-w-0 flex-1 items-center gap-2">
            {canPreview ? <ArtifactViewToggle view={view} onViewChange={setView} /> : null}
            <span className="flex min-w-0 items-baseline gap-2">
                <h4 className="truncate text-base font-semibold tracking-tight text-foreground">{displayTitle}</h4>
                {fileName ? (
                    <span className="shrink-0 text-xs text-muted-foreground max-sm:hidden">{fileName}</span>
                ) : null}
            </span>
        </div>
    );

    const renderDocument = () => {
        if (isPending) return <ArtifactSkeleton />;

        if (!version) {
            return (
                <div role="alert" className="text-sm text-muted-foreground">
                    {getApiErrorMessage(error, VERSION_ERROR_FALLBACK)}
                </div>
            );
        }

        return (
            <div
                className={cn(
                    'artifact-pane-document relative min-h-0 flex-1 overflow-hidden',
                    isOverlay ? 'border-t border-border' : 'rounded-xl border border-border',
                    isResizing && 'pointer-events-none',
                )}
            >
                <ArtifactView version={version} mode={mode} className="absolute inset-0" />
            </div>
        );
    };

    if (isOverlay && isVisible) {
        return (
            <div
                data-slot="artifact-pane"
                data-state="open"
                data-overlay={isNarrow ? 'narrow' : 'fullscreen'}
                data-fullscreen={isFullscreen ? 'true' : undefined}
                className="fixed inset-0 z-51 flex flex-col bg-card"
            >
                <div className="artifact-pane-header flex min-h-12 items-center justify-between gap-3 border-b border-border py-2 pr-3 pl-3">
                    {renderHeading()}
                    {renderHeaderActions()}
                </div>
                <div className="artifact-pane-body flex min-h-0 flex-1 flex-col overflow-hidden">
                    {renderDocument()}
                </div>
            </div>
        );
    }

    return (
        <div
            data-slot="artifact-pane"
            data-state={isVisible ? 'open' : 'closed'}
            className={cn(
                'relative sticky top-0 h-svh shrink-0 overflow-hidden',
                !isResizing && 'transition-[width] duration-300 ease-in-out',
            )}
            style={{ width: isVisible ? width : 0 }}
        >
            <div
                className={cn(
                    'flex h-svh flex-col border-l border-border bg-card',
                    !isResizing && 'transition-transform duration-300 ease-in-out',
                    isVisible ? 'translate-x-0' : 'translate-x-full',
                )}
                style={{ width }}
            >
                <div
                    role="separator"
                    aria-label="Resize panel"
                    aria-orientation="vertical"
                    tabIndex={0}
                    className={cn(
                        'artifact-pane-resizer absolute inset-y-0 left-0 z-1 w-3 cursor-col-resize',
                        'focus-visible:outline-none',
                        // A rail, not a filled slab: the grab area is wider than the strip that lights up.
                        'after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-transparent',
                        'after:pointer-events-none after:transition-colors after:duration-140',
                        'hover:after:bg-muted-foreground/40 focus-visible:after:bg-muted-foreground/70',
                        isResizing && 'after:bg-muted-foreground/70',
                    )}
                    {...handleProps}
                />
                <div className="artifact-pane-header sticky top-0 z-1 flex min-h-12 items-center justify-between gap-3 border-b border-border bg-card py-2 pr-3 pl-3">
                    {renderHeading()}
                    {renderHeaderActions()}
                </div>
                <div className="artifact-pane-body flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                    {isVisible ? renderDocument() : null}
                </div>
            </div>
        </div>
    );
};

interface ArtifactPaneProps {
    isVisible: boolean;
    isFromAdmin?: boolean;
    agentId: string;
    agentSlug?: string;
    artifact: ArtifactPointer | null;
    openNonce: number;
    onClose: () => void;
}

const ArtifactPane = ({
    isVisible,
    isFromAdmin = false,
    agentId,
    agentSlug,
    artifact,
    openNonce,
    onClose,
}: ArtifactPaneProps) => {
    const isNarrow = useIsPaneOverlay(isFromAdmin);

    if (!artifact) return null;

    return (
        <ArtifactPaneBody
            key={`${artifact.artifactId}:${artifact.versionNumber}:${openNonce}`}
            isVisible={isVisible}
            isNarrow={isNarrow}
            agentId={agentId}
            agentSlug={agentSlug}
            artifactId={artifact.artifactId}
            slug={artifact.slug}
            title={artifact.title}
            versionNumber={artifact.versionNumber}
            onClose={onClose}
        />
    );
};

export default ArtifactPane;
