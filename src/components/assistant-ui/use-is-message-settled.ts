import { useAuiState } from '@assistant-ui/react';

type ApprovalPart = {
    status?: { type?: string };
    approval?: { approved?: boolean } | null;
    interrupt?: unknown;
    result?: unknown;
};

// assistant-ui reports a resultless tool call as `requires-action` whether it is an approval
// request or a run stopped mid-tool-call, so the status alone cannot tell them apart. An
// `approval` object that has not produced a result yet marks the whole pause — the prompt itself
// and the gap between the user answering and the run resuming; an `interrupt` marks HITL.
const isBlockedOnApproval = ({ status, approval, interrupt, result }: ApprovalPart): boolean =>
    (approval != null && result === undefined) || (interrupt != null && status?.type === 'requires-action');

export const useIsMessageSettled = (): boolean =>
    useAuiState((s) => {
        if (s.message.status?.type === 'running') {
            return false;
        }

        return !s.message.parts.some((part) => isBlockedOnApproval(part as ApprovalPart));
    });
