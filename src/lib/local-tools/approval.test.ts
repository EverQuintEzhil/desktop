import { beforeEach, describe, expect, it } from 'vitest';

import {
    extractPermissionGrant,
    getCurrentPrompt,
    isAlwaysAllowed,
    rememberAlwaysAllowed,
    requestApproval,
    resetApprovalStateForTests,
    resolveCurrentPrompt,
} from './approval';

const GRANT = { kind: 'command', target: 'npm test', mode: 'run', nonce: 'g_1' };

beforeEach(() => {
    resetApprovalStateForTests();
    localStorage.clear();
});

describe('always-allow list', () => {
    it('remembers a grant by kind:mode:target, never by nonce', () => {
        expect(isAlwaysAllowed(GRANT)).toBe(false);

        rememberAlwaysAllowed(GRANT);

        expect(isAlwaysAllowed({ ...GRANT, nonce: 'g_other' })).toBe(true);
        expect(isAlwaysAllowed({ ...GRANT, target: 'rm -rf /' })).toBe(false);
    });

    it('survives malformed stored values', () => {
        localStorage.setItem('fm_local_tool_always_allow', 'not-json');

        expect(isAlwaysAllowed(GRANT)).toBe(false);

        rememberAlwaysAllowed(GRANT);

        expect(isAlwaysAllowed(GRANT)).toBe(true);
    });
});

describe('prompt store', () => {
    it('exposes the prompt and resolves the awaiting caller', async () => {
        const decision = requestApproval('shell', GRANT);

        expect(getCurrentPrompt()?.grant.nonce).toBe('g_1');
        expect(getCurrentPrompt()?.toolName).toBe('shell');

        resolveCurrentPrompt('allow-once');

        await expect(decision).resolves.toBe('allow-once');
        expect(getCurrentPrompt()).toBeNull();
    });

    it('queues concurrent prompts FIFO', async () => {
        const first = requestApproval('shell', GRANT);
        const second = requestApproval('edit', { ...GRANT, target: 'src/a.ts', nonce: 'g_2' });

        expect(getCurrentPrompt()?.grant.nonce).toBe('g_1');

        resolveCurrentPrompt('deny');

        expect(getCurrentPrompt()?.grant.nonce).toBe('g_2');

        resolveCurrentPrompt('allow-always');

        await expect(first).resolves.toBe('deny');
        await expect(second).resolves.toBe('allow-always');
        expect(getCurrentPrompt()).toBeNull();
    });
});

describe('extractPermissionGrant', () => {
    const envelope = { ok: false, code: 'permission_required', grant: GRANT, next: 'ask the user' };

    it('finds the grant at the top level and nested under data/error', () => {
        expect(extractPermissionGrant(envelope)?.nonce).toBe('g_1');
        expect(extractPermissionGrant({ ok: false, data: envelope })?.nonce).toBe('g_1');
        expect(extractPermissionGrant({ ok: false, error: envelope })?.nonce).toBe('g_1');
    });

    it('ignores ordinary results and malformed grants', () => {
        expect(extractPermissionGrant({ ok: true, data: { stdout: '' } })).toBeNull();
        expect(extractPermissionGrant({ ok: false, error: 'boom' })).toBeNull();
        expect(extractPermissionGrant({ code: 'permission_required', grant: { target: 'x' } })).toBeNull();
        expect(extractPermissionGrant(null)).toBeNull();
    });
});
