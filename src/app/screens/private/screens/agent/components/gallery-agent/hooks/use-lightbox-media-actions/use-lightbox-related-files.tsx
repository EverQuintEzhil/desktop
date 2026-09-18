import { useEffect, useState } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { appMediaApi } from '@/lib/api/app/media';
import { getFilesDownloadUrl } from '@/lib/axios';
import type { FileType } from '@/types/admin';

import { UploadedImagesCarousel } from '../../components/uploaded-images-carousel';

export interface UseLightboxRelatedFilesArgs {
    relatedFileIds?: string[];
}

export interface UseLightboxRelatedFilesResult {
    relatedFiles: FileType[];
    visibleRelatedFiles: FileType[];
    relatedCarouselOpen: boolean;
    closeRelatedCarousel: () => void;
    renderRelatedFilesThumbnails: () => React.ReactNode;
    renderRelatedFilesCarousel: () => React.ReactNode;
}

const isMaskFile = (file: FileType) => {
    const nameLower = file.name?.toLowerCase() ?? '';

    return nameLower === 'mask.png' || nameLower.replace(/\.[^.]+$/, '') === 'mask';
};

export const useLightboxRelatedFiles = (args: UseLightboxRelatedFilesArgs): UseLightboxRelatedFilesResult => {
    const { relatedFileIds } = args;

    const [relatedFiles, setRelatedFiles] = useState<FileType[]>([]);
    const [relatedFilesLoading, setRelatedFilesLoading] = useState(false);
    const [relatedCarouselOpen, setRelatedCarouselOpen] = useState(false);
    const [relatedCarouselIndex, setRelatedCarouselIndex] = useState(0);

    useEffect(() => {
        if (!relatedFileIds?.length) {
            setRelatedFiles([]);
            setRelatedFilesLoading(false);

            return;
        }

        const controller = new AbortController();

        setRelatedFilesLoading(true);

        const loadRelatedFiles = async () => {
            // allSettled, not all: a single unreachable related file would otherwise reject the
            // whole batch, and this effect is keyed on the id list so it never retries.
            const results = await Promise.allSettled(
                relatedFileIds.map(async (relatedFileId) => {
                    const downloadUrl = getFilesDownloadUrl(relatedFileId);
                    const value = await appMediaApi.getFile<{ ai?: { prompt?: string }; title?: string; url?: string }>(
                        relatedFileId,
                        { signal: controller.signal },
                    );
                    const name = value?.ai?.prompt || value?.title || 'video';
                    const newFile: FileType = {
                        name: typeof name === 'string' ? name : 'video',
                        type: 'image',
                        url: value?.url || downloadUrl,
                        _id: relatedFileId,
                        tempId: crypto.randomUUID(),
                        isUploading: false,
                    };

                    return newFile;
                }),
            );

            if (controller.signal.aborted) return;

            setRelatedFiles(
                results
                    .filter((result): result is PromiseFulfilledResult<FileType> => result.status === 'fulfilled')
                    .map((result) => result.value),
            );
            setRelatedFilesLoading(false);
        };

        void loadRelatedFiles();

        return () => {
            controller.abort();
        };
    }, [relatedFileIds?.join(',')]);

    const visibleRelatedFiles = relatedFiles.filter((f) => !isMaskFile(f));

    const renderRelatedFilesThumbnails = () => {
        const hasIds = Boolean(relatedFileIds?.length);

        if (!hasIds && !relatedFilesLoading) return null;

        const openRelatedCarousel = (index: number) => {
            setRelatedCarouselIndex(index);
            setRelatedCarouselOpen(true);
        };

        return (
            <div
                className="related-files-thumbnails flex flex-row flex-wrap gap-1.5"
                onClick={(e) => e.stopPropagation()}
            >
                {relatedFilesLoading
                    ? (relatedFileIds ?? []).map((id) => (
                          <div
                              key={id}
                              className="related-file-thumbnail related-file-thumbnail--skeleton h-10 w-10 cursor-not-allowed rounded-md"
                          />
                      ))
                    : visibleRelatedFiles.map((file, idx) => (
                          <Tooltip key={file._id ?? file.tempId ?? idx}>
                              <TooltipTrigger asChild>
                                  <figure
                                      className="related-file-thumbnail relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-md transition-transform duration-200 ease-out hover:scale-110"
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => openRelatedCarousel(idx)}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              openRelatedCarousel(idx);
                                          }
                                      }}
                                  >
                                      <img
                                          src={file.url}
                                          alt={file.name}
                                          className="block h-full w-full object-cover"
                                      />
                                  </figure>
                              </TooltipTrigger>
                              <TooltipContent
                                  side="top"
                                  sideOffset={8}
                                  className="related-file-preview-tooltip w-48 rounded-lg border border-white/15 bg-[#1f1f1f] p-2 text-white shadow-xl"
                                  arrowClassName="fill-[#1f1f1f]"
                              >
                                  <div className="flex flex-col gap-2">
                                      <img
                                          src={file.url}
                                          alt={`${file.name} reference preview`}
                                          className="h-44 w-full rounded-md object-cover"
                                      />
                                      <span className="text-center text-xs leading-none font-medium">
                                          Reference Image
                                      </span>
                                  </div>
                              </TooltipContent>
                          </Tooltip>
                      ))}
            </div>
        );
    };

    const renderRelatedFilesCarousel = () => (
        <UploadedImagesCarousel
            images={visibleRelatedFiles}
            startIndex={relatedCarouselIndex}
            isOpen={relatedCarouselOpen}
            onClose={() => setRelatedCarouselOpen(false)}
        />
    );

    const closeRelatedCarousel = () => setRelatedCarouselOpen(false);

    return {
        relatedFiles,
        visibleRelatedFiles,
        relatedCarouselOpen,
        closeRelatedCarousel,
        renderRelatedFilesThumbnails,
        renderRelatedFilesCarousel,
    };
};
