import { useForm, useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type RefObject } from 'react';

import { appProjectsApi } from '@/lib/api/app/projects';
import { useCreateRoutineMutation, useRunRoutineNowMutation, useUpdateRoutineMutation } from '@/lib/api/app/routines';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import type { RoutineType } from '@/types/routines';
import { showErrorToast, showSuccessToast } from '@/utils';

import {
    buildRoutineUpdatePayload,
    buildTriggersCreatePayload,
    type PayloadContext,
} from '../utils/build-routine-payload';
import { recipientSpaceRefusalOf, type RecipientSpaceRefusal } from '../utils/recipient-refusal';
import {
    hasProjectedRecipients,
    isRecipientRejection,
    storedRecipients,
    type RecipientOption,
} from '../utils/recipients';
import { validateTriggers } from '../utils/triggers';

import { useRoutineRecipients } from './use-routine-recipients';
import type { useRoutineTriggers } from './use-routine-triggers';
import { useRunNowToast } from './use-run-now-toast';

interface Params {
    routine?: RoutineType | null;
    agent?: { _id: string; name: string };
    project?: { _id: string; name: string };
    triggerState: ReturnType<typeof useRoutineTriggers>;
    /** Read at submit time: the agent record that decides it only arrives after the form is built. */
    areSpacesEnabledRef: RefObject<boolean>;
    onClose: () => void;
}

const createDefaults = (agent: Params['agent'], project: Params['project']) => ({
    name: '',
    prompt: '',
    agentId: agent?._id ?? '',
    projectId: project?._id ?? '',
    modelId: '',
    emailOnRun: false,
    deepResearch: false,
    icon: '',
    recipients: [] as RecipientOption[],
});

const editDefaults = (routine: RoutineType, agent: Params['agent'], project: Params['project']) => ({
    name: routine.name,
    prompt: routine.prompt,
    agentId: routine.agentId ?? agent?._id ?? '',
    projectId: routine.projectId ?? project?._id ?? '',
    modelId: routine.modelId ?? '',
    emailOnRun: routine.emailOnRun ?? false,
    deepResearch: routine.deepResearch ?? false,
    icon: routine.icon ?? '',
    // Synchronously, so a save that never touches the picker can diff against what it opened with
    // even while the owner lookup is in flight. `useRoutineRecipients` stands the owner in for a
    // pre-AMP-600 routine with no stored rows, moving this baseline with it.
    recipients: storedRecipients(routine),
});

const defaultValues = (routine: Params['routine'], agent: Params['agent'], project: Params['project']) =>
    routine ? editDefaults(routine, agent, project) : createDefaults(agent, project);

type RoutineFormValues = ReturnType<typeof createDefaults>;

interface SaveContext {
    value: RoutineFormValues;
    routine: Params['routine'];
    triggerState: Params['triggerState'];
    sendsProjectId: boolean;
    loadedRecipients: RecipientOption[];
    knowsRecipients: boolean;
    createMutation: ReturnType<typeof useCreateRoutineMutation>;
    updateMutation: ReturnType<typeof useUpdateRoutineMutation>;
    onRunNow: (routineId: string) => void;
}

const saveRoutine = async ({
    value,
    routine,
    triggerState,
    sendsProjectId,
    loadedRecipients,
    knowsRecipients,
    createMutation,
    updateMutation,
    onRunNow,
}: SaveContext) => {
    const context: PayloadContext = { sendsProjectId, routine, loadedRecipients, knowsRecipients };
    const editedTriggers = triggerState.isDirty && !triggerState.lock ? triggerState.triggers : null;

    if (routine) {
        await updateMutation.mutateAsync({
            id: routine._id,
            data: buildRoutineUpdatePayload(value, context, editedTriggers),
        });
        showSuccessToast('Routine updated.');

        return;
    }

    const created = await createMutation.mutateAsync(buildTriggersCreatePayload(value, context, triggerState.triggers));

    showSuccessToast('Routine created. First run fires on its schedule.', {
        action: { label: 'Run now', onClick: () => onRunNow(created._id) },
    });
};

export const useRoutineForm = ({ routine, agent, project, triggerState, areSpacesEnabledRef, onClose }: Params) => {
    const createMutation = useCreateRoutineMutation();
    const updateMutation = useUpdateRoutineMutation();
    const runNowMutation = useRunRoutineNowMutation();
    const runNowToast = useRunNowToast();
    const isEdit = Boolean(routine);
    const [recipientError, setRecipientError] = useState<string | null>(null);
    // Present only for a `RECIPIENT_NO_SPACE_ACCESS` refusal, which is the one case a routine
    // dialog can fix on its own — see `recipient-refusal.ts`.
    const [spaceRefusal, setSpaceRefusal] = useState<RecipientSpaceRefusal | null>(null);
    const loadedRecipientsRef = useRef(defaultValues(routine, agent, project).recipients);
    const knowsRecipients = routine ? hasProjectedRecipients(routine) : true;

    // Grants Space membership as an explicit action, never as a side effect of saving a routine —
    // that would widen who can read a Space with nobody having asked for it.
    const addToSpaceMutation = useMutation({
        mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
            appProjectsApi.addMember(projectId, { userId, role: 'viewer' }),
    });

    const onAddRecipientToSpace = () => {
        if (!spaceRefusal) return;

        addToSpaceMutation.mutate(
            { projectId: spaceRefusal.projectId, userId: spaceRefusal.recipient.userId },
            {
                onSuccess: () => {
                    showSuccessToast(`${spaceRefusal.recipient.name} added to ${spaceRefusal.spaceName}.`);
                    setRecipientError(null);
                    setSpaceRefusal(null);
                    // The recipient can now see the Space, so the save that named them is retried
                    // rather than making the admin find and click Save again.
                    void form.handleSubmit();
                },
                onError: (err) => {
                    showErrorToast(getApiErrorMessage(err, 'Failed to add them to the Space.'));
                },
            },
        );
    };

    // react-query drops mutate() callbacks once the observer unmounts, so errors past this modal would be swallowed.
    const onRunNow = (routineId: string) => {
        runNowMutation
            .mutateAsync(routineId)
            .then(() => runNowToast.showStarted())
            .catch((error: unknown) => runNowToast.showFailure(error));
    };

    const form = useForm({
        defaultValues: defaultValues(routine, agent, project),
        onSubmit: async ({ value }) => {
            // The Save button's disabled state is from the last render; a Once trigger can slip into the past since.
            const triggerError = validateTriggers(triggerState.triggers, new Date());

            if (triggerError) {
                showErrorToast(triggerError);

                return;
            }

            const sendsProjectId = areSpacesEnabledRef.current && Boolean(value.projectId || routine?.projectId);

            // Both cleared together: a stale `spaceRefusal` from a previous attempt must not
            // outlive the message it belongs to, or the action rendered beside a NEW error would
            // still point at the OLD refused person and Space.
            setRecipientError(null);
            setSpaceRefusal(null);

            try {
                await saveRoutine({
                    value,
                    routine,
                    triggerState,
                    sendsProjectId,
                    loadedRecipients: loadedRecipientsRef.current,
                    knowsRecipients,
                    createMutation,
                    updateMutation,
                    onRunNow,
                });
                onClose();
                form.reset();
            } catch (error) {
                // Checked before the plain-text path: `RECIPIENT_NO_SPACE_ACCESS` is also a
                // recipient rejection by sentence shape, but it is the one an admin can fix
                // without leaving this dialog, so it renders an action rather than a bare message.
                const spaceRefusalResult = recipientSpaceRefusalOf(
                    error,
                    value.projectId || routine?.projectId,
                    value.recipients,
                );

                if (value.emailOnRun && spaceRefusalResult) {
                    setRecipientError(spaceRefusalResult.message);
                    setSpaceRefusal(spaceRefusalResult);

                    return;
                }

                const message = getApiErrorMessage(error, `Failed to ${isEdit ? 'update' : 'create'} the routine.`);

                // Shown beside the picker rather than in a toast that fades: the api names the
                // person it refused, and the fix is to remove them from the list. Rendered exactly
                // as the api wrote it.
                //
                // Gated on the picker being on screen, and it has to be: `put.js` re-judges the
                // STORED list on every edit (this form always sends `agentId`, which is what sets
                // its `movedPair`), so this refusal reaches saves that never showed a picker to
                // put it beside — and an inline error on an unmounted field is no error at all.
                if (value.emailOnRun && isRecipientRejection(message)) {
                    setRecipientError(message);

                    return;
                }

                showErrorToast(message);
            }
        },
    });

    const recipients = useStore(form.store, (state) => state.values.recipients);
    const emailOnRun = useStore(form.store, (state) => state.values.emailOnRun);

    const { currentUserId } = useRoutineRecipients({
        routine,
        enabled: emailOnRun,
        canSeed: knowsRecipients,
        recipients,
        setRecipients: (value) => form.setFieldValue('recipients', value),
        loadedRecipientsRef,
    });

    const clearRecipientError = () => {
        setRecipientError(null);
        setSpaceRefusal(null);
    };

    return {
        form,
        isEdit,
        currentUserId,
        isPending: createMutation.isPending || updateMutation.isPending,
        recipientError,
        clearRecipientError,
        /** Present only for a `RECIPIENT_NO_SPACE_ACCESS` refusal — the action to render beside it. */
        recipientErrorAction: spaceRefusal
            ? {
                  label: `Add to ${spaceRefusal.spaceName}`,
                  isPending: addToSpaceMutation.isPending,
                  onClick: onAddRecipientToSpace,
              }
            : null,
    };
};

export type RoutineFormApi = ReturnType<typeof useRoutineForm>['form'];
