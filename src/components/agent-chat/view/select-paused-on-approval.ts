interface ApprovalToolPart {
    type: string;
    approval?: { id?: string; approved?: boolean };
}

/**
 * A turn paused on a pending tool approval (e.g. the MCP reconnect gate) has
 * ended its run but is waiting on the user — not generating. Shared by the
 * pending-generation indicator and the message-queue drain, which must agree.
 */
export const selectIsPausedOnApproval = (last: { role: string; content: unknown } | undefined): boolean => {
    if (last?.role !== 'assistant') return false;

    return (last.content as ReadonlyArray<ApprovalToolPart>).some(
        (part) => part.type === 'tool-call' && part.approval?.id !== undefined && part.approval?.approved === undefined,
    );
};
