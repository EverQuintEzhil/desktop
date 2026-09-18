import { useForm, useStore } from '@tanstack/react-form';
import { useEffect, useState } from 'react';

import { type SelectSuggestionItem } from '@/components';
import { Button } from '@/components/ui/button';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import SideSheet from '@/components/ui/side-sheet';
import SpinnerBlade from '@/components/ui/spinner';
import TextAreaForm from '@/components/ui/textarea-form';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { useUpdateDataStoreMutation } from '@/lib/api/admin/data-stores';
import { PROVIDER_OPTIONS, getProviderLabel, type DataStoreType, type ProviderType } from '@/types/admin';

interface Props {
    onClose: () => void;
    isOpen: boolean;
    onEditSuccess?: (dataStore: DataStoreType) => void;
    dataStore: DataStoreType;
}

const EditDataStore = (props: Props) => {
    const { onClose: onCloseProp, isOpen, dataStore, onEditSuccess } = props;

    const updateMutation = useUpdateDataStoreMutation();
    const [formError, setFormError] = useState('');

    const form = useForm({
        defaultValues: {
            provider: dataStore?.provider
                ? {
                      value: dataStore.provider,
                      label: dataStore.provider,
                  }
                : ({
                      value: 'api',
                      label: 'API',
                  } as SelectSuggestionItem<string>),
            name: dataStore?.name || '',
            description: dataStore?.description || '',
            refName: dataStore?.refName || '',
            showInAgentBuilder: dataStore?.showInAgentBuilder ?? false,
        },
        onSubmit: async ({ value }) => {
            setFormError('');
            try {
                const obj: { name: string; description: string; refName: string; showInAgentBuilder: boolean } = {
                    name: value.name.trim(),
                    description: value.description.trim(),
                    refName: value.refName.trim(),
                    showInAgentBuilder: value.showInAgentBuilder,
                };

                const result = await updateMutation.mutateAsync({ id: dataStore._id, data: obj });

                onEditSuccess?.(result);
                onClose();
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

    const isDirty = useStore(form.store, (state) => state.isDirty);

    const formValues = useStore(form.store, (state) => state.values);

    useEffect(() => {
        if (formError) {
            setFormError('');
        }
    }, [formValues]);

    const onClose = () => {
        form.reset({
            provider: { value: 'api', label: 'API' },
            name: '',
            description: '',
            refName: '',
            showInAgentBuilder: false,
        });
        setFormError('');
        onCloseProp();
    };

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

    return (
        <SideSheet
            isOpen={isOpen}
            onClose={onClose}
            renderTitle={() => <>{dataStore ? 'Edit Data Store' : 'Add Data Store'}</>}
            renderFooter={() => (
                <Button
                    onClick={form.handleSubmit}
                    className="edit-data-store-save-button ml-auto flex"
                    disabled={updateMutation.isPending}
                >
                    {updateMutation.isPending ? <SpinnerBlade className="scale-75" /> : null}
                    {updateMutation.isPending ? 'Saving' : 'Save'}
                </Button>
            )}
            showConfirmOnClose={isDirty}
            classNameContent="flex flex-col edit-data-store-content pb-0"
        >
            <div className="flex flex-col gap-4 pb-4">
                <form.Field
                    name="provider"
                    children={(field) => (
                        <FormField label="Provider" field={field} required>
                            {() => (
                                <Select<ProviderType>
                                    variant="ghost"
                                    placeholder="Select"
                                    options={PROVIDER_OPTIONS}
                                    value={(field.state.value?.value ?? null) as ProviderType | null}
                                    onChange={(val) => {
                                        if (val == null) return;
                                        field.handleChange({ value: val, label: getProviderLabel(val) });
                                        field.handleBlur();
                                    }}
                                    disabled={true}
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
                <form.Field
                    name="showInAgentBuilder"
                    children={(field) => (
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Show in Agent Builder</span>
                            <ToggleSwitch
                                checked={field.state.value}
                                onCheckedChange={(checked) => field.handleChange(checked)}
                            />
                        </div>
                    )}
                />
            </div>
            {formError && (
                <div className="sticky bottom-0 z-1 mt-auto bg-card py-2">
                    <span className="text-sm font-medium text-destructive">{formError}</span>
                </div>
            )}
        </SideSheet>
    );
};

export default EditDataStore;
