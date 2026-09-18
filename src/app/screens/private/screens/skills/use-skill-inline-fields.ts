import type { FocusEvent, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { useUpdateSkillMutation } from '@/lib/api/common/skills';
import type { SkillType } from '@/types/admin';
import { showErrorToast } from '@/utils';

const MAX_DESCRIPTION_LENGTH = 1024;

interface UseSkillInlineFieldsParams {
    skill: SkillType | undefined;
    isOwner: boolean;
    updateSkillMutation: ReturnType<typeof useUpdateSkillMutation>;
    onUpdated?: (skill: { _id: string; name: string }) => void;
}

export const useSkillInlineFields = ({
    skill,
    isOwner,
    updateSkillMutation,
    onUpdated,
}: UseSkillInlineFieldsParams) => {
    // Escape blurs the field to leave edit mode, and the blur handler runs synchronously
    // before React applies the queued draft reset — without these flags the abandoned
    // text is read back (from the DOM for the name, from the stale closure for the
    // description) and saved to the server.
    const isNameEscapingRef = useRef<boolean>(false);
    const isDescEscapingRef = useRef<boolean>(false);

    const [nameDraft, setNameDraft] = useState('');
    const [descDraft, setDescDraft] = useState('');
    const [isDescEditing, setIsDescEditing] = useState(false);

    useEffect(() => {
        if (!skill) return;
        setNameDraft(skill.name);
        setDescDraft(skill.description || '');
        setIsDescEditing(false);
        // Primitives only. `skill` itself is a fresh object on every parent refetch, and a
        // rename invalidates the `['skills']` prefix mid-edit, so depending on its identity
        // wipes the draft the user is still typing.
    }, [skill?.name, skill?.description, skill?._id]);

    const saveName = async (value: string) => {
        if (!skill || !isOwner || updateSkillMutation.isPending) return;

        const trimmedValue = value.trim();

        if (!trimmedValue) {
            setNameDraft(skill.name);

            return;
        }

        if (trimmedValue === skill.name) return;

        try {
            const updated = await updateSkillMutation.mutateAsync({
                id: skill._id,
                data: { name: trimmedValue },
            });

            onUpdated?.({ _id: skill._id, name: updated?.name ?? trimmedValue });
        } catch (error) {
            setNameDraft(skill.name);
            const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
            const errorMessage = axiosError.response?.data?.message || axiosError.message || 'Failed to rename skill.';

            showErrorToast(errorMessage);
        }
    };

    const saveDescription = async (value: string) => {
        if (!skill || !isOwner || updateSkillMutation.isPending) return;

        const trimmedValue = value.trim();

        if (trimmedValue.length > MAX_DESCRIPTION_LENGTH) {
            setDescDraft(skill.description || '');
            showErrorToast('Description must be 1024 characters or less.');

            return;
        }

        if (trimmedValue === (skill.description || '')) return;

        try {
            await updateSkillMutation.mutateAsync({
                id: skill._id,
                data: { description: trimmedValue },
            });
        } catch (error) {
            setDescDraft(skill.description || '');
            const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
            const errorMessage =
                axiosError.response?.data?.message || axiosError.message || 'Failed to update description.';

            showErrorToast(errorMessage);
        }
    };

    const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
        }
        if (e.key === 'Escape' && skill) {
            e.preventDefault();
            isNameEscapingRef.current = true;
            setNameDraft(skill.name);
            e.currentTarget.blur();
        }
    };

    const handleNameBlur = (e: FocusEvent<HTMLInputElement>) => {
        if (isNameEscapingRef.current) {
            isNameEscapingRef.current = false;
            setNameDraft(skill?.name || '');

            return;
        }

        void saveName(e.target.value);
    };

    const handleDescKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape' && skill) {
            e.preventDefault();
            isDescEscapingRef.current = true;
            setDescDraft(skill.description || '');
            setIsDescEditing(false);
            e.currentTarget.blur();
        }
    };

    const handleDescBlur = () => {
        setIsDescEditing(false);

        if (isDescEscapingRef.current) {
            isDescEscapingRef.current = false;
            setDescDraft(skill?.description || '');

            return;
        }

        void saveDescription(descDraft);
    };

    const startDescEditing = () => {
        if (!isOwner || updateSkillMutation.isPending) return;
        setIsDescEditing(true);
    };

    return {
        nameDraft,
        setNameDraft,
        descDraft,
        setDescDraft,
        isDescEditing,
        startDescEditing,
        handleNameKeyDown,
        handleNameBlur,
        handleDescKeyDown,
        handleDescBlur,
    };
};
