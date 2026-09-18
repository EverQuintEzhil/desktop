import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke, isTauri } = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke, isTauri }));

import { useLocalToolsStatus } from './use-local-tools-status';

const MANIFEST = [
    { name: 'read', description: 'Read text files.', parameters: { type: 'object' } },
    { name: 'shell', description: 'Run commands.', parameters: { type: 'object' } },
];

const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        children,
    );

beforeEach(() => {
    invoke.mockReset();
    isTauri.mockReset();
});

describe('useLocalToolsStatus', () => {
    it('reports unsupported outside the Tauri shell', () => {
        isTauri.mockReturnValue(false);

        const { result } = renderHook(() => useLocalToolsStatus('/Users/dev/project'), { wrapper });

        expect(result.current).toEqual({ state: 'unsupported' });
        expect(invoke).not.toHaveBeenCalled();
    });

    it('reports no-folder when the space has no folder path', () => {
        isTauri.mockReturnValue(true);

        const { result } = renderHook(() => useLocalToolsStatus('   '), { wrapper });

        expect(result.current).toEqual({ state: 'no-folder' });
        expect(invoke).not.toHaveBeenCalled();
    });

    /**
     * Ordered BEFORE the success case: the bridge caches a resolved manifest for
     * the whole module lifetime (a failure resets the cache, success does not),
     * so an error can only be provoked while nothing is cached yet.
     */
    it('surfaces the manifest failure with its actionable message', async () => {
        isTauri.mockReturnValue(true);
        invoke.mockRejectedValue(new Error('agent-core binary not found: set AGENT_CORE_BIN or put agent-core on PATH'));

        const { result } = renderHook(() => useLocalToolsStatus('/Users/dev/project'), { wrapper });

        await waitFor(() => {
            expect(result.current).toEqual({
                state: 'error',
                message: 'agent-core binary not found: set AGENT_CORE_BIN or put agent-core on PATH',
            });
        });
    });

    it('reports the manifest count (+ the terminal tool) once attached', async () => {
        isTauri.mockReturnValue(true);
        invoke.mockImplementation((command: unknown) =>
            command === 'list_local_tools' ? Promise.resolve(MANIFEST) : Promise.resolve(undefined),
        );

        const { result } = renderHook(() => useLocalToolsStatus('/Users/dev/project'), { wrapper });

        expect(result.current.state).toBe('loading');

        await waitFor(() => {
            expect(result.current).toEqual({ state: 'active', count: 3, root: '/Users/dev/project' });
        });
    });
});
