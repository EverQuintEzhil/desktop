import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke, isTauri } = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke, isTauri }));

import { cancelInFlightLocalTools, runLocalTool } from './bridge';

const cancelCalls = () => invoke.mock.calls.filter(([command]) => command === 'cancel_local_tools');

beforeEach(() => {
    invoke.mockReset();
});

describe('local tool cancellation', () => {
    it('flags exactly the in-flight call ids, once', async () => {
        let settle!: (value: unknown) => void;

        invoke.mockImplementation((command: unknown) => {
            if (command === 'run_local_tool') {
                return new Promise((resolve) => {
                    settle = resolve;
                });
            }

            return Promise.resolve(undefined);
        });

        const pending = runLocalTool('shell', { commands: ['sleep 5'] }, '/ws');

        await cancelInFlightLocalTools();

        expect(cancelCalls()).toHaveLength(1);
        const [, payload] = cancelCalls()[0] as [unknown, { callIds: string[] }];

        expect(payload.callIds).toHaveLength(1);
        expect(typeof payload.callIds[0]).toBe('string');

        settle({ ok: false, error: 'cancelled: the user stopped this chat turn' });
        await pending;

        // Settled runs are no longer tracked: a second stop is a no-op.
        await cancelInFlightLocalTools();
        expect(cancelCalls()).toHaveLength(1);
    });

    it('does nothing when nothing is running', async () => {
        await cancelInFlightLocalTools();

        expect(invoke).not.toHaveBeenCalled();
    });

    it('sends the callId with every execution', async () => {
        invoke.mockResolvedValue({ ok: true });

        await runLocalTool('read', { paths: ['a.txt'] }, '/ws');

        expect(invoke).toHaveBeenLastCalledWith('run_local_tool', {
            name: 'read',
            args: { paths: ['a.txt'] },
            root: '/ws',
            callId: expect.any(String),
        });
    });
});
