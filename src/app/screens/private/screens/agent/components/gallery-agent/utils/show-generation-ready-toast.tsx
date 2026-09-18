import { ImageIcon, VideoIcon, XIcon } from 'lucide-react';
import React from 'react';
import { toast } from 'sonner';

import AppImage from '@/components/image';
import { cn } from '@/lib/utils';
import type { GeneratedItem } from '@/types/gallery';

import { getJobToastLifecycleHandlers, registerJobToast } from './job-toasts';

export interface GenerationReadyToastProps {
    file: GeneratedItem;
    isVideo: boolean;
    onView: () => void;
    closeToast?: () => void;
}

function GenerationReadyToast({ file, isVideo, onView, closeToast }: GenerationReadyToastProps) {
    const thumbnailUrl = `${file.url}?thumbnail=true`;
    const title = isVideo ? 'Video Generation' : 'Image Generation';
    const FallbackIcon = isVideo ? VideoIcon : ImageIcon;

    const handleClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('[data-toast-close], [data-close-button]')) return;
        onView();
        closeToast?.();
    };

    const renderCloseButton = () => (
        <button
            data-close-button
            data-toast-close
            type="button"
            aria-label="Close toast"
            className={cn(
                'absolute top-0 left-0 z-1 flex size-5 translate-x-[-35%] translate-y-[-35%]',
                'cursor-pointer items-center justify-center rounded-full border border-border-secondary',
                'text-text-primary bg-card p-0 transition-colors hover:bg-background',
            )}
            onClick={(e) => {
                e.stopPropagation();
                closeToast?.();
            }}
        >
            <XIcon className="size-3" />
        </button>
    );

    return (
        <div className="flex w-full items-center justify-start gap-2">
            {renderCloseButton()}
            <div
                role="button"
                tabIndex={0}
                onClick={handleClick}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick(e as unknown as React.MouseEvent);
                    }
                }}
                className="flex min-w-0 flex-1 cursor-pointer items-center justify-start gap-2"
            >
                <div className="toast-media-preview flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-background">
                    {thumbnailUrl ? (
                        <AppImage
                            src={thumbnailUrl}
                            placeholder="/assets/images/broken-image.svg"
                            alt={file.title || title}
                            className="toast-media-image h-full w-full rounded-[inherit] object-cover"
                        />
                    ) : (
                        <FallbackIcon className="toast-media-fallback size-8 text-2xl" />
                    )}
                </div>
                <div className="toast-media-text flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm">{title}</span>
                    <span className="text-sm"> Ready · Click to view</span>
                </div>
            </div>
        </div>
    );
}

export interface ShowGenerationReadyToastOptions {
    file: GeneratedItem;
    isVideo: boolean;
    onView: () => void;
}

export function showGenerationReadyToast({ file, isVideo, onView }: ShowGenerationReadyToastOptions) {
    const toastId = toast.custom(
        (id) => (
            <GenerationReadyToast
                file={file}
                isVideo={isVideo}
                onView={() => {
                    onView();
                    toast.dismiss(id);
                }}
                closeToast={() => toast.dismiss(id)}
            />
        ),
        {
            duration: 10000, // 10 seconds
            closeButton: false,
            className: 'toast-generation-ready',
            style: {
                borderRadius: 12,
                boxShadow: 'var(--shadow-sm)',
                backgroundColor: 'var(--white)',
                padding: 12,
                width: 'var(--width)',
            },
            ...getJobToastLifecycleHandlers(),
        },
    );

    registerJobToast(toastId);
}
