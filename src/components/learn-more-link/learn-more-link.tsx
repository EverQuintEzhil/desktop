import { ExternalLinkIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/hooks/use-typed-redux';
import { cn } from '@/lib/utils';
import { type YoutubeVideoEmbedKey } from '@/types/admin';

interface Props {
    embedKey: YoutubeVideoEmbedKey;
    label: string;
    className?: string;
}

const LearnMoreLink = ({ embedKey, label, className }: Props) => {
    const youtubeVideoEmbeds = useAppSelector((state) => state.tenant.youtubeVideoEmbeds);
    const url = youtubeVideoEmbeds?.[embedKey];

    if (!url) {
        return null;
    }

    return (
        <Button asChild variant="link" size="sm" className={cn('h-auto p-0', className)}>
            <a href={url} target="_blank" rel="noopener noreferrer">
                {label}
                <ExternalLinkIcon aria-hidden className="size-3.5" />
            </a>
        </Button>
    );
};

export default LearnMoreLink;
