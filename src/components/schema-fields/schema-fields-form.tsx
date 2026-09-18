import { InfoIcon } from 'lucide-react';

import type { SchemaField } from '@/admin/screens/private/screens/admin/components/parameters-schema/schema-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { TextareaRoot } from '@/components/ui/textarea-form';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { cn } from '@/lib/utils';

import { enumOptions, fieldLabel, isGroup, type FieldValues } from './schema-field-values';

interface Props {
    fields: SchemaField[];
    values: FieldValues;
    errors: Record<string, string>;
    onChange: (key: string, value: string | boolean) => void;
    readOnlyAsText?: boolean;
    readOnlyNote?: string;
    className?: string;
    fieldClassName?: string;
    labelClassName?: string;
    controlClassName?: string;
    descriptionAsTooltip?: boolean;
}

const SchemaFieldsForm = (props: Props) => {
    const {
        fields,
        values,
        errors,
        onChange,
        readOnlyAsText = false,
        readOnlyNote = 'Read only for users',
        className = 'flex flex-col gap-4',
        fieldClassName = '',
        labelClassName = '',
        controlClassName = '',
        descriptionAsTooltip = false,
    } = props;

    const renderReadOnlyValue = (field: SchemaField, key: string) => {
        const raw = values[key];
        const options = enumOptions(field);
        const text = typeof raw === 'string' ? raw : '';
        const label = options.find((option) => option.value === text)?.label;

        if (field.type === 'boolean') {
            return (
                <span className={cn('text-sm leading-6 font-medium text-foreground', controlClassName)}>
                    {raw === true ? 'Yes' : 'No'}
                </span>
            );
        }

        return (
            <span className={cn('text-sm leading-6 font-medium wrap-break-word text-foreground', controlClassName)}>
                {label || text || '—'}
            </span>
        );
    };

    const renderControl = (field: SchemaField, key: string, inputId: string) => {
        const isErrored = !!errors[key];

        if (readOnlyAsText && field.readOnly) return renderReadOnlyValue(field, key);

        if (field.type === 'boolean') {
            return (
                <ToggleSwitch
                    id={inputId}
                    checked={values[key] === true}
                    onCheckedChange={(checked) => onChange(key, checked)}
                />
            );
        }

        const text = typeof values[key] === 'string' ? values[key] : '';
        const options = enumOptions(field);
        const placeholder = fieldLabel(field);

        if (options.length > 0 && field.type !== 'array') {
            return (
                <Select<string>
                    variant="ghost"
                    className={controlClassName}
                    placeholder="Select"
                    allowDeselect
                    isErrored={isErrored}
                    options={options}
                    value={text || null}
                    onChange={(value) => onChange(key, value ?? '')}
                />
            );
        }

        if (field.type === 'array' || field.type === 'object') {
            return (
                <TextareaRoot
                    id={inputId}
                    className={controlClassName}
                    placeholder={placeholder}
                    aria-invalid={isErrored ? 'true' : undefined}
                    value={text}
                    onChange={(event) => onChange(key, event.target.value)}
                />
            );
        }

        return (
            <Input
                id={inputId}
                className={controlClassName}
                type={field.type === 'number' || field.type === 'integer' ? 'number' : 'text'}
                placeholder={placeholder}
                isErrored={isErrored}
                value={text}
                onChange={(event) => onChange(key, event.target.value)}
            />
        );
    };

    const renderField = (field: SchemaField, prefix: string[]) => {
        const path = [...prefix, field.name];
        const key = path.join('.');
        const inputId = `custom-field-${key}`;
        const isText = readOnlyAsText && field.readOnly;
        const label = fieldLabel(field);
        const helper = field.description;
        const error = errors[key];

        return (
            <div key={key} className={cn('flex flex-col gap-2', fieldClassName)}>
                <div className={cn('flex items-center gap-2', labelClassName)}>
                    <Label htmlFor={isText ? undefined : inputId}>
                        <span>
                            {label}
                            {field.required && <span className="text-xs text-destructive">*</span>}
                        </span>
                    </Label>
                    {helper && descriptionAsTooltip && (
                        <SimpleTooltip content={helper}>
                            <span className="inline-flex text-text-secondary" data-testid={`field-description-${key}`}>
                                <InfoIcon className="size-3.5" />
                            </span>
                        </SimpleTooltip>
                    )}
                    {field.readOnly && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                            {readOnlyNote}
                        </span>
                    )}
                </div>
                {renderControl(field, key, inputId)}
                {helper && !error && !descriptionAsTooltip && (
                    <p className="text-[13px] text-muted-foreground">{helper}</p>
                )}
                {error && <p className="text-[11px] font-medium text-destructive">{error}</p>}
            </div>
        );
    };

    const renderFields = (list: SchemaField[], prefix: string[] = []) =>
        list
            .filter((field) => !!field.name)
            .map((field) => {
                if (!isGroup(field)) return renderField(field, prefix);

                const path = [...prefix, field.name];

                return (
                    <div key={path.join('.')} className="flex flex-col gap-3 border-l border-border pl-3">
                        <span className="text-xs font-medium">{fieldLabel(field)}</span>
                        {field.description && <p className="text-[13px] text-muted-foreground">{field.description}</p>}
                        {renderFields(field.properties, path)}
                    </div>
                );
            });

    return <div className={className}>{renderFields(fields)}</div>;
};

export default SchemaFieldsForm;
