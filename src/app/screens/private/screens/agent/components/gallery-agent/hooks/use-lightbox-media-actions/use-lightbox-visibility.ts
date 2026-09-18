import { useEffect, useState } from 'react';

import { appMediaApi } from '@/lib/api/app/media';
import type { GeneratedItem } from '@/types/gallery';
import { showErrorToast } from '@/utils';

export interface UseLightboxVisibilityArgs {
    currentItem: GeneratedItem | null;
    onItemChange?: (item: GeneratedItem) => void;
    onLikeItemClicked?: (item: GeneratedItem) => void;
}

export interface UseLightboxVisibilityResult {
    isPublic: boolean;
    isPublicLoading: boolean;
    handlePublicChange: (val: boolean) => Promise<void>;
    handleLikeItemClicked: (likesCount: number, isLikedByThisUser: boolean) => void;
}

export const useLightboxVisibility = (args: UseLightboxVisibilityArgs): UseLightboxVisibilityResult => {
    const { currentItem, onItemChange, onLikeItemClicked } = args;

    const [isPublic, setIsPublic] = useState(currentItem?.is_public ?? false);
    const [isPublicLoading, setIsPublicLoading] = useState(false);

    useEffect(() => {
        setIsPublic(currentItem?.is_public ?? false);
    }, [currentItem]);

    const handlePublicChange = async (val: boolean) => {
        if (!currentItem) return;
        setIsPublic(val);
        setIsPublicLoading(true);
        try {
            await appMediaApi.updateFile(currentItem._id, { isPublic: val });
            const updatedItem = { ...currentItem, is_public: val };

            if (onItemChange) {
                onItemChange(updatedItem);
            }
        } catch (error) {
            setIsPublic(!val);
            showErrorToast('Failed to update public status');
            console.error('Failed to update public status', error);
        } finally {
            setIsPublicLoading(false);
        }
    };

    const handleLikeItemClicked = (likesCount: number, isLikedByThisUser: boolean) => {
        if (!currentItem || !onLikeItemClicked) return;

        onLikeItemClicked({
            ...currentItem,
            isLikedByThisUser,
            likes_count: likesCount,
        });
    };

    return {
        isPublic,
        isPublicLoading,
        handlePublicChange,
        handleLikeItemClicked,
    };
};
