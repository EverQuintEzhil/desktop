import { useEffect, useState } from 'react';

import FilePreviewLightbox from '@/components/file-preview-lightbox';
import { cn } from '@/lib/utils';

import { useIsInsideLink } from './inside-link-context';

export interface LightboxImageProps {
    src: string;
    alt: string;
    className?: string;
    title?: string;
}

const LightboxImage = (props: LightboxImageProps) => {
    const { src, alt, className, title } = props;

    const [isOpen, setIsOpen] = useState(false);
    const [hasOpened, setHasOpened] = useState(false);
    const [hasError, setHasError] = useState(false);
    const isInsideLink = useIsInsideLink();

    // The markdown img override is memoized, so this instance is reused across streaming re-parses and only its props change.
    useEffect(() => {
        setHasError(false);
        setIsOpen(false);
    }, [src]);

    const handleError = () => {
        setHasError(true);
        setIsOpen(false);
    };

    // A button inside an anchor is nested interactive content: the click would open the lightbox and the link would never be followed.
    if (isInsideLink) {
        return <img src={src} alt={alt} title={title} className={className} />;
    }

    return (
        <>
            {/* The button stays mounted through the error state so the img keeps its tree position: a
                remount would re-request the URL, and a transient failure could then recover with no
                onLoad to clear the error. */}
            <button
                type="button"
                className="lightbox-image-trigger max-w-full cursor-pointer border-0 bg-transparent p-0 align-top disabled:cursor-default"
                aria-label={alt ? `View ${alt} in lightbox` : 'View image in lightbox'}
                disabled={hasError}
                onClick={() => {
                    setIsOpen(true);
                    setHasOpened(true);
                }}
            >
                <img
                    src={src}
                    alt={alt}
                    title={title}
                    className={cn(!hasError && 'clickable-image', className)}
                    onError={handleError}
                    onLoad={() => setHasError(false)}
                />
            </button>
            {/* Mounted on first open, not unconditionally: a table renders twice (inline + fullscreen
                copy), so idle dialogs are a per-image cost on the streaming render path. Kept mounted
                after so the close animation can play. */}
            {hasOpened ? (
                <FilePreviewLightbox
                    src={src}
                    alt={alt}
                    type="image"
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                />
            ) : null}
        </>
    );
};

export default LightboxImage;
