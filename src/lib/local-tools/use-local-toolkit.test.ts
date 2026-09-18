import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke, isTauri } = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn() }));

const approval = vi.hoisted(() => ({
    isAlwaysAllowed: vi.fn(() => false),
    rememberAlwaysAllowed: vi.fn(),
    requestApproval: vi.fn(),
}));

const { showErrorToast } = vi.hoisted(() => ({ showErrorToast: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke, isTauri }));

vi.mock('./approval', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./approval')>()),
    ...approval,
}));

vi.mock('@/utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/utils')>()),
    showErrorToast,
}));

import { useLocalToolkit } from './use-local-toolkit';

const MANIFEST = [
    {
        name: 'read',
        description: 'Read text files.',
        parameters: { type: 'object', properties: { paths: { type: 'array' } } },
    },
    {
        name: 'shell',
        description: 'Run commands.',
        parameters: { type: 'object', properties: { commands: { type: 'array' } } },
    },
];

/**
 * Keyed on the command name rather than call order: the bridge caches the
 * manifest at module level, so whether `list_local_tools` is invoked again in a
 * given test depends on the cache — order-based `mockResolvedValueOnce` queues
 * would silently leak between tests.
 */
const setupInvoke = (execResult: unknown) => {
    invoke.mockImplementation((command: unknown) => {
        if (command === 'list_local_tools') {
            return Promise.resolve(MANIFEST);
        }
        if (execResult instanceof Error) {
            return Promise.reject(execResult);
        }

        return Promise.resolve(execResult);
    });
};

const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        children,
    );

beforeEach(() => {
    invoke.mockReset();
    isTauri.mockReset();
    approval.isAlwaysAllowed.mockReset();
    approval.isAlwaysAllowed.mockReturnValue(false);
    approval.rememberAlwaysAllowed.mockReset();
    approval.requestApproval.mockReset();
});

describe('useLocalToolkit', () => {
    it('offers no tools outside the Tauri shell', () => {
        isTauri.mockReturnValue(false);

        const { result } = renderHook(() => useLocalToolkit('/Users/dev/project'), { wrapper });

        expect(result.current).toBeUndefined();
        expect(invoke).not.toHaveBeenCalled();
    });

    it('offers no tools when the space has no folder path (the gating rule)', () => {
        isTauri.mockReturnValue(true);

        const { result } = renderHook(() => useLocalToolkit(null), { wrapper });

        expect(result.current).toBeUndefined();
        expect(invoke).not.toHaveBeenCalled();
    });

    /**
     * A space WITH a folder path but no reachable agent-core must warn loudly —
     * silence here looks identical to an unconfigured space, and the model falls
     * back to hallucinating other tools (observed: Read Artifact loops).
     */
    it('warns loudly when the manifest cannot be fetched', async () => {
        isTauri.mockReturnValue(true);
        invoke.mockRejectedValue(new Error('agent-core binary not found: set AGENT_CORE_BIN or put agent-core on PATH'));

        const { result } = renderHook(() => useLocalToolkit('/Users/dev/project'), { wrapper });

        await waitFor(() => {
            expect(showErrorToast).toHaveBeenCalledWith(
                'Local coding tools are unavailable: agent-core binary not found: set AGENT_CORE_BIN or put agent-core on PATH',
            );
        });
        expect(result.current).toBeUndefined();
    });

    it('builds a toolkit from the manifest with the schemas forwarded verbatim', async () => {
        isTauri.mockReturnValue(true);
        setupInvoke({ ok: true });

        const { result } = renderHook(() => useLocalToolkit('/Users/dev/project'), { wrapper });

        await waitFor(() => {
            expect(result.current).toBeDefined();
        });

        expect(Object.keys(result.current!)).toEqual(['read', 'shell', 'terminal']);
        const readTool = result.current!.read as { description: string; parameters: unknown };

        expect(readTool.description).toBe('Read text files.');
        expect(readTool.parameters).toEqual(MANIFEST[0].parameters);
    });

    it('executes through run_local_tool rooted at the space folder', async () => {
        isTauri.mockReturnValue(true);
        setupInvoke({ ok: true, data: { content: 'hello' } });

        const { result } = renderHook(() => useLocalToolkit('/Users/dev/project'), { wrapper });

        await waitFor(() => {
            expect(result.current).toBeDefined();
        });

        const tool = result.current!.read as unknown as {
            execute: (args: Record<string, unknown>) => Promise<unknown>;
        };
        const output = await tool.execute({ paths: ['a.txt'] });

        expect(invoke).toHaveBeenLastCalledWith('run_local_tool', {
            name: 'read',
            args: { paths: ['a.txt'] },
            root: '/Users/dev/project',
            callId: expect.any(String),
        });
        expect(output).toEqual({ ok: true, data: { content: 'hello' } });
    });

    it('returns a refusal envelope instead of throwing when the bridge fails', async () => {
        isTauri.mockReturnValue(true);
        setupInvoke(new Error('agent-core binary not found'));

        const { result } = renderHook(() => useLocalToolkit('/Users/dev/project'), { wrapper });

        await waitFor(() => {
            expect(result.current).toBeDefined();
        });

        const tool = result.current!.shell as unknown as {
            execute: (args: Record<string, unknown>) => Promise<unknown>;
        };

        await expect(tool.execute({ commands: ['ls'] })).resolves.toEqual({
            ok: false,
            error: 'agent-core binary not found',
        });
    });
});

describe('permission grant flow', () => {
    const PERMISSION = {
        ok: false,
        code: 'permission_required',
        grant: { kind: 'command', target: 'npm test', mode: 'run', nonce: 'g_9' },
        next: 'ask the user to approve run access to npm test, then retry with grant_nonce=g_9',
    };

    /** First execution returns the grant challenge; the retry succeeds and echoes its args. */
    const setupGrantInvoke = () => {
        let executions = 0;

        invoke.mockImplementation((command: unknown, payload?: unknown) => {
            if (command === 'list_local_tools') {
                return Promise.resolve(MANIFEST);
            }

            executions += 1;

            if (executions === 1) {
                return Promise.resolve(PERMISSION);
            }

            return Promise.resolve({ ok: true, data: { args: (payload as { args?: unknown })?.args } });
        });
    };

    const executionCalls = () => invoke.mock.calls.filter(([command]) => command === 'run_local_tool');

    const mountShellTool = async () => {
        isTauri.mockReturnValue(true);
        setupGrantInvoke();

        const { result } = renderHook(() => useLocalToolkit('/Users/dev/project'), { wrapper });

        await waitFor(() => {
            expect(result.current).toBeDefined();
        });

        return result.current!.shell as unknown as {
            execute: (args: Record<string, unknown>) => Promise<unknown>;
        };
    };

    it('retries silently with the nonce when the grant is always-allowed', async () => {
        approval.isAlwaysAllowed.mockReturnValue(true);

        const tool = await mountShellTool();
        const output = await tool.execute({ commands: ['npm test'] });

        expect(approval.requestApproval).not.toHaveBeenCalled();
        expect(executionCalls()).toHaveLength(2);
        expect(invoke).toHaveBeenLastCalledWith('run_local_tool', {
            name: 'shell',
            args: { commands: ['npm test'], grant_nonce: 'g_9' },
            root: '/Users/dev/project',
            callId: expect.any(String),
        });
        expect(output).toEqual({ ok: true, data: { args: { commands: ['npm test'], grant_nonce: 'g_9' } } });
    });

    it('returns a model-readable refusal without retrying when the user denies', async () => {
        approval.requestApproval.mockResolvedValue('deny');

        const tool = await mountShellTool();
        const output = await tool.execute({ commands: ['npm test'] });

        expect(output).toEqual({ ok: false, error: 'the user denied run access to npm test' });
        expect(executionCalls()).toHaveLength(1);
        expect(approval.rememberAlwaysAllowed).not.toHaveBeenCalled();
    });

    it('retries once with the nonce on allow-once', async () => {
        approval.requestApproval.mockResolvedValue('allow-once');

        const tool = await mountShellTool();
        const output = await tool.execute({ commands: ['npm test'] });

        expect(executionCalls()).toHaveLength(2);
        expect(output).toEqual({ ok: true, data: { args: { commands: ['npm test'], grant_nonce: 'g_9' } } });
        expect(approval.rememberAlwaysAllowed).not.toHaveBeenCalled();
    });

    it('persists the grant on allow-always before retrying', async () => {
        approval.requestApproval.mockResolvedValue('allow-always');

        const tool = await mountShellTool();
        await tool.execute({ commands: ['npm test'] });

        expect(approval.rememberAlwaysAllowed).toHaveBeenCalledWith(
            expect.objectContaining({ target: 'npm test', mode: 'run', nonce: 'g_9' }),
        );
        expect(executionCalls()).toHaveLength(2);
    });
});

describe('terminal tool', () => {
    beforeEach(async () => {
        // The store is module-level (one shared session per app); tests must not
        // inherit a previous test's session id.
        const { resetTerminalStateForTests } = await import('@/components/space-terminal/terminal-store');

        resetTerminalStateForTests();
    });

    const setupTerminalInvoke = (runResult: unknown) => {
        invoke.mockImplementation((command: unknown) => {
            if (command === 'list_local_tools') {
                return Promise.resolve(MANIFEST);
            }
            if (command === 'terminal_open') {
                return Promise.resolve('sess-1');
            }
            if (command === 'terminal_run') {
                return Promise.resolve(runResult);
            }

            return Promise.resolve(undefined);
        });
    };

    const mountTerminalTool = async () => {
        isTauri.mockReturnValue(true);

        const { result } = renderHook(() => useLocalToolkit('/Users/dev/project'), { wrapper });

        await waitFor(() => {
            expect(result.current).toBeDefined();
        });

        return result.current!.terminal as unknown as {
            execute: (args: Record<string, unknown>) => Promise<unknown>;
        };
    };

    const terminalRunCalls = () => invoke.mock.calls.filter(([command]) => command === 'terminal_run');

    it('denies without running when the user says no', async () => {
        approval.requestApproval.mockResolvedValue('deny');
        setupTerminalInvoke({ ok: true });

        const tool = await mountTerminalTool();
        const output = await tool.execute({ command: 'npm run dev' });

        expect(output).toEqual({ ok: false, error: 'the user denied run access to npm run dev' });
        expect(terminalRunCalls()).toHaveLength(0);
    });

    it('runs in the shared session after approval and opens it once', async () => {
        approval.requestApproval.mockResolvedValue('allow-once');
        setupTerminalInvoke({ ok: true, data: { output: 'ok\n', exit_code: 0, timed_out: false } });

        const tool = await mountTerminalTool();
        const output = await tool.execute({ command: 'npm test', timeout_ms: 5000 });

        expect(invoke).toHaveBeenCalledWith('terminal_open', { root: '/Users/dev/project', cols: 80, rows: 24 });
        expect(invoke).toHaveBeenLastCalledWith(
            'terminal_run',
            expect.objectContaining({ id: 'sess-1', command: 'npm test', timeoutMs: 5000 }),
        );
        expect(output).toEqual({ ok: true, data: { output: 'ok\n', exit_code: 0, timed_out: false } });

        // Second call reuses the session — no second terminal_open.
        await tool.execute({ command: 'npm test' });
        expect(invoke.mock.calls.filter(([command]) => command === 'terminal_open')).toHaveLength(1);
    });

    it('skips the dialog for an always-allowed command', async () => {
        approval.isAlwaysAllowed.mockReturnValue(true);
        setupTerminalInvoke({ ok: true, data: { output: '', exit_code: 0, timed_out: false } });

        const tool = await mountTerminalTool();
        await tool.execute({ command: 'git status' });

        expect(approval.requestApproval).not.toHaveBeenCalled();
        expect(terminalRunCalls()).toHaveLength(1);
    });
});
