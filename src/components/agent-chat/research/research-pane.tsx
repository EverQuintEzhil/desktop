import { XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useIsPaneOverlay } from '../hooks/use-is-pane-overlay';

import type { ResearchContent, ResearchQueryGroup, ResearchSourceItem } from './research-contract';
import ResearchDomainBreakdown from './research-domain-breakdown';
import ResearchPhaseRow from './research-phase-row';
import ResearchPlanSteps from './research-plan-steps';
import ResearchReportActions from './research-report-actions';
import ResearchReportLevel from './research-report-level';
import ResearchSourcesLevel, { formatQueryProgress, ResearchAllSourcesLevel } from './research-sources-level';
import { buildPlanSteps, buildResearchPhases } from './research-view-model';

// Roughly half the window, the width Claude's document panel and Gemini's Canvas take — the report
// carries tables and prose that a 400px rail wraps to shreds. The slide-in animates the outer
// width against the inner element's own width, so both must read this same class.
const PANE_WIDTH_CLASS = 'w-[clamp(420px,46vw,860px)]';

/**
 * The flat sources list is a third level rather than a header toggle: the pane already owns a
 * level and a back affordance, so one more variant costs a branch, while a toggle would have
 * to stay coherent with a drill-down that is open at the same time.
 */
type PaneView =
    | { level: 'trace' }
    | { level: 'round'; round: number }
    | { level: 'sources'; site?: string }
    | { level: 'report' };

/** Which level the transcript asked for. The report chip opens the pane straight at the report. */
export type RequestedResearchView = 'trace' | 'report';

const formatSourceCount = (count: number): string => `${count} source${count === 1 ? '' : 's'}`;

const groupByRound = (groups: readonly ResearchQueryGroup[]): Map<number, ResearchQueryGroup[]> => {
    const byRound = new Map<number, ResearchQueryGroup[]>();

    for (const group of groups) {
        byRound.set(group.round, [...(byRound.get(group.round) ?? []), group]);
    }

    return byRound;
};

/** Distinct sources across the run, first-seen order, keyed by URL as the receipt count is. */
const collectDistinctSources = (groups: readonly ResearchQueryGroup[]): ResearchSourceItem[] => {
    const byUrl = new Map<string, ResearchSourceItem>();

    for (const group of groups) {
        for (const source of group.sources) {
            if (!byUrl.has(source.url)) byUrl.set(source.url, source);
        }
    }

    return [...byUrl.values()];
};

/**
 * The round's own position, preferring the search still in flight. Undefined unless the
 * backend stated both fields — a position this client counted itself would be a fabrication.
 */
const buildRoundProgress = (groups: readonly ResearchQueryGroup[]): string | undefined => {
    const stated = groups.filter((group) => formatQueryProgress(group) !== undefined);

    if (stated.length === 0) return undefined;

    return formatQueryProgress(stated.find((group) => group.status === 'pending') ?? stated[stated.length - 1]);
};

interface Props {
    isVisible: boolean;
    isFromAdmin?: boolean;
    /** Message the trace belongs to. The only identity that separates two runs in one thread. */
    runId: string | null;
    content: ResearchContent | null;
    isRunning: boolean;
    /** Level the opening affordance asked for; re-applied when the transcript asks again. */
    requestedView?: RequestedResearchView;
    /** Changes on every such request, so re-asking for the level already shown still re-applies. */
    requestedViewNonce?: number;
    onClose: () => void;
}

/** The deep-research trace: a phase timeline, drilling into the sources one round gathered. */
const ResearchPane = ({
    isVisible,
    isFromAdmin = false,
    runId,
    content,
    isRunning,
    requestedView = 'trace',
    requestedViewNonce = 0,
    onClose,
}: Props) => {
    const isModalMode = useIsPaneOverlay(isFromAdmin);
    const [view, setView] = useState<PaneView>({ level: 'trace' });
    const reportBodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setView({ level: requestedView === 'report' ? 'report' : 'trace' });
    }, [runId, isVisible, requestedView, requestedViewNonce]);

    // Liveness is the pushed snapshot's, never inferred from which optional fields arrived.
    const isLive = isRunning && content?.phase !== 'done';
    const phases = useMemo(() => (content ? buildResearchPhases(content, isLive) : []), [content, isLive]);
    const planSteps = useMemo(() => (content ? buildPlanSteps(content, isLive) : []), [content, isLive]);
    const roundGroups = useMemo(() => groupByRound(content?.queryGroups ?? []), [content]);
    const distinctSources = useMemo(() => collectDistinctSources(content?.queryGroups ?? []), [content]);

    const headerTitle = content?.title ?? 'Research';
    const settledCount = content?.sourceCount ?? 0;
    const headerCount = isLive ? Math.max(settledCount, content?.runningSourceCount ?? 0) : settledCount;
    const headerCountLabel = isLive
        ? `${formatSourceCount(headerCount)} and counting…`
        : formatSourceCount(headerCount);

    const isReportLevel = view.level === 'report' && content?.reportMarkdown !== undefined;

    const renderHeaderActions = () => {
        if (!isReportLevel) return null;

        return (
            <ResearchReportActions
                title={headerTitle}
                markdown={content?.reportMarkdown ?? ''}
                bodyRef={reportBodyRef}
            />
        );
    };

    const renderHeaderCount = () => {
        if (headerCount === 0 || view.level === 'sources' || view.level === 'report') return null;

        return (
            <button
                type="button"
                className="research-pane-count shrink-0 cursor-pointer text-xs text-muted-foreground tabular-nums underline-offset-2 transition-colors hover:text-foreground hover:underline"
                onClick={() => setView({ level: 'sources' })}
            >
                {headerCountLabel}
            </button>
        );
    };

    const lastRound = [...roundGroups.keys()].sort((a, b) => a - b).at(-1);

    const renderOverview = () => (
        <ol className="research-pane-phases flex flex-col">
            {phases.map((phase, index) => {
                const round = phase.round;
                const groups = round === undefined ? [] : (roundGroups.get(round) ?? []);

                return (
                    <ResearchPhaseRow
                        key={phase.id}
                        phase={phase}
                        isLast={index === phases.length - 1}
                        progressLabel={buildRoundProgress(groups)}
                        onDrillDown={round === undefined ? undefined : () => setView({ level: 'round', round })}
                        expandedContent={
                            phase.id === 'plan' && planSteps.length > 0 ? (
                                <ResearchPlanSteps steps={planSteps} />
                            ) : undefined
                        }
                        // Claude prints the site breakdown under the last gathering step, where it
                        // reads as the shape of everything collected rather than of one round.
                        belowContent={
                            round !== undefined && round === lastRound && distinctSources.length > 0 ? (
                                <ResearchDomainBreakdown
                                    sources={distinctSources}
                                    onSelectSite={(site) => setView({ level: 'sources', site })}
                                    onShowAll={() => setView({ level: 'sources' })}
                                />
                            ) : undefined
                        }
                    />
                );
            })}
        </ol>
    );

    const renderBody = () => {
        if (!content) return null;

        if (view.level === 'report' && content.reportMarkdown !== undefined) {
            return <ResearchReportLevel markdown={content.reportMarkdown} bodyRef={reportBodyRef} />;
        }

        if (view.level === 'sources') {
            return (
                <ResearchAllSourcesLevel
                    sources={distinctSources}
                    isLive={isLive}
                    site={view.site}
                    onBack={() => setView({ level: 'trace' })}
                />
            );
        }

        if (phases.length === 0) {
            return <p className="text-sm text-muted-foreground">No research steps reported yet.</p>;
        }

        if (view.level === 'round') {
            const groups = roundGroups.get(view.round) ?? [];

            if (groups.length > 0) {
                const heading = phases.find((phase) => phase.round === view.round)?.label ?? content.title;

                return (
                    <ResearchSourcesLevel
                        heading={heading}
                        groups={groups}
                        onBack={() => setView({ level: 'trace' })}
                    />
                );
            }
        }

        return renderOverview();
    };

    if (isModalMode) {
        return (
            <Dialog open={isVisible} onOpenChange={(open) => !open && onClose()}>
                <DialogContent
                    data-slot="research-pane"
                    // bg-card overrides the shared dialog's hardcoded bg-white, which is unreadable
                    // in dark mode.
                    className="flex max-w-[600px] flex-col overflow-hidden bg-card p-0 max-xl:max-h-[80svh] max-xl:rounded-2xl"
                >
                    <DialogHeader className="flex min-h-12 flex-row items-center justify-between gap-3 py-2 pr-3 pl-5">
                        <div className="research-pane-heading flex min-w-0 items-baseline gap-2">
                            <DialogTitle className="truncate text-base font-semibold tracking-tight">
                                {headerTitle}
                            </DialogTitle>
                            {renderHeaderCount()}
                        </div>
                        <div className="research-pane-header-actions flex shrink-0 items-center gap-1">
                            {renderHeaderActions()}
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Close"
                                onClick={onClose}
                                className="text-muted-foreground hover:bg-background hover:text-foreground"
                            >
                                <XIcon className="size-4" />
                            </Button>
                        </div>
                    </DialogHeader>
                    <DialogBody className="scrollbar-controller scrollbar-vertical flex flex-col gap-6 p-5">
                        {renderBody()}
                    </DialogBody>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <div
            data-slot="research-pane"
            data-state={isVisible ? 'open' : 'closed'}
            className={cn(
                'sticky top-0 h-svh shrink-0 overflow-hidden',
                'transition-[width] duration-300 ease-in-out',
                isVisible ? PANE_WIDTH_CLASS : 'w-0',
            )}
        >
            <div
                className={cn(
                    'flex h-svh flex-col',
                    PANE_WIDTH_CLASS,
                    'border-l border-border bg-card',
                    'transition-transform duration-300 ease-in-out',
                    isVisible ? 'translate-x-0' : 'translate-x-full',
                )}
            >
                <div className="research-pane-header sticky top-0 z-1 flex min-h-12 items-center justify-between gap-3 border-b border-border bg-card py-2 pr-3 pl-5">
                    <div className="research-pane-heading flex min-w-0 items-baseline gap-2">
                        <h4 className="truncate text-base font-semibold tracking-tight text-foreground">
                            {headerTitle}
                        </h4>
                        {renderHeaderCount()}
                    </div>
                    <div className="research-pane-header-actions flex shrink-0 items-center gap-1">
                        {renderHeaderActions()}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Close"
                            onClick={onClose}
                            className="text-muted-foreground hover:bg-background hover:text-foreground"
                        >
                            <XIcon className="size-4" />
                        </Button>
                    </div>
                </div>
                <div className="research-pane-body scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col gap-6 px-4 py-5">
                    {isVisible ? renderBody() : null}
                </div>
            </div>
        </div>
    );
};

export default ResearchPane;
