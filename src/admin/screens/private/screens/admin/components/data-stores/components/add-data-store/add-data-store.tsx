import { useForm, useStore } from '@tanstack/react-form';
import { useEffect, useState } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import Select, { type SelectSuggestionItem } from '@/components/ui/select';
import SideSheet from '@/components/ui/side-sheet';
import SpinnerBlade from '@/components/ui/spinner';
import TextAreaForm from '@/components/ui/textarea-form';
import { useCreateDataStoreMutation } from '@/lib/api/admin/data-stores';
import { PROVIDER_OPTIONS, getProviderLabel, type ProviderType } from '@/types/admin';
import { parseJsonIfValid } from '@/utils';
interface Props {
    onClose: () => void;
    isOpen: boolean;
}

const DEFAULT_DS_CONNECTION: Record<string, object> = {
    opensearch: {
        host: '',
        auth: {
            username: '',
            password: '',
        },
        index: '',
    },
    mongodb: {
        url: '',
        options: {},
        collection: '',
    },
};

const isNotEmpty = (val: unknown): boolean => {
    if (val === null || val === undefined || val === '') return false;

    if (Array.isArray(val)) {
        return val.every(isNotEmpty);
    }

    if (typeof val === 'object') {
        return Object.values(val).every(isNotEmpty);
    }

    return true;
};

const getKeyPaths = (obj: unknown, prefix = ''): string[] => {
    if (obj === null || typeof obj !== 'object') return [];

    return Object.keys(obj).flatMap((key) => {
        const path = prefix ? `${prefix}.${key}` : key;

        return [path, ...getKeyPaths((obj as Record<string, unknown>)[key], path)];
    });
};

const getDefaultConnection = (key: string) => {
    if (key in DEFAULT_DS_CONNECTION && DEFAULT_DS_CONNECTION[key]) {
        return DEFAULT_DS_CONNECTION[key];
    }

    return {};
};

const AddDataStore = (props: Props) => {
    const { onClose: onCloseProp, isOpen } = props;

    const createMutation = useCreateDataStoreMutation();
    const [formError, setFormError] = useState('');

    const form = useForm({
        defaultValues: {
            provider: {
                value: 'api',
                label: 'API',
            } as SelectSuggestionItem<ProviderType>,
            name: '',
            description: '',
            specification: {
                json: {},
            } as Content,
            connection: {
                json: getDefaultConnection('api'),
            } as Content,
        },
        validators: {
            onChange: ({ value }) => {
                const parsedSpecificationValue = parseJsonIfValid(value.specification);

                return {
                    fields: {
                        specification:
                            value.provider.value === 'custom' &&
                            (!parsedSpecificationValue || Object.keys(parsedSpecificationValue).length === 0)
                                ? 'Specification is required.'
                                : undefined,
                    },
                };
            },
        },
        onSubmit: async ({ value }) => {
            setFormError('');
            try {
                const parsedConnectionValue = parseJsonIfValid(value.connection);
                const parsedSpecificationValue = parseJsonIfValid(value.specification);

                const obj = {
                    provider: value.provider.value,
                    name: value.name.trim(),
                    description: value.description.trim(),
                    connection: parsedConnectionValue,
                    specification: JSON.stringify(parsedSpecificationValue, null, 2),
                };

                await createMutation.mutateAsync(obj);

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

    const provider = useStore(form.store, (state) => state.values.provider);

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
            specification: {
                json: {},
            } as Content,
            connection: {
                json: getDefaultConnection('api'),
            } as Content,
        });
        setFormError('');
        onCloseProp();
    };

    return (
        <SideSheet
            isOpen={isOpen}
            onClose={onClose}
            renderTitle={() => <>Add Data Store</>}
            renderFooter={() => (
                <Button
                    onClick={form.handleSubmit}
                    className="add-data-store-save-button ml-auto flex"
                    disabled={createMutation.isPending}
                >
                    {createMutation.isPending ? <SpinnerBlade className="scale-75" /> : null}
                    {createMutation.isPending ? 'Saving' : 'Save'}
                </Button>
            )}
            showConfirmOnClose={isDirty}
            classNameContent="flex flex-col relative pb-0"
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
                                    value={field.state.value?.value ?? null}
                                    onChange={(val) => {
                                        if (val == null) return;
                                        field.handleChange({ value: val, label: getProviderLabel(val) });
                                        form.setFieldValue('connection', {
                                            json: getDefaultConnection(val) as object,
                                        } as Content);
                                        field.handleBlur();
                                    }}
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
                                    onChange={(e) => field.handleChange(e.target.value)}
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
                    name="connection"
                    children={(field) => (
                        <FormField label="Connection" field={field} required>
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
                    validators={{
                        onChange: ({ value }) => {
                            const parsedCurrentValue = parseJsonIfValid(value);

                            if (!parsedCurrentValue || Object.keys(parsedCurrentValue).length === 0) {
                                return 'Connection is required';
                            }
                            form.setFieldMeta('connection', (prev) => ({
                                ...prev,
                                errorMap: {},
                            }));

                            return null;
                        },
                        onBlur: ({ value }) => {
                            if (!value || Object.keys(value).length === 0) {
                                return 'Configuration Secret is required';
                            }

                            const defaultObj = provider.value ? getDefaultConnection(provider.value) : {};
                            const parsedCurrentValue = parseJsonIfValid(value);

                            const defaultKeys = getKeyPaths(defaultObj);
                            const currentKeys = getKeyPaths(parsedCurrentValue);

                            const currentValueValues = Object.values(parsedCurrentValue);

                            const allKeysPresent = defaultKeys.every((key) => currentKeys.includes(key));

                            const allKeysHasValues = currentValueValues.every(isNotEmpty);

                            if (!allKeysPresent) {
                                return 'Default keys are required';
                            }

                            if (!allKeysHasValues) {
                                return "Key values can't be empty or null";
                            }

                            return null;
                        },
                    }}
                />

                <form.Field
                    name="specification"
                    children={(field) => (
                        <FormField label="Specification" field={field} required={provider.value === 'custom'}>
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
                <div className="absolute bottom-9 left-1/2 z-1 -translate-x-1/2 bg-card">
                    <span className="text-sm font-medium text-destructive">{formError}</span>
                </div>
            )}
        </SideSheet>
    );
};

export default AddDataStore;
