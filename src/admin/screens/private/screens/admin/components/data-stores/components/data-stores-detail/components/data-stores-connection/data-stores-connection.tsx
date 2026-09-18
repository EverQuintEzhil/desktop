import { useForm, useStore } from '@tanstack/react-form';
import { useState, useEffect } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import SpinnerBlade from '@/components/ui/spinner';
import { useWizardListCollectionsMutation, useWizardSaveConnectionMutation } from '@/lib/api/admin/data-stores';
import type { DataStoreType, ProviderType } from '@/types/admin';
import { dataStoreCollectionToOption, showErrorToast, showSuccessToast } from '@/utils';

import connectionFields from '../../../connectionFields.json';
import { ConnectionOptionTabs } from '../../../wizard-pages/configure-connection-step/connection-option-tabs';

import {
    type ConnectionProviderOption,
    connectionBuildNestedInitialValues,
    connectionCoerceNestedValues,
    connectionDeriveSslFromUrl,
    connectionFirstFieldErrorFromErrorMap,
    connectionFlattenToLeaves,
    connectionGetNestedValue,
    connectionGetValueType,
    connectionToLabel,
    connectionUrlPathForSslDerivedFromUrl,
} from './connection-utils';
import DataStoresConnectionSecretModal from './data-stores-connection-secret-modal';

interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    onSubmit: (value: DataStoreType) => void;
    showConnectionSecrets?: boolean;
}

const DataStoresConnection = ({ dataStore, canUserEdit, onSubmit, showConnectionSecrets = true }: Props) => {
    const saveConnectionMutation = useWizardSaveConnectionMutation();
    const listCollectionsMutation = useWizardListCollectionsMutation();
    const provider: ProviderType = dataStore.provider ?? 'api';
    const providerOptions: ConnectionProviderOption[] =
        (connectionFields as unknown as Record<string, ConnectionProviderOption[]>)[provider] ?? [];

    const [activeOptionIndex, setActiveOptionIndex] = useState<number>(0);
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSecretModalOpen, setIsSecretModalOpen] = useState(false);

    const getActiveFields = (): Record<string, unknown> => providerOptions[activeOptionIndex]?.config ?? {};

    const form = useForm({
        defaultValues: connectionBuildNestedInitialValues(getActiveFields()),
        onSubmit: async ({ value }) => {
            setFormError('');
            setIsSubmitting(true);

            try {
                const connection = connectionCoerceNestedValues(value, getActiveFields());

                const result = await saveConnectionMutation.mutateAsync({
                    id: dataStore._id,
                    data: {
                        connection:
                            provider === 'custom' ? (connection as Record<string, unknown>).connection : connection,
                    },
                });

                form.reset(connectionBuildNestedInitialValues(getActiveFields()));
                showSuccessToast('Connection saved successfully.');
                setIsSubmitting(false);
                // Notify the parent last: consumers unmount this form from onSubmit (modal close,
                // inline chat card), so no internal state may be touched after this call.
                onSubmit(result);
            } catch (error: unknown) {
                console.error(error);

                const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                const message = axiosError.response?.data?.message || 'Something went wrong. Please try again.';

                setFormError(
                    axiosError.response?.status === 500 ? 'Internal server error, Please try again.' : message,
                );
                setIsSubmitting(false);
            }
        },
    });

    useEffect(() => {
        form.reset(connectionBuildNestedInitialValues(getActiveFields()));
    }, [activeOptionIndex]);

    const formValues = useStore(form.store, (state) => state.values) as Record<string, unknown>;

    const leaves = connectionFlattenToLeaves(getActiveFields());

    useEffect(() => {
        const syncLeaves = connectionFlattenToLeaves(getActiveFields());
        const sslLeaf = syncLeaves.find(
            (l) => l.derivedFromUrl === true && connectionGetValueType(l.value) === 'boolean',
        );

        if (!sslLeaf) return;

        const urlPath = connectionUrlPathForSslDerivedFromUrl(sslLeaf.path);
        const urlVal = connectionGetNestedValue(formValues, urlPath);
        const next = String(connectionDeriveSslFromUrl(urlVal));
        const current = String(connectionGetNestedValue(formValues, sslLeaf.path) ?? '');

        if (current !== next) {
            form.setFieldValue(sslLeaf.path as never, next as never);
        }
    }, [activeOptionIndex, form, formValues, provider]);

    const renderSecretsTrigger = () => {
        if (!showConnectionSecrets) return null;

        return (
            <div>
                <Button variant="secondary" size="sm" onClick={() => setIsSecretModalOpen(true)}>
                    View Connection Secrets
                </Button>
            </div>
        );
    };

    const renderSecretModal = () => {
        if (!showConnectionSecrets) return null;

        return (
            <DataStoresConnectionSecretModal
                dataStoreId={dataStore._id}
                isOpen={isSecretModalOpen}
                onClose={() => setIsSecretModalOpen(false)}
            />
        );
    };

    return (
        <div className="tab-content data-stores-tab flex flex-col gap-6">
            <div className="data-stores-connection-form flex w-full flex-col gap-4">
                <div className="flex justify-between">
                    <ConnectionOptionTabs
                        options={providerOptions}
                        activeIndex={activeOptionIndex}
                        onChange={setActiveOptionIndex}
                    />
                    {renderSecretsTrigger()}
                </div>

                <div className="data-stores-connection-form-fields scrollbar-controller scrollbar-vertical flex max-h-[60svh] flex-col gap-4">
                    {leaves.map(({ path, value, required, otherFieldsShouldComplete, derivedFromUrl, sensitive }) => {
                        const valueType = connectionGetValueType(value);
                        const label = connectionToLabel(path);

                        const requiredValidator = ({ value: v }: { value: unknown }) => {
                            if (required && (!v || String(v).trim() === '')) {
                                return `${label} is required`;
                            }

                            return undefined;
                        };

                        return (
                            <form.Field
                                key={path}
                                name={path as never}
                                validators={{
                                    onBlur: requiredValidator,
                                    onSubmit: requiredValidator,
                                    // Select does not use blur like inputs; re-validate on change so required errors clear after picking a value.
                                    ...(valueType === 'select' ? { onChange: requiredValidator } : {}),
                                }}
                            >
                                {(field) => {
                                    const fieldValue = (field.state.value as string) ?? '';
                                    const fieldError = connectionFirstFieldErrorFromErrorMap(
                                        field.state.meta.errorMap as Record<string, unknown> | undefined,
                                    );

                                    if (valueType === 'boolean') {
                                        return (
                                            <Checkbox
                                                checked={fieldValue === 'true'}
                                                label={label}
                                                disabled={derivedFromUrl === true || !canUserEdit}
                                                onChange={(_, checked) => field.handleChange(String(checked) as never)}
                                            />
                                        );
                                    }

                                    if (valueType === 'json') {
                                        return (
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-foreground">
                                                    {label}
                                                    {required && <span className="ml-0.5 text-destructive">*</span>}
                                                </label>
                                                <JSONEditor
                                                    content={{ text: fieldValue }}
                                                    readOnly={!canUserEdit}
                                                    onBlur={field.handleBlur}
                                                    onChange={(content: Content) => {
                                                        const text =
                                                            'text' in content
                                                                ? content.text
                                                                : JSON.stringify(content.json);

                                                        field.handleChange(text as never);
                                                    }}
                                                />
                                                {fieldError && (
                                                    <span className="text-xs text-destructive">{fieldError}</span>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (valueType === 'select') {
                                        const otherNonSelectLeaves = leaves.filter(
                                            (l) => l.path !== path && connectionGetValueType(l.value) !== 'select',
                                        );
                                        const allRequiredComplete =
                                            !otherFieldsShouldComplete ||
                                            otherNonSelectLeaves
                                                .filter((l) => l.required)
                                                .every(({ path: p }) => {
                                                    const v = connectionGetNestedValue(formValues, p);

                                                    return v && String(v).trim() !== '';
                                                });
                                        const dependencyKey = otherNonSelectLeaves
                                            .map((l) => String(connectionGetNestedValue(formValues, l.path) ?? ''))
                                            .join('|');

                                        const fetchSelectOptions = async (query: string, pageNo: number = 0) => {
                                            try {
                                                const connection = connectionCoerceNestedValues(
                                                    formValues,
                                                    getActiveFields(),
                                                );

                                                leaves
                                                    .filter((l) => connectionGetValueType(l.value) === 'select')
                                                    .forEach(({ path: p }) => {
                                                        const key = p.split('.').pop();

                                                        if (key) delete (connection as Record<string, unknown>)[key];
                                                    });

                                                const finalQuery = query?.trim() ? query : '';

                                                const result = await listCollectionsMutation.mutateAsync({
                                                    wizardId: dataStore._id,
                                                    params: {
                                                        page: pageNo,
                                                        size: 20,
                                                        search: finalQuery,
                                                    },
                                                    connection,
                                                });

                                                const list = result.values;

                                                const finalList = list.map(dataStoreCollectionToOption);

                                                return {
                                                    list: finalList,
                                                    pageInfo: {
                                                        page: result.pageInfo.page,
                                                        total_pages: result.pageInfo.totalPages,
                                                    },
                                                };
                                            } catch (error) {
                                                console.error(error);
                                                showErrorToast(
                                                    'Failed to fetch select options. Please check the connection and try again.',
                                                );

                                                return { list: [], pageInfo: { page: 0, total_pages: 0 } };
                                            }
                                        };

                                        const fetchSelectOptionsForSelect = async (
                                            query: string,
                                            pageNo: number = 0,
                                        ) => {
                                            const res = await fetchSelectOptions(query, pageNo);

                                            return {
                                                list:
                                                    res?.list?.map((item: { value: string; label: string }) => ({
                                                        value: item.value,
                                                        label: item.label,
                                                    })) ?? [],
                                                pageInfo: res.pageInfo,
                                            };
                                        };

                                        return (
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-foreground">
                                                    {label}
                                                    {required && <span className="ml-0.5 text-destructive">*</span>}
                                                </label>
                                                <Select
                                                    key={dependencyKey}
                                                    variant="ghost"
                                                    placeholder={
                                                        allRequiredComplete
                                                            ? 'Select...'
                                                            : 'Complete other fields first'
                                                    }
                                                    options={allRequiredComplete ? fetchSelectOptionsForSelect : []}
                                                    value={fieldValue || null}
                                                    disabled={!canUserEdit || !allRequiredComplete}
                                                    onChange={(val) => {
                                                        void (async () => {
                                                            field.setValue(val as never, { dontValidate: true });
                                                            await field.validate('change');
                                                            if (val != null && String(val).trim() !== '') {
                                                                form.setFieldMeta(path as never, (prev) => ({
                                                                    ...prev,
                                                                    errorMap: {},
                                                                    errorSourceMap: {},
                                                                }));
                                                            }
                                                        })();
                                                    }}
                                                    allowSearch={true}
                                                />
                                                {fieldError && (
                                                    <span className="text-xs text-destructive">{fieldError}</span>
                                                )}
                                            </div>
                                        );
                                    }

                                    let inputType = 'text';

                                    if (valueType === 'number') inputType = 'number';
                                    else if (sensitive) inputType = 'password';

                                    return (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-medium text-foreground">
                                                {label}
                                                {required && <span className="ml-0.5 text-destructive">*</span>}
                                            </label>
                                            <Input
                                                name={field.name}
                                                type={inputType}
                                                value={fieldValue}
                                                disabled={!canUserEdit}
                                                onBlur={field.handleBlur}
                                                onChange={(e) => field.handleChange(e.target.value as never)}
                                            />
                                            {fieldError && (
                                                <span className="text-xs text-destructive">{fieldError}</span>
                                            )}
                                        </div>
                                    );
                                }}
                            </form.Field>
                        );
                    })}
                </div>

                {formError && <span className="text-center text-sm font-medium text-destructive">{formError}</span>}

                {canUserEdit && (
                    <div className="data-stores-connection-form-submit flex justify-end">
                        <Button onClick={form.handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <SpinnerBlade className="scale-75" /> : null}
                            {isSubmitting ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                )}
            </div>

            {renderSecretModal()}
        </div>
    );
};

export default DataStoresConnection;
