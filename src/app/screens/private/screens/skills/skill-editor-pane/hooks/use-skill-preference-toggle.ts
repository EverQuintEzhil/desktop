import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { SkillPreference } from '@/lib/api';
import { skillsApi, SKILLS_QUERY_KEY, invalidateSkillSurfaces } from '@/lib/api/common/skills';
import type { SkillType } from '@/types/admin';
import { showErrorToast } from '@/utils';

export const useSkillPreferenceToggle = (skillId: string | undefined) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ disabled }: { disabled: boolean }) => skillsApi.putSkillPreference(skillId!, disabled),
        onMutate: ({ disabled }) => {
            queryClient.setQueryData<SkillType>([...SKILLS_QUERY_KEY, 'detail', skillId], (old) =>
                old
                    ? {
                          ...old,
                          preference: { ...(old.preference ?? {}), skillId: old._id, disabled } as SkillPreference,
                      }
                    : old,
            );
        },
        onError: () => {
            showErrorToast('Failed to update skill.');
        },
        onSettled: () => {
            invalidateSkillSurfaces(queryClient);
        },
    });
};
