import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';

import { INPUT_TYPES } from '../../schema';
import type { FieldSpecSchemaType } from '../../schema';
import type { GetUiConfigFieldError } from '../../validation';
import FieldErrorMessage from '../primitives/field-error-message';
import FieldHelp from '../primitives/field-help';

import FileTypeSelector from './file-type-selector';
import StringListEditor from './string-list-editor';

const INPUT_TYPE_OPTIONS = INPUT_TYPES.map((v) => ({ value: v, label: v }));

const NEEDS_VALUES = new Set(['select', 'multiselect', 'radio', 'checkbox']);

interface Props {
    value: FieldSpecSchemaType[];
    onChange: (next: FieldSpecSchemaType[]) => void;
    disabled?: boolean;
    getError: GetUiConfigFieldError;
}

const emptyField = (): FieldSpecSchemaType => ({
    name: '',
    label: '',
    inputType: 'text',
    values: [],
});

const FormSpecBuilder = ({ value, onChange, disabled, getError }: Props) => {
    const items = value ?? [];

    const updateAt = (index: number, patch: Partial<FieldSpecSchemaType>) => {
        if (disabled) return;

        const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));

        onChange(next);
    };

    const moveAt = (index: number, direction: -1 | 1) => {
        if (disabled) return;

        const target = index + direction;

        if (target < 0 || target >= items.length) return;
        const next = [...items];

        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const removeAt = (index: number) => {
        if (disabled) return;

        onChange(items.filter((_, i) => i !== index));
    };

    const addRow = () => {
        if (disabled) return;

        onChange([...items, emptyField()]);
    };

    const renderValuesField = (field: FieldSpecSchemaType, index: number) => {
        if (!NEEDS_VALUES.has(field.inputType)) return null;

        return (
            <div className="flex flex-col gap-1">
                <FieldHelp label="Allowed values" description="Values shown to the user for this field." />
                <StringListEditor
                    disabled={disabled}
                    value={field.values}
                    onChange={(values) => updateAt(index, { values })}
                />
            </div>
        );
    };

    const renderAcceptField = (field: FieldSpecSchemaType, index: number) => {
        if (field.inputType !== 'filesupload') return null;

        return (
            <div className="flex flex-col gap-1">
                <FieldHelp label="Accepted file types" />
                <FileTypeSelector
                    disabled={disabled}
                    value={field.accept}
                    onChange={(next) => updateAt(index, { accept: next })}
                />
            </div>
        );
    };

    const renderMultipleField = (field: FieldSpecSchemaType, index: number) => {
        if (field.inputType !== 'filesupload') return null;

        return (
            <Checkbox
                id={`form-spec-${index}-multiple`}
                disabled={disabled}
                label="Allow multiple files"
                checked={field.multiple ?? false}
                onChange={(_, checked) => updateAt(index, { multiple: checked })}
            />
        );
    };

    const renderRow = (field: FieldSpecSchemaType, index: number) => (
        <div key={index} className="flex flex-col gap-3 rounded-md border bg-(--bg-base) p-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Field #{index + 1}</span>
                <div className="flex gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled || index === 0}
                        onClick={() => moveAt(index, -1)}
                        aria-label="Move up"
                    >
                        <ArrowUpIcon />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled || index === items.length - 1}
                        onClick={() => moveAt(index, 1)}
                        aria-label="Move down"
                    >
                        <ArrowDownIcon />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        onClick={() => removeAt(index)}
                        aria-label="Remove field"
                    >
                        <TrashIcon />
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                    <FieldHelp label="Name (key)" required />
                    <Input
                        readOnly={disabled}
                        isErrored={Boolean(getError(`formSpec.${index}.name`))}
                        value={field.name}
                        onChange={(e) => updateAt(index, { name: e.target.value })}
                    />
                    <FieldErrorMessage error={getError(`formSpec.${index}.name`)} />
                </div>
                <div className="flex flex-col gap-1">
                    <FieldHelp label="Label" required />
                    <Input
                        readOnly={disabled}
                        isErrored={Boolean(getError(`formSpec.${index}.label`))}
                        value={field.label}
                        onChange={(e) => updateAt(index, { label: e.target.value })}
                    />
                    <FieldErrorMessage error={getError(`formSpec.${index}.label`)} />
                </div>
                <div className="flex flex-col gap-1">
                    <FieldHelp label="Input type" required />
                    <Select<(typeof INPUT_TYPES)[number]>
                        variant="outline"
                        allowDeselect={false}
                        disabled={disabled}
                        isErrored={Boolean(getError(`formSpec.${index}.inputType`))}
                        value={field.inputType}
                        options={INPUT_TYPE_OPTIONS}
                        onChange={(v) => {
                            if (v) updateAt(index, { inputType: v });
                        }}
                    />
                    <FieldErrorMessage error={getError(`formSpec.${index}.inputType`)} />
                </div>
            </div>
            {renderValuesField(field, index)}
            {renderAcceptField(field, index)}
            <div className="flex items-center gap-4">
                <Checkbox
                    id={`form-spec-${index}-required`}
                    disabled={disabled}
                    label="Required"
                    checked={field.required ?? false}
                    onChange={(_, checked) => updateAt(index, { required: checked })}
                />
                {renderMultipleField(field, index)}
            </div>
        </div>
    );

    const renderRows = () => {
        if (items.length === 0) {
            return (
                <span className="text-xs text-text-secondary">
                    {disabled ? 'No form fields.' : 'No form fields. Click "Add field" to start building.'}
                </span>
            );
        }

        return items.map(renderRow);
    };

    return (
        <div className="flex flex-col gap-2">
            {renderRows()}
            {!disabled ? (
                <Button type="button" variant="outline" size="sm" onClick={addRow} className="self-start">
                    <PlusIcon className="mr-1" /> Add field
                </Button>
            ) : null}
        </div>
    );
};

export default FormSpecBuilder;
