import { Globe } from 'lucide-react';
import { useState } from 'react';

import { useCitationSource } from '@/components/assistant-ui/citation-sources-context';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { getFaviconUrl, getHostname } from '@/lib/web-source-urls';

interface CitationChipProps {
    url: string;
    label?: string;
}

interface CitationFaviconProps {
    faviconUrl?: string;
    className: string;
}

const CitationFavicon = ({ faviconUrl, className }: CitationFaviconProps) => {
    const [faviconFailed, setFaviconFailed] = useState(false);

    if (!faviconUrl || faviconFailed) {
        return <Globe className={className} aria-hidden="true" />;
    }

    return <img src={faviconUrl} alt="" className={className} onError={() => setFaviconFailed(true)} />;
};

export const CitationChip = ({ url, label }: CitationChipProps) => {
    const source = useCitationSource(url);
    const hostname = getHostname(url);
    const faviconUrl = source?.faviconUrl ?? getFaviconUrl(url);
    const siteName = source?.siteName || label?.trim() || hostname;

    const renderPreview = () => {
        if (!source) return null;

        const renderDescription = () => {
            if (!source.description) return null;

            return <p className="line-clamp-2 text-sm text-muted-foreground">{source.description}</p>;
        };

        return (
            <HoverCardContent className="w-auto max-w-sm rounded-xl bg-popover p-4 shadow-lg">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <CitationFavicon faviconUrl={faviconUrl} className="h-4 w-4 shrink-0 rounded-[3px]" />
                        <span className="text-sm text-muted-foreground">{source.siteName}</span>
                    </div>
                    <p className="line-clamp-2 text-base leading-snug font-semibold">{source.title}</p>
                    {renderDescription()}
                </div>
            </HoverCardContent>
        );
    };

    return (
        <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={siteName}
                    className={[
                        'fm-citation-chip not-prose inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0 m-0 align-baseline whitespace-nowrap transition-colors',
                        'text-[11px]! leading-4! no-underline! font-normal! text-muted-foreground!',
                        'hover:bg-foreground hover:text-background! hover:no-underline!',
                    ].join(' ')}
                >
                    <CitationFavicon faviconUrl={faviconUrl} className="m-0! h-3! w-3! shrink-0 rounded-[3px]!" />
                    {siteName}
                </a>
            </HoverCardTrigger>
            {renderPreview()}
        </HoverCard>
    );
};
