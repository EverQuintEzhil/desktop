import { ChevronLeftIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { ArtifactFav, ArtifactVisibilityChip } from '@/app/components/artifact-file-meta';
import { useAppSelector } from '@/app/hooks';
import { ArtifactCopySplit } from '@/components/agent-chat/artifact/artifact-copy-split';
import { artifactFileName } from '@/components/agent-chat/artifact/artifact-download';
import { ArtifactSkeleton } from '@/components/agent-chat/artifact/artifact-skeleton';
import type { ArtifactViewMode } from '@/components/agent-chat/artifact/artifact-types';
import { PREVIEWABLE_ARTIFACT_TYPES } from '@/components/agent-chat/artifact/artifact-types';
import { ArtifactVersionMenu } from '@/components/agent-chat/artifact/artifact-version-menu';
import { ArtifactView } from '@/components/agent-chat/artifact/artifact-view';
import { ArtifactViewToggle } from '@/components/agent-chat/artifact/artifact-view-toggle';
import {
    useArtifactHead,
    useArtifactVersion,
    useArtifactVersions,
} from '@/components/agent-chat/artifact/use-artifact';
import { useArtifactFileMeta } from '@/components/agent-chat/artifact/use-artifact-file-meta';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';

import { useAgentQuery } from '../agent/hooks/use-agent-query';

const VERSION_ERROR_FALLBACK = 'This document could not be loaded.';

const FRAME_CLASS_NAME = 'artifact-page-frame relative min-h-0 flex-1 overflow-hidden border-t border-border bg-card';

const FRAME_INSET_CLASS_NAME = 'md:rounded-xl md:border';

const readErrorStatus = (error: unknown): number | undefined =>
    (error as { response?: { status?: number } } | null | undefined)?.response?.status;

const ArtifactPage = () => {
    const { agentId = '', artifactId = '' } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
    const [view, setView] = useState<ArtifactViewMode>('preview');

    const user = useAppSelector(selectUser);
    const userId = user._id || '';
    const fileMeta = useArtifactFileMeta(artifactId, userId);

    const { data: agent, isPending: isAgentPending, isError: isAgentError } = useAgentQuery(agentId);

    const {
        data: head,
        isPending: isHeadPending,
        isError: isHeadError,
        error: headError,
    } = useArtifactHead(agent?._id ?? '', artifactId);
    const { data: versions } = useArtifactVersions(agent?._id ?? '', artifactId);

    const displayedVersionNumber = selectedVersionNumber ?? head?.latestVersion ?? 0;
    const {
        data: version,
        isPending: isVersionPending,
        error: versionError,
    } = useArtifactVersion(agent?._id ?? '', artifactId, displayedVersionNumber);

    const goHome = () => {
        navigate('/');
    };

    const goBack = () => {
        if (location.key === 'default') {
            goHome();

            return;
        }
        navigate(-1);
    };

    const renderBack = () => (
        <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back"
            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            onClick={goBack}
        >
            <ChevronLeftIcon />
        </Button>
    );

    const renderShell = (topbar: ReactNode, children: ReactNode) => (
        <div className="artifact-page flex h-svh w-full min-w-0 flex-col bg-background">
            <header className="artifact-page-topbar flex h-12 shrink-0 items-center gap-3 px-3 md:px-4">
                {renderBack()}
                {topbar}
            </header>
            <div className="artifact-page-body flex min-h-0 flex-1 flex-col md:px-4 md:pb-4">{children}</div>
        </div>
    );

    const renderCentred = (children: ReactNode) => (
        <div className={cn(FRAME_CLASS_NAME, FRAME_INSET_CLASS_NAME, 'flex items-center justify-center p-6')}>
            {children}
        </div>
    );

    const renderSkeleton = () => (
        <div className="artifact-page-loading flex min-h-0 flex-1 flex-col max-md:px-3 max-md:pb-3">
            <ArtifactSkeleton />
        </div>
    );

    const renderNotice = (heading: string, description: string, action?: ReactNode) => (
        <div className="artifact-page-notice flex w-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex max-w-[320px] flex-col items-center gap-1.5">
                <h1 className="text-lg font-medium text-foreground">{heading}</h1>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            {action}
        </div>
    );

    if (isAgentPending) {
        return renderShell(null, renderCentred(<Spinner className="scale-150" />));
    }

    if (isAgentError || !agent) {
        return renderShell(
            null,
            renderCentred(
                renderNotice(
                    'Agent not available',
                    'This agent may have been removed, or you may not have access to it.',
                    <Button variant="secondary" size="sm" asChild className="rounded-full px-4">
                        <Link to="/">Back to home</Link>
                    </Button>,
                ),
            ),
        );
    }

    const agentHomePath = `/agent/${encodeURIComponent(agent.slug)}`;

    if (isHeadPending) {
        return renderShell(null, renderSkeleton());
    }

    if (isHeadError || !head) {
        const status = readErrorStatus(headError);
        const isUnavailable = status === 404 || status === 403;

        return renderShell(
            null,
            renderCentred(
                renderNotice(
                    isUnavailable ? 'Document not available' : 'Something went wrong',
                    isUnavailable
                        ? 'It may have been deleted, or you may not have access to it.'
                        : 'This document could not be loaded. Try again in a moment.',
                    <Button variant="secondary" size="sm" asChild className="rounded-full px-4">
                        <Link to={agentHomePath}>Back to {agent.name}</Link>
                    </Button>,
                ),
            ),
        );
    }

    const artifactType = version?.artifactType ?? head.artifactType;
    const canPreview = PREVIEWABLE_ARTIFACT_TYPES.has(artifactType);
    const mode: ArtifactViewMode = canPreview ? view : 'code';
    const fileName = artifactFileName({ title: head.title || head.slug, artifactType, language: version?.language });
    const displayTitle = head.title || head.slug;

    const isReadingMeasure = mode === 'preview' && artifactType === 'markdown';

    const renderFav = () => {
        if (!fileMeta || !userId) return null;

        return <ArtifactFav artifactId={artifactId} meta={fileMeta} userId={userId} />;
    };

    const renderDocument = () => {
        if (isVersionPending) return renderSkeleton();

        if (!version) {
            return renderCentred(
                <div role="alert" className="text-sm text-muted-foreground">
                    {getApiErrorMessage(versionError, VERSION_ERROR_FALLBACK)}
                </div>,
            );
        }

        return (
            <div
                className={cn(
                    FRAME_CLASS_NAME,
                    FRAME_INSET_CLASS_NAME,
                    isReadingMeasure && 'w-full max-w-4xl self-center',
                )}
            >
                <ArtifactView
                    version={version}
                    mode={mode}
                    className={cn('absolute inset-0', isReadingMeasure && 'px-6 py-6 md:px-12 md:py-10')}
                />
            </div>
        );
    };

    return renderShell(
        <>
            {canPreview ? <ArtifactViewToggle view={view} onViewChange={setView} /> : null}
            <span className="artifact-page-heading flex min-w-0 flex-1 items-baseline gap-2">
                <h1 className="truncate text-sm font-medium text-foreground">{displayTitle}</h1>
                <span className="shrink-0 text-xs text-muted-foreground max-sm:hidden">{fileName}</span>
                {fileMeta ? (
                    <ArtifactVisibilityChip meta={fileMeta} className="text-xs text-muted-foreground max-md:hidden" />
                ) : null}
            </span>
            <div className="artifact-page-actions flex shrink-0 items-center gap-1">
                {renderFav()}
                <ArtifactVersionMenu
                    versions={versions}
                    versionNumber={displayedVersionNumber}
                    latestVersion={head.latestVersion}
                    onVersionChange={setSelectedVersionNumber}
                />
                {version ? (
                    <ArtifactCopySplit version={version} agentSlug={agent.slug} artifactId={head.artifactId} />
                ) : null}
            </div>
        </>,
        renderDocument(),
    );
};

export default ArtifactPage;
