import type React from 'react';
import { useState } from 'react';

import type { JobType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';

export interface UseGalleryLightboxStateResult {
    lightboxImage: GeneratedItem | null;
    setLightboxImage: React.Dispatch<React.SetStateAction<GeneratedItem | null>>;
    lightboxJob: JobType | null;
    setLightboxJob: React.Dispatch<React.SetStateAction<JobType | null>>;
}

export const useGalleryLightboxState = (): UseGalleryLightboxStateResult => {
    const [lightboxImage, setLightboxImage] = useState<GeneratedItem | null>(null);
    const [lightboxJob, setLightboxJob] = useState<JobType | null>(null);

    return {
        lightboxImage,
        setLightboxImage,
        lightboxJob,
        setLightboxJob,
    };
};
