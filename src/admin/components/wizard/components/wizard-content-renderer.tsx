import { useEffect, useState } from 'react';

import type { WizardStepContent } from '../wizard';

const WizardContentRenderer = ({ content }: { content: WizardStepContent }) => {
    const [imageLoadFailed, setImageLoadFailed] = useState(false);

    useEffect(() => {
        setImageLoadFailed(false);
    }, [content.url]);

    switch (content.type) {
        case 'text':
            return (
                <div className="flex flex-col gap-1">
                    {content.title && <h6 className="font-medium">{content.title}</h6>}
                    <span className="text-sm text-muted-foreground">{content.content}</span>
                </div>
            );

        case 'image': {
            const showPlaceholder = !content.url || imageLoadFailed;

            return (
                <div className="flex flex-col gap-2">
                    <div className="wizard-step-image">
                        {content.url && !imageLoadFailed && (
                            <img
                                src={content.url}
                                alt={content.content || content.title || 'Image'}
                                className="h-full w-full rounded-md object-cover"
                                onError={() => setImageLoadFailed(true)}
                            />
                        )}
                        {showPlaceholder && (
                            <div className="flex h-full items-center justify-center rounded-md bg-muted">
                                <span className="text-sm text-muted-foreground">
                                    {content.url ? 'Image failed to load' : 'No image URL provided'}
                                </span>
                            </div>
                        )}
                    </div>
                    {content.description && (
                        <span className="text-center text-xs text-muted-foreground">{content.description}</span>
                    )}
                </div>
            );
        }

        case 'video': {
            const isYouTube = content.url?.includes('youtube.com') || content.url?.includes('youtu.be');
            const isVimeo = content.url?.includes('vimeo.com');

            const getYouTubeEmbedUrl = (url: string) => {
                const videoId = url.includes('youtu.be')
                    ? url.split('youtu.be/')[1]?.split('?')[0]
                    : url.split('v=')[1]?.split('&')[0];

                return `https://www.youtube.com/embed/${videoId}`;
            };

            const getVimeoEmbedUrl = (url: string) => {
                const videoId = url.split('vimeo.com/')[1]?.split('?')[0];

                return `https://player.vimeo.com/video/${videoId}`;
            };

            return (
                <div className="flex flex-col gap-2">
                    {content.title && <h6 className="text-sm font-medium">{content.title}</h6>}
                    <div className="h-48 overflow-hidden rounded-md sm:h-64 md:h-80">
                        {content.url && isYouTube && (
                            <iframe
                                src={getYouTubeEmbedUrl(content.url)}
                                title={content.title || 'Video'}
                                className="h-full w-full"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        )}
                        {content.url && !isYouTube && isVimeo && (
                            <iframe
                                src={getVimeoEmbedUrl(content.url)}
                                title={content.title || 'Video'}
                                className="h-full w-full"
                                frameBorder="0"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                            />
                        )}
                        {content.url && !isYouTube && !isVimeo && (
                            <video src={content.url} controls className="h-full w-full object-cover">
                                Your browser does not support the video tag.
                            </video>
                        )}
                        {!content.url && (
                            <div className="flex h-full w-full items-center justify-center bg-muted">
                                <span className="text-sm text-muted-foreground">No video URL provided</span>
                            </div>
                        )}
                    </div>
                    {content.description && (
                        <span className="text-xs text-muted-foreground">{content.description}</span>
                    )}
                </div>
            );
        }

        case 'link':
            return (
                <div className="flex flex-col gap-1">
                    {content.title && <h6 className="font-medium">{content.title}</h6>}
                    <a
                        href={content.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-primary underline hover:opacity-80"
                    >
                        {content.content}
                        <svg className="ml-1 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                        </svg>
                    </a>
                    {content.description && <span className="text-xs text-destructive">{content.description}</span>}
                </div>
            );

        default:
            return null;
    }
};

export default WizardContentRenderer;
