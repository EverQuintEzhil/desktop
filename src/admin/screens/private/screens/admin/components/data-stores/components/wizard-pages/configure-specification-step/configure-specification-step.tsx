import { useForm, useStore } from '@tanstack/react-form';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import type { WizardFormPageHandle, WizardFormPageProps } from '@/admin/components/wizard';
import JSONEditor from '@/components/json-editor';
import FormField from '@/components/ui/form-field';
import { useWizardSaveConnectionMutation } from '@/lib/api/admin/data-stores';
import type { DataStoreType } from '@/types/admin';
import { parseJsonIfValid } from '@/utils';

export const ConfigureSpecificationStep = forwardRef<WizardFormPageHandle, WizardFormPageProps>(
    ({ currentPage, setCanGoNext, onPageComplete, handleCommonDataChange, commonData }, ref) => {
        const saveConnectionMutation = useWizardSaveConnectionMutation();
        const [formError, setFormError] = useState('');

        const wizardData = commonData as { dataStore?: DataStoreType; completedPages?: number[] } | null;
        const isAlreadyAdded = wizardData?.completedPages?.includes(currentPage);

        const submitSucceededRef = useRef(false);

        const form = useForm({
            defaultValues: {
                specification: {
                    json: wizardData?.dataStore?.specification,
                } as Content,
            },
            validators: {
                onChange: ({ value }) => {
                    const parsedSpecificationValue = parseJsonIfValid(value.specification);

                    return {
                        fields: {
                            specification:
                                wizardData?.dataStore?.provider === 'custom' &&
                                (!parsedSpecificationValue || Object.keys(parsedSpecificationValue).length === 0)
                                    ? 'Specification is required.'
                                    : undefined,
                        },
                    };
                },
            },
            onSubmit: async ({ value }) => {
                submitSucceededRef.current = false;
                setFormError('');
                try {
                    const parsedSpecificationValue = parseJsonIfValid(value.specification);

                    const obj = {
                        specification: parsedSpecificationValue,
                    };

                    const result = await saveConnectionMutation.mutateAsync({
                        id: wizardData?.dataStore?._id ?? '',
                        data: obj,
                    });

                    onPageComplete?.(result, { currentPage, method: 'PUT' });

                    const updatedDataStore = {
                        ...wizardData,
                        dataStore: {
                            ...wizardData?.dataStore,
                            ...result,
                        },
                        completedPages: [...(wizardData?.completedPages ?? []), currentPage],
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
            if (isAlreadyAdded) {
                setCanGoNext(true);
            }
        }, [currentPage]);

        return (
            <>
                <div className="scrollbar-controller scrollbar-vertical flex max-h-[50svh] flex-col gap-4 pb-4">
                    <form.Field
                        name="specification"
                        children={(field) => (
                            <FormField
                                label="Specification"
                                field={field}
                                required={wizardData?.dataStore?.provider === 'custom'}
                            >
                                {(isErrored) => (
                                    <JSONEditor
                                        isErrored={isErrored}
                                        content={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(content: Content) => {
                                            field.handleChange(content);
                                        }}
                                    />
                                )}
                            </FormField>
                        )}
                    />
                </div>

                {formError && (
                    <div className="add-data-store-error py-2">
                        <span className="text-sm font-medium text-destructive">{formError}</span>
                    </div>
                )}
            </>
        );
    },
);

ConfigureSpecificationStep.displayName = 'ConfigureSpecificationStep';
