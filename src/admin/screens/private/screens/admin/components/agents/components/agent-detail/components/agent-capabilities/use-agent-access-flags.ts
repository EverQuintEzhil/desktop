import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useCapabilitiesUpdateMutation } from '@/lib/api/admin/capabilities';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import type { AgentSettingsType, AgentType } from '@/types/admin';
import { resolveAgentAccessFlags } from '@/utils/resolve-agent-access-flags';

type AccessFlags = Required<AgentSettingsType>;

interface PendingSave {
    /** The flags the `agent` prop resolved to when the first unsaved toggle was clicked. */
    baseline: AccessFlags;
    /** The flags being saved, shown while the prop still reads `baseline`. */
    settings: AccessFlags;
}

export interface UseAgentAccessFlagsResult {
    settings: AccessFlags;
    onToggle: (key: keyof AgentSettingsType, checked: boolean) => void;
}

const areFlagsEqual = (a: AccessFlags, b: AccessFlags): boolean =>
    a.allowCustomSkills === b.allowCustomSkills &&
    a.allowSharedSkills === b.allowSharedSkills &&
    a.allowCustomConnectors === b.allowCustomConnectors &&
    a.allowSharedConnectors === b.allowSharedConnectors;

/**
 * Single owner of the four agent access flags. The Skills and Connectors switch pairs both read
 * from this, so every payload is built from the flags currently on screen rather than from a copy
 * of the agent that predates a toggle in the other pair.
 */
export const useAgentAccessFlags = (
    agent: AgentType,
    onSubmit: (value: AgentType) => void,
): UseAgentAccessFlagsResult => {
    const updateMutation = useCapabilitiesUpdateMutation();
    const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
    // Saves run one at a time and in click order: the api takes the whole four-key object, so two
    // in flight at once would let an out-of-order response drop the earlier toggle.
    const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
    const latestSaveRef = useRef(0);

    const { allowCustomSkills, allowSharedSkills, allowCustomConnectors, allowSharedConnectors } =
        resolveAgentAccessFlags(agent);

    const resolvedSettings = useMemo<AccessFlags>(
        () => ({
            allowCustomSkills,
            allowSharedSkills,
            allowCustomConnectors,
            allowSharedConnectors,
        }),
        [allowCustomSkills, allowSharedSkills, allowCustomConnectors, allowSharedConnectors],
    );

    // A pending save goes inert the moment the `agent` prop stops reading its baseline — whether
    // that is the saved value arriving or an unrelated refetch. The prop always wins from then on,
    // so a parent that never updates cannot wedge the switches on a stale optimistic value.
    const isPendingSaveStale = pendingSave !== null && !areFlagsEqual(pendingSave.baseline, resolvedSettings);
    const settings = pendingSave && !isPendingSaveStale ? pendingSave.settings : resolvedSettings;

    useEffect(() => {
        if (isPendingSaveStale) setPendingSave(null);
    }, [isPendingSaveStale]);

    const saveFlags = async (nextSettings: AccessFlags, saveId: number) => {
        try {
            // PUT /agents/:id validates `settings` as a strict object with all four keys required,
            // so every save carries the complete set rather than a patch.
            await updateMutation.mutateAsync({
                type: 'agents',
                id: agent._id,
                data: { settings: nextSettings },
            });

            // Only the last click in a burst tells the parent, so an earlier save landing does not
            // walk the agent back to a state the user has already moved on from.
            if (saveId !== latestSaveRef.current) return;

            // Hand the parent a narrow merge rather than the PUT response. That response is the
            // raw agent document, whose skills/mcpServers entries lack the per-user `effectiveEnabled`
            // and `connection` fields the GET folds in, so merging it into the detail cache would
            // flash "everything enabled, nothing connected" until the refetch lands.
            onSubmit({ ...agent, settings: nextSettings });
        } catch (error) {
            setPendingSave(null);
            toast.error(getApiErrorMessage(error, 'Could not update agent settings.'));
        }
    };

    const onToggle = (key: keyof AgentSettingsType, checked: boolean) => {
        const nextSettings = { ...settings, [key]: checked };
        // Keep the baseline of a burst pinned to the first unsaved click, so the second toggle
        // does not mistake its own optimistic value for an incoming prop change.
        const baseline = pendingSave && !isPendingSaveStale ? pendingSave.baseline : resolvedSettings;

        setPendingSave({ baseline, settings: nextSettings });

        latestSaveRef.current += 1;

        const saveId = latestSaveRef.current;

        saveQueueRef.current = saveQueueRef.current.then(() => saveFlags(nextSettings, saveId));
    };

    return {
        settings,
        onToggle,
    };
};
