import { GlobeIcon, HeartIcon, LockIcon } from 'lucide-react';

import Like from '@/app/components/like';
import { type ArtifactFileMeta, useArtifactLikeUpdate } from '@/components/agent-chat/artifact/use-artifact-file-meta';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

interface ChipProps {
    meta: ArtifactFileMeta;
    className?: string;
}

interface FavProps {
    artifactId: string;
    meta: ArtifactFileMeta;
    userId: string;
    className?: string;
}

export const ArtifactVisibilityChip = (props: ChipProps) => {
    const { meta, className } = props;
    const Icon = meta.isPublic ? GlobeIcon : LockIcon;

    return (
        <span className={cn('artifact-visibility-chip flex shrink-0 items-center gap-1', className)}>
            <Icon className="size-3.5" />
            {meta.isPublic ? 'Public' : 'Private'}
        </span>
    );
};

export const ArtifactFav = (props: FavProps) => {
    const { artifactId, meta, userId, className } = props;
    const onLikeItemClicked = useArtifactLikeUpdate(artifactId, userId);
    const canLike = Boolean(userId) && (meta.isPublic || meta.creatorId === userId);

    if (!canLike) return null;

    return (
        <Like
            key={artifactId}
            likesCount={meta.likesCount}
            isLikedByThisUser={meta.isLikedByThisUser}
            itemId={artifactId}
            itemType="files"
            onLikeItemClicked={onLikeItemClicked}
            renderWrapperContent={(countVisible, likesState, formattedLikesCount, isDisabled, handleLikeClick) => (
                <SimpleTooltip content={likesState.isLikedByThisUser ? 'Unlike' : 'Like'} side="bottom">
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label={likesState.isLikedByThisUser ? 'Unlike' : 'Like'}
                        aria-pressed={likesState.isLikedByThisUser}
                        disabled={isDisabled}
                        className={cn(
                            'px-2',
                            likesState.isLikedByThisUser ? 'text-foreground' : 'text-muted-foreground',
                            className,
                        )}
                        onClick={handleLikeClick}
                    >
                        <HeartIcon fill={likesState.isLikedByThisUser ? 'currentColor' : 'none'} />
                        {countVisible && likesState.totalLikes > 0 ? (
                            <span className="text-xs">{formattedLikesCount}</span>
                        ) : null}
                    </Button>
                </SimpleTooltip>
            )}
        />
    );
};
