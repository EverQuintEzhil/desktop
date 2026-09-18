import { useForm, useStore } from '@tanstack/react-form';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import type { WizardFormPageHandle, WizardFormPageProps } from '@/admin/components/wizard';
import JSONEditor from '@/components/json-editor';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { useWizardListCollectionsMutation, useWizardSaveConnectionMutation } from '@/lib/api/admin/data-stores';
import type { DataStoreType, ProviderType } from '@/types/admin';
import { dataStoreCollectionToOption, showErrorToast } from '@/utils';

import connectionFields from '../../connectionFields.json';

import { ConnectionOptionTabs } from './connection-option-tabs';
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

export const ConfigureConnectionStep = forwardRef<WizardFormPageHandle, WizardFormPageProps>(
    ({ currentPage, setCanGoNext, onPageComplete, handleCommonDataChange, commonData }, ref) => {
        const saveConnectionMutation = useWizardSaveConnectionMutation();
        const listCollectionsMutation = useWizardListCollectionsMutation();
        const [formError, setFormError] = useState('');

        const wizardData = commonData as {
            dataStore?: DataStoreType;
            completedPages?: number[];
            dontSkipEmbeddingFields?: boolean;
            requestEmbeddingFieldsChoice?: () => void;
        } | null;
        const provider: ProviderType = wizardData?.dataStore?.provider ?? 'api';
        const isAlreadyAdded = wizardData?.completedPages?.includes(currentPage);

        const providerOptions: ConnectionProviderOption[] =
            (connectionFields as unknown as Record<string, ConnectionProviderOption[]>)[provider] ?? [];

        const [activeOptionIndex, setActiveOptionIndex] = useState<number>(0);

        const submitSucceededRef = useRef(false);

        const getActiveFields = (): Record<string, unknown> => providerOptions[activeOptionIndex]?.config ?? {};

        const form = useForm({
            defaultValues: connectionBuildNestedInitialValues(getActiveFields()),
            onSubmit: async ({ value }) => {
                submitSucceededRef.current = false;
                setFormError('');

                try {
                    const dataStoreId = wizardData?.dataStore?._id;
                    const connection = connectionCoerceNestedValues(value, getActiveFields());

                    const result = await saveConnectionMutation.mutateAsync({
                        id: dataStoreId!,
                        data: {
                            connection:
                                provider === 'custom' ? (connection as Record<string, unknown>).connection : connection,
                        },
                    });

                    onPageComplete?.(result, { currentPage, method: 'PUT' });
                    handleCommonDataChange?.({
                        ...wizardData,
                        dataStore: { ...wizardData?.dataStore, ...result },
                        completedPages: [...(wizardData?.completedPages ?? []), currentPage],
                    });
                    setCanGoNext(true);
                    submitSucceededRef.current = true;
                } catch (error: unknown) {
                    console.error(error);

                    const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                    const message = axiosError.response?.data?.message || 'Something went wrong. Please try again.';

                    setFormError(
                        axiosError.response?.status === 500 ? 'Internal server error, Please try again.' : message,
                    );
                }
            },
        });

        useEffect(() => {
            form.reset(connectionBuildNestedInitialValues(getActiveFields()));
        }, [activeOptionIndex]);

        useEffect(() => {
            if (isAlreadyAdded) {
                setCanGoNext(true);
            }
        }, [isAlreadyAdded, setCanGoNext]);

        const submitStep = useCallback(async (): Promise<boolean> => {
            const w = commonData as {
                dataStore?: DataStoreType;
                completedPages?: number[];
                dontSkipEmbeddingFields?: boolean;
                requestEmbeddingFieldsChoice?: () => void;
            } | null;
            const p = w?.dataStore?.provider ?? 'api';
            const isBlobStorageProvider = p === 's3' || p === 'azure-blob-storage' || p === 'sharepoint';

            if (!isBlobStorageProvider) {
                if (isAlreadyAdded && !form.state.isDirty) {
                    return true;
                }
                submitSucceededRef.current = false;
                await form.handleSubmit();

                return submitSucceededRef.current;
            }

            if (w?.dontSkipEmbeddingFields === undefined) {
                if (isAlreadyAdded && !form.state.isDirty) {
                    w?.requestEmbeddingFieldsChoice?.();

                    return false;
                }
                submitSucceededRef.current = false;
                await form.handleSubmit();

                if (!submitSucceededRef.current) {
                    return false;
                }

                w?.requestEmbeddingFieldsChoice?.();

                return false;
            }

            if (isAlreadyAdded && !form.state.isDirty) {
                return true;
            }
            submitSucceededRef.current = false;
            await form.handleSubmit();

            return submitSucceededRef.current;
        }, [commonData, form, isAlreadyAdded]);

        useImperativeHandle(ref, () => ({ submitStep }), [submitStep]);

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

        return (
            <>
                <div className="wizard-form-step-switch flex flex-col gap-4 pb-4">
                    <ConnectionOptionTabs
                        options={providerOptions}
                        activeIndex={activeOptionIndex}
                        onChange={setActiveOptionIndex}
                    />
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
                                                disabled={derivedFromUrl === true}
                                                onChange={(_, checked) => field.handleChange(String(checked) as never)}
                                            />
                                        );
                                    }

                                    if (valueType === 'json') {
                                        return (
                                            <div className="flex flex-col gap-1">
                                                <label className="text-sm font-medium">
                                                    {label}
                                                    {required && <span className="ml-0.5 text-destructive">*</span>}
                                                </label>
                                                <JSONEditor
                                                    content={{ text: fieldValue }}
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
                                        const dataStoreId = wizardData?.dataStore?._id;

                                        const fetchSelectOptions = async (query: string, pageNo: number = 0) => {
                                            try {
                                                if (!dataStoreId) {
                                                    return { list: [], pageInfo: { page: 0, total_pages: 0 } };
                                                }

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
                                                    wizardId: dataStoreId,
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
                                            <div className="flex flex-col gap-1">
                                                <label className="text-sm font-medium">
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
                                                    disabled={!allRequiredComplete}
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
                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium">
                                                {label}
                                                {required && <span className="ml-0.5 text-destructive">*</span>}
                                            </label>
                                            <Input
                                                name={field.name}
                                                type={inputType}
                                                value={fieldValue}
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
                {formError && (
                    <div className="wizard-footer py-2">
                        <span className="text-center text-sm font-medium text-destructive">{formError}</span>
                    </div>
                )}
            </>
        );
    },
);

ConfigureConnectionStep.displayName = 'ConfigureConnectionStep';
