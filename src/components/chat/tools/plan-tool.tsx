import { useAuiState } from '@assistant-ui/react';
import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { Check, Circle, Loader2, Minus, X } from 'lucide-react';
import { z } from 'zod';

import { ChatBlock } from '@/components/chat/blocks';
import { cn } from '@/lib/utils';

const PLAN_TOOL_NAME = 'update_plan';

const planStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'failed']);

const planItemSchema = z.object({
    content: z.string().describe('Short imperative description of the step.'),
    status: planStatusSchema.describe('Current status of the step.'),
});

export const updatePlanParameters = z.object({
    items: z
        .array(planItemSchema)
        .min(1)
        .describe('The full ordered list of plan steps. Always send every step, not just the changed ones.'),
});

const streamingPlanItemSchema = z.object({
    content: z.string().optional(),
    status: z.string().optional(),
});

const streamingPlanParameters = z.object({
    items: z.array(streamingPlanItemSchema).optional(),
});

type PlanStatus = z.infer<typeof planStatusSchema>;
type PlanItem = z.infer<typeof planItemSchema>;

type RunState = 'running' | 'complete' | 'incomplete' | 'requires-action' | undefined;

// A step left `in_progress` once the run is over is ambiguous: the model may have finished the work
// and skipped its closing update_plan call, or the run may have died mid-step. Only an `incomplete`
// run (cancelled or errored) is evidence of the latter, so that is the only case we call a failure.
const resolveStatus = (status: PlanStatus, runState: RunState): PlanStatus => {
    if (runState === 'running' || runState === 'requires-action') {
        return status;
    }

    if (status === 'in_progress') {
        return runState === 'incomplete' ? 'failed' : 'completed';
    }

    // Only an `incomplete` run proves a pending step never happened. A `complete` message is not
    // enough: every human-tool pause ends the message `complete` and the plan continues in the
    // next one, so remapping there would show upcoming steps as skipped mid-conversation.
    if (status === 'pending' && runState === 'incomplete') {
        return 'cancelled';
    }

    return status;
};

const toPlanStatus = (status: string | undefined): PlanStatus => {
    const parsed = planStatusSchema.safeParse(status);

    if (parsed.success) {
        return parsed.data;
    }

    return 'pending';
};

const renderStatusIcon = (status: PlanStatus) => {
    switch (status) {
        case 'completed':
            return (
                <span className="flex size-4 items-center justify-center rounded-full bg-foreground">
                    <Check className="size-3 text-background" aria-hidden="true" />
                </span>
            );
        case 'in_progress':
            return <Loader2 className="size-4 animate-spin text-foreground" aria-hidden="true" />;
        case 'failed':
            return (
                <span className="flex size-4 items-center justify-center rounded-full bg-destructive">
                    <X className="size-3 text-background" aria-hidden="true" />
                </span>
            );
        case 'cancelled':
            return (
                <span className="flex size-4 items-center justify-center rounded-full border border-muted-foreground/40">
                    <Minus className="size-2.5 text-muted-foreground" aria-hidden="true" />
                </span>
            );
        default:
            return <Circle className="size-4 text-muted-foreground/50" aria-hidden="true" />;
    }
};

const renderItemText = (item: PlanItem) => {
    return (
        <span
            className={cn(
                'text-sm leading-5 transition-all duration-300',
                item.status === 'completed' && 'text-muted-foreground line-through decoration-muted-foreground/60',
                item.status === 'cancelled' && 'text-muted-foreground/70',
                item.status === 'failed' && 'text-destructive',
                item.status === 'in_progress' && 'font-medium text-foreground',
                item.status === 'pending' && 'text-muted-foreground',
            )}
        >
            {item.content}
        </span>
    );
};

const PlanTool = ({ args, toolCallId }: ToolCallMessagePartProps) => {
    const firstPlanId = useAuiState((s) => {
        const part = s.message.parts.find((p) => p.type === 'tool-call' && p.toolName === PLAN_TOOL_NAME);

        return part ? (part as { toolCallId: string }).toolCallId : undefined;
    });

    const latestArgs = useAuiState((s) => {
        const plans = s.message.parts.filter((p) => p.type === 'tool-call' && p.toolName === PLAN_TOOL_NAME);

        let bestArgs: unknown;
        let bestCount = -1;

        for (const part of plans) {
            const candidate = (part as { args?: unknown }).args;
            const result = streamingPlanParameters.safeParse(candidate);
            const count = result.success ? (result.data.items?.length ?? 0) : 0;

            if (count >= bestCount) {
                bestCount = count;
                bestArgs = candidate;
            }
        }

        return bestArgs;
    });

    const runState = useAuiState((s) => s.message.status?.type as RunState);

    if (firstPlanId !== undefined && firstPlanId !== toolCallId) {
        return null;
    }

    const parsed = streamingPlanParameters.safeParse(latestArgs ?? args);
    const rawItems = parsed.success ? (parsed.data.items ?? []) : [];

    if (rawItems.length === 0) {
        return <ChatBlock bodyClassName="p-4 text-sm text-muted-foreground">Planning…</ChatBlock>;
    }

    const items = rawItems.map((item) => ({
        content: item.content ?? '',
        status: resolveStatus(toPlanStatus(item.status), runState),
    }));
    const completed = items.filter((item) => item.status === 'completed').length;

    return (
        <ChatBlock bodyClassName="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">Plan</span>
                <span className="text-xs text-muted-foreground">
                    {completed}/{items.length}
                </span>
            </div>
            <ul className="flex flex-col gap-2">
                {items.map((item, index) => (
                    <li key={index} className="flex items-start gap-2.5">
                        <span className="mt-0.5 shrink-0">{renderStatusIcon(item.status)}</span>
                        {renderItemText(item)}
                    </li>
                ))}
            </ul>
        </ChatBlock>
    );
};

export default PlanTool;
export { PlanTool };
