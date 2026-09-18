import { describe, expect, it, vi } from 'vitest';

type MessageState = { message: { status?: { type?: string }; parts: unknown[] } };

let state: MessageState = { message: { status: { type: 'complete' }, parts: [] } };

vi.mock('@assistant-ui/react', () => ({
    useAuiState: (selector: (s: MessageState) => boolean) => selector(state),
}));

const { useIsMessageSettled } = await import('./use-is-message-settled');

const useSettledFor = (message: MessageState['message']): boolean => {
    state = { message };

    return useIsMessageSettled();
};

const toolPart = (extra: Record<string, unknown> = {}) => ({ type: 'tool-call', ...extra });

describe('useIsMessageSettled', () => {
    it('is not settled while the message is running', () => {
        expect(useSettledFor({ status: { type: 'running' }, parts: [toolPart({ result: 'done' })] })).toBe(false);
    });

    it('is settled once the message completes', () => {
        expect(useSettledFor({ status: { type: 'complete' }, parts: [toolPart({ result: 'done' })] })).toBe(true);
    });

    it('is not settled while a tool approval is pending', () => {
        const parts = [toolPart({ approval: { approved: undefined }, status: { type: 'requires-action' } })];

        expect(useSettledFor({ status: { type: 'requires-action' }, parts })).toBe(false);
    });

    it('is not settled between the user approving and the run resuming', () => {
        const parts = [toolPart({ approval: { approved: true }, status: { type: 'requires-action' } })];

        expect(useSettledFor({ status: { type: 'requires-action' }, parts })).toBe(false);
    });

    it('is settled once the approved tool has produced a result', () => {
        const parts = [toolPart({ approval: { approved: true }, result: 'ok' })];

        expect(useSettledFor({ status: { type: 'complete' }, parts })).toBe(true);
    });

    it('is not settled while an interrupt is awaiting the user', () => {
        const parts = [toolPart({ interrupt: {}, status: { type: 'requires-action' } })];

        expect(useSettledFor({ status: { type: 'requires-action' }, parts })).toBe(false);
    });

    // A run stopped mid-tool-call leaves a bare resultless tool call, which assistant-ui also
    // reports as `requires-action`; it must still collapse.
    it('is settled for a run stopped mid-tool-call', () => {
        expect(useSettledFor({ status: { type: 'requires-action' }, parts: [toolPart()] })).toBe(true);
    });

    it('is settled for an incomplete message', () => {
        expect(useSettledFor({ status: { type: 'incomplete' }, parts: [] })).toBe(true);
    });
});
