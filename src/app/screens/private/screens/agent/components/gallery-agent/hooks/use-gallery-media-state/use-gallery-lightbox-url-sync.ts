import type React from 'react';
import { useEffect } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';

import type { GeneratedItem } from '@/types/gallery';

import { LIGHTBOX_FILE_ID_PARAM } from './constants';

interface UseGalleryLightboxUrlSyncArgs {
    searchParams: URLSearchParams;
    setSearchParams: SetURLSearchParams;
    fetchFileById: (fileId: string) => Promise<GeneratedItem | null>;
    displayHistoryRef: React.RefObject<GeneratedItem[]>;
    setLightboxImage: React.Dispatch<React.SetStateAction<GeneratedItem | null>>;
}

/**
 * Opens the lightbox for the file referenced by the `lightboxFileId` search
 * param (e.g. from a "generation ready" toast navigation), then strips the
 * param once handled.
 */
export const useGalleryLightboxUrlSync = (args: UseGalleryLightboxUrlSyncArgs): void => {
    const { searchParams, setSearchParams, fetchFileById, displayHistoryRef, setLightboxImage } = args;

    useEffect(() => {
        const lightboxFileId = searchParams.get(LIGHTBOX_FILE_ID_PARAM);

        if (!lightboxFileId) return;

        let cancelled = false;

        const openLightboxFromUrl = async () => {
            const existing = displayHistoryRef.current.find((history) => history._id === lightboxFileId);

            if (existing) {
                if (!cancelled) setLightboxImage(existing);
            } else {
                const fetched = await fetchFileById(lightboxFileId);

                if (!cancelled && fetched) setLightboxImage(fetched);
            }

            if (cancelled) return;

            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);

                    next.delete(LIGHTBOX_FILE_ID_PARAM);

                    return next;
                },
                { replace: true },
            );
        };

        void openLightboxFromUrl();

        return () => {
            cancelled = true;
        };
    }, [searchParams, fetchFileById, setSearchParams, displayHistoryRef, setLightboxImage]);
};
