import type { ResearchDomainCount, ResearchSourceItem } from './research-contract';
import { buildDomainBreakdown } from './research-contract';

const renderMark = (row: ResearchDomainCount) => (
    <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted text-[9px] font-medium text-muted-foreground">
        {row.faviconUrl ? (
            <img
                src={row.faviconUrl}
                alt=""
                className="size-full object-cover"
                onError={(event) => {
                    event.currentTarget.style.display = 'none';
                }}
            />
        ) : (
            row.siteName.charAt(0).toUpperCase()
        )}
    </span>
);

const formatSourceCount = (count: number): string => `${count} source${count === 1 ? '' : 's'}`;

interface Props {
    sources: readonly ResearchSourceItem[];
    onSelectSite: (siteName: string) => void;
    onShowAll: () => void;
}

/** Which sites the run leaned on — Claude's breakdown under "Gathered N sources". */
const ResearchDomainBreakdown = ({ sources, onSelectSite, onShowAll }: Props) => {
    const { rows, otherCount } = buildDomainBreakdown(sources);

    if (rows.length === 0) return null;

    return (
        <div className="research-domain-breakdown mt-2 flex flex-col gap-1 rounded-xl border border-border bg-card px-2 py-2">
            <p className="research-domain-breakdown-label px-1 text-xs font-medium text-muted-foreground">Top sites</p>
            {rows.map((row) => (
                <button
                    key={row.siteName}
                    type="button"
                    aria-label={`Show the ${formatSourceCount(row.count)} from ${row.siteName}`}
                    onClick={() => onSelectSite(row.siteName)}
                    className="research-domain-row flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-background"
                >
                    {renderMark(row)}
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">{row.siteName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatSourceCount(row.count)}
                    </span>
                </button>
            ))}
            {otherCount > 0 && (
                <button
                    type="button"
                    onClick={onShowAll}
                    className="research-domain-other cursor-pointer rounded-lg px-1 py-1 text-left text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                    {`+${otherCount} more source${otherCount === 1 ? '' : 's'}`}
                </button>
            )}
        </div>
    );
};

export default ResearchDomainBreakdown;
