import { useAuiState } from '@assistant-ui/react';
import { AlignLeftIcon, ClockIcon, FilesIcon, TelescopeIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useIsLastMessage } from '@/components/chat/tools/use-is-last-message';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getErrorToastOptions } from '@/utils/toast-theme';

import { markPlanConfirmAnswered } from './plan-confirm-answered';
import {
    buildPlanConfirmResult,
    collectResearchContent,
    DEFAULT_RESEARCH_TITLE,
    hasResearchRunStarted,
    parsePlanConfirmArgs,
    parsePlanConfirmResult,
    type PlanConfirmResult,
    type ResearchQueryItem,
} from './research-contract';

/**
 * The plan step in Gemini's shape: a card titled with the run, a fixed four-stage timeline
 * (research → analyse → report → how long), the proposed steps nested under the first stage
 * behind a More expander, and one primary Start research.
 *
 * The stages are fixed labels rather than payload: they describe what a deep-research run
 * always does, which is why Gemini can print them before planning has finished. Only the
 * nested lines and the wait estimate come from the backend.
 */
const VISIBLE_LINES = 3;

interface Stage {
    id: string;
    label: string;
    icon: typeof FilesIcon;
}

/**
 * Deliberately ours rather than the model's `etaLabel`, which every observed run overran —
 * "About 4 minutes" against 4m29s to 6m06s. Gemini is vague here for the same reason: a promise
 * the run cannot keep costs more trust than saying less.
 */
const ETA_LABEL = 'Ready in a few mins';

const STAGES: Stage[] = [
    { id: 'research', label: 'Research Websites', icon: FilesIcon },
    { id: 'analyze', label: 'Analyze Results', icon: AlignLeftIcon },
    { id: 'report', label: 'Create Report', icon: TelescopeIcon },
];

const renderShell = (children: React.ReactNode) => (
    <section
        data-slot="research-plan-confirm"
        className="research-plan-confirm mb-3 flex w-full flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-4"
    >
        {children}
    </section>
);

const renderStageRow = (stage: Stage, isLast: boolean, nested?: React.ReactNode) => {
    const Icon = stage.icon;

    return (
        <li key={stage.id} className="research-plan-stage flex gap-3">
            <div className="research-plan-stage-rail flex flex-col items-center self-stretch">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {!isLast && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
            </div>
            <div className={cn('research-plan-stage-body min-w-0 flex-1', isLast ? 'pb-0' : 'pb-4')}>
                <p className="text-sm text-foreground">{stage.label}</p>
                {nested}
            </div>
        </li>
    );
};

interface ResearchPlanConfirmProps {
    toolCallId: string;
    args: unknown;
    result?: unknown;
    status?: { type?: string };
    /** Omitted for a read-only viewer, whose answer would land in someone else's run. */
    addResult?: (result: PlanConfirmResult) => void;
}

export const ResearchPlanConfirm = ({ toolCallId, args, result, status, addResult }: ResearchPlanConfirmProps) => {
    const isLastMessage = useIsLastMessage();
    // The run draws its own trace once it starts, so a gate whose run has begun steps aside.
    const hasRunStarted = useAuiState((s) =>
        'message' in s ? hasResearchRunStarted(collectResearchContent(s.message.parts)) : false,
    );
    const plan = useMemo(() => parsePlanConfirmArgs(args), [args]);
    // A reloaded run replays the answer off the wire, so it is parsed rather than trusted.
    const persisted = useMemo(() => parsePlanConfirmResult(result), [result]);
    // The latch carries the tool call it belongs to: React may reuse this instance for the next
    // gate, and a bare boolean would arrive already answered.
    const [answer, setAnswer] = useState<{ toolCallId: string; result: PlanConfirmResult }>();
    const [expandedFor, setExpandedFor] = useState<string>();

    const localAnswer = answer?.toolCallId === toolCallId ? answer.result : undefined;
    const settled = persisted ?? localAnswer;
    const isExpanded = expandedFor === toolCallId;

    // Approved steps aside too: status is never persisted, so a reloaded mid-run message has no run
    // evidence until attach streams the first phase, and a receipt would flash above the card.
    if (hasRunStarted || settled?.approved) return null;

    // Args stream in step by step. Answering before the last one lands would confirm a plan
    // the user never saw whole.
    if (!plan || (status?.type === 'running' && settled === undefined)) {
        if (status?.type !== 'running') return null;

        return renderShell(<p className="text-sm text-muted-foreground">Preparing the research plan…</p>);
    }

    const title = plan.title?.trim() || DEFAULT_RESEARCH_TITLE;
    const steps = settled && settled.steps.length > 0 ? settled.steps : plan.steps;

    const renderLines = (planSteps: readonly ResearchQueryItem[]) => {
        const visible = isExpanded ? planSteps : planSteps.slice(0, VISIBLE_LINES);
        const hidden = planSteps.length - visible.length;

        return (
            <div className="research-plan-lines mt-1.5 flex flex-col gap-1.5">
                {visible.map((step, position) => (
                    <p key={step.id} className="text-sm text-muted-foreground">
                        {`(${position + 1}) ${step.text}`}
                    </p>
                ))}
                {(hidden > 0 || isExpanded) && (
                    <button
                        type="button"
                        className="research-plan-more cursor-pointer self-start text-sm text-foreground underline-offset-2 hover:underline"
                        onClick={() => setExpandedFor(isExpanded ? undefined : toolCallId)}
                    >
                        {isExpanded ? 'Less' : 'More'}
                    </button>
                )}
            </div>
        );
    };

    const renderTimeline = (planSteps: readonly ResearchQueryItem[]) => (
        <ol className="research-plan-stages flex flex-col">
            {STAGES.map((stage) =>
                renderStageRow(stage, false, stage.id === 'research' ? renderLines(planSteps) : undefined),
            )}
            <li className="research-plan-stage flex gap-3">
                <ClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <p className="min-w-0 flex-1 text-sm text-foreground">{ETA_LABEL}</p>
            </li>
        </ol>
    );

    const renderCard = (footer: React.ReactNode) =>
        renderShell(
            <>
                <h3 className="research-plan-confirm-title text-base text-foreground">{title}</h3>
                {renderTimeline(steps)}
                {footer}
            </>,
        );

    if (settled) {
        return renderCard(
            <p className="text-xs text-muted-foreground">Research cancelled. This plan was never run.</p>,
        );
    }

    // An answer sent from an older message has no paused run to resume, so it would go
    // nowhere — render the plan inert rather than offer a button that hangs the turn.
    if (addResult === undefined || !isLastMessage) {
        return renderCard(
            <p className="text-xs text-muted-foreground">No longer active — the conversation has moved on.</p>,
        );
    }

    const answerWith = (approved: boolean) => {
        const payload = buildPlanConfirmResult(plan.steps, approved);

        setAnswer({ toolCallId, result: payload });

        try {
            // Marked before the call: the runtime's resume predicate reads this set the moment
            // the tool part resolves, and only an answer given here may resume the turn.
            markPlanConfirmAnswered(toolCallId);
            addResult(payload);
        } catch {
            setAnswer(undefined);
            toast.error('Could not answer the research plan. Please try again.', getErrorToastOptions());
        }
    };

    return renderCard(
        <div className="research-plan-confirm-actions flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => answerWith(false)}>
                Cancel
            </Button>
            <Button size="sm" className="rounded-full px-4" onClick={() => answerWith(true)}>
                Start research
            </Button>
        </div>,
    );
};

export default ResearchPlanConfirm;
