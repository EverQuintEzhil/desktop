import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { cancelAgentCaches, PREVIEW_AGENT_DETAIL_KEY } from '@/lib/api/common/agent-cache';
import { composerSkillsKey, patchSkillEnabledInCaches, SKILLS_QUERY_KEY, skillsApi } from '@/lib/api/common/skills';
import type { SkillType } from '@/types/admin';

import type { DisabledAgentSkill, SkillArgument, UseSkillsResult } from '../types';

interface UseSkillsParams {
    agentId?: string | null;
    agentSkills: SkillType[];
    allowCustomSkills: boolean;
    allowSharedSkills: boolean;
}

// size: 0 asks the server to return all rows — the composer needs the full
// entitled set, and paging here would hide globally-enabled skills past page 1.
const SKILLS_PAGE_SIZE = 0;

const SKILL_PREFERENCE_MUTATION_KEY = ['skill-preference'] as const;

interface SkillPreferenceVariables {
    skillId: string;
    disabled: boolean;
    previousEnabled: boolean;
    writeId: number;
    agentId: string;
}

interface SkillOverride {
    disabled: boolean;
    writeId: number;
    isConfirmed: boolean;
}

export const useSkills = ({
    agentId,
    agentSkills: attachedSkills,
    allowCustomSkills,
    allowSharedSkills,
}: UseSkillsParams): UseSkillsResult => {
    const queryClient = useQueryClient();

    // The agent payload now carries capabilities the viewer cannot access instead of
    // omitting them, so every derived value here — the composer list, the mention
    // suggestions and the `/chat` skill arguments — must be built from the usable set only.
    const agentSkills = useMemo(() => attachedSkills.filter((skill) => skill.noAccess !== true), [attachedSkills]);

    const { data } = useQuery({
        queryKey: agentId ? composerSkillsKey(agentId) : ['skills', 'composer', 'none'],
        queryFn: () => skillsApi.list({ agentId: agentId as string, size: SKILLS_PAGE_SIZE }),
        enabled: !!agentId && (allowCustomSkills || allowSharedSkills),
        staleTime: 5 * 60 * 1000,
    });

    // Skills the user can add, kept only when enabled at the global (settings)
    // level. Enterprise skills default off, so only the ones opted into globally
    // surface here; personal skills default on. Attached skills are excluded to
    // avoid duplicating the agent's own set.
    const entitledSkills = useMemo(() => {
        const agentSkillIds = new Set(agentSkills.map((skill) => skill._id));

        return (data?.values ?? []).filter((skill) => skill.globalEnabled === true && !agentSkillIds.has(skill._id));
    }, [data, agentSkills]);

    const customSkills = useMemo<SkillType[]>(() => {
        if (!allowCustomSkills) {
            return [];
        }

        return entitledSkills.filter((skill) => skill.category === 'personal');
    }, [allowCustomSkills, entitledSkills]);

    const sharedSkills = useMemo<SkillType[]>(() => {
        if (!allowSharedSkills) {
            return [];
        }

        return entitledSkills.filter((skill) => skill.category === 'enterprise');
    }, [allowSharedSkills, entitledSkills]);

    const skills = useMemo<SkillType[]>(
        () => [...agentSkills, ...customSkills, ...sharedSkills],
        [agentSkills, customSkills, sharedSkills],
    );

    const customIds = useMemo(() => customSkills.map((skill) => skill._id), [customSkills]);

    const sharedIds = useMemo(() => sharedSkills.map((skill) => skill._id), [sharedSkills]);

    // Effective per-agent enabled state from the server. Attached skills carry
    // `effectiveEnabled` (agent payload); entitled skills carry `agentEnabled`
    // (composer list). Both already fold agent over global over default.
    const serverEnabledMap = useMemo(() => {
        const map: Record<string, boolean> = {};

        agentSkills.forEach((skill) => {
            map[skill._id] = skill.effectiveEnabled !== false;
        });
        entitledSkills.forEach((skill) => {
            map[skill._id] = skill.agentEnabled !== false;
        });

        return map;
    }, [agentSkills, entitledSkills]);

    // Optimistic overrides layered on the server state (skillId -> override).
    const [overrides, setOverrides] = useState<Record<string, SkillOverride>>({});
    const overridesRef = useRef(overrides);
    const serverEnabledRef = useRef(serverEnabledMap);

    serverEnabledRef.current = serverEnabledMap;
    const writeIdRef = useRef(0);
    // Latest write per skill, kept outside `overrides` so ownership survives the
    // override being dropped once the server confirms it.
    const latestWriteIdsRef = useRef<Record<string, number>>({});

    const applyOverrides = useCallback(
        (update: (previous: Record<string, SkillOverride>) => Record<string, SkillOverride>) => {
            const next = update(overridesRef.current);

            if (next === overridesRef.current) return;

            overridesRef.current = next;
            setOverrides(next);
        },
        [],
    );

    useEffect(() => {
        applyOverrides((previous) => {
            const kept = Object.entries(previous).filter(([skillId, override]) => {
                const serverDisabled = serverEnabledMap[skillId] === false;

                return (
                    !override.isConfirmed ||
                    serverEnabledMap[skillId] === undefined ||
                    serverDisabled !== override.disabled
                );
            });

            return kept.length === Object.keys(previous).length ? previous : Object.fromEntries(kept);
        });
    }, [serverEnabledMap, applyOverrides]);

    useEffect(() => {
        latestWriteIdsRef.current = {};
        applyOverrides((previous) => (Object.keys(previous).length === 0 ? previous : {}));
    }, [agentId, applyOverrides]);

    const disabledMap = useMemo(() => {
        const map: Record<string, boolean> = {};

        skills.forEach((skill) => {
            const override = overrides[skill._id];

            map[skill._id] = override !== undefined ? override.disabled : serverEnabledMap[skill._id] === false;
        });

        return map;
    }, [skills, overrides, serverEnabledMap]);

    const readDisabled = useCallback(
        (skillId: string) => overridesRef.current[skillId]?.disabled ?? serverEnabledRef.current[skillId] === false,
        [],
    );

    const startWrite = useCallback(
        (skillId: string, disabled: boolean) => {
            const writeId = writeIdRef.current + 1;

            writeIdRef.current = writeId;
            latestWriteIdsRef.current[skillId] = writeId;
            applyOverrides((previous) => ({ ...previous, [skillId]: { disabled, writeId, isConfirmed: false } }));

            return writeId;
        },
        [applyOverrides],
    );

    const isLatestWrite = useCallback(
        (skillId: string, writeId: number) => latestWriteIdsRef.current[skillId] === writeId,
        [],
    );

    const confirmOverride = useCallback(
        (skillId: string, writeId: number) => {
            applyOverrides((previous) => {
                const override = previous[skillId];

                if (!override) return previous;
                if (override.writeId !== writeId || override.isConfirmed) return previous;

                return { ...previous, [skillId]: { ...override, isConfirmed: true } };
            });
        },
        [applyOverrides],
    );

    const dropOverride = useCallback(
        (skillId: string, writeId: number) => {
            applyOverrides((previous) => {
                if (previous[skillId]?.writeId !== writeId) return previous;

                const next = { ...previous };

                delete next[skillId];

                return next;
            });
        },
        [applyOverrides],
    );

    const preferenceMutation = useMutation({
        mutationKey: SKILL_PREFERENCE_MUTATION_KEY,
        mutationFn: (variables: SkillPreferenceVariables) =>
            skillsApi.putSkillPreference(variables.skillId, variables.disabled, variables.agentId),
        onMutate: async ({ skillId, disabled }) => {
            if (!agentId) return;

            await Promise.all([
                queryClient.cancelQueries({ queryKey: composerSkillsKey(agentId) }),
                cancelAgentCaches(queryClient, agentId),
            ]);
            patchSkillEnabledInCaches(queryClient, agentId, skillId, !disabled);
        },
        onSuccess: (_data, { skillId, writeId }) => {
            confirmOverride(skillId, writeId);
        },
        onError: (_error, { skillId, previousEnabled, writeId }) => {
            if (!isLatestWrite(skillId, writeId)) return;

            dropOverride(skillId, writeId);
            if (agentId) {
                patchSkillEnabledInCaches(queryClient, agentId, skillId, previousEnabled);
            }

            toast.error("Couldn't update skill. Please try again.");
        },
        onSettled: () => {
            // Only refetch once the last pending toggle settles; the settling
            // mutation still counts itself, so `=== 1` means "I'm the last one".
            if (agentId && queryClient.isMutating({ mutationKey: SKILL_PREFERENCE_MUTATION_KEY }) === 1) {
                queryClient.invalidateQueries({ queryKey: composerSkillsKey(agentId) });
                queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
                queryClient.invalidateQueries({ queryKey: ['agent'] });
                queryClient.invalidateQueries({ queryKey: PREVIEW_AGENT_DETAIL_KEY });
            }
        },
    });

    const toggleSkill = useCallback(
        (skillId: string) => {
            if (!agentId) {
                return;
            }

            const currentDisabled = readDisabled(skillId);
            const disabled = !currentDisabled;
            const writeId = startWrite(skillId, disabled);

            preferenceMutation.mutate({
                skillId,
                disabled,
                previousEnabled: !currentDisabled,
                writeId,
                agentId,
            });
        },
        [agentId, readDisabled, startWrite, preferenceMutation],
    );

    const { mutateAsync: writeSkillPreference } = preferenceMutation;

    const enableSkill = useCallback(
        async (skillId: string): Promise<boolean> => {
            if (!agentId) {
                return false;
            }

            const previousEnabled = !readDisabled(skillId);
            const writeId = startWrite(skillId, false);

            try {
                await writeSkillPreference({
                    skillId,
                    disabled: false,
                    previousEnabled,
                    writeId,
                    agentId,
                });

                return isLatestWrite(skillId, writeId);
            } catch {
                return false;
            }
        },
        [agentId, isLatestWrite, readDisabled, startWrite, writeSkillPreference],
    );

    const disabledAgentSkills = useMemo<DisabledAgentSkill[]>(
        () =>
            agentSkills
                .filter((skill) => disabledMap[skill._id])
                .map((skill) => ({ _id: skill._id, name: skill.name, isRecommended: skill.isRecommended })),
        [agentSkills, disabledMap],
    );

    const enabledIds = useMemo(
        () => skills.filter((skill) => !disabledMap[skill._id]).map((skill) => skill._id),
        [skills, disabledMap],
    );

    const skillArguments = useMemo<SkillArgument[]>(
        () => skills.map((skill) => ({ _id: skill._id, isEnabled: !disabledMap[skill._id] })),
        [skills, disabledMap],
    );

    return {
        skills,
        customIds,
        sharedIds,
        enabledIds,
        toggleSkill,
        skillArguments,
        disabledAgentSkills,
        enableSkill,
    };
};
