import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { schemaToFields } from '@/admin/screens/private/screens/admin/components/parameters-schema/schema-builders';
import { SchemaFieldsForm, buildCustomFields, collectLeaves, initialFieldValues } from '@/components/schema-fields';
import type { FieldValues } from '@/components/schema-fields';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Spinner from '@/components/ui/spinner';
import { accountApi, ME_QUERY_KEY, useUserProfileSchemaQuery, type MeProfile } from '@/lib/api';

interface Props {
    profile: MeProfile;
}

interface FormState {
    signature: string;
    initial: FieldValues;
    values: FieldValues;
}

const readCustomFields = (profile: MeProfile): Record<string, unknown> => {
    const stored = profile.customFields;

    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};

    return stored;
};

const getErrorMessage = (error: unknown): string => {
    const axiosError = error as { response?: { data?: { message?: string } } };

    if (axiosError.response?.data?.message) return axiosError.response.data.message;
    if (error instanceof Error && error.message) return error.message;

    return 'Something went wrong. Please try again.';
};

const ProfileFieldsSection = (props: Props) => {
    const { profile } = props;

    const queryClient = useQueryClient();
    const schemaQuery = useUserProfileSchemaQuery();

    const [formError, setFormError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [form, setForm] = useState<FormState | null>(null);

    const fields = useMemo(() => (schemaQuery.data ? schemaToFields(schemaQuery.data) : []), [schemaQuery.data]);
    const leaves = useMemo(() => collectLeaves(fields), [fields]);

    const customFields = readCustomFields(profile);
    const signature = `${leaves.map((leaf) => leaf.key).join('|')}::${JSON.stringify(customFields)}`;

    const { mutateAsync: saveCustomFields, isPending } = useMutation({
        mutationFn: (next: Record<string, unknown>) => accountApi.updateMe({ customFields: next }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
    });

    if (leaves.length > 0 && form?.signature !== signature) {
        const initial = initialFieldValues(leaves, customFields);

        setForm({ signature, initial, values: initial });
    }

    const renderHeader = () => (
        <div className="general-panel-profile-fields-header flex flex-col gap-1">
            <h3 className="text-base font-semibold">Profile details</h3>
            <p className="text-sm text-muted-foreground">
                Extra information your organisation asks you to keep up to date.
            </p>
        </div>
    );

    const renderSkeletonField = (index: number) => (
        <div key={`profile-field-skeleton-${index}`} className="flex flex-col gap-2 rounded-xl bg-card p-4">
            <Skeleton className="h-4 w-28 rounded-sm" />
            <Skeleton className="h-9 w-full rounded-md" />
        </div>
    );

    if (schemaQuery.isPending) {
        return (
            <section className="general-panel-profile-fields flex flex-col gap-4">
                {renderHeader()}
                <div className="grid gap-3 lg:grid-cols-2">{[0, 1].map(renderSkeletonField)}</div>
            </section>
        );
    }

    if (leaves.length === 0 || !form) return null;

    const isDirty = leaves.some((leaf) => form.values[leaf.key] !== form.initial[leaf.key]);

    const onFieldChange = (key: string, value: string | boolean) => {
        setFormError('');
        setSuccessMessage('');
        setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
        setForm((prev) => (prev ? { ...prev, values: { ...prev.values, [key]: value } } : prev));
    };

    const onDiscard = () => {
        setFormError('');
        setSuccessMessage('');
        setErrors({});
        setForm((prev) => (prev ? { ...prev, values: prev.initial } : prev));
    };

    const onSave = async () => {
        setFormError('');
        setSuccessMessage('');

        const outcome = buildCustomFields(customFields, leaves, form.values);

        if (!outcome.customFields) {
            setErrors(outcome.errors);
            setFormError(Object.values(outcome.errors)[0] ?? 'Fix the highlighted fields before saving.');

            return;
        }

        setErrors({});
        try {
            await saveCustomFields(outcome.customFields);
            setSuccessMessage('Your profile has been saved.');
        } catch (error: unknown) {
            setFormError(getErrorMessage(error));
        }
    };

    const renderActions = () => (
        <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" disabled={!isDirty || isPending} onClick={onDiscard}>
                Discard
            </Button>
            <Button disabled={!isDirty || isPending} onClick={() => void onSave()}>
                {isPending ? <Spinner className="scale-75" /> : null}
                {isPending ? 'Saving' : 'Save'}
            </Button>
        </div>
    );

    return (
        <section className="general-panel-profile-fields flex flex-col gap-4">
            {renderHeader()}
            <SchemaFieldsForm
                readOnlyAsText
                readOnlyNote="Set by your administrator"
                descriptionAsTooltip
                className="grid gap-3 lg:grid-cols-2"
                fieldClassName="rounded-xl bg-card p-4"
                labelClassName="px-2"
                controlClassName="border-transparent bg-transparent px-2"
                fields={fields}
                values={form.values}
                errors={errors}
                onChange={onFieldChange}
            />
            {formError && <span className="text-sm font-medium text-destructive">{formError}</span>}
            {successMessage && <span className="text-sm font-medium text-primary">{successMessage}</span>}
            {renderActions()}
        </section>
    );
};

export default ProfileFieldsSection;
