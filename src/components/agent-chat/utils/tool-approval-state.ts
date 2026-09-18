export type ToolApprovalState = {
    status?: { type?: string };
    approval?: { approved?: boolean } | null;
    interrupt?: unknown;
};

// A genuine approval / HITL request carries an explicit pending `approval` object or an
// `interrupt`. A bare `requires-action` with neither is NOT an approval: it is a tool call
// left without a result — which happens when the run is stopped mid-tool-call, since
// assistant-ui surfaces a resultless, non-running tool call as `requires-action`. Keying the
// card on bare `requires-action` made "Allow this tool to run?" appear on stop for tools that
// never required approval; require a real signal instead.
export const isToolPendingApproval = ({ status, approval, interrupt }: ToolApprovalState): boolean =>
    (approval != null && approval.approved === undefined) || (interrupt != null && status?.type === 'requires-action');

export const hasPendingApprovalTool = (indices: readonly number[], parts: readonly unknown[]): boolean =>
    indices.some((index) => {
        const part = parts[index] as ToolApprovalState | undefined;

        return part ? isToolPendingApproval(part) : false;
    });
