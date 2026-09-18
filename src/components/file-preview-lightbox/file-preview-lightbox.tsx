import {
    ChevronLeftIcon,
    ChevronRightIcon,
    DownloadIcon,
    ExternalLinkIcon,
    FileIcon,
    Loader2Icon,
    XIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import useOverlayManager from '@/hooks/use-overlay-manager';

import './file-preview-lightbox.scss';

interface Props {
    src: string;
    alt: string;
    isOpen: boolean;
    type?: 'image' | 'video' | 'pdf' | 'file';
    onClose: () => void;
    title?: string;
    onDownload?: () => void;
    isDownloading?: boolean;
    children?: ReactNode;
    subtitle?: ReactNode;
    details?: ReactNode;
    actions?: ReactNode;
    onPrev?: () => void;
    onNext?: () => void;
    hasPrev?: boolean;
    hasNext?: boolean;
    isNextLoading?: boolean;
}

const FilePreviewLightbox = (props: Props) => {
    const {
        src,
        alt,
        isOpen,
        type = 'image',
        onClose,
        title,
        onDownload,
        isDownloading = false,
        children,
        subtitle,
        details,
        actions,
        onPrev,
        onNext,
        hasPrev = false,
        hasNext = false,
        isNextLoading = false,
    } = props;

    const contentRef = useRef<HTMLDivElement>(null);

    useOverlayManager(isOpen);

    useEffect(() => {
        if (!isOpen) return undefined;

        // Escape is owned by Radix Dialog via onOpenChange. Handling it here too would call
        // onClose twice; GlobalLibrary closes the preview with navigate(-1), so a second call
        // leaves the library entirely.
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && onPrev && hasPrev) {
                e.preventDefault();
                onPrev();
            }

            if (e.key === 'ArrowRight' && onNext && hasNext) {
                e.preventDefault();
                onNext();
            }
        };

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onPrev, onNext, hasPrev, hasNext]);

    const renderMedia = () => {
        if (type === 'video') {
            return (
                <video
                    src={src}
                    title={alt}
                    className="max-h-full min-h-[50vh] max-w-full min-w-[50vw] rounded-lg"
                    controls
                    autoPlay
                />
            );
        }

        if (type === 'pdf') {
            return <iframe src={src} title={alt} className="h-full w-full rounded-lg bg-white" />;
        }

        if (type === 'file') {
            return (
                <div className="flex max-w-md flex-col items-center gap-4 rounded-lg bg-background px-8 py-10 text-center">
                    <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileIcon className="size-8" />
                    </span>
                    <span className="line-clamp-2 text-base font-medium">{title || alt}</span>
                    <span className="text-sm text-text-secondary">
                        Preview isn&apos;t available for this file type.
                    </span>
                    {onDownload ? (
                        <Button disabled={isDownloading} onClick={onDownload}>
                            {isDownloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
                            Download
                        </Button>
                    ) : null}
                    <Button
                        variant="link"
                        className="text-text-secondary hover:text-foreground"
                        onClick={() => window.open(src, '_blank', 'noopener')}
                    >
                        <ExternalLinkIcon className="size-3.5" />
                        Open in new tab
                    </Button>
                </div>
            );
        }

        return <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg" />;
    };

    const renderNavigation = () => {
        if (!onPrev && !onNext) return null;

        return (
            <>
                <Button
                    variant="black"
                    size="icon-sm"
                    className="absolute top-1/2 left-0 z-1 -translate-y-1/2 rounded-full"
                    aria-label="Previous file"
                    disabled={!hasPrev}
                    onClick={onPrev}
                >
                    <ChevronLeftIcon />
                </Button>
                <Button
                    variant="black"
                    size="icon-sm"
                    className="absolute top-1/2 right-0 z-1 -translate-y-1/2 rounded-full"
                    aria-label="Next file"
                    disabled={!hasNext || isNextLoading}
                    onClick={onNext}
                >
                    {isNextLoading ? <Loader2Icon className="animate-spin" /> : <ChevronRightIcon />}
                </Button>
            </>
        );
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                ref={contentRef}
                overlayClassName="bg-black z-59!"
                className="lightbox-overlay common top-0! left-0! flex w-full max-w-none! translate-x-0! translate-y-0! items-center justify-center rounded-none border-0 bg-black p-5 shadow-none"
                onOpenAutoFocus={(e) => {
                    // Radix autofocuses the first focusable element, which pops its tooltip on open
                    e.preventDefault();
                    contentRef.current?.focus();
                }}
            >
                <DialogTitle className="sr-only">{alt || 'Image preview'}</DialogTitle>
                <div className="lightbox-content relative flex w-full flex-col items-center justify-center">
                    <div className="lightbox-header flex w-full items-start gap-2 pb-5">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            {title || subtitle ? (
                                <div className="flex min-w-0 flex-col gap-0.5">
                                    {title ? (
                                        <span className="line-clamp-1 text-sm font-medium text-white">{title}</span>
                                    ) : null}
                                    {subtitle ? <div className="min-w-0">{subtitle}</div> : null}
                                </div>
                            ) : null}
                            {details ? <div className="min-w-0">{details}</div> : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {actions}
                            {onDownload ? (
                                <SimpleTooltip content="Download" side="bottom" className="z-61">
                                    <Button
                                        variant="black"
                                        size="icon-sm"
                                        className="rounded-full"
                                        aria-label="Download"
                                        disabled={isDownloading}
                                        onClick={onDownload}
                                    >
                                        {isDownloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
                                    </Button>
                                </SimpleTooltip>
                            ) : null}
                            <SimpleTooltip content="Close" side="bottom" className="z-61">
                                <Button
                                    variant="black"
                                    size="icon-sm"
                                    className="lightbox-close-button shrink-0 rounded-full"
                                    aria-label="Close"
                                    onClick={onClose}
                                >
                                    <XIcon />
                                </Button>
                            </SimpleTooltip>
                        </div>
                    </div>
                    {renderNavigation()}
                    {children ? (
                        <div className="lightbox-image scrollbar-controller scrollbar-vertical scrollbar-horizontal h-[calc(100svh-40px-44px)] w-full max-w-[92vw]">
                            {children}
                        </div>
                    ) : (
                        <figure className="lightbox-image flex h-[calc(100svh-40px-44px)] w-full max-w-[92vw] items-center justify-center">
                            {renderMedia()}
                        </figure>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default FilePreviewLightbox;
