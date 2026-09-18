import { GlobeIcon } from 'lucide-react';

import type { AdminSource } from '../types';

export interface SourceLinkProps {
    source: AdminSource;
}

export const SourceLink = ({ source }: SourceLinkProps) => (
    <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded p-1 transition-colors hover:bg-background"
    >
        {source.favicon ? (
            <img src={source.favicon} alt="" className="size-4 shrink-0 rounded-sm" />
        ) : (
            <GlobeIcon className="size-4 shrink-0 text-text-secondary" aria-label="Website" />
        )}
        <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium">{source.title || source.site_name || source.url}</span>
            {source.site_name && source.title && (
                <span className="truncate text-xs text-text-secondary">{source.site_name}</span>
            )}
        </div>
    </a>
);
