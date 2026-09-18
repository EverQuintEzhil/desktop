import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import MultiSelect from '@/components/multi-select';
import { Checkbox } from '@/components/ui/checkbox';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { RadioGroup } from '@/components/ui/radio-group';
import Select, { type SelectSuggestionItem } from '@/components/ui/select';
import TextAreaForm from '@/components/ui/textarea-form';
import { UploadFilesProvider } from '@/context';
import type { FieldType } from '@/types/admin';
import { parseJsonIfValid } from '@/utils';

import type { AgentAPIPlaygroundFormPanelProps, FileType } from '../types';
import {
    getFieldValueAsString,
    getFieldValueAsStringArray,
    getMultiSelectFieldValue,
} from '../utils/field-value-selectors';

import FileUpload from './file-upload';

type DynamicFormFieldsProps = Pick<
    AgentAPIPlaygroundFormPanelProps,
    'agent' | 'dynamicForm' | 'loading' | 'handleFilesChange' | 'handleIsUploading'
>;

/** Renders one control per `agent.uiConfig.formSpec` entry, dispatching on `inputType`. */
const DynamicFormFields = (props: DynamicFormFieldsProps) => {
    const { agent, dynamicForm, loading, handleFilesChange, handleIsUploading } = props;

    return (
        <>
            {agent.uiConfig.formSpec?.map((dynamicField: FieldType) => {
                if (dynamicField?.inputType === 'filesupload') {
                    return (
                        <div key={dynamicField.name}>
                            <UploadFilesProvider>
                                <FileUpload
                                    name={dynamicField.name}
                                    label={dynamicField.label}
                                    accept={dynamicField.accept as string}
                                    required={dynamicField.required}
                                    handleFilesChange={handleFilesChange as (name: string, files: FileType[]) => void}
                                    disableDeleteIcon={loading}
                                    disabled={loading}
                                    multiple={dynamicField?.multiple ?? false}
                                    handleIsUploading={handleIsUploading}
                                />
                            </UploadFilesProvider>
                        </div>
                    );
                } else if (dynamicField?.inputType === 'checkbox') {
                    return (
                        <dynamicForm.Field
                            key={dynamicField.name}
                            name={dynamicField.name}
                            children={(field) => (
                                <FormField label={dynamicField.label} field={field} required={dynamicField?.required}>
                                    {() => (
                                        <div className="flex flex-wrap gap-2">
                                            {dynamicField.values?.map((checkbox) => (
                                                <Checkbox
                                                    key={checkbox}
                                                    label={checkbox}
                                                    name={checkbox}
                                                    onBlur={field.handleBlur}
                                                    checked={(field.state.value as string[]).includes(checkbox)}
                                                    onChange={(_, val) => {
                                                        const existingValue = getFieldValueAsStringArray(
                                                            field.state.value,
                                                        );
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
                        <dynamicForm.Field
                            key={dynamicField.name}
                            name={dynamicField.name}
                            children={(field) => (
                                <FormField label={dynamicField.label} field={field} required={dynamicField?.required}>
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
                        <dynamicForm.Field
                            key={dynamicField.name}
                            name={dynamicField.name}
                            children={(field) => (
                                <FormField
                                    label={dynamicField.label}
                                    field={field}
                                    required={dynamicField?.required}
                                    className="name"
                                >
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
                                    if (dynamicField?.required && !value) {
                                        return `${dynamicField.label} is required`;
                                    }

                                    return null;
                                },
                            }}
                        />
                    );
                } else if (dynamicField.inputType === 'number') {
                    return (
                        <dynamicForm.Field
                            key={dynamicField.name}
                            name={dynamicField.name}
                            children={(field) => (
                                <FormField
                                    label={dynamicField.label}
                                    field={field}
                                    required={dynamicField?.required}
                                    className="number"
                                >
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
                                    if (dynamicField?.required && !value) {
                                        return `${dynamicField.label} is required`;
                                    }

                                    return null;
                                },
                            }}
                        />
                    );
                } else if (dynamicField.inputType === 'textbox') {
                    return (
                        <dynamicForm.Field
                            key={dynamicField.name}
                            name={dynamicField.name}
                            children={(field) => (
                                <FormField
                                    label={dynamicField.label}
                                    field={field}
                                    required={dynamicField?.required}
                                    className="form-textarea"
                                >
                                    {(isErrored) => (
                                        <TextAreaForm
                                            name={dynamicField.name}
                                            isErrored={isErrored}
                                            value={getFieldValueAsString(field.state.value)}
                                            onBlur={field.handleBlur}
                                            onChange={(e) => field.handleChange(e)}
                                        />
                                    )}
                                </FormField>
                            )}
                            validators={{
                                onChange: ({ value }) => {
                                    if (dynamicField?.required && !value) {
                                        return `${dynamicField.label} is required`;
                                    }

                                    return null;
                                },
                            }}
                        />
                    );
                } else if (dynamicField.inputType === 'select') {
                    return (
                        <dynamicForm.Field
                            key={dynamicField.name}
                            name={dynamicField.name}
                            children={(field) => (
                                <FormField
                                    label={dynamicField.label}
                                    field={field}
                                    required={dynamicField?.required}
                                    className="form-select"
                                >
                                    {() => (
                                        <Select<string>
                                            variant="ghost"
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
                                                    ? ((field.state.value as SelectSuggestionItem<string>).value ??
                                                      null)
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
                                    if (
                                        dynamicField?.required &&
                                        (!value ||
                                            (!Array.isArray(value) &&
                                                typeof value === 'object' &&
                                                !(value as SelectSuggestionItem<string>).value))
                                    ) {
                                        return `${dynamicField.label} is required`;
                                    }

                                    return null;
                                },
                            }}
                        />
                    );
                } else if (dynamicField.inputType === 'multiselect') {
                    return (
                        <dynamicForm.Field
                            key={dynamicField.name}
                            name={dynamicField.name}
                            children={(field) => (
                                <FormField
                                    label={dynamicField.label}
                                    field={field}
                                    required={dynamicField?.required}
                                    className="form-multi-select"
                                >
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
                                    if (
                                        dynamicField?.required &&
                                        (!value || (Array.isArray(value) && value.length === 0))
                                    ) {
                                        return `${dynamicField.label} is required`;
                                    }

                                    return null;
                                },
                            }}
                        />
                    );
                } else if (dynamicField.inputType === 'jsoneditor') {
                    return (
                        <dynamicForm.Field
                            key={dynamicField.name}
                            name={dynamicField.name}
                            children={(field) => (
                                <FormField label={dynamicField.label} field={field} required={dynamicField?.required}>
                                    {(isErrored) => (
                                        <JSONEditor
                                            isErrored={isErrored}
                                            content={field.state.value as Content}
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
                                    const parsedCurrentValue = parseJsonIfValid(value as Content);

                                    if (
                                        (dynamicField?.required && !parsedCurrentValue) ||
                                        Object.keys(parsedCurrentValue).length === 0
                                    ) {
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
            })}
        </>
    );
};

export default DynamicFormFields;
