import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import { RESEARCH_STEP_STATE_LABEL, renderResearchStepMarker } from './research-step-marker';
import { toPlainSummary } from './research-summary-text';
import type { ResearchFavicon, ResearchPhase } from './research-view-model';

const FAVICON_CLASS =
    'flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-circle border border-border bg-muted text-[10px] font-medium text-muted-foreground';

/** Same letter fallback the inline card uses, for the same reason: favicon fetches fail. */
const StripFavicon = ({ favicon }: { favicon: ResearchFavicon }) => {
    const [hasFailed, setHasFailed] = useState(false);

    if (!favicon.url || hasFailed) {
        return (
            <span className={FAVICON_CLASS} aria-hidden>
                {favicon.siteName.charAt(0).toUpperCase()}
            </span>
        );
    }

    return (
        <span className={FAVICON_CLASS} aria-hidden>
            <img src={favicon.url} alt="" onError={() => setHasFailed(true)} className="size-full object-cover" />
        </span>
    );
};

const renderFavicons = (favicons: readonly ResearchFavicon[]) => {
    if (favicons.length === 0) return null;

    return (
        <span className="research-phase-row-favicons flex shrink-0 items-center -space-x-1.5">
            {favicons.map((favicon) => (
                <StripFavicon key={favicon.id} favicon={favicon} />
            ))}
        </span>
    );
};

const renderProgress = (progressLabel: string | undefined) => {
    if (progressLabel === undefined) return null;

    return <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{progressLabel}</span>;
};

const labelClass = (state: ResearchPhase['state']) =>
    cn('min-w-0 flex-1 text-left text-sm', state === 'pending' ? 'text-muted-foreground' : 'text-foreground');

interface Props {
    phase: ResearchPhase;
    isLast: boolean;
    /** Per-round position the backend stated, already formatted. Absent when it stated none. */
    progressLabel?: string;
    onDrillDown?: () => void;
    expandedContent?: ReactNode;
    /** Rendered under the row, outside any collapsible — a breakdown, a narrative entry. */
    belowContent?: ReactNode;
}

/** One row of the trace timeline: a state marker, the phase label, and the sites it touched. */
const ResearchPhaseRow = ({ phase, isLast, progressLabel, onDrillDown, expandedContent, belowContent }: Props) => {
    const stateLabel = <span className="sr-only">{` — ${RESEARCH_STEP_STATE_LABEL[phase.state]}`}</span>;
    const summaryText = phase.summary === undefined ? undefined : toPlainSummary(phase.summary);
    const summary =
        summaryText === undefined || summaryText.length === 0 ? null : (
            <p className="research-phase-summary mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {summaryText}
            </p>
        );

    const renderBody = () => {
        if (expandedContent !== undefined) {
            return (
                <Collapsible defaultOpen className="research-phase-row-body flex min-w-0 flex-1 flex-col gap-3">
                    <CollapsibleTrigger className="group -mr-2 flex w-full cursor-pointer items-center gap-2">
                        <span className={labelClass(phase.state)}>
                            {phase.label}
                            {stateLabel}
                        </span>
                        <ChevronDownIcon
                            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90"
                            aria-hidden
                        />
                    </CollapsibleTrigger>
                    <CollapsibleContent>{expandedContent}</CollapsibleContent>
                </Collapsible>
            );
        }

        if (onDrillDown) {
            return (
                <button
                    type="button"
                    aria-label={`Show sources for ${phase.label}`}
                    onClick={onDrillDown}
                    className="research-phase-row-body -mx-2 -my-1 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-background"
                >
                    <span className={labelClass(phase.state)}>
                        {phase.label}
                        {stateLabel}
                    </span>
                    {renderProgress(progressLabel)}
                    {renderFavicons(phase.favicons)}
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
            );
        }

        return (
            <div className="research-phase-row-body flex min-w-0 flex-1 items-center gap-2">
                <span className={labelClass(phase.state)}>
                    {phase.label}
                    {stateLabel}
                </span>
                {renderProgress(progressLabel)}
                {renderFavicons(phase.favicons)}
            </div>
        );
    };

    return (
        <li className="research-phase-row relative flex gap-3 pb-4 last:pb-0">
            {isLast ? null : <span className="absolute top-5 bottom-0 left-[7px] w-px bg-border" aria-hidden />}
            <span className="relative z-1 mt-0.5 shrink-0">{renderResearchStepMarker(phase.state)}</span>
            <div className="research-phase-row-column flex min-w-0 flex-1 flex-col">
                {renderBody()}
                {summary}
                {belowContent}
            </div>
        </li>
    );
};

export default ResearchPhaseRow;
