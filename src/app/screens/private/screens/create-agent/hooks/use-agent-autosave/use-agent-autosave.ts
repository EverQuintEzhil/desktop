import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { ChatAgentUiType } from '@/types/ui';

import { MY_AGENTS_QUERY_KEY } from '../../../agents/hooks/use-agents-queries';
import {
    applyModelsToUiConfig,
    buildDefaultUiConfig,
    saveCapabilities,
    saveDescription,
    saveName,
    SYSTEM_PROMPT_TYPE,
    UI_CONFIG_TYPE,
} from '../../lib/create-agent-api';
import type { CapabilityIds } from '../../lib/create-agent-api';
import { getModelChange, hasNonModelChanges } from '../../lib/ui-config-diff';
import type { AgentConfigDraft, AgentConfigItem } from '../../types';
import type { CodeDraftStatus } from '../use-code-draft';
import { useCodeDraft } from '../use-code-draft';

import type { AgentAutosaveSeed, AgentAutosaveState } from './types';
import { buildModels, sameIds, sameOrderedIds, sameRecommendedFlags, toSnapshot } from './utils/snapshot';
import { restoreAppearance, restoreModel } from './utils/ui-config-restore';

const NAME_DEBOUNCE_MS = 600;
const INSTRUCTIONS_DEBOUNCE_MS = 800;

export const useAgentAutosave = (
    agentId: string,
    agentConfig: AgentConfigDraft,
    seed: AgentAutosaveSeed = {},
): AgentAutosaveState => {
    const queryClient = useQueryClient();
    const persistedRef = useRef(toSnapshot(agentConfig));
    // Which agent `persistedRef` and `agentConfig` describe. Every write below is addressed by
    // `agentId`, so a snapshot belonging to another agent must not be written at all.
    const baselineAgentIdRef = useRef(agentId);
    const lastSavedDescriptionRef = useRef<string | undefined>(seed.description);
    const baselineModelIdsRef = useRef<string[]>((agentConfig.models ?? []).map((m) => m._id));
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const applyingModelRef = useRef(false);
    const flushNameRef = useRef<(() => void) | null>(null);
    const flushInstructionsRef = useRef<(() => void) | null>(null);
    const pendingModelsRef = useRef<AgentConfigItem[]>(agentConfig.models ?? []);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const markSaved = () => {
        setSaving(false);
        setSaved(true);

        if (savedTimerRef.current !== null) {
            clearTimeout(savedTimerRef.current);
        }

        savedTimerRef.current = setTimeout(() => {
            setSaved(false);
            savedTimerRef.current = null;
        }, 2000);
    };

    const handleError = (error: unknown, label: string) => {
        setSaving(false);
        setSaved(false);
        const message = error instanceof Error ? error.message : `Failed to save ${label}.`;

        toast.error(message);
    };

    const status: CodeDraftStatus = {
        onSaving: () => setSaving(true),
        onSaved: markSaved,
        onError: handleError,
    };

    const instructionsDraft = useCodeDraft<string>(
        {
            agentId,
            codeType: SYSTEM_PROMPT_TYPE,
            lang: 'markdown',
            pointerField: 'systemPromptCodeId',
            label: 'instructions',
            serialize: (value) => value,
            allowBootstrap: true,
            status,
            onLocalSaved: (value) => {
                persistedRef.current = { ...persistedRef.current, instructions: value };
            },
        },
        {
            publishedCodeId: seed.systemPromptCodeId,
            publishedVersion: seed.systemPromptVersion,
            publishedValue: seed.defaultInstructions ?? '',
            pendingCodeId: seed.pendingCodeId,
            pendingVersion: seed.pendingVersion,
            pendingValue: seed.pendingCodeId ? (agentConfig.instructions ?? '') : undefined,
        },
    );

    const uiConfigDraft = useCodeDraft<ChatAgentUiType>(
        {
            agentId,
            codeType: UI_CONFIG_TYPE,
            lang: 'json',
            pointerField: 'uiConfigCodeId',
            label: 'chat appearance',
            serialize: (value) => JSON.stringify(value),
            allowBootstrap: false,
            status,
        },
        {
            publishedCodeId: seed.uiConfigCodeId,
            publishedVersion: seed.uiConfigVersion,
            publishedValue: seed.uiConfig,
            pendingCodeId: seed.pendingUiConfigCodeId,
            pendingVersion: seed.pendingUiConfigVersion,
            pendingValue: seed.pendingUiConfig,
        },
    );

    const { reseed: reseedInstructions } = instructionsDraft;
    const { reseed: reseedUiConfig, isDirty: isUiConfigDirty } = uiConfigDraft;

    const synchronizePersistedState = useCallback(
        (config: AgentConfigDraft, nextSeed: AgentAutosaveSeed) => {
            persistedRef.current = toSnapshot(config);
            baselineAgentIdRef.current = agentId;
            lastSavedDescriptionRef.current = nextSeed.description;
            baselineModelIdsRef.current = (config.models ?? []).map((m) => m._id);
            reseedInstructions({
                publishedCodeId: nextSeed.systemPromptCodeId,
                publishedVersion: nextSeed.systemPromptVersion,
                publishedValue: nextSeed.defaultInstructions ?? '',
                pendingCodeId: nextSeed.pendingCodeId,
                pendingVersion: nextSeed.pendingVersion,
                pendingValue: nextSeed.pendingCodeId ? (config.instructions ?? '') : undefined,
            });
            reseedUiConfig({
                publishedCodeId: nextSeed.uiConfigCodeId,
                publishedVersion: nextSeed.uiConfigVersion,
                publishedValue: nextSeed.uiConfig,
                pendingCodeId: nextSeed.pendingUiConfigCodeId,
                pendingVersion: nextSeed.pendingUiConfigVersion,
                pendingValue: nextSeed.pendingUiConfig,
            });
            setSaving(false);
        },
        [agentId, reseedInstructions, reseedUiConfig],
    );

    const snapshot = toSnapshot(agentConfig);

    const isDirtyRef = useRef(false);

    isDirtyRef.current =
        snapshot.name !== persistedRef.current.name ||
        snapshot.instructions !== persistedRef.current.instructions ||
        !sameOrderedIds(
            snapshot.models.map((m) => m._id),
            persistedRef.current.models.map((m) => m._id),
        ) ||
        !sameOrderedIds(
            snapshot.mcpServers.map((m) => m._id),
            persistedRef.current.mcpServers.map((m) => m._id),
        ) ||
        snapshot.mcpServers.some((m, i) => m.isRecommended !== persistedRef.current.mcpServers[i]?.isRecommended) ||
        !sameIds(snapshot.agentIds, persistedRef.current.agentIds) ||
        !sameIds(snapshot.toolIds, persistedRef.current.toolIds) ||
        !sameIds(snapshot.dataStoreIds, persistedRef.current.dataStoreIds) ||
        !sameIds(
            snapshot.skills.map((s) => s._id),
            persistedRef.current.skills.map((s) => s._id),
        ) ||
        !sameRecommendedFlags(snapshot.skills, persistedRef.current.skills) ||
        !sameIds(snapshot.memoryIds, persistedRef.current.memoryIds);

    const getIsDirty = useCallback(() => isDirtyRef.current || isUiConfigDirty(), [isUiConfigDirty]);

    const hasUnsavedLocalEdits = useCallback(() => isDirtyRef.current, []);

    useEffect(
        () => () => {
            if (savedTimerRef.current !== null) {
                clearTimeout(savedTimerRef.current);
            }
        },
        [],
    );

    useEffect(() => {
        if (saving) {
            setSaved(false);
        }
    }, [saving]);

    useEffect(() => {
        // The flush ref is left set on purpose: it holds the write scheduled for the agent the
        // snapshot belongs to, and clearing it would drop a rename the UI already accepted.
        if (baselineAgentIdRef.current !== agentId) {
            return undefined;
        }

        if (snapshot.name === persistedRef.current.name) {
            flushNameRef.current = null;

            return undefined;
        }

        const nextName = snapshot.name;

        const persistName = () => {
            flushNameRef.current = null;

            if (nextName === persistedRef.current.name) {
                return;
            }

            setSaving(true);
            saveName(agentId, nextName)
                .then(() => {
                    persistedRef.current = { ...persistedRef.current, name: nextName };
                    void queryClient.invalidateQueries({ queryKey: MY_AGENTS_QUERY_KEY });
                    markSaved();
                })
                .catch((error) => handleError(error, 'name'));
        };

        flushNameRef.current = persistName;

        const timer = setTimeout(persistName, NAME_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [agentId, snapshot.name, queryClient]);

    useEffect(() => {
        // Flush ref left set, as in the rename effect above.
        if (baselineAgentIdRef.current !== agentId) {
            return undefined;
        }

        if (snapshot.instructions === persistedRef.current.instructions) {
            flushInstructionsRef.current = null;

            return undefined;
        }

        const nextInstructions = snapshot.instructions;

        const persistInstructions = () => {
            flushInstructionsRef.current = null;

            if (nextInstructions === persistedRef.current.instructions) {
                return;
            }

            void instructionsDraft.save(nextInstructions);
        };

        flushInstructionsRef.current = persistInstructions;

        const timer = setTimeout(persistInstructions, INSTRUCTIONS_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [agentId, snapshot.instructions]);

    // Cleanup on a dependency change is the debounce itself and must cancel; cleanup on
    // unmount must not, or an edit made within the debounce window is lost while the UI
    // has already reported it saved. Two invariants keep the flush from writing something
    // the user did not ask for: each flush clears its own ref slot so it can never run
    // twice, and it re-reads persistedRef at write time because it may run long after it
    // was scheduled — after synchronizePersistedState re-baselined the value, or after the
    // edit was typed and reverted, whose effect re-run clears the slot on its early return.
    useEffect(() => {
        return () => {
            flushNameRef.current?.();
            flushInstructionsRef.current?.();
        };
    }, []);

    useEffect(() => {
        // Not debounced, so a stale snapshot here writes on the next effect run rather than after
        // a timer.
        if (baselineAgentIdRef.current !== agentId) {
            return;
        }

        const prev = persistedRef.current;
        const ids: CapabilityIds = {};

        if (
            !sameOrderedIds(
                snapshot.mcpServers.map((m) => m._id),
                prev.mcpServers.map((m) => m._id),
            ) ||
            snapshot.mcpServers.some((m, i) => m.isRecommended !== prev.mcpServers[i]?.isRecommended)
        ) {
            ids.mcpServers = snapshot.mcpServers.map((item) => ({
                mcpServerId: item._id,
                isRecommended: item.isRecommended ?? false,
            }));
        }

        if (!sameIds(snapshot.agentIds, prev.agentIds)) {
            ids.agentIds = snapshot.agentIds;
        }

        if (!sameIds(snapshot.toolIds, prev.toolIds)) {
            ids.toolIds = snapshot.toolIds;
        }

        if (!sameIds(snapshot.dataStoreIds, prev.dataStoreIds)) {
            ids.dataStoreIds = snapshot.dataStoreIds;
        }

        if (
            !sameIds(
                snapshot.skills.map((s) => s._id),
                prev.skills.map((s) => s._id),
            ) ||
            !sameRecommendedFlags(snapshot.skills, prev.skills)
        ) {
            ids.skills = snapshot.skills.map((item) => ({
                skillId: item._id,
                isRecommended: item.isRecommended ?? false,
            }));
        }

        if (!sameIds(snapshot.memoryIds, prev.memoryIds)) {
            ids.memoryIds = snapshot.memoryIds;
        }

        if (Object.keys(ids).length === 0) {
            return;
        }

        setSaving(true);
        saveCapabilities(agentId, ids)
            .then(() => {
                persistedRef.current = {
                    ...persistedRef.current,
                    mcpServers: snapshot.mcpServers,
                    agentIds: snapshot.agentIds,
                    toolIds: snapshot.toolIds,
                    dataStoreIds: snapshot.dataStoreIds,
                    skills: snapshot.skills,
                    memoryIds: snapshot.memoryIds,
                };
                markSaved();
            })
            .catch((error) => handleError(error, 'changes'));
    }, [
        agentId,
        snapshot.mcpServers.map((m) => `${m._id}:${m.isRecommended}`).join(','),
        snapshot.agentIds.join(','),
        snapshot.toolIds.join(','),
        snapshot.dataStoreIds.join(','),
        snapshot.skills.map((s) => `${s._id}:${s.isRecommended}`).join(','),
        snapshot.memoryIds.join(','),
    ]);

    useEffect(() => {
        // `uiConfigDraft.save` resolves `agentId` at write time, not from this closure.
        if (baselineAgentIdRef.current !== agentId) {
            return;
        }

        if (
            sameOrderedIds(
                snapshot.models.map((m) => m._id),
                persistedRef.current.models.map((m) => m._id),
            )
        ) {
            return;
        }

        pendingModelsRef.current = snapshot.models;

        if (applyingModelRef.current) {
            return;
        }

        applyingModelRef.current = true;

        const drainModelChanges = async () => {
            try {
                while (
                    !sameOrderedIds(
                        pendingModelsRef.current.map((m) => m._id),
                        persistedRef.current.models.map((m) => m._id),
                    )
                ) {
                    const items = pendingModelsRef.current;
                    const base = uiConfigDraft.getCurrent() ?? buildDefaultUiConfig();
                    const models = await buildModels(items, base.models ?? []);
                    const next = applyModelsToUiConfig(base, models);

                    // Keep the agent's model list in sync with the draft: the API rejects a
                    // ui_config code referencing a model absent from that list, and a removed model
                    // must also drop off the agent. A pure reorder keeps the same set and stays in
                    // the draft until publish.
                    const prevIds = persistedRef.current.models.map((m) => m._id);
                    const modelIds = items.map((m) => m._id);
                    const setChanged =
                        prevIds.length !== modelIds.length || modelIds.some((id) => !prevIds.includes(id));

                    if (setChanged) {
                        await saveCapabilities(agentId, { modelIds, defaultModelId: modelIds[0] ?? null });
                    }

                    const ok = await uiConfigDraft.save(next);

                    if (!ok) {
                        break;
                    }

                    persistedRef.current = { ...persistedRef.current, models: items };
                }
            } catch (error) {
                handleError(error, 'model');
            } finally {
                applyingModelRef.current = false;
            }
        };

        void drainModelChanges();
    }, [snapshot.models.map((m) => m._id).join(',')]);

    const publishPending = useCallback(async (): Promise<boolean> => {
        try {
            await instructionsDraft.publish();

            return true;
        } catch (error) {
            handleError(error, 'publish');

            return false;
        }
    }, [instructionsDraft]);

    const discardPending = useCallback(async (): Promise<string> => {
        const restored = (await instructionsDraft.discard()) ?? '';

        persistedRef.current = { ...persistedRef.current, instructions: restored };

        return restored;
    }, [instructionsDraft]);

    const getUiConfig = useCallback(() => uiConfigDraft.getCurrent(), [uiConfigDraft]);

    const getPublishedUiConfig = useCallback(() => uiConfigDraft.getPublished(), [uiConfigDraft]);

    const getDescription = useCallback(() => lastSavedDescriptionRef.current ?? '', []);

    const saveChannelUiConfig = useCallback(
        async (next: ChatAgentUiType) => {
            await uiConfigDraft.save(next);
        },
        [uiConfigDraft],
    );

    const publishUiConfigPending = useCallback(async (): Promise<boolean> => {
        try {
            const didPublish = await uiConfigDraft.publish();

            if (didPublish) {
                const published = uiConfigDraft.getPublished();
                const models = published?.models ?? [];
                const modelIds = models.map((m) => m.modelId);
                const defaultModelId = published?.defaultModel?.modelId ?? modelIds[0] ?? null;

                await saveCapabilities(agentId, { modelIds, defaultModelId });
                baselineModelIdsRef.current = modelIds;
            }

            return true;
        } catch (error) {
            handleError(error, 'publish');

            return false;
        }
    }, [agentId, uiConfigDraft]);

    const publishAll = useCallback(async (): Promise<void> => {
        setIsPublishing(true);
        try {
            const instructionsOk = await publishPending();

            if (!instructionsOk) {
                return;
            }

            const uiConfigOk = await publishUiConfigPending();

            if (uiConfigOk) {
                markSaved();
            }
        } finally {
            setIsPublishing(false);
        }
    }, [publishPending, publishUiConfigPending]);

    const discardModelPending = useCallback(async (): Promise<{ ok: boolean; models?: AgentConfigItem[] }> => {
        const current = uiConfigDraft.getCurrent();
        const published = uiConfigDraft.getPublished();

        if (hasNonModelChanges(published, current)) {
            const ok = await uiConfigDraft.save(restoreModel(current, published));

            if (!ok) {
                uiConfigDraft.resetCurrent(current);

                return { ok: false };
            }
        } else {
            await uiConfigDraft.discard();
        }

        const models =
            published?.models?.map((m) => ({ _id: m.modelId, name: m.name })) ??
            baselineModelIdsRef.current.map((id) => ({ _id: id, name: id }));

        persistedRef.current = { ...persistedRef.current, models };

        return { ok: true, models };
    }, [uiConfigDraft]);

    const discardAppearancePending = useCallback(async (): Promise<boolean> => {
        const current = uiConfigDraft.getCurrent();
        const published = uiConfigDraft.getPublished();

        if (getModelChange(published, current)) {
            const ok = await uiConfigDraft.save(restoreAppearance(current, published));

            if (!ok) {
                uiConfigDraft.resetCurrent(current);

                return false;
            }
        } else {
            await uiConfigDraft.discard();
        }

        return true;
    }, [uiConfigDraft]);

    const saveChannelDescription = useCallback(
        async (description: string) => {
            setSaving(true);
            try {
                await saveDescription(agentId, description);
                lastSavedDescriptionRef.current = description;
                void queryClient.invalidateQueries({ queryKey: MY_AGENTS_QUERY_KEY });
                markSaved();
            } catch (error) {
                handleError(error, 'description');
            }
        },
        [agentId, queryClient],
    );

    return {
        saving,
        saved,
        hasPendingChanges: instructionsDraft.hasPending,
        isPublishing,
        originalInstructions: instructionsDraft.getPublished() ?? '',
        synchronizePersistedState,
        getIsDirty,
        hasUnsavedLocalEdits,
        publishAll,
        discardPending,
        getUiConfig,
        getPublishedUiConfig,
        getDescription,
        saveChannelUiConfig,
        saveChannelDescription,
        hasPendingUiConfig: uiConfigDraft.hasPending,
        discardModelPending,
        discardAppearancePending,
    };
};
