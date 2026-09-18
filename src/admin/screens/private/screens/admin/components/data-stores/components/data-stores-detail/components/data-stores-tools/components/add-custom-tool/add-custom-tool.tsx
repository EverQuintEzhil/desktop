import { useForm, useStore } from '@tanstack/react-form';
import { useState, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import SideSheet from '@/components/ui/side-sheet';
import SpinnerBlade from '@/components/ui/spinner';
import TextAreaForm from '@/components/ui/textarea-form';
import { useCreateDatastoreToolMutation } from '@/lib/api/admin/data-stores';
import type { DataStoreType, ToolType } from '@/types/admin';

interface Props {
    onClose: () => void;
    isOpen: boolean;
    onAddTool?: (tool: ToolType) => void;
    dataStore: DataStoreType;
}

const AddCustomTool = (props: Props) => {
    const { onClose: onCloseProp, isOpen, onAddTool, dataStore } = props;
    const createToolMutation = useCreateDatastoreToolMutation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    const isRefNameEditedByUserRef = useRef(false);
    const form = useForm({
        defaultValues: {
            name: '',
            description: '',
            refName: '',
        },
        onSubmit: async ({ value }) => {
            setIsSubmitting(true);
            setFormError('');
            try {
                const obj = {
                    name: value.name.trim(),
                    description: value.description,
                    refName: value.refName.trim(),
                    dataStoreIds: [dataStore._id],
                };

                const result = await createToolMutation.mutateAsync(obj);

                onAddTool?.(result as ToolType);
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
            } finally {
                setIsSubmitting(false);
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
            name: '',
            refName: '',
            description: '',
        });
        isRefNameEditedByUserRef.current = false;
        setFormError('');
        onCloseProp();
    };

    const handleNameChange = (newName: string) => {
        const refNameValue = newName
            .toLowerCase()
            .replace(/[^a-z0-9_ ]/g, '') // remove special characters except underscore and space
            .replace(/\s+/g, '_') // replace spaces with underscore
            .replace(/_+/g, '_') // replace multiple underscores with single
            .replace(/^_+|_+$/g, '');

        if (!isRefNameEditedByUserRef.current) {
            form.setFieldValue('refName', refNameValue);
        }
    };

    return (
        <SideSheet
            isOpen={isOpen}
            onClose={onClose}
            renderTitle={() => <>{'Add Custom Tool'}</>}
            renderFooter={() => (
                <Button
                    onClick={form.handleSubmit}
                    className="add-tool-save-button ml-auto flex"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? <SpinnerBlade className="scale-75" /> : null}
                    {isSubmitting ? 'Saving' : 'Save'}
                </Button>
            )}
            showConfirmOnClose={isDirty}
            classNameContent="flex flex-col add-tool-content pb-0"
        >
            <div className="flex flex-col gap-4 pb-4">
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
                                        handleNameChange(e.target.value);
                                        field.handleChange(e.target.value);
                                    }}
                                />
                            )}
                        </FormField>
                    )}
                    validators={{
                        onChange: ({ value }) => {
                            if (!value?.trim()) {
                                return 'Name is required';
                            }

                            return null;
                        },
                    }}
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
                                        if (!isRefNameEditedByUserRef.current) {
                                            isRefNameEditedByUserRef.current = true;
                                        }
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
                            } else if (/^\d/.test(value)) {
                                return 'Ref Name should not start with a number.';
                            } else if (!/^[a-z0-9_]+$/.test(value)) {
                                return 'Ref Name should not contain special characters except underscores.';
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
            </div>
            {formError && (
                <div className="sticky bottom-0 z-1 mt-auto bg-card py-2">
                    <span className="text-sm font-medium text-destructive">{formError}</span>
                </div>
            )}
        </SideSheet>
    );
};

export default AddCustomTool;
