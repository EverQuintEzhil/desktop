import { isCancel } from 'axios';
import { XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { appMediaApi } from '@/lib/api/app/media';
import type { GeneratedItem } from '@/types/gallery';

import type { LightboxMediaFileIdProps } from '../../lightbox-media';
import LightboxMedia from '../../lightbox-media';

type FileIdState = {
    isLoading: boolean;
    lightboxImage: GeneratedItem | null;
    error: string | null;
};

const LightboxMediaFileId = (props: LightboxMediaFileIdProps) => {
    const {
        fileId,
        isVideo = false,
        onClose,
        escapeClosesLightbox = true,
        showCloseButton = true,
        renderHeaderLeft,
        ...rest
    } = props;

    const [state, setState] = useState<FileIdState>({
        isLoading: true,
        error: null,
        lightboxImage: null,
    });

    useEffect(() => {
        const controller = new AbortController();

        // Reset alongside the abort: without this the previous file's image and error survive at
        // isLoading false, so the next file renders the old media under its own title.
        setState({ isLoading: true, error: null, lightboxImage: null });
        void fetchLightboxImage(controller.signal);

        return () => controller.abort();
    }, [fileId]);

    useEffect(() => {
        if (!escapeClosesLightbox) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose?.();
            }
        };

        if (state.isLoading || state.error) {
            document.addEventListener('keydown', handleKeyDown, true);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [state.isLoading, state.error, onClose, escapeClosesLightbox]);

    const fetchLightboxImage = async (signal: AbortSignal) => {
        try {
            const value = await appMediaApi.getFile<{ is_deleted?: boolean; [key: string]: unknown }>(fileId, {
                signal,
            });

            if (value?.is_deleted === true) {
                setState((prev) => ({
                    ...prev,
                    isLoading: false,
                    lightboxImage: null,
                    error: isVideo ? 'Video not found' : 'Image not found',
                }));

                return;
            }

            setState((prev) => ({
                ...prev,
                lightboxImage: {
                    ...value,
                    _id: fileId,
                } as GeneratedItem,
                isLoading: false,
                error: null,
            }));
        } catch (error) {
            // A superseded request must leave both the state and the loading flag of the request that replaced it untouched.
            if (isCancel(error)) return;

            console.error(error);
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: 'Failed to fetch',
            }));
        }
    };

    const renderLoadingState = () => (
        <div className="lightbox-overlay flex flex-col py-3">
            <div className="lightbox-content flex h-full flex-col">
                <div className="lightbox-header grid w-full items-center justify-between gap-2 px-4">
                    <div className="ml-auto flex items-center gap-2" />
                    {showCloseButton && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                size="icon-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose?.();
                                }}
                            >
                                <XIcon />
                            </Button>
                        </div>
                    )}
                </div>
                <div className="lightbox-media-container lightbox-image-slider relative flex min-h-0 w-full flex-1 items-center justify-center py-6">
                    <div className="lightbox-state-content lightbox-loading flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
                        <div className="flex h-full w-full max-w-[74vw] flex-col items-center justify-center gap-4 bg-white/20">
                            <span className="text-sm">Loading...</span>
                            <div className="lightbox-loading-spinner rounded-circle" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const notFoundLabel = isVideo ? 'Video not found' : 'Image not found';

    const renderErrorState = () => (
        <div className="lightbox-overlay flex flex-col py-3">
            <div className="lightbox-content flex h-full flex-col">
                <div className="lightbox-header flex w-full items-center justify-between gap-2 px-4">
                    {showCloseButton && (
                        <Button
                            variant="secondary"
                            size="icon-sm"
                            className="ml-auto"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose?.();
                            }}
                        >
                            <XIcon />
                        </Button>
                    )}
                </div>
                <div className="lightbox-media-container lightbox-image-slider relative flex min-h-0 w-full flex-1 items-center justify-center py-6">
                    <div className="lightbox-state-content lightbox-not-found flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
                        <span className="text-sm">{notFoundLabel}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    if (state.isLoading) {
        return renderLoadingState();
    }

    if (state.error) {
        return renderErrorState();
    }

    return (
        <LightboxMedia
            lightboxImage={state.lightboxImage}
            isVideo={isVideo}
            onClose={onClose ?? (() => {})}
            escapeClosesLightbox={escapeClosesLightbox}
            showCloseButton={showCloseButton}
            renderHeaderLeft={renderHeaderLeft}
            {...rest}
        />
    );
};

export default LightboxMediaFileId;
