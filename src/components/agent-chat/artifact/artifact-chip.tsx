import { cn } from '@/lib/utils';

import { useChatViewContext } from '../view/chat-view-context';

import type { ArtifactPointer, ArtifactVersion } from './artifact-types';
import { ARTIFACT_TYPE_LABELS } from './artifact-types';
import { useArtifactVersion } from './use-artifact';

const THUMBNAIL_LENGTH = 280;

const HTML_SCAN_LENGTH = 8000;

const HTML_UNREADABLE_BLOCKS = /<(script|style|head)\b[\s\S]*?<\/\1>/gi;
const HTML_TAGS = /<[^>]*>/g;
const WHITESPACE_RUN = /\s+/g;

const readThumbnailText = (version: ArtifactVersion | undefined): string => {
    if (!version) return '';

    if (version.artifactType !== 'html') return version.content.slice(0, THUMBNAIL_LENGTH);

    return version.content
        .slice(0, HTML_SCAN_LENGTH)
        .replace(HTML_UNREADABLE_BLOCKS, ' ')
        .replace(HTML_TAGS, ' ')
        .replace(WHITESPACE_RUN, ' ')
        .trim()
        .slice(0, THUMBNAIL_LENGTH);
};

interface ArtifactChipProps {
    pointer: ArtifactPointer;
}

export const ArtifactChip = ({ pointer }: ArtifactChipProps) => {
    const { agent, onShowArtifact, activeArtifactId } = useChatViewContext();
    const { data: version } = useArtifactVersion(agent._id, pointer.artifactId, pointer.versionNumber);

    const isActive = activeArtifactId === pointer.artifactId;
    const title = pointer.title || pointer.slug;

    return (
        <button
            type="button"
            data-slot="artifact-chip"
            aria-current={isActive}
            className={cn(
                'artifact-chip my-3 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors duration-140 hover:border-muted-foreground/40',
                isActive && 'border-primary/60',
            )}
            onClick={() => onShowArtifact(pointer)}
        >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">{title}</span>
                <span className="text-xs text-muted-foreground">
                    {ARTIFACT_TYPE_LABELS[pointer.artifactType]} · v{pointer.versionNumber}
                </span>
            </span>
            <span
                aria-hidden
                className="artifact-chip-thumb hidden h-14 w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-muted/60 px-1.5 py-1 text-[4px] leading-[6px] break-words text-muted-foreground sm:block"
            >
                {readThumbnailText(version)}
            </span>
        </button>
    );
};
