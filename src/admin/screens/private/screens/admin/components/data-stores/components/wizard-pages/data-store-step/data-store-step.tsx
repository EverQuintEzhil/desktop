import { useForm, useStore } from '@tanstack/react-form';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import type { WizardFormPageHandle, WizardFormPageProps } from '@/admin/components/wizard';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import type { SelectSuggestionItem } from '@/components/ui/select';
import Select from '@/components/ui/select';
import TextAreaForm from '@/components/ui/textarea-form';
import { useUpdateDataStoreMutation, useWizardCreateDataStoreMutation } from '@/lib/api/admin/data-stores';
import { PROVIDER_OPTIONS, getProviderLabel, type DataStoreType, type ProviderType } from '@/types/admin';

export const DataStoreStep = forwardRef<WizardFormPageHandle, WizardFormPageProps>(
    ({ currentPage, setCanGoNext, onPageComplete, handleCommonDataChange, commonData: commonDataProp }, ref) => {
        const wizardCreateMutation = useWizardCreateDataStoreMutation();
        const updateMutation = useUpdateDataStoreMutation();
        const [formError, setFormError] = useState('');

        const commonData = commonDataProp as { dataStore?: DataStoreType; completedPages?: number[] } | null;
        const isAlreadyAdded = commonData?.completedPages?.includes(currentPage);

        const submitSucceededRef = useRef(false);

        const form = useForm({
            defaultValues: {
                provider: commonData?.dataStore?.provider
                    ? {
                          value: commonData.dataStore.provider,
                          label: commonData.dataStore.provider,
                      }
                    : ({
                          value: 'api',
                          label: 'API',
                      } as SelectSuggestionItem<ProviderType>),
                name: commonData?.dataStore?.name ?? '',
                description: commonData?.dataStore?.description ?? '',
                refName: commonData?.dataStore?.refName ?? '',
            },
            onSubmit: async ({ value }) => {
                submitSucceededRef.current = false;
                setFormError('');
                try {
                    const isFilesProvider = value.provider.value === 'files';

                    const obj = isFilesProvider
                        ? {
                              provider: isAlreadyAdded ? undefined : value.provider.value,
                              name: value.name.trim(),
                              refName: value.refName.trim(),
                          }
                        : {
                              provider: isAlreadyAdded ? undefined : value.provider.value,
                              name: value.name.trim(),
                              description: value.description.trim(),
                              refName: value.refName.trim(),
                          };

                    const result = isAlreadyAdded
                        ? await updateMutation.mutateAsync({
                              id: commonData?.dataStore?._id ?? '',
                              data: obj,
                              refreshList: false,
                          })
                        : await wizardCreateMutation.mutateAsync(obj);

                    onPageComplete?.(result, { currentPage, method: isAlreadyAdded ? 'PUT' : 'POST' });
                    const updatedDataStore = {
                        ...commonData,
                        dataStore: {
                            ...commonData?.dataStore,
                            ...result,
                        },
                        completedPages: [...(commonData?.completedPages ?? []), currentPage],
                    };

                    handleCommonDataChange?.(updatedDataStore);
                    setCanGoNext(true);
                    submitSucceededRef.current = true;
                } catch (error: unknown) {
                    console.error(error);
                    const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                    const message = axiosError.response?.data?.message || 'Something went wrong. Please try again.';

                    if (axiosError.response?.status === 500) {
                        setFormError('Internal server error, Please try again.');
                    } else {
                        setFormError(message);
                    }
                }
            },
        });

        const formValues = useStore(form.store, (state) => state.values);
        const isFilesProvider = formValues.provider?.value === 'files';

        const submitStep = useCallback(async (): Promise<boolean> => {
            if (isAlreadyAdded && !form.state.isDirty) {
                return true;
            }
            submitSucceededRef.current = false;
            await form.handleSubmit();

            return submitSucceededRef.current;
        }, [form, isAlreadyAdded]);

        useImperativeHandle(ref, () => ({ submitStep }), [submitStep]);

        useEffect(() => {
            if (formError) {
                setFormError('');
            }
        }, [formValues]);

        useEffect(() => {
            if (isAlreadyAdded || commonData?.dataStore?.provider) {
                setCanGoNext(true);
            }
        }, [currentPage]);

        const toRefName = (name: string): string =>
            name
                .toLowerCase()
                .replace(/[^a-z0-9_ ]/g, '')
                .replace(/\s+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_+|_+$/g, '');

        const handleNameChange = (previousName: string, nextName: string) => {
            if (form.getFieldValue('refName') === toRefName(previousName)) {
                form.setFieldValue('refName', toRefName(nextName));
            }
        };

        const renderAdditionalFields = () => {
            return (
                <>
                    {!isFilesProvider && (
                        <form.Field
                            name="description"
                            children={(field) => (
                                <FormField label="Description" field={field}>
                                    {(isErrored) => (
                                        <TextAreaForm
                                            name={field.name}
                                            isErrored={isErrored}
                                            value={field.state.value}
                                            onBlur={field.handleBlur}
                                            onChange={(val) => field.handleChange(val)}
                                        />
                                    )}
                                </FormField>
                            )}
                        />
                    )}
                    <form.Field
                        name="refName"
                        children={(field) => (
                            <FormField label="Ref Name" field={field} required>
                                {(isErrored) => (
                                    <Input
                                        name={field.name}
                                        isErrored={isErrored}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => {
                                            if (field.state.meta.errorMap?.onServer) {
                                                form.setFieldMeta('refName', (prev) => ({
                                                    ...prev,
                                                    errorMap: {},
                                                }));
                                            }
                                            field.handleChange(e.target.value);
                                        }}
                                    />
                                )}
                            </FormField>
                        )}
                        validators={{
                            onChange: ({ value }) => {
                                if (!value) {
                                    return 'Ref Name is required';
                                } else if (value?.includes(' ')) {
                                    return 'Spaces are not allowed in the refName.';
                                } else if (/[A-Z]/.test(value)) {
                                    return 'Ref Name should not contain uppercase letters.';
                                } else if (!/^[a-z0-9_]+$/.test(value)) {
                                    return 'Ref Name should not contain special characters except underscores.';
                                } else if (/^\d/.test(value)) {
                                    return 'Ref Name should not start with a number.';
                                }

                                return null;
                            },
                        }}
                    />
                </>
            );
        };

        return (
            <>
                <div className="wizard-form-step-content-container scrollbar-controller scrollbar-vertical scrollbar-horizontal flex flex-col gap-4 pb-4">
                    <form.Field
                        name="provider"
                        children={(field) => (
                            <FormField label="Provider" field={field} required>
                                {() => (
                                    <Select<ProviderType>
                                        variant="ghost"
                                        placeholder="Select"
                                        options={PROVIDER_OPTIONS}
                                        value={field.state.value?.value ?? null}
                                        onChange={(val) => {
                                            if (val == null) return;
                                            field.handleChange({ value: val, label: getProviderLabel(val) });
                                            field.handleBlur();
                                        }}
                                        disabled={isAlreadyAdded}
                                    />
                                )}
                            </FormField>
                        )}
                        validators={{
                            onChange: ({ value }) => {
                                if (!value) {
                                    return 'Provider is required';
                                }

                                return null;
                            },
                        }}
                    />
                    <form.Field
                        name="name"
                        children={(field) => (
                            <FormField label="Name" field={field} required>
                                {(isErrored) => (
                                    <Input
                                        name={field.name}
                                        isErrored={isErrored}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => {
                                            handleNameChange(field.state.value, e.target.value);
                                            field.handleChange(e.target.value);
                                        }}
                                    />
                                )}
                            </FormField>
                        )}
                        validators={{
                            onChange: ({ value }) => {
                                if (!value) {
                                    return 'Name is required';
                                }

                                return null;
                            },
                        }}
                    />
                    {renderAdditionalFields()}
                </div>

                {formError && (
                    <div className="add-data-store-error py-2">
                        <span className="text-center text-sm font-medium text-destructive">{formError}</span>
                    </div>
                )}
            </>
        );
    },
);

DataStoreStep.displayName = 'DataStoreStep';
