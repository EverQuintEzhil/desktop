import { ChevronRightIcon, TelescopeIcon } from 'lucide-react';
import { useMemo } from 'react';

import type { ResearchContent } from './research-contract';
import ResearchPlanSteps from './research-plan-steps';
import { buildRunningStatus } from './research-status-line';
import { buildPlanSteps } from './research-view-model';
import { useElapsedMs } from './use-elapsed-ms';

interface ResearchPlanCardProps {
    content: ResearchContent;
    isRunning: boolean;
    onOpenTrace: () => void;
}

/**
 * The plan the run will follow, shown in full until the first round comes back. It leads the
 * transcript for exactly as long as there is nothing else to say about the run.
 *
 * The checklist is flow content, so the trace affordance is the header rather than the whole
 * card — a button may not contain a list.
 */
const ResearchPlanCard = ({ content, isRunning, onOpenTrace }: ResearchPlanCardProps) => {
    const elapsedMs = useElapsedMs(isRunning, content.startedAt);
    const steps = useMemo(() => buildPlanSteps(content, isRunning), [content, isRunning]);

    return (
        <section
            data-slot="research-card"
            data-phase="plan"
            className="research-plan-card flex w-full flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
            <button
                type="button"
                aria-label={`Open research trace: ${content.title}`}
                onClick={onOpenTrace}
                className="research-plan-card-header -mx-1 flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-background"
            >
                <TelescopeIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{content.title}</h3>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
            <ResearchPlanSteps steps={steps} />
            {isRunning && (
                <p className="research-plan-card-progress text-xs text-muted-foreground tabular-nums">
                    {buildRunningStatus(content, elapsedMs)}
                </p>
            )}
        </section>
    );
};

export default ResearchPlanCard;
