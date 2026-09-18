import React, { useState } from 'react';

import { cn } from '@/lib/utils';

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    placeholder?: string;
    src?: string;
    srcSet?: string;
    onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
    ref?: React.Ref<HTMLImageElement>;
}

const Image = (props: ImageProps) => {
    const { placeholder, src, srcSet = '', onError, ref, className, ...rest } = props;

    const [failedImage, setFailedImage] = useState(false);

    if (placeholder && (failedImage || (!src && !srcSet))) {
        return (
            <img
                ref={ref}
                {...rest}
                className={cn('placeholder-image max-w-full shrink-0 object-cover', className)}
                src={placeholder}
                alt={rest.alt}
            />
        );
    }

    if ((src && src !== '') || (srcSet && srcSet !== '')) {
        return (
            <img
                ref={ref}
                alt={rest.alt}
                {...rest}
                className={cn('max-w-full shrink-0 object-cover', className)}
                src={src}
                srcSet={srcSet}
                onError={(e) => {
                    setFailedImage(true);
                    if (onError) onError(e);
                }}
            />
        );
    }

    return (
        <figure
            ref={ref as React.Ref<HTMLElement>}
            {...(rest as React.HTMLAttributes<HTMLElement>)}
            className={cn(
                'h-full w-full shrink-0 bg-[#e5e5e5] bg-size-[40px] bg-center bg-no-repeat',
                'bg-[url("https://projecthub365-assets.s3.amazonaws.com/hub-ui/svg/broken-image.svg")]',
                className,
            )}
        />
    );
};

export default Image;
