import { HeartIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { appEngagementApi } from '@/lib/api/app/engagement';
import { showErrorToast } from '@/utils';

import './like.scss';

interface Props {
    className?: string;
    likesCount: number;
    isLikedByThisUser: boolean;
    itemId: string;
    itemType: string;
    onLikeItemClicked: (likesCount: number, isLikedByThisUser: boolean) => void;
    disabled?: boolean;
    countVisible?: boolean;
    renderWrapperContent?: (
        countVisible: boolean,
        likesState: { isLikedByThisUser: boolean; totalLikes: number },
        formattedLikesCount: string,
        isDisabled: boolean,
        handleLikeClick: (e: React.MouseEvent) => void,
    ) => React.ReactNode;
}

export const formatLikeCount = (count: number): string => {
    if (count === 0) return '';

    const formatted = new Intl.NumberFormat('en', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1,
    }).format(count);

    return formatted.toLowerCase();
};

const Like = (props: Props) => {
    const {
        className,
        likesCount,
        isLikedByThisUser,
        itemId,
        itemType,
        onLikeItemClicked,
        disabled = false,
        countVisible = true,
        renderWrapperContent,
    } = props;

    const [likesState, setLikesState] = useState({
        isLikedByThisUser: isLikedByThisUser || false,
        totalLikes: likesCount || 0,
    });
    const [isLiking, setIsLiking] = useState(false);

    useEffect(() => {
        setLikesState({
            isLikedByThisUser: isLikedByThisUser || false,
            totalLikes: likesCount || 0,
        });
    }, [isLikedByThisUser, likesCount]);

    const isDisabled = disabled || isLiking;

    const handleLikeClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isDisabled) return;

        const previousState = { ...likesState };
        const newLikeState = {
            isLikedByThisUser: !previousState.isLikedByThisUser,
            totalLikes: previousState.isLikedByThisUser ? previousState.totalLikes - 1 : previousState.totalLikes + 1,
        };

        try {
            setIsLiking(true);

            setLikesState(newLikeState);

            await appEngagementApi.updateLike(itemType, itemId, { liked: newLikeState.isLikedByThisUser });

            onLikeItemClicked(newLikeState.totalLikes, newLikeState.isLikedByThisUser);
        } catch (error: unknown) {
            setLikesState(previousState);

            showErrorToast('Failed to update like. Please try again.');
            console.error('Error updating like status:', error);
        } finally {
            setIsLiking(false);
        }
    };

    if (!onLikeItemClicked) {
        return null;
    }

    if (renderWrapperContent) {
        return renderWrapperContent(
            countVisible,
            likesState,
            formatLikeCount(likesState.totalLikes),
            isDisabled,
            handleLikeClick,
        );
    }

    return (
        <div
            className={[
                'like-button flex items-center justify-center gap-1 rounded-full min-h-[33px]',
                'outline-none focus-visible:ring-1 focus-visible:ring-(--color-focus-ring)',
                countVisible ? 'px-2 min-w-[50px]' : 'px-0 min-w-[33px]',
                isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLikeClick(e);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLikeClick(e as unknown as React.MouseEvent);
                }
            }}
        >
            <HeartIcon
                className="like-icon size-4 text-white transition-opacity"
                fill={likesState.isLikedByThisUser ? 'currentColor' : 'none'}
            />
            {likesState.totalLikes > 0 && countVisible && (
                <span className="text-sm text-white">{formatLikeCount(likesState.totalLikes)}</span>
            )}
        </div>
    );
};

export default Like;
