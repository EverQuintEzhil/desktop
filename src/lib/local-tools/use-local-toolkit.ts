import type { Toolkit } from '@assistant-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import { ToolFallback } from '@/components/assistant-ui/tool-fallback';
// Direct file import (not the space-terminal barrel) to keep the module graph acyclic:
// the dock imports from this package's barrel.
import { runInTerminal } from '@/components/space-terminal/terminal-store';
import { showErrorToast } from '@/utils';

import {
    extractPermissionGrant,
    isAlwaysAllowed,
    rememberAlwaysAllowed,
    requestApproval,
    type PermissionGrant,
} from './approval';
import { isDesktopRuntime, listLocalTools, runLocalTool, type LocalToolManifestEntry } from './bridge';

const toRefusal = (error: unknown) => ({
    ok: false,
    error: error instanceof Error ? error.message : 'the local tool bridge failed',
});

// Once per app session: the toast repeats on every remount otherwise, and the
// underlying cause (agent-core not installed) does not change mid-session.
let warnedManifestUnavailable = false;

/**
 * Runs one tool call, intercepting agent-core's permission flow: an
 * always-allowed grant retries silently with the nonce; anything else asks the
 * user through the approval dialog. Exactly one retry — the nonce is
 * single-use, and a repeated `permission_required` goes back to the model as-is.
 */
const executeWithGrantFlow = async (
    name: string,
    args: Record<string, unknown>,
    root: string,
): Promise<unknown> => {
    const first = await runLocalTool(name, args, root);
    const grant = extractPermissionGrant(first);

    if (!grant) {
        return first;
    }

    if (isAlwaysAllowed(grant)) {
        return runLocalTool(name, { ...args, grant_nonce: grant.nonce }, root);
    }

    const decision = await requestApproval(name, grant);

    if (decision === 'deny') {
        return { ok: false, error: `the user denied ${grant.mode} access to ${grant.target}` };
    }

    if (decision === 'allow-always') {
        rememberAlwaysAllowed(grant);
    }

    return runLocalTool(name, { ...args, grant_nonce: grant.nonce }, root);
};

const TERMINAL_TOOL_NAME = 'terminal';

/**
 * The shared interactive terminal as an agent tool. Unlike agent-core's
 * sandboxed one-shot `shell`, this runs in the Space's persistent, USER-VISIBLE
 * PTY session (the panel auto-opens), so state like venvs, exports and dev
 * servers survives between calls. Every command is approval-gated here (agent-core
 * never sees these commands, so its grant flow cannot cover them).
 */
const terminalTool = (getRoot: () => string) => ({
    type: 'frontend' as const,
    description:
        "Run ONE command line in the user's visible interactive terminal (persistent session: cwd, venvs, " +
        'exported vars and dev servers survive between calls; the user watches live). Prefer `shell` for ' +
        'quick sandboxed checks; use this for stateful or long-running work. Chain with && — newlines are ' +
        'rejected. Returns {output, exit_code, timed_out}; on timeout the command may still be running.',
    parameters: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'One command line to type into the terminal.' },
            timeout_ms: { type: 'number', description: 'Wait budget in ms (default 120000, max 600000).' },
        },
        required: ['command'],
    },
    execute: async (args: Record<string, unknown>) => {
        const command = typeof args?.command === 'string' ? args.command.trim() : '';

        if (!command) {
            return { ok: false, error: 'command is required' };
        }

        try {
            // Same allowlist store as agent-core grants, keyed terminal:run:<command> —
            // "Always allow" applies to this exact command line only.
            const grant: PermissionGrant = {
                kind: 'terminal',
                target: command,
                mode: 'run',
                nonce: `local-${Date.now()}`,
            };

            if (!isAlwaysAllowed(grant)) {
                const decision = await requestApproval(TERMINAL_TOOL_NAME, grant);

                if (decision === 'deny') {
                    return { ok: false, error: `the user denied run access to ${command}` };
                }
                if (decision === 'allow-always') {
                    rememberAlwaysAllowed(grant);
                }
            }

            const timeoutMs = typeof args?.timeout_ms === 'number' ? args.timeout_ms : undefined;

            return await runInTerminal(getRoot(), command, timeoutMs);
        } catch (error) {
            console.error('Terminal tool failed:', error);

            return toRefusal(error);
        }
    },
    render: ToolFallback,
});

const buildToolkit = (manifest: LocalToolManifestEntry[], getRoot: () => string): Toolkit => {
    const entries = manifest.map((entry) => [
        entry.name,
        {
            type: 'frontend' as const,
            description: entry.description,
            // Already a JSON `type:"object"` schema from agent-core — forwarded
            // verbatim to the wire by toClientTools.
            parameters: entry.parameters,
            // Refusals are returned, not thrown, so the model reads why and adapts.
            execute: async (args: Record<string, unknown>) => {
                try {
                    return await executeWithGrantFlow(entry.name, args ?? {}, getRoot());
                } catch (error) {
                    console.error(`Local tool "${entry.name}" failed:`, error);

                    return toRefusal(error);
                }
            },
            render: ToolFallback,
        },
    ]);

    return {
        ...Object.fromEntries(entries),
        [TERMINAL_TOOL_NAME]: terminalTool(getRoot),
    } as unknown as Toolkit;
};

/**
 * The space's local coding tools as an assistant-ui toolkit — or undefined when
 * they must not be offered at all: outside the Tauri shell, or when the active
 * space has no folder path configured (the gating rule: no folder, no tools).
 */
export const useLocalToolkit = (folderPath: string | null | undefined): Toolkit | undefined => {
    const enabled = isDesktopRuntime() && Boolean(folderPath?.trim());

    const { data: manifest, error: manifestError } = useQuery({
        queryKey: ['local-tools', 'manifest'],
        queryFn: listLocalTools,
        enabled,
        staleTime: Infinity,
        retry: 1,
    });

    // A space WITH a folder path but no reachable agent-core must be loud:
    // silently attaching no tools is indistinguishable from an unconfigured
    // space, and the model falls back to hallucinating other tools.
    useEffect(() => {
        if (!enabled || !manifestError) {
            return;
        }

        console.error('[local-tools] manifest unavailable — no tools attached:', manifestError);

        if (!warnedManifestUnavailable) {
            warnedManifestUnavailable = true;
            const message = manifestError instanceof Error ? manifestError.message : String(manifestError);

            showErrorToast(`Local coding tools are unavailable: ${message}`);
        }
    }, [enabled, manifestError]);

    // Executors close over the CURRENT folder path via a ref: switching spaces
    // re-roots calls without changing the toolkit identity mid-turn.
    const rootRef = useRef(folderPath ?? '');

    rootRef.current = folderPath ?? '';

    // The success signal for devtools: this line proves the tools rode the chat.
    useEffect(() => {
        if (enabled && manifest && manifest.length > 0) {
            console.info(`[local-tools] ${manifest.length + 1} tools attached (incl. terminal), rooted at ${rootRef.current}`);
        }
    }, [enabled, manifest]);

    return useMemo(() => {
        if (!enabled || !manifest || manifest.length === 0) {
            return undefined;
        }

        return buildToolkit(manifest, () => rootRef.current);
    }, [enabled, manifest]);
};
