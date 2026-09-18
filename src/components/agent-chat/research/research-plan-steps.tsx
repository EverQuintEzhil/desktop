import { cn } from '@/lib/utils';

import { RESEARCH_STEP_STATE_LABEL, renderResearchStepMarker } from './research-step-marker';
import type { ResearchStep } from './research-view-model';

interface Props {
    steps: readonly ResearchStep[];
    className?: string;
}

/**
 * The plan as a checklist. Presentational only — the caller owns which state each entry is
 * in, so the approval gate and the running card cannot disagree about what a marker means.
 */
const ResearchPlanSteps = ({ steps, className }: Props) => {
    if (steps.length === 0) return null;

    return (
        <ol className={cn('research-plan-steps flex flex-col gap-3', className)}>
            {steps.map((step) => (
                <li key={step.id} className="research-plan-step flex items-start gap-3">
                    {renderResearchStepMarker(step.state)}
                    <span
                        className={cn(
                            'text-sm leading-5',
                            step.state === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                        )}
                    >
                        {step.text}
                        <span className="sr-only">{` — ${RESEARCH_STEP_STATE_LABEL[step.state]}`}</span>
                    </span>
                </li>
            ))}
        </ol>
    );
};

export default ResearchPlanSteps;
