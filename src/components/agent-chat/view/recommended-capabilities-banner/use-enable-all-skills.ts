import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { CapabilityChip } from './types';

interface EnableAllSkills {
    isEnablingAll: boolean;
    /** The skill the run is writing right now, so its own row can show the pending state. */
    enablingSkillKey: string | null;
    enableAllSkills: (skills: readonly CapabilityChip[]) => Promise<void>;
}

/**
 * Enables recommended skills one at a time through the same per-skill path the chips use.
 * Every skill is attempted even after one fails, and the run reports `k of n` rather than
 * stopping at the first error.
 */
export const useEnableAllSkills = (
    onEnableSkill: (skillId: string) => Promise<boolean>,
    onFailed: (failedKeys: string[]) => void,
): EnableAllSkills => {
    const [isEnablingAll, setIsEnablingAll] = useState(false);
    const [enablingSkillKey, setEnablingSkillKey] = useState<string | null>(null);
    const isRunningRef = useRef(false);
    const isCancelledRef = useRef(false);

    // The chat subtree remounts on an agent switch, so a run started under the previous agent
    // must not report onto the new one.
    useEffect(() => {
        isCancelledRef.current = false;

        return () => {
            isCancelledRef.current = true;
        };
    }, []);

    const enableAllSkills = useCallback(
        async (skills: readonly CapabilityChip[]) => {
            // A skill leaves the list once it succeeds, so the loop walks a snapshot taken up front.
            const snapshot = [...skills];

            if (snapshot.length === 0 || isRunningRef.current) return;

            isRunningRef.current = true;
            setIsEnablingAll(true);

            const failed: CapabilityChip[] = [];

            for (const skill of snapshot) {
                let isEnabled = false;

                setEnablingSkillKey(skill.key);

                try {
                    isEnabled = await onEnableSkill(skill._id);
                } catch {
                    isEnabled = false;
                }

                if (!isEnabled) failed.push(skill);
            }

            isRunningRef.current = false;

            if (isCancelledRef.current) return;

            setEnablingSkillKey(null);
            setIsEnablingAll(false);
            onFailed(failed.map((skill) => skill.key));

            const summary = `${snapshot.length - failed.length} of ${snapshot.length} skill${snapshot.length === 1 ? '' : 's'} enabled for this chat`;

            if (failed.length === 0) {
                toast.success(summary);

                return;
            }

            toast.error(`${summary}. Failed: ${failed.map((skill) => skill.name).join(', ')}`);
        },
        [onEnableSkill, onFailed],
    );

    return { isEnablingAll, enablingSkillKey, enableAllSkills };
};
