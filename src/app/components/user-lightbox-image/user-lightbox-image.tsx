import { useState } from 'react';

import FilePreviewLightbox from '@/components/file-preview-lightbox';

interface UserLightboxImageProps {
    src: string;
    alt: string;
    className?: string;
    onOpenChange?: (open: boolean) => void;
}

const UserLightboxImage = (props: UserLightboxImageProps) => {
    const { src, alt, className, onOpenChange } = props;

    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [hasError, setHasError] = useState(false);

    const setLightboxOpen = (open: boolean) => {
        setIsLightboxOpen(open);
        onOpenChange?.(open);
    };

    const openLightbox = () => {
        if (hasError) return;

        setLightboxOpen(true);
    };

    return (
        <>
            <img
                src={src}
                alt={alt}
                className={`${className ?? ''} ${hasError ? 'cursor-default' : 'cursor-pointer'}`}
                role={hasError ? undefined : 'button'}
                tabIndex={hasError ? undefined : 0}
                aria-label={hasError ? alt : `View ${alt} in lightbox`}
                onClick={openLightbox}
                onError={() => setHasError(true)}
                onKeyDown={(event) => {
                    if (hasError) return;

                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openLightbox();
                    }
                }}
            />
            {!hasError && (
                <FilePreviewLightbox
                    src={src}
                    alt={alt}
                    isOpen={isLightboxOpen}
                    onClose={() => setLightboxOpen(false)}
                />
            )}
        </>
    );
};

export default UserLightboxImage;
