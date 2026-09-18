import { ArrowLeftIcon, ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type { ResearchQueryGroup, ResearchSourceItem } from './research-contract';

/**
 * Favicon hosts fail often enough — blocked third-party requests, sites with no icon —
 * that the initial letter is a normal path rather than an edge case.
 */
const SourceFavicon = ({ source, className }: { source: ResearchSourceItem; className?: string }) => {
    const [hasFailed, setHasFailed] = useState(false);

    if (!source.faviconUrl || hasFailed) {
        return (
            <span
                className={cn(
                    'research-source-favicon flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted text-[9px] font-medium text-muted-foreground',
                    className,
                )}
                aria-hidden
            >
                {source.siteName.charAt(0).toUpperCase()}
            </span>
        );
    }

    return (
        <img
            src={source.faviconUrl}
            alt=""
            onError={() => setHasFailed(true)}
            className={cn('research-source-favicon size-4 shrink-0 rounded-sm bg-muted', className)}
        />
    );
};

const formatResultCount = (count: number): string => `${count} result${count === 1 ? '' : 's'}`;

/**
 * `index` is contracted nonnegative and `total` positive, so the position is zero-based and
 * the reading has to be shifted for a human. Absent either field there is no progress to show.
 */
export const formatQueryProgress = (group: ResearchQueryGroup): string | undefined => {
    if (group.index === undefined || group.total === undefined) return undefined;

    return `${group.index}/${group.total}`;
};

const renderGroupStatus = (group: ResearchQueryGroup) => {
    if (group.status === 'pending') {
        return <span className="shrink-0 text-xs text-muted-foreground">Searching…</span>;
    }

    if (group.status === 'error') {
        return <span className="shrink-0 text-xs text-destructive">Search failed</span>;
    }

    return (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatResultCount(group.sources.length)}
        </span>
    );
};

const renderSource = (source: ResearchSourceItem) => (
    <li key={source.id}>
        <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="research-source-row flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-background"
        >
            <SourceFavicon source={source} className="mt-0.5" />
            <span className="flex min-w-0 flex-col gap-0.5">
                <span className="line-clamp-2 text-sm text-foreground">{source.title}</span>
                <span className="truncate text-xs text-muted-foreground">{source.siteName}</span>
            </span>
        </a>
    </li>
);

const renderGroupBody = (group: ResearchQueryGroup) => {
    if (group.sources.length > 0) {
        return <ul className="flex flex-col gap-0.5 px-2 pb-2">{group.sources.map(renderSource)}</ul>;
    }

    if (group.status === 'pending') {
        return <p className="px-3 pb-2 text-xs text-muted-foreground">Results are still coming in.</p>;
    }

    return <p className="px-3 pb-2 text-xs text-muted-foreground">No sources reported for this query.</p>;
};

const renderQueryGroup = (group: ResearchQueryGroup) => {
    const progress = formatQueryProgress(group);

    return (
        <Collapsible
            key={group.id}
            defaultOpen
            data-status={group.status ?? 'complete'}
            className={cn(
                'research-query-group rounded-lg border transition-colors',
                group.status === 'pending' ? 'border-primary/50' : 'border-border hover:border-muted-foreground/40',
            )}
        >
            <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left">
                <ChevronDownIcon
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90"
                    aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{group.text}</span>
                {progress === undefined ? null : (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{progress}</span>
                )}
                {renderGroupStatus(group)}
            </CollapsibleTrigger>
            <CollapsibleContent>{renderGroupBody(group)}</CollapsibleContent>
        </Collapsible>
    );
};

const renderBackButton = (onBack: () => void) => (
    <Button variant="ghost" size="icon-xs" aria-label="Back to research overview" onClick={onBack}>
        <ArrowLeftIcon />
    </Button>
);

interface Props {
    heading: string;
    groups: readonly ResearchQueryGroup[];
    onBack: () => void;
}

/** The trace's second level: every query one round ran, with the sources it turned up. */
const ResearchSourcesLevel = ({ heading, groups, onBack }: Props) => (
    <div className="research-sources-level flex flex-col gap-4">
        <div className="research-sources-level-header flex items-center gap-2">
            {renderBackButton(onBack)}
            <h5 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{heading}</h5>
        </div>
        {groups.length > 0 ? (
            <div className="research-sources-level-groups flex flex-col gap-2">{groups.map(renderQueryGroup)}</div>
        ) : (
            <p className="text-sm text-muted-foreground">No sources reported for this step.</p>
        )}
    </div>
);

const buildAllSourcesHeading = (count: number, isLive: boolean): string => {
    if (count === 0) return isLive ? 'Browsing sources…' : 'No sources browsed';

    const websites = `${count} website${count === 1 ? '' : 's'}`;

    return isLive ? `Researching ${websites}…` : `Browsed ${websites}`;
};

const buildSiteHeading = (site: string, count: number, isLive: boolean): string => {
    const sources = `${count} source${count === 1 ? '' : 's'}`;

    return isLive ? `${sources} from ${site} so far…` : `${sources} from ${site}`;
};

interface AllSourcesProps {
    sources: readonly ResearchSourceItem[];
    isLive: boolean;
    onBack: () => void;
    /** Set when the reader picked one site out of the breakdown; the list narrows to it. */
    site?: string;
}

/**
 * Every distinct site the whole run opened, first-seen order. The heading counts what this
 * list actually holds rather than the higher figure the backend may be reporting — a heading
 * that outruns its own rows reads as a bug.
 */
export const ResearchAllSourcesLevel = ({ sources, isLive, onBack, site }: AllSourcesProps) => {
    const shown = site === undefined ? sources : sources.filter((source) => source.siteName === site);

    return (
        <div className="research-all-sources flex flex-col gap-4">
            <div className="research-all-sources-header flex items-start gap-2">
                {renderBackButton(onBack)}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h5 className="text-sm font-medium text-foreground">
                        {site === undefined
                            ? buildAllSourcesHeading(shown.length, isLive)
                            : buildSiteHeading(site, shown.length, isLive)}
                    </h5>
                    <p className="text-xs text-muted-foreground">
                        {site === undefined
                            ? 'Every site the research opened, in the order it found them.'
                            : 'Every page the research opened on this site.'}
                    </p>
                </div>
            </div>
            {shown.length > 0 ? (
                <ul className="research-all-sources-list flex flex-col gap-0.5">
                    {shown.map((source) => (
                        <li key={source.id}>
                            <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="research-source-row flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-background"
                            >
                                <SourceFavicon source={source} className="mt-0.5" />
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className="truncate text-xs text-muted-foreground">{source.siteName}</span>
                                    <span className="line-clamp-2 text-sm text-foreground">{source.title}</span>
                                </span>
                            </a>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {site === undefined ? 'No sources reported yet.' : `No sources left from ${site}.`}
                </p>
            )}
        </div>
    );
};

export default ResearchSourcesLevel;
