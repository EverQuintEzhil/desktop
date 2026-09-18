import { act, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, server } from '@/test/msw';
import { renderHookWithProviders } from '@/test/test-utils';
import type { AgentSettingsType, AgentType } from '@/types/admin';

import { useAgentAccessFlags } from './use-agent-access-flags';

const AGENT_ID = 'agent-1';

interface AgentOverrides {
    settings?: AgentSettingsType | null;
    uiConfig?: Partial<AgentSettingsType> | null;
}

const makeAgent = (overrides: AgentOverrides = {}): AgentType =>
    ({
        _id: AGENT_ID,
        name: 'Support agent',
        settings: overrides.settings ?? null,
        uiConfig: overrides.uiConfig ?? null,
    }) as AgentType;

interface HookProps {
    agent: AgentType;
}

const renderFlagsHook = (agent: AgentType, seen?: Array<Required<AgentSettingsType>>) => {
    const onSubmit = vi.fn();
    const rendered = renderHookWithProviders(
        ({ agent: currentAgent }: HookProps) => {
            const value = useAgentAccessFlags(currentAgent, onSubmit);

            seen?.push(value.settings);

            return value;
        },
        { initialProps: { agent } },
    );

    return { ...rendered, onSubmit };
};

describe('useAgentAccessFlags — resolving the current flags', () => {
    it('reads the flags from agent.settings', () => {
        const { result } = renderFlagsHook(
            makeAgent({
                settings: {
                    allowCustomSkills: true,
                    allowSharedSkills: false,
                    allowCustomConnectors: false,
                    allowSharedConnectors: false,
                },
            }),
        );

        expect(result.current.settings.allowCustomSkills).toBe(true);
        expect(result.current.settings.allowSharedSkills).toBe(false);
    });

    it('ignores the legacy uiConfig flags when settings is null', () => {
        const { result } = renderFlagsHook(makeAgent({ settings: null, uiConfig: { allowSharedSkills: true } }));

        expect(result.current.settings.allowSharedSkills).toBe(false);
        expect(result.current.settings.allowCustomSkills).toBe(false);
    });

    it('ignores the legacy uiConfig flags when settings is an empty object', () => {
        const { result } = renderFlagsHook(makeAgent({ settings: {}, uiConfig: { allowCustomSkills: true } }));

        expect(result.current.settings.allowCustomSkills).toBe(false);
    });

    it('resolves every flag to false when neither source carries one', () => {
        const { result } = renderFlagsHook(makeAgent());

        expect(result.current.settings).toEqual({
            allowCustomSkills: false,
            allowSharedSkills: false,
            allowCustomConnectors: false,
            allowSharedConnectors: false,
        });
    });
});

describe('useAgentAccessFlags — saving', () => {
    it('sends all four settings keys with only the toggled key changed', async () => {
        let body: unknown;

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                body = await request.json();

                return envelope({ _id: AGENT_ID });
            }),
        );

        const { result, onSubmit } = renderFlagsHook(
            makeAgent({
                settings: {
                    allowCustomSkills: false,
                    allowSharedSkills: true,
                    allowCustomConnectors: false,
                    allowSharedConnectors: false,
                },
            }),
        );

        act(() => result.current.onToggle('allowCustomSkills', true));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
        });

        expect(body).toEqual({
            settings: {
                allowCustomSkills: true,
                allowSharedSkills: true,
                allowCustomConnectors: false,
                allowSharedConnectors: false,
            },
        });
    });

    // The PUT response is the raw agent document, whose relation entries lack the per-user fields
    // the GET folds in — so the hook must hand up a narrow merge of the agent it already has.
    it('hands the parent the current agent with only settings replaced', async () => {
        const rawResponse = { _id: AGENT_ID, skills: [{ _id: 'skill-1' }] };

        server.use(http.put(apiUrl(`/agents/${AGENT_ID}`), () => envelope(rawResponse)));

        const agent = makeAgent();
        const { result, onSubmit } = renderFlagsHook(agent);

        act(() => result.current.onToggle('allowCustomSkills', true));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({
                ...agent,
                settings: {
                    allowCustomSkills: true,
                    allowSharedSkills: false,
                    allowCustomConnectors: false,
                    allowSharedConnectors: false,
                },
            });
        });
        expect(onSubmit).not.toHaveBeenCalledWith(expect.objectContaining({ skills: [{ _id: 'skill-1' }] }));
    });

    it('reverts the flag and calls no onSubmit when the save fails', async () => {
        server.use(http.put(apiUrl(`/agents/${AGENT_ID}`), () => httpError(403, 'Not allowed')));

        const { result, onSubmit } = renderFlagsHook(makeAgent());

        act(() => result.current.onToggle('allowCustomSkills', true));

        await waitFor(() => {
            expect(result.current.settings.allowCustomSkills).toBe(false);
        });

        expect(onSubmit).not.toHaveBeenCalled();
    });
});

describe('useAgentAccessFlags — a second toggle while the first save is in flight', () => {
    it('carries the first toggle into the second payload instead of clobbering it', async () => {
        const bodies: Array<Record<string, unknown>> = [];
        let releaseFirstSave = () => {};
        const firstSaveBlocked = new Promise<void>((resolve) => {
            releaseFirstSave = resolve;
        });

        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                const body = (await request.json()) as Record<string, unknown>;
                const isFirst = bodies.length === 0;

                bodies.push(body);

                if (isFirst) await firstSaveBlocked;

                return envelope({ _id: AGENT_ID, ...body });
            }),
        );

        const { result } = renderFlagsHook(makeAgent());

        act(() => result.current.onToggle('allowCustomSkills', true));

        await waitFor(() => {
            expect(bodies).toHaveLength(1);
        });

        // The other switches stay usable while the first save is in flight, and the second click
        // shows immediately rather than waiting on the round trip.
        act(() => result.current.onToggle('allowSharedConnectors', true));

        expect(result.current.settings).toEqual({
            allowCustomSkills: true,
            allowSharedSkills: false,
            allowCustomConnectors: false,
            allowSharedConnectors: true,
        });
        expect(bodies).toHaveLength(1);

        releaseFirstSave();

        await waitFor(() => {
            expect(bodies).toHaveLength(2);
        });

        expect(bodies[1]).toEqual({
            settings: {
                allowCustomSkills: true,
                allowSharedSkills: false,
                allowCustomConnectors: false,
                allowSharedConnectors: true,
            },
        });
    });

    it('tells the parent once, with the last clicked state', async () => {
        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), async ({ request }) => {
                const body = (await request.json()) as Record<string, unknown>;

                return envelope({ _id: AGENT_ID, ...body });
            }),
        );

        const agent = makeAgent();
        const { result, onSubmit } = renderFlagsHook(agent);

        act(() => {
            result.current.onToggle('allowCustomSkills', true);
        });
        act(() => {
            result.current.onToggle('allowSharedConnectors', true);
        });

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1);
        });

        expect(onSubmit).toHaveBeenCalledWith({
            ...agent,
            settings: {
                allowCustomSkills: true,
                allowSharedSkills: false,
                allowCustomConnectors: false,
                allowSharedConnectors: true,
            },
        });
    });
});

describe('useAgentAccessFlags — the successful-save transition', () => {
    it('never shows the old value again between the request and the parent update', async () => {
        server.use(
            http.put(apiUrl(`/agents/${AGENT_ID}`), () =>
                envelope({
                    _id: AGENT_ID,
                    settings: { allowCustomSkills: true },
                }),
            ),
        );

        const seen: Array<Required<AgentSettingsType>> = [];
        const { result, onSubmit } = renderFlagsHook(makeAgent(), seen);

        act(() => result.current.onToggle('allowCustomSkills', true));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
        });

        const firstCheckedRender = seen.findIndex((settings) => settings.allowCustomSkills);

        expect(firstCheckedRender).toBeGreaterThan(-1);
        expect(seen.slice(firstCheckedRender).every((settings) => settings.allowCustomSkills)).toBe(true);
    });

    it('lets a later external refetch of the agent win over the saved value', async () => {
        server.use(http.put(apiUrl(`/agents/${AGENT_ID}`), () => envelope({ _id: AGENT_ID })));

        const { result, rerender, onSubmit } = renderFlagsHook(makeAgent());

        act(() => result.current.onToggle('allowCustomSkills', true));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
        });

        rerender({ agent: makeAgent({ settings: { allowCustomSkills: false, allowSharedSkills: true } }) });

        await waitFor(() => {
            expect(result.current.settings).toEqual({
                allowCustomSkills: false,
                allowSharedSkills: true,
                allowCustomConnectors: false,
                allowSharedConnectors: false,
            });
        });
    });
});
