import { PlusIcon, StarIcon, TrashIcon } from 'lucide-react';
import { type KeyboardEvent, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { ParameterSchemaType } from '../../../schema';
import FormRow from '../../primitives/form-row';

type SelectParam = Extract<ParameterSchemaType, { type: 'select' }>;
type SelectOption = SelectParam['options'][number];

interface OptionRowProps {
    option: SelectOption;
    idx: number;
    isDefault: boolean;
    disabled?: boolean;
    onChangeValue: (idx: number, nextValue: string) => void;
    onChangeLabel: (idx: number, nextLabel: string) => void;
    onSetDefault: (option: SelectOption) => void;
    onRemove: (idx: number) => void;
}

const OptionRow = ({
    option,
    idx,
    isDefault,
    disabled,
    onChangeValue,
    onChangeLabel,
    onSetDefault,
    onRemove,
}: OptionRowProps) => {
    const [value, setValue] = useState(String(option.value));
    const [label, setLabel] = useState(option.label);

    useEffect(() => {
        setValue(String(option.value));
    }, [option.value]);

    useEffect(() => {
        setLabel(option.label);
    }, [option.label]);

    return (
        <div className="grid items-center gap-2 bg-(--bg-surface) px-2 py-1.5 @[400px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px_32px]">
            <Input
                readOnly={disabled}
                aria-label={`Option ${idx + 1} value`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => onChangeValue(idx, value)}
            />
            <Input
                readOnly={disabled}
                aria-label={`Option ${idx + 1} label`}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={() => onChangeLabel(idx, label)}
            />
            <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={isDefault ? 'Default option' : 'Set as default'}
                disabled={disabled || isDefault}
                onClick={() => onSetDefault(option)}
                className={cn(isDefault && 'text-amber-500')}
            >
                <StarIcon className="size-3.5" fill={isDefault ? 'currentColor' : 'none'} />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                aria-label={`Remove option ${option.value}`}
                onClick={() => onRemove(idx)}
            >
                <TrashIcon />
            </Button>
        </div>
    );
};

interface Props {
    paramKey: string;
    param: SelectParam;
    disabled?: boolean;
    onUpdate: (key: string, patch: (prev: ParameterSchemaType) => ParameterSchemaType) => void;
}

const SelectParameterFields = ({ paramKey, param, disabled, onUpdate }: Props) => {
    const [optionDraft, setOptionDraft] = useState('');

    const setSelectDefault = (optionToSet: SelectOption) => {
        onUpdate(paramKey, (prev) => ({
            ...(prev as SelectParam),
            default: {
                value: optionToSet.value,
                label: optionToSet.label,
            },
        }));
    };

    const updateSelectOptions = (nextOptions: SelectOption[], nextDefault?: string | number) => {
        const defaultValue = nextDefault ?? param.default.value;
        const matchedDefault = nextOptions.find((option) => option.value === defaultValue);
        const fallbackDefault = nextOptions[0]
            ? {
                  value: nextOptions[0].value,
                  label: nextOptions[0].label,
              }
            : { value: '', label: '' };

        onUpdate(paramKey, (prev) => ({
            ...(prev as SelectParam),
            options: nextOptions,
            default: matchedDefault
                ? {
                      value: matchedDefault.value,
                      label: matchedDefault.label,
                  }
                : fallbackDefault,
        }));
    };

    const addOption = () => {
        if (disabled) return;

        const draft = optionDraft.trim();

        if (!draft) return;

        if (param.options.some((option) => String(option.value) === draft)) {
            setOptionDraft('');

            return;
        }

        updateSelectOptions(
            [
                ...param.options,
                {
                    value: draft,
                    label: draft,
                },
            ],
            param.options.length === 0 ? draft : undefined,
        );
        setOptionDraft('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            addOption();
        }
    };

    const handleChangeValue = (idx: number, nextValue: string) => {
        const isDefault = param.options[idx]?.value === param.default.value;
        const nextOptions = param.options.map((cur, i) => (i === idx ? { ...cur, value: nextValue } : cur));

        updateSelectOptions(nextOptions, isDefault ? nextValue : undefined);
    };

    const handleChangeLabel = (idx: number, nextLabel: string) => {
        const isDefault = param.options[idx]?.value === param.default.value;
        const nextOptions = param.options.map((cur, i) => (i === idx ? { ...cur, label: nextLabel } : cur));

        updateSelectOptions(nextOptions, isDefault ? param.options[idx]?.value : undefined);
    };

    return (
        <>
            <FormRow label="Options" sub="Values users can choose from" wide>
                <div className="flex min-w-0 flex-col gap-2">
                    {!disabled ? (
                        <div className="flex gap-2">
                            <Input
                                value={optionDraft}
                                placeholder="Add option value"
                                onChange={(e) => setOptionDraft(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                    !optionDraft.trim() ||
                                    param.options.some((option) => String(option.value) === optionDraft.trim())
                                }
                                onClick={addOption}
                            >
                                <PlusIcon className="mr-1" />
                                Add
                            </Button>
                        </div>
                    ) : null}
                    <div className="overflow-hidden rounded-md border border-border">
                        {param.options.length > 0 ? (
                            <div className="flex flex-col divide-y divide-border">
                                <div className="grid gap-2 bg-(--bg-subtle) px-2 py-1.5 text-xs font-medium text-text-secondary @[400px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px_32px]">
                                    <span>Value</span>
                                    <span>Label</span>
                                    <span aria-hidden="true" />
                                    <span aria-hidden="true" />
                                </div>
                                {param.options.map((option, idx) => (
                                    <OptionRow
                                        key={`${option.value}-${idx}`}
                                        option={option}
                                        idx={idx}
                                        isDefault={option.value === param.default.value}
                                        disabled={disabled}
                                        onChangeValue={handleChangeValue}
                                        onChangeLabel={handleChangeLabel}
                                        onSetDefault={setSelectDefault}
                                        onRemove={(i) => updateSelectOptions(param.options.filter((_, j) => j !== i))}
                                    />
                                ))}
                            </div>
                        ) : (
                            <span className="block bg-(--bg-surface) px-2 py-2 text-xs text-text-secondary">
                                No options yet.
                            </span>
                        )}
                    </div>
                </div>
            </FormRow>
            <FormRow label="Default option" sub="The option selected by default">
                <Select<string | number>
                    variant="ghost"
                    className="w-full rounded-md"
                    allowDeselect={false}
                    disabled={disabled || param.options.length === 0}
                    value={param.default.value ?? null}
                    options={param.options}
                    onChange={(v) => {
                        if (v === null) return;

                        const option = param.options.find((cur) => cur.value === v);

                        if (!option) return;

                        setSelectDefault(option);
                    }}
                />
            </FormRow>
            <FormRow label="Apply by default" sub="Show this parameter by default before the user adds it">
                <div className="flex h-8 items-center">
                    <Checkbox
                        id={`parameter-${paramKey.replace(/[^a-zA-Z0-9_-]/g, '-')}-select-preselect-default`}
                        disabled={disabled}
                        checked={param.showDefault ?? false}
                        label="Apply by default"
                        onChange={(_, checked) =>
                            onUpdate(paramKey, (prev) => ({
                                ...prev,
                                showDefault: checked || undefined,
                            }))
                        }
                    />
                </div>
            </FormRow>
        </>
    );
};

export default SelectParameterFields;
