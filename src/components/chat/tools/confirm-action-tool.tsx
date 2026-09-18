import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { CircleCheck, CircleSlash, ShieldAlert, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';

import { ChatBlock } from '@/components/chat/blocks';
import { Button } from '@/components/ui/button';

import { ToolRailStep } from './tool-rail';
import { useIsLastMessage } from './use-is-last-message';

export const confirmActionParameters = z.object({
    title: z.string().describe('The action being confirmed, phrased as a question the user can answer yes to.'),
    detail: z.string().optional().describe('What will happen, including anything that cannot be undone.'),
    confirmLabel: z.string().optional().describe('Label for the confirm button. Defaults to "Confirm".'),
    cancelLabel: z.string().optional().describe('Label for the cancel button. Defaults to "Cancel".'),
    destructive: z.boolean().optional().describe('Set true when the action deletes data or cannot be reversed.'),
});

const confirmActionResultSchema = z.object({ confirmed: z.boolean() });

type ConfirmActionResult = z.infer<typeof confirmActionResultSchema>;

const ConfirmActionTool = ({ args, result, addResult, status }: ToolCallMessagePartProps) => {
    const parsed = confirmActionParameters.safeParse(args);
    const isLastMessage = useIsLastMessage();
    const parsedResult = confirmActionResultSchema.safeParse(result);
    const [answer, setAnswer] = useState<ConfirmActionResult | null>(null);
    const settled = parsedResult.success ? parsedResult.data : answer;

    // Args stream in field by field; without the status gate the buttons are clickable before
    // `detail` and `destructive` have arrived.
    if (!parsed.success || (status.type === 'running' && !settled)) {
        return (
            <ToolRailStep tone="muted" icon={<ShieldAlert className="size-4" aria-hidden="true" />}>
                <ChatBlock bodyClassName="p-4 text-sm text-muted-foreground">Preparing confirmation…</ChatBlock>
            </ToolRailStep>
        );
    }

    const { title, detail, confirmLabel, cancelLabel, destructive } = parsed.data;

    // An answer submitted from an older message has no paused run to resume, so it would go
    // nowhere — render the confirmation inert instead.
    if (!settled && !isLastMessage) {
        return (
            <ToolRailStep tone="muted" icon={<ShieldAlert className="size-4" aria-hidden="true" />}>
                <ChatBlock bodyClassName="flex flex-col gap-1 p-4">
                    <span className="text-sm font-medium text-muted-foreground">{title}</span>
                    <span className="text-sm text-muted-foreground">
                        No longer active — the conversation has moved on.
                    </span>
                </ChatBlock>
            </ToolRailStep>
        );
    }

    const respond = (confirmed: boolean) => {
        if (settled) return;

        setAnswer({ confirmed });
        addResult({ confirmed } satisfies ConfirmActionResult);
    };

    if (settled) {
        return (
            <ToolRailStep
                tone={settled.confirmed ? 'active' : 'muted'}
                icon={
                    settled.confirmed ? (
                        <CircleCheck className="size-4" aria-hidden="true" />
                    ) : (
                        <CircleSlash className="size-4" aria-hidden="true" />
                    )
                }
            >
                <ChatBlock bodyClassName="flex flex-col gap-1 p-4">
                    <span className="text-sm font-medium text-muted-foreground">{title}</span>
                    <span className="text-sm text-muted-foreground">
                        {settled.confirmed ? 'Confirmed' : 'Declined'}
                    </span>
                </ChatBlock>
            </ToolRailStep>
        );
    }

    return (
        <ToolRailStep
            tone="muted"
            icon={
                destructive ? (
                    <TriangleAlert className="size-4 text-destructive" aria-hidden="true" />
                ) : (
                    <ShieldAlert className="size-4" aria-hidden="true" />
                )
            }
        >
            <ChatBlock bodyClassName="flex flex-col gap-2 p-4">
                <span className="text-sm font-medium text-foreground">{title}</span>
                {detail ? <span className="text-sm text-muted-foreground">{detail}</span> : null}
                <div className="mt-1 flex items-center justify-end gap-2">
                    <Button size="xs" variant="ghost" onClick={() => respond(false)}>
                        {cancelLabel ?? 'Cancel'}
                    </Button>
                    <Button size="xs" variant={destructive ? 'destructive' : 'default'} onClick={() => respond(true)}>
                        {confirmLabel ?? 'Confirm'}
                    </Button>
                </div>
            </ChatBlock>
        </ToolRailStep>
    );
};

export default ConfirmActionTool;
export { ConfirmActionTool };
