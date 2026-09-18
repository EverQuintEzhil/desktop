import { appMediaApi } from '@/lib/api/app/media';
import type { ApiRequestConfig } from '@/lib/api/client';

type GalleryMediaKind = 'image' | 'video';

interface GenerateGalleryMediaOptions<D> {
    kind: GalleryMediaKind;
    data: D;
    config?: ApiRequestConfig;
}

export const generateGalleryMedia = async <D = unknown>({
    kind,
    data,
    config,
}: GenerateGalleryMediaOptions<D>): Promise<unknown> => {
    if (kind === 'image') {
        return appMediaApi.generateImage(data, config);
    }

    return appMediaApi.generateVideo(data, config);
};
