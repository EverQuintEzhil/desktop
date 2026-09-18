import type { RoutineTriggersPayload } from '@/lib/api/app/routines';
import type { RoutineType } from '@/types/routines';

import { haveSameRecipients, recipientIds, type RecipientOption } from './recipients';
import { toTriggerInputs, type TriggerFormValue } from './triggers';

export interface RoutineFormValues {
    name: string;
    prompt: string;
    agentId: string;
    projectId: string;
    modelId: string;
    emailOnRun: boolean;
    deepResearch: boolean;
    icon: string;
    recipients: RecipientOption[];
}

export interface PayloadContext {
    sendsProjectId: boolean;
    routine?: RoutineType | null;
    /** The list the edit form opened with, so an untouched picker sends no `recipients` key. */
    loadedRecipients?: RecipientOption[];
    /** False when the response never carried the list: then there is nothing to safely replace. */
    knowsRecipients?: boolean;
}

const sharedFields = (values: RoutineFormValues, context: PayloadContext) => ({
    name: values.name.trim(),
    prompt: values.prompt.trim(),
    agentId: values.agentId,
    ...(context.sendsProjectId ? { projectId: values.projectId || null } : {}),
});

// Omitted means "leave alone", and `emailOnRun` and `modelId` are both optional in the read payload, so a
// key that only mirrors what the form defaulted to would write a value the user never chose.
const changedOptionalFields = (values: RoutineFormValues, context: PayloadContext) => {
    const storedModelId = context.routine?.modelId ?? '';
    const storedEmailOnRun = context.routine?.emailOnRun ?? false;
    const storedDeepResearch = context.routine?.deepResearch ?? false;
    const storedIcon = context.routine?.icon ?? '';

    return {
        ...(values.modelId === storedModelId ? {} : { modelId: values.modelId || null }),
        ...(values.emailOnRun === storedEmailOnRun ? {} : { emailOnRun: values.emailOnRun }),
        ...(values.deepResearch === storedDeepResearch ? {} : { deepResearch: values.deepResearch }),
        ...(values.icon === storedIcon ? {} : { icon: values.icon || null }),
        // A `recipients` key replaces the stored list wholesale, and the api re-judges every id on
        // it — so an untouched picker must send nothing, exactly like `triggers` below. A list the
        // response never carried is never replaced at all: there is no baseline to have changed.
        ...(context.knowsRecipients === false || haveSameRecipients(values.recipients, context.loadedRecipients ?? [])
            ? {}
            : { recipients: recipientIds(values.recipients) }),
    };
};

export const buildTriggersCreatePayload = (
    values: RoutineFormValues,
    context: PayloadContext,
    triggers: TriggerFormValue[],
): RoutineTriggersPayload => ({
    ...sharedFields(values, context),
    ...(values.modelId ? { modelId: values.modelId } : {}),
    ...(values.icon ? { icon: values.icon } : {}),
    emailOnRun: values.emailOnRun,
    deepResearch: values.deepResearch,
    recipients: recipientIds(values.recipients),
    triggers: toTriggerInputs(triggers),
});

// A `triggers` key replaces the whole stored set in one transaction, so it is sent only when this form
// owns the change: omitting it is what keeps a rename from rewriting the schedule.
export const buildRoutineUpdatePayload = (
    values: RoutineFormValues,
    context: PayloadContext,
    triggers: TriggerFormValue[] | null,
): Partial<RoutineTriggersPayload> => ({
    ...sharedFields(values, context),
    ...changedOptionalFields(values, context),
    ...(triggers ? { triggers: toTriggerInputs(triggers) } : {}),
});
