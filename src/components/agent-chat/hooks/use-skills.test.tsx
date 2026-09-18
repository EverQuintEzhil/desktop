import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, pagedEnvelope, server } from '@/test/msw';
import type { SkillType } from '@/types/admin';

import { useSkills } from './use-skills';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
    </QueryClientProvider>
);

const makeSkill = (overrides: Partial<SkillType> & Pick<SkillType, '_id' | 'name'>): SkillType =>
    ({
        description: '',
        category: 'personal',
        globalEnabled: true,
        agentEnabled: null,
        effectiveEnabled: true,
        ...overrides,
    }) as SkillType;

const serveComposerSkills = (values: SkillType[]) => {
    server.use(http.get(apiUrl('/skills'), () => pagedEnvelope(values)));
};

interface PreferenceRequest {
    id: string | readonly string[] | undefined;
    body: unknown;
}

interface PreferenceGate {
    requests: PreferenceRequest[];
    release: () => void;
}

const gatePreferenceWrites = (): PreferenceGate => {
    const requests: PreferenceRequest[] = [];
    let release = () => {};
    const settled = new Promise<void>((resolve) => {
        release = resolve;
    });

    server.use(
        http.put(apiUrl('/skills/:id/preferences'), async ({ request, params }) => {
            requests.push({ id: params.id, body: await request.json() });
            await settled;

            return envelope({ skillId: params.id, userId: 'user-1', disabled: false });
        }),
    );

    return { requests, release };
};

const serveSupersededFirstWrite = ({ failFirstWrite }: { failFirstWrite: boolean }) => {
    let releaseFirstWrite = () => {};
    const firstWrite = new Promise<void>((resolve) => {
        releaseFirstWrite = resolve;
    });
    let writes = 0;

    server.use(
        http.put(apiUrl('/skills/:id/preferences'), async ({ params }) => {
            writes += 1;

            if (writes > 1) return envelope({ skillId: params.id, userId: 'user-1', disabled: true });

            await firstWrite;

            if (failFirstWrite) return httpError(500, 'Skill preference rejected');

            return envelope({ skillId: params.id, userId: 'user-1', disabled: false });
        }),
    );

    return { releaseFirstWrite: () => releaseFirstWrite() };
};

const renderSkills = (agentSkills: SkillType[]) =>
    renderHook(
        () =>
            useSkills({
                agentId: 'agent-1',
                agentSkills,
                allowCustomSkills: true,
                allowSharedSkills: true,
            }),
        { wrapper },
    );

interface AgentPayload {
    _id: string;
    skills: SkillType[];
}

const AGENT_SLUG_KEY = ['agent', 'brand-agent'] as const;

const servePreferenceWrites = () => {
    server.use(
        http.put(apiUrl('/skills/:id/preferences'), ({ params }) =>
            envelope({ skillId: params.id, userId: 'user-1', disabled: false }),
        ),
    );
};

const renderSkillsFromAgentPayload = (getSkills: () => SkillType[]) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    queryClient.setQueryData(AGENT_SLUG_KEY, { _id: 'agent-1', skills: getSkills() });

    return renderHook(
        () => {
            const { data } = useQuery<AgentPayload>({
                queryKey: AGENT_SLUG_KEY,
                queryFn: () => Promise.resolve({ _id: 'agent-1', skills: getSkills() }),
            });

            return useSkills({
                agentId: 'agent-1',
                agentSkills: data?.skills ?? [],
                allowCustomSkills: true,
                allowSharedSkills: true,
            });
        },
        {
            wrapper: ({ children }: { children: ReactNode }) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            ),
        },
    );
};

const renderSkillsForAgent = (agentId: string, agentSkills: SkillType[]) =>
    renderHook(
        (props: { agentId: string }) =>
            useSkills({
                agentId: props.agentId,
                agentSkills,
                allowCustomSkills: true,
                allowSharedSkills: true,
            }),
        { wrapper, initialProps: { agentId } },
    );

describe('useSkills', () => {
    it('says nothing about an attached skill that is on in this chat', async () => {
        serveComposerSkills([]);

        const { result } = renderSkills([makeSkill({ _id: 'on-attached', name: 'Cost model' })]);

        await waitFor(() => expect(result.current.skills).toHaveLength(1));
        expect(result.current.disabledAgentSkills).toEqual([]);
    });

    it('lists an attached skill that is off in this chat, whoever owns it', async () => {
        serveComposerSkills([]);

        const { result } = renderSkills([
            makeSkill({
                _id: 'off-attached',
                name: 'Brand voice',
                globalEnabled: false,
                effectiveEnabled: false,
            }),
            makeSkill({ _id: 'shared-on', name: 'Shared but usable', globalEnabled: false }),
        ]);

        await waitFor(() =>
            expect(result.current.disabledAgentSkills).toEqual([{ _id: 'off-attached', name: 'Brand voice' }]),
        );
    });

    it('never lists an attached skill the viewer has no access to', async () => {
        serveComposerSkills([]);

        const { result } = renderSkills([
            makeSkill({
                _id: 'off-no-access',
                name: 'Brand voice',
                effectiveEnabled: false,
                noAccess: true,
            }),
            makeSkill({ _id: 'off-attached', name: 'Cost model', effectiveEnabled: false }),
        ]);

        await waitFor(() =>
            expect(result.current.disabledAgentSkills).toEqual([{ _id: 'off-attached', name: 'Cost model' }]),
        );
    });

    it('keeps an attached skill the viewer has no access to out of the picker, the mentions and the chat request', async () => {
        serveComposerSkills([]);

        const { result } = renderSkills([
            makeSkill({ _id: 'no-access', name: 'Brand voice', noAccess: true }),
            makeSkill({ _id: 'usable', name: 'Cost model' }),
        ]);

        await waitFor(() => expect(result.current.skills.map((skill) => skill._id)).toEqual(['usable']));
        expect(result.current.enabledIds).toEqual(['usable']);
        expect(result.current.skillArguments).toEqual([{ _id: 'usable', isEnabled: true }]);
    });

    it('never lists a skill the agent does not carry', async () => {
        serveComposerSkills([makeSkill({ _id: 'entitled-off', name: 'Detached skill', agentEnabled: false })]);

        const { result } = renderSkills([]);

        await waitFor(() => expect(result.current.skills.map((skill) => skill._id)).toEqual(['entitled-off']));
        expect(result.current.disabledAgentSkills).toEqual([]);
    });

    it('never shows a chip for a skill the picker shows as on', async () => {
        serveComposerSkills([makeSkill({ _id: 'entitled', name: 'Entitled skill' })]);

        const { result } = renderSkills([
            makeSkill({ _id: 'on-attached', name: 'Cost model' }),
            makeSkill({ _id: 'off-attached', name: 'Brand voice', effectiveEnabled: false }),
        ]);

        await waitFor(() => expect(result.current.enabledIds).toEqual(['on-attached', 'entitled']));

        const chipIds = result.current.disabledAgentSkills.map((skill) => skill._id);

        expect(chipIds.some((id) => result.current.enabledIds.includes(id))).toBe(false);
    });

    it('writes the preference for this agent when enabling a skill', async () => {
        serveComposerSkills([]);

        const { requests, release } = gatePreferenceWrites();
        const { result } = renderSkills([
            makeSkill({ _id: 'off-attached', name: 'Brand voice', effectiveEnabled: false }),
        ]);

        await waitFor(() => expect(result.current.disabledAgentSkills).toHaveLength(1));

        const write = result.current.enableSkill('off-attached');

        await waitFor(() => expect(result.current.disabledAgentSkills).toEqual([]));
        release();

        await act(async () => {
            await expect(write).resolves.toBe(true);
        });

        expect(requests).toEqual([{ id: 'off-attached', body: { disabled: false, agentId: 'agent-1' } }]);
    });

    it('cannot switch an already-enabled skill back off', async () => {
        serveComposerSkills([]);

        const { requests, release } = gatePreferenceWrites();
        const { result } = renderSkills([makeSkill({ _id: 'on-attached', name: 'Cost model' })]);

        await waitFor(() => expect(result.current.enabledIds).toEqual(['on-attached']));

        const write = result.current.enableSkill('on-attached');

        release();
        await act(async () => {
            await expect(write).resolves.toBe(true);
        });

        expect(requests).toEqual([{ id: 'on-attached', body: { disabled: false, agentId: 'agent-1' } }]);
        expect(result.current.enabledIds).toEqual(['on-attached']);
        expect(result.current.disabledAgentSkills).toEqual([]);
    });

    it('resolves false and leaves the skill off when the preference cannot be saved', async () => {
        serveComposerSkills([]);
        server.use(http.put(apiUrl('/skills/:id/preferences'), () => httpError(500, 'Skill preference rejected')));

        const { result } = renderSkills([
            makeSkill({ _id: 'off-attached', name: 'Brand voice', effectiveEnabled: false }),
        ]);

        await waitFor(() => expect(result.current.disabledAgentSkills).toHaveLength(1));

        await act(async () => {
            await expect(result.current.enableSkill('off-attached')).resolves.toBe(false);
        });

        await waitFor(() =>
            expect(result.current.disabledAgentSkills).toEqual([{ _id: 'off-attached', name: 'Brand voice' }]),
        );
    });

    it('drops both chips while two skills are enabled in quick succession', async () => {
        serveComposerSkills([]);

        const { release } = gatePreferenceWrites();
        const { result } = renderSkills([
            makeSkill({ _id: 'skill-1', name: 'Brand voice', effectiveEnabled: false }),
            makeSkill({ _id: 'skill-2', name: 'Cost model', effectiveEnabled: false }),
        ]);

        await waitFor(() => expect(result.current.disabledAgentSkills).toHaveLength(2));

        const writes = Promise.all([result.current.enableSkill('skill-1'), result.current.enableSkill('skill-2')]);

        await waitFor(() => expect(result.current.disabledAgentSkills).toEqual([]));
        release();

        await act(async () => {
            await expect(writes).resolves.toEqual([true, true]);
        });
    });
    it('keeps the skill on after the write settles, whatever key the agent payload is under', async () => {
        serveComposerSkills([]);
        servePreferenceWrites();

        let payloadReads = 0;
        const getSkills = () => {
            payloadReads += 1;

            return [makeSkill({ _id: 'off-attached', name: 'Brand voice', effectiveEnabled: false })];
        };

        const { result } = renderSkillsFromAgentPayload(getSkills);

        await waitFor(() => expect(result.current.disabledAgentSkills).toHaveLength(1));

        const readsBeforeWrite = payloadReads;

        await act(async () => {
            await expect(result.current.enableSkill('off-attached')).resolves.toBe(true);
        });

        await waitFor(() => expect(payloadReads).toBeGreaterThan(readsBeforeWrite));

        expect(result.current.disabledAgentSkills).toEqual([]);
        expect(result.current.enabledIds).toEqual(['off-attached']);
    });

    it('forgets the optimistic state when the agent changes', async () => {
        serveComposerSkills([]);
        servePreferenceWrites();

        const { result, rerender } = renderSkillsForAgent('agent-1', [
            makeSkill({ _id: 'off-attached', name: 'Brand voice', effectiveEnabled: false }),
        ]);

        await waitFor(() => expect(result.current.disabledAgentSkills).toHaveLength(1));

        await act(async () => {
            await expect(result.current.enableSkill('off-attached')).resolves.toBe(true);
        });

        expect(result.current.disabledAgentSkills).toEqual([]);

        rerender({ agentId: 'agent-2' });

        await waitFor(() =>
            expect(result.current.disabledAgentSkills).toEqual([{ _id: 'off-attached', name: 'Brand voice' }]),
        );
    });

    it('lets the last write win when an enable and a toggle race on the same skill', async () => {
        serveComposerSkills([]);

        let writes = 0;
        let releaseFailingWrite = () => {};
        let releasePendingWrite = () => {};
        const failingWrite = new Promise<void>((resolve) => {
            releaseFailingWrite = resolve;
        });
        const pendingWrite = new Promise<void>((resolve) => {
            releasePendingWrite = resolve;
        });

        server.use(
            http.put(apiUrl('/skills/:id/preferences'), async ({ params }) => {
                writes += 1;

                if (writes === 1) return envelope({ skillId: params.id, userId: 'user-1', disabled: false });

                if (writes === 2) {
                    await failingWrite;

                    return httpError(500, 'Skill preference rejected');
                }

                await pendingWrite;

                return envelope({ skillId: params.id, userId: 'user-1', disabled: false });
            }),
        );

        const { result } = renderSkillsFromAgentPayload(() => [
            makeSkill({ _id: 'off-attached', name: 'Brand voice', effectiveEnabled: false }),
        ]);

        await waitFor(() => expect(result.current.disabledAgentSkills).toHaveLength(1));

        await act(async () => {
            await expect(result.current.enableSkill('off-attached')).resolves.toBe(true);
        });

        act(() => {
            result.current.toggleSkill('off-attached');
        });
        await waitFor(() => expect(writes).toBe(2));

        act(() => {
            result.current.toggleSkill('off-attached');
        });
        await waitFor(() => expect(writes).toBe(3));

        await act(async () => {
            releaseFailingWrite();
            await failingWrite;
        });

        await waitFor(() => expect(result.current.enabledIds).toEqual(['off-attached']));
        expect(result.current.disabledAgentSkills).toEqual([]);

        await act(async () => {
            releasePendingWrite();
            await pendingWrite;
        });
    });

    it('surfaces the chip again as soon as the skill is switched off from the picker', async () => {
        serveComposerSkills([]);

        const { release } = gatePreferenceWrites();
        const { result } = renderSkills([makeSkill({ _id: 'on-attached', name: 'Cost model' })]);

        await waitFor(() => expect(result.current.enabledIds).toEqual(['on-attached']));

        act(() => {
            result.current.toggleSkill('on-attached');
        });

        await waitFor(() =>
            expect(result.current.disabledAgentSkills).toEqual([{ _id: 'on-attached', name: 'Cost model' }]),
        );

        release();
    });

    it('stays quiet when a failing write has already been superseded', async () => {
        serveComposerSkills([]);
        vi.mocked(toast.error).mockClear();

        const { releaseFirstWrite } = serveSupersededFirstWrite({ failFirstWrite: true });
        const { result } = renderSkills([
            makeSkill({ _id: 'off-attached', name: 'Brand voice', effectiveEnabled: false }),
        ]);

        await waitFor(() => expect(result.current.disabledAgentSkills).toHaveLength(1));

        const write = result.current.enableSkill('off-attached');

        await waitFor(() => expect(result.current.disabledAgentSkills).toEqual([]));
        act(() => {
            result.current.toggleSkill('off-attached');
        });
        await waitFor(() => expect(result.current.disabledAgentSkills).toHaveLength(1));

        await act(async () => {
            releaseFirstWrite();
            await expect(write).resolves.toBe(false);
        });

        expect(toast.error).not.toHaveBeenCalled();
    });

    it('does not report a superseded write as an owning success', async () => {
        serveComposerSkills([]);

        const { releaseFirstWrite } = serveSupersededFirstWrite({ failFirstWrite: false });
        const { result } = renderSkills([
            makeSkill({ _id: 'off-attached', name: 'Brand voice', effectiveEnabled: false }),
        ]);

        await waitFor(() => expect(result.current.disabledAgentSkills).toHaveLength(1));

        const write = result.current.enableSkill('off-attached');

        await waitFor(() => expect(result.current.disabledAgentSkills).toEqual([]));
        act(() => {
            result.current.toggleSkill('off-attached');
        });
        await waitFor(() => expect(result.current.disabledAgentSkills).toHaveLength(1));

        await act(async () => {
            releaseFirstWrite();
            await expect(write).resolves.toBe(false);
        });

        expect(result.current.disabledAgentSkills).toEqual([{ _id: 'off-attached', name: 'Brand voice' }]);
    });
});
