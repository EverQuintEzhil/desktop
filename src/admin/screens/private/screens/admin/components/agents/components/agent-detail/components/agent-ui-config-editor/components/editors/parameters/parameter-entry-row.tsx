import { closestCenter } from '@dnd-kit/collision';
import { useSortable } from '@dnd-kit/react/sortable';
import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon, RotateCcwIcon, TrashIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

import type { ParameterSchemaType } from '../../../schema';
import FieldErrorMessage from '../../primitives/field-error-message';
import FieldHelp from '../../primitives/field-help';
import FormRow from '../../primitives/form-row';

import {
    getParameterControlId,
    getEditableParameterType,
    getParameterTypeLabel,
    renderSummaryMeta,
    type EditableParameterType,
} from './parameter-helpers';
import RangeParameterFields from './range-parameter-fields';
import SelectParameterFields from './select-parameter-fields';
import ToggleParameterFields from './toggle-parameter-fields';
import { DEFAULT_PARAMETER_TYPE, EDITABLE_PARAMETER_TYPES } from './types';

interface ParameterEntryRowProps {
    paramKey: string;
    index: number;
    param: ParameterSchemaType;
    isSourceParameter: boolean;
    hasSourceDiff: boolean;
    allKeys: string[];
    isExpanded: boolean;
    disabled?: boolean;
    getEntryError?: (suffix?: string) => string | undefined;
    onToggleExpanded: (key: string) => void;
    onUpdate: (key: string, patch: (prev: ParameterSchemaType) => ParameterSchemaType) => void;
    onRemove: (key: string) => void;
    onRename: (oldKey: string, newKey: string) => void;
    onRestoreFromSource: (key: string) => void;
    onChangeType: (key: string, type: EditableParameterType) => void;
}

const ParameterEntryRow = ({
    paramKey,
    index,
    param,
    isSourceParameter,
    hasSourceDiff,
    allKeys,
    isExpanded,
    disabled,
    getEntryError,
    onToggleExpanded,
    onUpdate,
    onRemove,
    onRename,
    onRestoreFromSource,
    onChangeType,
}: ParameterEntryRowProps) => {
    const [renameError, setRenameError] = useState<string | undefined>(undefined);
    const [draftKey, setDraftKey] = useState(paramKey);

    const { ref, handleRef, isDragging } = useSortable({
        id: paramKey,
        index,
        disabled,
        collisionDetector: closestCenter,
    });

    useEffect(() => {
        setDraftKey(paramKey);
    }, [paramKey]);

    const handleRenameCommit = (newKey: string) => {
        if (disabled) return;

        const trimmed = newKey.trim();

        if (!trimmed) {
            setRenameError('Parameter key is required.');

            return;
        }

        if (trimmed === paramKey) {
            setRenameError(undefined);
            setDraftKey(paramKey);

            return;
        }

        if (allKeys.filter((k) => k !== paramKey).includes(trimmed)) {
            setRenameError('Parameter key already exists.');

            return;
        }

        setRenameError(undefined);
        onRename(paramKey, trimmed);
    };

    const renderTypeControl = () => {
        if ('component' in param && param.component === 'textbox') {
            return (
                <span className="flex h-8 items-center rounded-md border border-border-secondary bg-(--bg-subtle) px-2 text-sm text-text-secondary">
                    Textbox
                </span>
            );
        }

        const currentType = getEditableParameterType(param) ?? DEFAULT_PARAMETER_TYPE;

        return (
            <Select<EditableParameterType>
                variant="ghost"
                className="w-full rounded-md"
                allowDeselect={false}
                disabled={disabled}
                isErrored={Boolean(getEntryError?.('type'))}
                value={currentType}
                options={EDITABLE_PARAMETER_TYPES.map((c) => ({ value: c.value, label: c.label }))}
                onChange={(nextType) => {
                    if (nextType) onChangeType(paramKey, nextType);
                }}
            />
        );
    };

    const renderTypeFields = () => {
        if ('component' in param && param.component === 'textbox') return null;

        const editableType = getEditableParameterType(param);

        if (editableType === 'select') {
            return (
                <SelectParameterFields
                    paramKey={paramKey}
                    param={param as Extract<ParameterSchemaType, { type: 'select' }>}
                    disabled={disabled}
                    onUpdate={onUpdate}
                />
            );
        }

        if (editableType === 'range') {
            return (
                <RangeParameterFields
                    paramKey={paramKey}
                    param={param as Extract<ParameterSchemaType, { type: 'range' }>}
                    disabled={disabled}
                    onUpdate={onUpdate}
                />
            );
        }

        if (editableType === 'toggle') {
            return (
                <ToggleParameterFields
                    paramKey={paramKey}
                    param={param as Extract<ParameterSchemaType, { type: 'toggle' }>}
                    disabled={disabled}
                    onUpdate={onUpdate}
                />
            );
        }

        return null;
    };

    const renderExpandedFields = () => (
        <div className="-m-3">
            <FormRow label="Identity" sub="Visible name and request key">
                <div className="grid gap-3 @[400px]:grid-cols-2">
                    <div className="min-w-0">
                        <FieldHelp label="Label" required />
                        <Input
                            readOnly={disabled}
                            isErrored={Boolean(getEntryError?.('label'))}
                            value={param.label}
                            placeholder="Visible control name"
                            onChange={(e) => onUpdate(paramKey, (prev) => ({ ...prev, label: e.target.value }))}
                        />
                        <FieldErrorMessage error={getEntryError?.('label')} />
                    </div>
                    <div className="min-w-0">
                        <FieldHelp label="Key" required />
                        <Input
                            readOnly={disabled || isSourceParameter}
                            isErrored={Boolean(renameError ?? getEntryError?.())}
                            value={draftKey}
                            onChange={(e) => {
                                setDraftKey(e.target.value);
                                if (renameError) setRenameError(undefined);
                            }}
                            onBlur={(e) => handleRenameCommit(e.target.value)}
                            onEnter={handleRenameCommit}
                        />
                        <FieldErrorMessage error={renameError ?? getEntryError?.()} />
                    </div>
                </div>
            </FormRow>
            <FormRow label="Presentation" sub="Control type and optional icon">
                <div className="grid gap-3 @[400px]:grid-cols-2">
                    <div className="min-w-0">
                        <FieldHelp label="Type" />
                        {renderTypeControl()}
                        <FieldErrorMessage error={getEntryError?.('type')} />
                    </div>
                    <div className="min-w-0">
                        <FieldHelp label="Icon name" />
                        <Input
                            readOnly={disabled}
                            value={param.icon ?? ''}
                            placeholder="e.g. search or sliders-vertical"
                            onChange={(e) =>
                                onUpdate(paramKey, (prev) => ({ ...prev, icon: e.target.value || undefined }))
                            }
                        />
                    </div>
                </div>
            </FormRow>
            {renderTypeFields()}
        </div>
    );

    const typeLabel = getParameterTypeLabel(param);
    const displayLabel = param.label || 'Untitled parameter';

    return (
        <div
            ref={ref}
            className={cn(
                'border-b border-border bg-(--bg-surface) transition-colors last:border-b-0',
                isDragging && 'opacity-50',
            )}
        >
            <div
                className={cn(
                    'flex items-center gap-2 border-l-2 border-transparent bg-primary/5 px-3 py-2 transition-colors hover:bg-primary/10',
                    isExpanded && 'border-l-primary bg-primary/10',
                )}
            >
                {!disabled ? (
                    <span
                        ref={handleRef}
                        role="button"
                        aria-label="Reorder parameter"
                        className="inline-flex shrink-0 cursor-grab"
                    >
                        <GripVerticalIcon className="size-4 text-text-secondary opacity-40" />
                    </span>
                ) : null}
                <button
                    type="button"
                    aria-expanded={isExpanded}
                    className="min-w-0 flex-1 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus-ring)"
                    onClick={() => onToggleExpanded(paramKey)}
                >
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="min-w-0 truncate text-sm font-medium">{displayLabel}</span>
                        <Badge variant="outline" className="text-xs">
                            {typeLabel}
                        </Badge>
                        <Badge variant="outline" className="bg-(--bg-subtle) text-xs text-text-secondary">
                            {isSourceParameter ? 'Source' : 'Custom'}
                        </Badge>
                    </div>
                    {renderSummaryMeta({ key: paramKey, param })}
                </button>
                <div
                    className="flex shrink-0 items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {isSourceParameter ? (
                        <>
                            {hasSourceDiff ? (
                                <SimpleTooltip content="Restore this parameter to the model-provided value." side="top">
                                    <span className="inline-flex">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            disabled={disabled}
                                            aria-label="Restore from model"
                                            onClick={() => onRestoreFromSource(paramKey)}
                                        >
                                            <RotateCcwIcon className="size-3.5" />
                                        </Button>
                                    </span>
                                </SimpleTooltip>
                            ) : null}
                            <SimpleTooltip content="Show this model parameter in the agent UI." side="top">
                                <span className="inline-flex">
                                    <Checkbox
                                        id={getParameterControlId(paramKey, 'include')}
                                        disabled={disabled}
                                        checked
                                        label="Include"
                                        onChange={(_, checked) => {
                                            if (!checked) onRemove(paramKey);
                                        }}
                                    />
                                </span>
                            </SimpleTooltip>
                        </>
                    ) : (
                        <SimpleTooltip content="Remove this custom parameter." side="top">
                            <span className="inline-flex">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon-sm"
                                    disabled={disabled}
                                    onClick={() => onRemove(paramKey)}
                                    aria-label="Remove parameter"
                                >
                                    <TrashIcon className="size-3.5" />
                                </Button>
                            </span>
                        </SimpleTooltip>
                    )}
                    <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={isExpanded ? 'Collapse parameter' : 'Expand parameter'}
                        onClick={() => onToggleExpanded(paramKey)}
                    >
                        {isExpanded ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
                    </Button>
                </div>
            </div>
            {isExpanded ? <div className="border-t border-border p-3">{renderExpandedFields()}</div> : null}
        </div>
    );
};

export default ParameterEntryRow;
