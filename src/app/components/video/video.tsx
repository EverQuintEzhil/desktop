import React, { useState, useRef, useEffect } from 'react';

import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import './video.scss';

type LoadingOption = 'thumbnail' | 'spinner' | 'default';

export interface VideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    src?: string;
    thumbnail?: string;
    loadingOption?: LoadingOption;
    onError?: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
    onLoadStart?: () => void;
    onCanPlay?: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
    ref?: React.Ref<HTMLVideoElement>;
    controls?: boolean;
    showOnlyThumbnail?: boolean;
    hideThumbnail?: boolean;
}

const Video = (props: VideoProps) => {
    const {
        src,
        thumbnail,
        loadingOption = 'default',
        onError,
        onLoadStart,
        onCanPlay,
        ref,
        controls,
        showOnlyThumbnail = false,
        hideThumbnail,
        className = '',
        ...rest
    } = props;

    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (showOnlyThumbnail) {
            setIsPlaying(false);
        }
    }, [showOnlyThumbnail]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const showOnlyThumbnailTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (ref) {
            if (typeof ref === 'function') {
                ref(videoRef.current);
            } else {
                ref.current = videoRef.current;
            }
        }
    }, [ref]);

    useEffect(() => {
        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }

            if (showOnlyThumbnailTimeoutRef.current) {
                clearTimeout(showOnlyThumbnailTimeoutRef.current);
            }
        };
    }, []);

    const handleLoadStart = () => {
        setIsLoading(true);
        if (onLoadStart) {
            onLoadStart();
        }

        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
        }
        loadingTimeoutRef.current = setTimeout(() => {
            setIsLoading(false);
        }, 3000);
    };

    const handleCanPlay = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
        }
        setIsLoading(false);
        if (onCanPlay) {
            onCanPlay(e);
        }
    };

    const handleLoadedData = () => {
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
        }
        setIsLoading(false);
    };

    const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
        }
        setIsLoading(false);
        setHasError(true);
        if (onError) {
            onError(e);
        }
    };

    if (hasError) {
        return <div className="video-error flex h-full w-full shrink-0 items-center justify-center" />;
    }

    if (src && src !== '') {
        return (
            <div className="video-block relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
                <div
                    className={cn(
                        'video-thumbnail absolute inset-0 z-1 shrink-0',
                        (isPlaying || hideThumbnail) && !(loadingOption === 'thumbnail' && isLoading)
                            ? 'pointer-events-none opacity-0'
                            : 'pointer-events-auto opacity-100',
                    )}
                >
                    <img src={thumbnail} alt="Video thumbnail" />
                    {isLoading && loadingOption === 'thumbnail' && (
                        <div className="video-thumbnail-loading-overlay">
                            <Spinner className="scale-[1.5] text-white drop-shadow-lg" />
                        </div>
                    )}
                </div>
                {!showOnlyThumbnail && (
                    <video
                        className={`relative z-2 h-full w-full shrink-0 object-contain ${className}`.trim()}
                        ref={videoRef}
                        src={src}
                        muted
                        onLoadStart={handleLoadStart}
                        onCanPlay={handleCanPlay}
                        onLoadedData={handleLoadedData}
                        onError={handleError}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        controls={isLoading ? false : controls}
                        {...rest}
                    />
                )}

                {isLoading && loadingOption === 'spinner' && (
                    <div className="absolute top-1/2 left-1/2 z-2 -translate-x-1/2 -translate-y-1/2">
                        <Spinner />
                    </div>
                )}

                {isLoading && loadingOption === 'default' && thumbnail && (
                    <div className="video-thumbnail absolute inset-0 z-1 shrink-0 opacity-50" />
                )}
            </div>
        );
    }

    if (thumbnail) {
        return (
            <div className="video-block-image relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
                <div className="video-thumbnail absolute inset-0 z-1 shrink-0" />
            </div>
        );
    }

    return <div className="video-error flex h-full w-full shrink-0 items-center justify-center" />;
};

export default Video;
