import { DragDropProvider, type DragEndEvent } from '@dnd-kit/react';
import isEqual from 'lodash/isEqual';
import { ChevronDownIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { SORTABLE_LIST_SENSORS, VERTICAL_LIST_MODIFIERS } from '@/admin/utils/sortable-list';
import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import type { ParameterSchemaType } from '../../schema';
import type { GetUiConfigFieldError } from '../../validation';
import FieldHelp from '../primitives/field-help';

import {
    DEFAULT_PARAMETER_TYPE,
    EDITABLE_PARAMETER_TYPES,
    type EditableParameterType,
    emptySelectParameter,
    ParameterEntryRow,
    SourceOnlyParameterRow,
} from './parameters';
import { reorderParameters } from './utils/reorder-sortable-list';

type ParameterMap = Record<string, ParameterSchemaType>;

const getParameterTypeConfig = (type: EditableParameterType) =>
    EDITABLE_PARAMETER_TYPES.find((config) => config.value === type);

const createParameterByType = (type: EditableParameterType): ParameterSchemaType => {
    const config = getParameterTypeConfig(type) ?? getParameterTypeConfig(DEFAULT_PARAMETER_TYPE);

    return config?.create() ?? emptySelectParameter();
};

interface Props {
    label?: string;
    description?: string;
    value: ParameterMap | undefined;
    sourceValue?: ParameterMap;
    onChange: (next: ParameterMap | undefined) => void;
    disabled?: boolean;
    errorPathPrefix?: string;
    getError?: GetUiConfigFieldError;
}

const ParametersEditor = ({
    label,
    description,
    value,
    sourceValue,
    onChange,
    disabled,
    errorPathPrefix,
    getError,
}: Props) => {
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

    const entries = Object.entries(value ?? {});
    const sourceOnlyEntries = Object.entries(sourceValue ?? {}).filter(([key]) => !value?.[key]);
    const entryIds = entries.map(([key]) => key);

    const handleToggleExpanded = (key: string) => {
        setExpandedKeys((prev) => {
            const next = new Set(prev);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (disabled) return;

        const next = reorderParameters(value ?? {}, event);

        if (!next) return;

        onChange(next);
    };

    const makeEntryError =
        (key: string) =>
        (suffix?: string): string | undefined => {
            if (!errorPathPrefix || !getError) return undefined;

            const path = suffix ? `${errorPathPrefix}.${key}.${suffix}` : `${errorPathPrefix}.${key}`;

            return getError(path);
        };

    const handleUpdate = (key: string, patch: (prev: ParameterSchemaType) => ParameterSchemaType) => {
        if (disabled) return;

        const prev = value ?? {};

        onChange({ ...prev, [key]: patch(prev[key]) });
    };

    const handleRemove = (key: string) => {
        if (disabled) return;

        const rest = Object.fromEntries(Object.entries(value ?? {}).filter(([k]) => k !== key)) as ParameterMap;

        onChange(Object.keys(rest).length === 0 ? undefined : rest);
    };

    const handleRename = (oldKey: string, newKey: string) => {
        if (disabled) return;

        const prev = value ?? {};
        const { [oldKey]: current, ...rest } = prev;

        onChange({ ...rest, [newKey]: current } as ParameterMap);

        setExpandedKeys((prev) => {
            if (!prev.has(oldKey)) return prev;
            const next = new Set(prev);

            next.delete(oldKey);
            next.add(newKey);

            return next;
        });
    };

    const handleRestoreFromSource = (key: string) => {
        if (disabled) return;

        const sourceParam = sourceValue?.[key];

        if (!sourceParam) return;

        const prev = value ?? {};

        onChange({ ...prev, [key]: { ...sourceParam } });
    };

    const handleChangeType = (key: string, type: EditableParameterType) => {
        if (disabled) return;

        const prev = value ?? {};
        const currentLabel = prev[key]?.label ?? '';
        const nextParam = createParameterByType(type);

        onChange({ ...prev, [key]: { ...nextParam, label: currentLabel } });
    };

    const handleAddSourceEntry = (key: string, param: ParameterSchemaType) => {
        if (disabled) return;

        const prev = value ?? {};

        onChange({ ...prev, [key]: param });
    };

    const addRow = (type: EditableParameterType = DEFAULT_PARAMETER_TYPE) => {
        if (disabled) return;

        const prev = value ?? {};
        let idx = 1;
        let newKey = `param${idx}`;

        while (newKey in prev) {
            idx += 1;
            newKey = `param${idx}`;
        }

        onChange({ ...prev, [newKey]: createParameterByType(type) });
    };

    const renderEntries = () => {
        const visibleSourceOnlyEntries = disabled ? [] : sourceOnlyEntries;

        if (entries.length === 0 && visibleSourceOnlyEntries.length === 0) {
            return <span className="block px-3 py-2 text-xs text-text-secondary">No parameters defined.</span>;
        }

        return (
            <>
                {entries.length > 0 ? (
                    <DragDropProvider
                        modifiers={VERTICAL_LIST_MODIFIERS}
                        sensors={SORTABLE_LIST_SENSORS}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="flex flex-col">
                            {entries.map(([key, param], index) => {
                                const sourceParam = sourceValue?.[key];

                                return (
                                    <ParameterEntryRow
                                        key={key}
                                        paramKey={key}
                                        index={index}
                                        param={param}
                                        isSourceParameter={Boolean(sourceParam)}
                                        hasSourceDiff={Boolean(sourceParam && !isEqual(param, sourceParam))}
                                        allKeys={entryIds}
                                        isExpanded={expandedKeys.has(key)}
                                        disabled={disabled}
                                        getEntryError={makeEntryError(key)}
                                        onToggleExpanded={handleToggleExpanded}
                                        onUpdate={handleUpdate}
                                        onRemove={handleRemove}
                                        onRename={handleRename}
                                        onRestoreFromSource={handleRestoreFromSource}
                                        onChangeType={handleChangeType}
                                    />
                                );
                            })}
                        </div>
                    </DragDropProvider>
                ) : null}
                {visibleSourceOnlyEntries.length > 0 ? (
                    <div className={cn('flex flex-col', entries.length > 0 && 'border-t border-border')}>
                        <div className="flex items-center justify-between gap-3 border-b border-border bg-(--bg-base) px-3 py-1.5">
                            <span className="text-xs font-medium text-text-secondary">Available from model</span>
                            <span className="text-xs text-text-secondary">
                                {visibleSourceOnlyEntries.length} not included
                            </span>
                        </div>
                        {visibleSourceOnlyEntries.map(([key, param]) => (
                            <SourceOnlyParameterRow
                                key={key}
                                paramKey={key}
                                param={param}
                                disabled={disabled}
                                onAdd={handleAddSourceEntry}
                            />
                        ))}
                    </div>
                ) : null}
            </>
        );
    };

    return (
        <div className="flex flex-col gap-2">
            {label || description ? <FieldHelp label={label ?? ''} description={description} /> : null}
            <div className="overflow-hidden rounded-md border border-border bg-(--bg-surface)">
                {renderEntries()}
                {!disabled ? (
                    <div className="flex items-center justify-end gap-3 border-t border-border px-3 py-2">
                        <DropdownMenu
                            align="end"
                            trigger={
                                <Button type="button" variant="outline" size="sm">
                                    <PlusIcon className="mr-1" />
                                    Add parameter
                                    <ChevronDownIcon className="size-3.5" />
                                </Button>
                            }
                            options={EDITABLE_PARAMETER_TYPES.map((config) => ({
                                value: config.value,
                                label: `${config.label} parameter`,
                                onClick: () => addRow(config.value),
                            }))}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default ParametersEditor;
