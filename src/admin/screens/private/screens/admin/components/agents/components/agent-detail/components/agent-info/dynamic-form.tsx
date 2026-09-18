import { useForm } from '@tanstack/react-form';
import { CheckIcon, PencilIcon, XIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useParams } from 'react-router-dom';

import MultiSelect from '@/components/multi-select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { RadioGroup } from '@/components/ui/radio-group';
import Select, { type SelectSuggestionItem } from '@/components/ui/select';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import SpinnerBlade from '@/components/ui/spinner';
import TextAreaForm from '@/components/ui/textarea-form';
import { useUpdateAgentMutation } from '@/lib/api/admin/agents';
import type { FieldType } from '@/types/admin';

export interface DynamicFormProps {
    customFields: { [key: string]: unknown };
    dynamicFields: FieldType[];
    title: string;
    agentId: string;
    field: string;
    canUserEdit: boolean;
}

const INPUT_TYPES_DEFAULT_VALUE = {
    text: '',
    textbox: '',
    number: 0,
    radio: '',
    checkbox: [] as string[],
    select: { label: '', value: '' },
    multiselect: [],
    filesupload: [],
    jsoneditor: {},
};

const DynamicForm = (props: DynamicFormProps) => {
    const { customFields, dynamicFields, title, agentId, field, canUserEdit } = props;
    const params = useParams();
    const [isEditing, setIsEditing] = useState(false);

    const updateMutation = useUpdateAgentMutation();
    const isSubmitting = updateMutation.isPending;

    const getFieldValueAsStringArray = (value: unknown): string[] => {
        if (Array.isArray(value)) {
            if (typeof value[0] === 'string') {
                // Copy: callers update the selection and hand the result back to the form, so
                // returning the form's own array would make that update invisible by identity.
                return [...value] as string[];
            }

            return (value as { value: string }[]).map((item) => item.value);
        }

        return [];
    };

    const getFieldValueAsString = (value: unknown): string => {
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'object' && value !== null && 'value' in value) {
            return String(value.value);
        }

        return '';
    };

    const getMultiSelectFieldValue = (value: unknown): SelectSuggestionItem<string>[] => {
        if (Array.isArray(value) && typeof value[0] !== 'object') {
            return value.map((val) => ({ label: String(val), value: val }));
        }

        return value as SelectSuggestionItem<string>[];
    };

    const getDefaultValue = () => {
        const defaultValues: {
            [key: string]: string | string[] | SelectSuggestionItem<string> | SelectSuggestionItem<string>[];
        } = {};

        dynamicFields?.forEach((dynamicField: FieldType) => {
            const key = dynamicField.name as string;
            const value = INPUT_TYPES_DEFAULT_VALUE[dynamicField.inputType];

            if (Object.keys(customFields).length > 0 && customFields[key]) {
                if (dynamicField.inputType === 'select') {
                    defaultValues[key] = {
                        label: customFields[key],
                        value: customFields[key],
                    } as SelectSuggestionItem<string>;
                } else if (dynamicField.inputType === 'multiselect') {
                    const selectedValues = customFields[key] as string[];

                    defaultValues[key] = selectedValues?.map((selectedValue) => ({
                        label: selectedValue,
                        value: selectedValue,
                    })) as SelectSuggestionItem<string>[];
                } else {
                    defaultValues[key] = customFields[key] as string;
                }
            } else {
                defaultValues[key] = value as string;
            }
        });

        return defaultValues;
    };

    const form = useForm({
        defaultValues: getDefaultValue(),
        onSubmit: async ({ value }) => {
            try {
                const finalValue = { ...value };

                Object.entries(finalValue).map(([key, value]) => {
                    const dynamicField = dynamicFields.find((df) => df.name === key);

                    if (dynamicField?.inputType === 'select') {
                        const val = value as { label: string; value: string };

                        finalValue[key] = val?.value;
                    }
                    if (dynamicField?.inputType === 'multiselect') {
                        const val = value as { label: string; value: string }[];

                        finalValue[key] = val?.map((val) => val.value);
                    }
                });

                const obj = {
                    [field]: finalValue,
                };

                await updateMutation.mutateAsync({
                    id: agentId,
                    data: obj,
                    routeSlugOrId: params.agentId,
                });
            } catch (error) {
                console.error(error);
            } finally {
                setIsEditing(false);
            }
        },
    });

    const renderContent = () => {
        const formatFieldValue = (value: unknown) => {
            if (typeof value === 'string') return value;
            if (Array.isArray(value)) return value?.join(', ') + '.';

            return <em>N/A</em>;
        };

        if (isEditing) {
            return (
                <div className="dynamic-form-custom-fields grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
                    {renderDynamicForm()}
                </div>
            );
        }

        if (Object.keys(customFields).length === 0) {
            return <span className="text-sm font-medium text-text-secondary">Yet to be filled.</span>;
        }

        return (
            <div className="dynamic-form-grid inline-grid grid-cols-[1fr_4fr] gap-x-4 gap-y-3">
                {Object.entries(customFields).map(([key, value]) => {
                    return (
                        <Fragment key={key}>
                            <span className="text-sm">{key}</span>
                            <span className="text-sm">{formatFieldValue(value)}</span>
                        </Fragment>
                    );
                })}
            </div>
        );
    };

    const renderDynamicForm = () => {
        return dynamicFields?.map((dynamicField: FieldType) => {
            if (dynamicField?.inputType === 'checkbox') {
                return (
                    <form.Field
                        key={dynamicField.name}
                        name={dynamicField.name}
                        children={(field) => (
                            <FormField label={dynamicField.label} field={field} required>
                                {() => (
                                    <div className="dynamic-form-checkbox-wrap flex flex-wrap gap-2">
                                        {dynamicField.values?.map((checkbox) => (
                                            <Checkbox
                                                key={checkbox}
                                                label={checkbox}
                                                checked={(field.state.value as string[]).includes(checkbox)}
                                                onChange={(_, val) => {
                                                    const existingValue = getFieldValueAsStringArray(field.state.value);
                                                    const nextValue = val
                                                        ? [...existingValue, checkbox]
                                                        : existingValue.filter(
                                                              (existingField) => checkbox !== existingField,
                                                          );

                                                    field.handleChange(nextValue);
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </FormField>
                        )}
                    />
                );
            } else if (dynamicField?.inputType === 'radio') {
                return (
                    <form.Field
                        key={dynamicField.name}
                        name={dynamicField.name}
                        children={(field) => (
                            <FormField label={dynamicField.label} field={field} required>
                                {() => (
                                    <RadioGroup
                                        options={dynamicField.values?.map((value) => ({
                                            name: value,
                                            value,
                                            label: value,
                                        }))}
                                        checked={getFieldValueAsString(field.state.value)}
                                        onChange={(val: string) => {
                                            field.handleChange(val);
                                        }}
                                        gap="8px"
                                        orientation="horizontal"
                                    />
                                )}
                            </FormField>
                        )}
                    />
                );
            } else if (dynamicField.inputType === 'text') {
                return (
                    <form.Field
                        key={dynamicField.name}
                        name={dynamicField.name}
                        children={(field) => (
                            <FormField label={dynamicField.label} field={field} required className="name">
                                {(isErrored) => (
                                    <Input
                                        name={field.name}
                                        isErrored={isErrored}
                                        value={getFieldValueAsString(field.state.value)}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => {
                                            field.handleChange(e.target.value);
                                        }}
                                    />
                                )}
                            </FormField>
                        )}
                        validators={{
                            onChange: ({ value }) => {
                                if (!value) {
                                    return `${dynamicField.label} is required`;
                                }

                                return null;
                            },
                        }}
                    />
                );
            } else if (dynamicField.inputType === 'number') {
                return (
                    <form.Field
                        key={dynamicField.name}
                        name={dynamicField.name}
                        children={(field) => (
                            <FormField label={dynamicField.label} field={field} required className="number">
                                {(isErrored) => (
                                    <Input
                                        name={field.name}
                                        type="number"
                                        isErrored={isErrored}
                                        value={getFieldValueAsString(field.state.value)}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => {
                                            field.handleChange(e.target.value);
                                        }}
                                    />
                                )}
                            </FormField>
                        )}
                        validators={{
                            onChange: ({ value }) => {
                                if (!value) {
                                    return `${dynamicField.label} is required`;
                                }

                                return null;
                            },
                        }}
                    />
                );
            } else if (dynamicField.inputType === 'textbox') {
                return (
                    <form.Field
                        key={dynamicField.name}
                        name={dynamicField.name}
                        children={(field) => (
                            <FormField label={dynamicField.label} field={field} required className="form-textarea">
                                {(isErrored) => (
                                    <TextAreaForm
                                        name={dynamicField.name}
                                        isErrored={isErrored}
                                        value={getFieldValueAsString(field.state.value)}
                                        onBlur={field.handleBlur}
                                        onChange={(val) => field.handleChange(val)}
                                    />
                                )}
                            </FormField>
                        )}
                        validators={{
                            onChange: ({ value }) => {
                                if (!value) {
                                    return `${dynamicField.label} is required`;
                                }

                                return null;
                            },
                        }}
                    />
                );
            } else if (dynamicField.inputType === 'select') {
                return (
                    <form.Field
                        key={dynamicField.name}
                        name={dynamicField.name}
                        children={(field) => (
                            <FormField label={dynamicField.label} field={field} required className="form-select">
                                {() => (
                                    <Select<string>
                                        placeholder="Select"
                                        options={
                                            dynamicField.values?.map((v) => ({
                                                value: v ?? '',
                                                label: v ?? '',
                                            })) ?? []
                                        }
                                        value={
                                            typeof field.state.value === 'object' &&
                                            field.state.value &&
                                            'value' in field.state.value
                                                ? ((field.state.value as SelectSuggestionItem<string>).value ?? null)
                                                : ((field.state.value as string) ?? null)
                                        }
                                        onChange={(val) => {
                                            field.handleChange(
                                                val != null
                                                    ? { value: val, label: val }
                                                    : (undefined as unknown as SelectSuggestionItem<string>),
                                            );
                                            field.handleBlur();
                                        }}
                                    />
                                )}
                            </FormField>
                        )}
                        validators={{
                            onChange: ({ value }) => {
                                if (!value || (!Array.isArray(value) && typeof value === 'object' && !value.value)) {
                                    return `${dynamicField.label} is required`;
                                }

                                return null;
                            },
                        }}
                    />
                );
            } else if (dynamicField.inputType === 'multiselect') {
                return (
                    <form.Field
                        key={dynamicField.name}
                        name={dynamicField.name}
                        children={(field) => (
                            <FormField label={dynamicField.label} field={field} required className="form-multi-select">
                                {() => (
                                    <MultiSelect<string>
                                        allowSearch={true}
                                        value={getMultiSelectFieldValue(field.state.value)}
                                        data={dynamicField.values?.map((value) => ({
                                            value: value ?? '',
                                            label: value ?? '',
                                        }))}
                                        onSelect={(val: SelectSuggestionItem<string>[]) => {
                                            field.handleChange(val);
                                        }}
                                    />
                                )}
                            </FormField>
                        )}
                        validators={{
                            onChange: ({ value }) => {
                                if (!value || (Array.isArray(value) && value.length === 0)) {
                                    return `${dynamicField.label} is required`;
                                }

                                return null;
                            },
                        }}
                    />
                );
            }

            return (
                <span key={dynamicField.name} className="text-sm">
                    {dynamicField.label}
                </span>
            );
        });
    };

    return (
        <div className="custom-fields hover-me flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <h4>{title}</h4>
                {isEditing ? (
                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                                setIsEditing(!isEditing);
                                form.reset();
                            }}
                        >
                            <XIcon />
                        </Button>
                        <Button
                            variant="default"
                            size="icon-sm"
                            disabled={isSubmitting}
                            onClick={() => {
                                form.handleSubmit();
                            }}
                        >
                            {isSubmitting ? <SpinnerBlade className="scale-75" /> : <CheckIcon />}
                        </Button>
                    </div>
                ) : (
                    canUserEdit && (
                        <SimpleTooltip content="Edit" side="bottom">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="on-hover"
                                onClick={() => setIsEditing(!isEditing)}
                            >
                                <PencilIcon />
                            </Button>
                        </SimpleTooltip>
                    )
                )}
            </div>
            {renderContent()}
        </div>
    );
};

export default DynamicForm;
