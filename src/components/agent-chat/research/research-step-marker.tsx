import { CheckIcon, MinusIcon } from 'lucide-react';

import type { ResearchStepState } from './research-view-model';

export const RESEARCH_STEP_STATE_LABEL: Record<ResearchStepState, string> = {
    done: 'done',
    active: 'in progress',
    pending: 'pending',
    stopped: 'stopped',
};

/**
 * The one dot the plan checklist and the trace timeline both draw. Shared so a marker means
 * the same thing wherever the run is rendered.
 */
export const renderResearchStepMarker = (state: ResearchStepState) => {
    if (state === 'done') {
        return (
            <span className="flex size-4 shrink-0 items-center justify-center rounded-circle bg-primary">
                <CheckIcon className="size-2.5 text-primary-foreground" aria-hidden />
            </span>
        );
    }

    if (state === 'stopped') {
        return (
            <span className="flex size-4 shrink-0 items-center justify-center rounded-circle bg-muted-foreground">
                <MinusIcon className="size-2.5 text-background" aria-hidden />
            </span>
        );
    }

    if (state === 'active') {
        return (
            <span className="research-step-marker is-active flex size-4 shrink-0 items-center justify-center rounded-circle border-2 border-primary">
                <span className="size-1.5 rounded-circle bg-primary" />
            </span>
        );
    }

    return (
        <span
            className="block size-4 shrink-0 rounded-circle border-2 border-dashed border-muted-foreground/50"
            aria-hidden
        />
    );
};
