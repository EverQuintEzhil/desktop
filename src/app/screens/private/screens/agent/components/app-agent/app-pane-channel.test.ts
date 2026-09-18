import type { AppPaneContext } from '@thefluentmind/genui-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    changeAppPane,
    describeAppPaneActions,
    dispatchAppPaneAction,
    formatAppPaneContext,
    publishAppPaneContext,
    readAppPaneContext,
    registerAppPaneActionHandler,
    resetAppPaneChannel,
    settledAppPane,
} from './app-pane-channel';

const readGlobal = (): unknown => (window as unknown as Record<string, unknown>).__fmAppPaneContext;

afterEach(() => {
    resetAppPaneChannel();
});

describe('formatAppPaneContext', () => {
    it('renders summary, state and each action with its arguments', () => {
        const text = formatAppPaneContext({
            summary: 'Viewing the pipeline list, 24 rows.',
            state: { page: 'pipeline', sort: 'updated_desc' },
            actions: [
                { name: 'set_sort', description: 'Reorder the list', args: { sort: 'one of fee_desc, fee_asc' } },
                { name: 'set_tab', description: 'Switch tab', args: { tab: 'one of open, closed' } },
            ],
        });

        expect(text).toContain('Viewing the pipeline list, 24 rows.');
        expect(text).toContain('"sort":"updated_desc"');
        expect(text).toContain('set_sort(sort: one of fee_desc, fee_asc)');
        expect(text).toContain('set_tab(tab: one of open, closed)');
        expect(text).toContain('set_app_view');
        expect(text).toContain('get_app_view');
    });

    // Verified live: strip the argument values and the model invents them, so
    // `set_app_view` comes back "Unknown view". Only the prose description goes.
    it('keeps the argument values and drops only the description', () => {
        const text = formatAppPaneContext({
            summary: 'Viewing the pipeline list.',
            actions: [
                { name: 'set_sort', description: 'Reorder the list', args: { sort: 'one of fee_desc, fee_asc' } },
            ],
        });

        expect(text).toContain('fee_desc');
        expect(text).not.toContain('Reorder the list');
    });

    it('drops an empty state object rather than telling the model nothing twice', () => {
        expect(formatAppPaneContext({ summary: 'Dashboard.', state: {} })).toBe('Dashboard.');
    });

    it('survives an unserializable state and still publishes the summary', () => {
        const circular: Record<string, unknown> = { page: 'dashboard' };

        circular.self = circular;

        expect(formatAppPaneContext({ summary: 'Dashboard.', state: circular })).toBe('Dashboard.');
    });

    it('returns null when there is nothing to say', () => {
        expect(formatAppPaneContext({ summary: '   ' })).toBeNull();
    });
});

describe('publishAppPaneContext', () => {
    it('mirrors the rendered context onto the global the transport already reads', () => {
        publishAppPaneContext({ summary: 'Viewing pursuit "NEOM Oxagon".' });

        expect(readGlobal()).toContain('NEOM Oxagon');
        expect(readAppPaneContext()?.summary).toBe('Viewing pursuit "NEOM Oxagon".');
    });

    it('clears the global on null so a closed pane is not described to the assistant', () => {
        publishAppPaneContext({ summary: 'Dashboard.' });
        publishAppPaneContext(null);

        expect(readGlobal()).toBeUndefined();
        expect(readAppPaneContext()).toBeNull();
    });

    it('replaces outright — the previous view never lingers', () => {
        publishAppPaneContext({ summary: 'Dashboard.' });
        publishAppPaneContext({ summary: 'Targets grid.' });

        expect(readGlobal()).toBe('Targets grid.');
    });
});

describe('dispatchAppPaneAction', () => {
    it('refuses with a relayable reason when no pane is listening', () => {
        const result = dispatchAppPaneAction({ name: 'set_sort', args: {} });

        expect(result).toEqual({ ok: false, error: expect.stringContaining('does not accept view actions') });
    });

    it('hands the action to the registered pane', () => {
        const handler = vi.fn().mockReturnValue({ ok: true, note: 'sorted by fee' });

        registerAppPaneActionHandler(handler);

        expect(dispatchAppPaneAction({ name: 'set_sort', args: { sort: 'fee_desc' } })).toEqual({
            ok: true,
            note: 'sorted by fee',
        });
        expect(handler).toHaveBeenCalledWith({ name: 'set_sort', args: { sort: 'fee_desc' } });
    });

    it('rejects an action the current view never declared, and names the real ones', () => {
        const handler = vi.fn().mockReturnValue({ ok: true });

        registerAppPaneActionHandler(handler);
        publishAppPaneContext({
            summary: 'Pipeline.',
            actions: [{ name: 'set_sort', description: 'Reorder' }],
        } satisfies AppPaneContext);

        const result = dispatchAppPaneAction({ name: 'delete_everything', args: {} });

        expect(result).toEqual({ ok: false, error: expect.stringContaining('set_sort') });
        expect(handler).not.toHaveBeenCalled();
    });

    it('returns a pane crash as a refusal — a thrown frontend tool would stall the turn', () => {
        registerAppPaneActionHandler(() => {
            throw new Error('reducer blew up');
        });

        expect(dispatchAppPaneAction({ name: 'set_sort', args: {} })).toEqual({ ok: false, error: 'reducer blew up' });
    });

    it('treats a pane that returns nothing as having handled it', () => {
        registerAppPaneActionHandler(() => undefined as unknown as { ok: true });

        expect(dispatchAppPaneAction({ name: 'set_sort', args: {} })).toEqual({ ok: true });
    });

    it('stops dispatching after the pane unsubscribes', () => {
        const handler = vi.fn().mockReturnValue({ ok: true });
        const off = registerAppPaneActionHandler(handler);

        off();
        dispatchAppPaneAction({ name: 'set_sort', args: {} });

        expect(handler).not.toHaveBeenCalled();
    });
});

describe('describeAppPaneActions', () => {
    it('renders each action with its argument names, for a tool result', () => {
        expect(
            describeAppPaneActions({
                summary: 'Pipeline.',
                actions: [
                    { name: 'set_sort', description: 'Reorder', args: { value: 'fee_desc | fee_asc' } },
                    { name: 'clear_filters', description: 'Drop filters' },
                ],
            }),
        ).toEqual(['set_sort(value: fee_desc | fee_asc)', 'clear_filters']);
    });

    it('is empty for a view that declares nothing, and for no context at all', () => {
        expect(describeAppPaneActions({ summary: 'A form.' })).toEqual([]);
        expect(describeAppPaneActions(null)).toEqual([]);
    });
});

describe('settledAppPane', () => {
    it('reports the page and actions the pane publishes AFTER the change', async () => {
        publishAppPaneContext({ summary: 'Playbook.', state: { page: 'playbook' } });

        const settled = settledAppPane();

        publishAppPaneContext({
            summary: 'Pipeline.',
            state: { page: 'pipeline' },
            actions: [{ name: 'set_sort', description: 'Reorder', args: { value: 'fee_desc' } }],
        });

        await expect(settled).resolves.toEqual({ page: 'pipeline', actions: ['set_sort(value: fee_desc)'] });
    });

    it('falls back to the current view when nothing republishes', async () => {
        vi.useFakeTimers();

        try {
            publishAppPaneContext({
                summary: 'Already here.',
                state: { page: 'pipeline' },
                actions: [{ name: 'set_scope', description: 'Scope' }],
            });

            const settled = settledAppPane();

            await vi.advanceTimersByTimeAsync(800);
            await expect(settled).resolves.toEqual({ page: 'pipeline', actions: ['set_scope'] });
        } finally {
            vi.useRealTimers();
        }
    });

    it('ignores the null a page swap publishes on its way out', async () => {
        publishAppPaneContext({ summary: 'Dashboard.', state: { page: 'dashboard' } });

        const settled = settledAppPane();

        publishAppPaneContext(null);
        publishAppPaneContext({
            summary: 'Pipeline.',
            state: { page: 'pipeline' },
            actions: [{ name: 'set_sort', description: 'Reorder' }],
        });

        await expect(settled).resolves.toEqual({ page: 'pipeline', actions: ['set_sort'] });
    });

    it('falls back to the last real view when a page swap nulls out before the new page publishes', async () => {
        vi.useFakeTimers();

        try {
            publishAppPaneContext({
                summary: 'Pipeline.',
                state: { page: 'pipeline' },
                actions: [{ name: 'set_sort', description: 'Reorder' }],
            });

            const settled = settledAppPane();

            publishAppPaneContext(null);
            await vi.advanceTimersByTimeAsync(800);

            await expect(settled).resolves.toEqual({ page: 'pipeline', actions: ['set_sort'] });
        } finally {
            vi.useRealTimers();
        }
    });

    it('resolves rather than hanging when the pane unmounts mid-wait', async () => {
        publishAppPaneContext({ summary: 'Dashboard.', state: { page: 'dashboard' } });

        const settled = settledAppPane();

        resetAppPaneChannel();

        await expect(settled).resolves.toEqual({ actions: [] });
    });
});

describe('changeAppPane', () => {
    it('gives each queued change the view its own change produced', async () => {
        publishAppPaneContext({ summary: 'Start.', state: { page: 'dashboard' } });

        const first = changeAppPane(() => {
            publishAppPaneContext({
                summary: 'Pipeline.',
                state: { page: 'pipeline' },
                actions: [{ name: 'set_sort', description: 'Reorder' }],
            });

            return 'a';
        });
        const second = changeAppPane(() => {
            publishAppPaneContext({
                summary: 'Targets.',
                state: { page: 'targets' },
                actions: [{ name: 'set_year', description: 'Year' }],
            });

            return 'b';
        });

        await expect(first).resolves.toEqual({
            change: 'a',
            settled: { page: 'pipeline', actions: ['set_sort'] },
        });
        await expect(second).resolves.toEqual({
            change: 'b',
            settled: { page: 'targets', actions: ['set_year'] },
        });
    });

    it('keeps the queue moving when a change throws', async () => {
        const boom = changeAppPane(() => {
            throw new Error('reducer blew up');
        });

        await expect(boom).rejects.toThrow('reducer blew up');

        const after = changeAppPane(() => {
            publishAppPaneContext({ summary: 'Recovered.', state: { page: 'dashboard' } });

            return 'ok';
        });

        await expect(after).resolves.toEqual({ change: 'ok', settled: { page: 'dashboard', actions: [] } });
    });
});
