import { closestCenter } from '@dnd-kit/collision';
import { DragDropProvider, type DragEndEvent } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { SORTABLE_LIST_SENSORS, VERTICAL_LIST_MODIFIERS } from '@/admin/utils/sortable-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { modelDisplayName, type ModelType } from '@/types/admin';

import {
    agentModelToUiModel,
    copyModelParameters,
    type ModelValueSchemaType,
    type ModelValueShape,
    type ModelsEditorComponentType,
} from '../../schema';
import type { GetUiConfigFieldError } from '../../validation';
import FieldErrorMessage from '../primitives/field-error-message';

import ParametersEditor from './parameters-editor';
import { reorderModels } from './utils/reorder-sortable-list';

const DEFAULT_MAX_IMAGE_UPLOADS = 2;

type SortableElementRef = (element: Element | null) => void;

interface Props {
    componentType: ModelsEditorComponentType;
    agentModels: ModelType[];
    value: ModelValueShape[] | undefined;
    defaultModel?: ModelValueSchemaType;
    onChange: (next: ModelValueShape[] | undefined) => void;
    onDefaultModelChange?: (next: ModelValueSchemaType) => void;
    disabled?: boolean;
    getError: GetUiConfigFieldError;
}

interface SortableModelRowProps {
    id: string;
    index: number;
    disabled?: boolean;
    children: (rowRef: SortableElementRef, gripRef: SortableElementRef, isDragging: boolean) => React.ReactNode;
}

const SortableModelRow = ({ id, index, disabled: isDisabled, children }: SortableModelRowProps) => {
    const { ref, handleRef, isDragging } = useSortable({
        id,
        index,
        disabled: isDisabled,
        collisionDetector: closestCenter,
    });

    return children(ref, handleRef, isDragging);
};

const ModelsListEditor = ({
    componentType,
    agentModels,
    value,
    defaultModel,
    onChange,
    onDefaultModelChange,
    disabled,
    getError,
}: Props) => {
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
    const [maxImageUploadDrafts, setMaxImageUploadDrafts] = useState<Record<string, string>>({});
    const items = value ?? [];
    const agentModelById = new Map(agentModels.map((model) => [model._id, model]));
    const sourceParametersByModelId = useMemo(
        () => new Map(agentModels.map((model) => [model._id, copyModelParameters(model.parameters)])),
        [agentModels],
    );
    const addedModelIds = new Set(items.map((item) => item.modelId));

    const rowKey = (item: ModelValueShape) => item.modelId;

    const toggleExpanded = (key: string) => {
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

    const updateModel = (selectedIndex: number, patch: Partial<ModelValueShape>) => {
        if (disabled) return;

        onChange(items.map((item, i) => (i === selectedIndex ? { ...item, ...patch } : item)));
    };

    const updateModelOptions = (
        selectedIndex: number,
        currentOptions: ModelValueShape['options'],
        patch: Partial<NonNullable<ModelValueShape['options']>>,
    ) => {
        const nextOptions = { ...(currentOptions ?? {}), ...patch };

        if (nextOptions.mask !== true) {
            delete nextOptions.mask;
        }
        if (nextOptions.frames !== true) {
            delete nextOptions.frames;
        }
        if (nextOptions.maxImageUploads == null) {
            delete nextOptions.maxImageUploads;
        }

        updateModel(selectedIndex, {
            options: Object.keys(nextOptions).length > 0 ? nextOptions : undefined,
        });
    };

    const updateMaxImageUploadDraft = (key: string, nextValue: string | undefined) => {
        setMaxImageUploadDrafts((prev) => {
            const next = { ...prev };

            if (nextValue === undefined) {
                delete next[key];
            } else {
                next[key] = nextValue;
            }

            return next;
        });
    };

    const removeModel = (selectedIndex: number) => {
        if (disabled) return;

        const next = items.filter((_, i) => i !== selectedIndex);

        onChange(next.length > 0 ? next : undefined);
    };

    const setDefault = (item: ModelValueShape) => {
        if (disabled) return;

        onDefaultModelChange?.({ modelId: item.modelId, name: item.name });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (disabled) return;

        const next = reorderModels(items, event);

        if (!next) return;

        onChange(next);
    };

    const renderExpanded = (item: ModelValueShape, index: number) => {
        const sourceParameters = sourceParametersByModelId.get(item.modelId);
        const agentModel = agentModelById.get(item.modelId);
        const nameError = getError(`models.${index}.name`);
        const key = rowKey(item);
        const maxImageUploads = item.options?.maxImageUploads ?? DEFAULT_MAX_IMAGE_UPLOADS;
        const maxImageUploadsDraft = maxImageUploadDrafts[key];
        const maxImageUploadsValue = maxImageUploadsDraft ?? String(maxImageUploads);

        const commitMaxImageUploads = (rawValue: string) => {
            const parsedValue = Number(rawValue);
            const nextValue = Number.isFinite(parsedValue)
                ? Math.max(1, Math.floor(parsedValue))
                : DEFAULT_MAX_IMAGE_UPLOADS;

            updateMaxImageUploadDraft(key, undefined);
            updateModelOptions(index, item.options, { maxImageUploads: nextValue });
        };

        return (
            <div className="flex flex-col gap-3 border-t border-border bg-(--bg-base) px-3 py-3">
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-text-secondary">
                            {'Display name '}
                            <span className="text-(--danger)">*</span>
                        </div>
                        <Input
                            readOnly={disabled}
                            isErrored={Boolean(nameError)}
                            value={item.name}
                            placeholder={agentModel?.model ?? item.modelId}
                            onChange={(e) => updateModel(index, { name: e.target.value })}
                        />
                        <FieldErrorMessage error={nameError} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-text-secondary">Model ID (read-only)</div>
                        <Input readOnly value={item.modelId} className="font-mono text-xs" />
                    </div>
                </div>
                {componentType === 'gallery' ? (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-3">
                            <Checkbox
                                disabled={disabled}
                                checked={item.options?.mask ?? false}
                                label="Supports mask input"
                                onChange={(_, checked) =>
                                    updateModelOptions(index, item.options, { mask: checked ? true : undefined })
                                }
                            />
                            <Checkbox
                                disabled={disabled}
                                checked={item.options?.frames ?? false}
                                label="Supports first/last frame"
                                onChange={(_, checked) =>
                                    updateModelOptions(index, item.options, { frames: checked ? true : undefined })
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-xs font-medium text-text-secondary">Maximum upload images</div>
                            <Input
                                readOnly={disabled}
                                type="number"
                                min={1}
                                step={1}
                                value={maxImageUploadsValue}
                                onChange={(e) => {
                                    const rawValue = e.target.value.trim();

                                    updateMaxImageUploadDraft(key, rawValue);

                                    if (!rawValue) {
                                        return;
                                    }

                                    const parsedValue = Number(rawValue);

                                    updateModelOptions(index, item.options, {
                                        maxImageUploads: Number.isFinite(parsedValue)
                                            ? Math.max(1, Math.floor(parsedValue))
                                            : undefined,
                                    });
                                }}
                                onBlur={(e) => commitMaxImageUploads(e.target.value.trim())}
                            />
                        </div>
                    </div>
                ) : null}
                <ParametersEditor
                    description="Override model-level parameters for this entry."
                    disabled={disabled}
                    value={item.parameters}
                    sourceValue={sourceParameters}
                    errorPathPrefix={`models.${index}.parameters`}
                    getError={getError}
                    onChange={(next) => updateModel(index, { parameters: next })}
                />
            </div>
        );
    };

    const renderRow = (item: ModelValueShape, index: number) => {
        const agentModel = agentModelById.get(item.modelId);
        const key = rowKey(item);
        const isExpanded = expandedKeys.has(key);
        const isDefault =
            Boolean(defaultModel?.modelId) &&
            defaultModel?.modelId === item.modelId &&
            defaultModel?.name === item.name;
        const paramCount = Object.keys(item.parameters ?? {}).length;
        const displayName = item.name || modelDisplayName(agentModel) || item.modelId;

        return (
            <SortableModelRow key={key} id={item.modelId} index={index} disabled={disabled}>
                {(rowRef, gripRef, isDragging) => (
                    <div
                        ref={rowRef}
                        className={cn(
                            'border-b border-border transition-colors last:border-b-0',
                            isDragging && 'opacity-50',
                        )}
                    >
                        <div className="flex items-center gap-1 px-3 py-2">
                            {!disabled ? (
                                <span
                                    ref={gripRef}
                                    role="button"
                                    aria-label={`Reorder ${displayName}`}
                                    className="inline-flex shrink-0 cursor-grab"
                                >
                                    <GripVerticalIcon className="size-4 text-text-secondary opacity-40" />
                                </span>
                            ) : null}
                            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleExpanded(key)}>
                                <div className="flex items-center gap-1.5">
                                    <span className="truncate text-sm font-medium">{displayName}</span>
                                    {isDefault ? (
                                        <Badge
                                            variant="outline"
                                            className="shrink-0 border-primary/40 bg-primary/5 text-xs font-semibold tracking-wide text-primary uppercase"
                                        >
                                            DEFAULT
                                        </Badge>
                                    ) : null}
                                    {item.options?.mask ? (
                                        <Badge variant="outline" className="shrink-0 text-xs">
                                            mask
                                        </Badge>
                                    ) : null}
                                    {item.options?.frames ? (
                                        <Badge variant="outline" className="shrink-0 text-xs">
                                            frames
                                        </Badge>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-text-secondary">
                                    {agentModel?.provider ? (
                                        <>
                                            <span>{agentModel.provider}</span>
                                            <span>·</span>
                                        </>
                                    ) : null}
                                    <span className="max-w-[160px] truncate rounded bg-(--bg-subtle) px-1.5 py-0.5 font-mono text-[11px]">
                                        {item.modelId}
                                    </span>
                                    {paramCount > 0 ? (
                                        <>
                                            <span>·</span>
                                            <span>{paramCount} params</span>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                                {onDefaultModelChange ? (
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        aria-label="Set as default model"
                                        disabled={disabled || isDefault}
                                        onClick={() => setDefault(item)}
                                        className={cn(isDefault && 'text-amber-500')}
                                    >
                                        <StarIcon className="size-3.5" fill={isDefault ? 'currentColor' : 'none'} />
                                    </Button>
                                ) : null}
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label={`Remove ${displayName}`}
                                    disabled={disabled}
                                    onClick={() => removeModel(index)}
                                >
                                    <Trash2Icon className="size-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                    onClick={() => toggleExpanded(key)}
                                >
                                    {isExpanded ? (
                                        <ChevronUpIcon className="size-3.5" />
                                    ) : (
                                        <ChevronDownIcon className="size-3.5" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        {isExpanded ? renderExpanded(item, index) : null}
                    </div>
                )}
            </SortableModelRow>
        );
    };

    const handleAddModel = (modelId: string | null) => {
        if (disabled) return;
        if (!modelId) return;
        if (addedModelIds.has(modelId)) return;

        const model = agentModelById.get(modelId);

        if (!model) return;

        onChange([...items, agentModelToUiModel(model)]);
    };

    const renderAddModelSelect = () => {
        if (disabled) return null;

        const availableToAdd = agentModels.filter((m) => !addedModelIds.has(m._id));
        const isAddDisabled = agentModels.length === 0;
        let placeholder = 'Select from capabilities…';

        if (agentModels.length === 0) {
            placeholder = 'No capability models assigned';
        } else if (availableToAdd.length === 0) {
            placeholder = 'All capability models added';
        }

        return (
            <div className="flex items-center gap-2 border-t border-border px-3 py-1.5">
                <PlusIcon className="size-3.5 shrink-0 text-text-secondary" />
                <span className="shrink-0 text-sm text-text-secondary">Add model</span>
                <Select<string>
                    variant="ghost"
                    className="min-w-0 flex-1 rounded-md"
                    placeholder={placeholder}
                    searchPlaceholder="Search capability models..."
                    emptyText="No capability models available."
                    allowSearch
                    disabled={isAddDisabled || availableToAdd.length === 0}
                    value={null}
                    options={availableToAdd.map((model) => ({
                        value: model._id,
                        label: `${modelDisplayName(model)} (${model.provider})`,
                    }))}
                    onChange={handleAddModel}
                />
            </div>
        );
    };

    if (agentModels.length === 0 && items.length === 0) {
        return (
            <span className="block px-3 py-2 text-xs text-text-secondary">
                No agent models assigned, please add models in the agent capabilities section.
            </span>
        );
    }

    return (
        <div className="overflow-hidden bg-(--bg-surface)">
            {items.length === 0 ? (
                <span className="block px-3 py-2 text-xs text-text-secondary">No models selected.</span>
            ) : (
                <DragDropProvider
                    modifiers={VERTICAL_LIST_MODIFIERS}
                    sensors={SORTABLE_LIST_SENSORS}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex flex-col">{items.map(renderRow)}</div>
                </DragDropProvider>
            )}
            {renderAddModelSelect()}
        </div>
    );
};

export default ModelsListEditor;
