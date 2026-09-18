import { ChevronRightIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { TextareaRoot } from '@/components/ui/textarea-form';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { cn } from '@/lib/utils';

const jsonContentToString = (content: Content): string => {
    if ('text' in content && typeof content.text === 'string') return content.text;
    if ('json' in content && content.json !== undefined) return JSON.stringify(content.json, null, 2);

    return '';
};

/** Pass text through without reformatting valid JSON — prettifying would replace the document and break CodeMirror selection. */
const stringToJsonContent = (value: string): Content => ({ text: value });

import EnumRowEditor from './enum-row-editor';
import FieldConstraintSections from './field-constraint-sections';
import type { SchemaField, FieldType } from './schema-utils';
import { FIELD_TYPES, createField } from './schema-utils';

const TYPE_OPTIONS = FIELD_TYPES.map((t) => ({
    value: t,
    label: t,
}));

const ARRAY_ENUM_ITEM_TYPES: FieldType[] = ['string', 'number', 'integer'];

interface FieldEditorProps {
    field: SchemaField;
    onChange: (field: SchemaField) => void;
    onDelete: () => void;
    isSchemaLocked?: boolean;
    depth?: number;
}

const getDefaultDefaultValue = (type: FieldType, itemType?: FieldType): string | undefined => {
    switch (type) {
        case 'string':
            return 'default';
        case 'number':
            return '0';
        case 'integer':
            return '0';
        case 'boolean':
            return 'false';
        case 'array': {
            const itemDefaultValue = itemType ? getDefaultDefaultValue(itemType) : undefined;

            return `${itemType ? `[${itemDefaultValue}]` : '[]'}`;
        }
        case 'object':
            return '{"key":"value"}';
    }
};

const FieldEditor = ({ field, onChange, onDelete, isSchemaLocked = false, depth = 0 }: FieldEditorProps) => {
    const [isExpanded, setIsExpanded] = useState(!field.name);

    const update = (patch: Partial<SchemaField>) => {
        onChange({ ...field, ...patch });
    };
    const childProperties = field.properties || [];

    const showNestedObject = field.type === 'object' || (field.type === 'array' && field.itemType === 'object');

    const showEnumAndDefaultGrid =
        field.type === 'string' ||
        field.type === 'number' ||
        field.type === 'integer' ||
        (field.type === 'array' && ARRAY_ENUM_ITEM_TYPES.includes(field.itemType));

    const showMinMax =
        field.type === 'number' ||
        field.type === 'integer' ||
        (field.type === 'array' && (field.itemType === 'number' || field.itemType === 'integer'));

    const readOnlyToggleId = `schema-field-${field.id}-read-only`;

    const typeBadgeLabel = field.type === 'array' ? `array<${field.itemType || 'string'}>` : field.type;

    const renderMinMaxInputs = () => {
        if (!showMinMax) return null;

        const integerItem = field.type === 'array' && field.itemType === 'integer';

        const placeholderMin = field.type === 'integer' || integerItem ? '0' : '0.0';
        const placeholderMax = field.type === 'integer' || integerItem ? '100' : '99.9';

        return (
            <>
                <div className="flex flex-col gap-1">
                    <Label>Minimum</Label>
                    <Input
                        value={field.minText}
                        disabled={isSchemaLocked}
                        onChange={(e) => update({ minText: e.target.value })}
                        placeholder={placeholderMin}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label>Maximum</Label>
                    <Input
                        value={field.maxText}
                        disabled={isSchemaLocked}
                        onChange={(e) => update({ maxText: e.target.value })}
                        placeholder={placeholderMax}
                    />
                </div>
            </>
        );
    };

    return (
        <div className="field-accordion rounded-lg border border-border-secondary">
            <div
                className={cn('field-accordion-header flex items-center gap-2 px-3 py-2', 'cursor-pointer select-none')}
                role="button"
                tabIndex={0}
                onClick={() => setIsExpanded((p) => !p)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsExpanded((p) => !p);
                    }
                }}
            >
                <ChevronRightIcon className={cn('size-4', 'field-accordion-chevron', isExpanded && 'is-expanded')} />
                <span className="flex-1 truncate text-sm font-medium">{field.name || 'Untitled field'}</span>
                <Badge variant="secondary">{typeBadgeLabel}</Badge>
                {field.required && (
                    <Badge
                        variant="outline"
                        className="border-destructive/40 bg-destructive/5 text-xs text-destructive"
                    >
                        required
                    </Badge>
                )}
                {field.readOnly && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                        read only
                    </Badge>
                )}
                {!isSchemaLocked && (
                    <Button
                        variant="destructive"
                        size="icon-xs"
                        type="button"
                        aria-label="Delete field"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        <TrashIcon className="size-4" />
                    </Button>
                )}
            </div>

            {isExpanded && (
                <div className="field-accordion-body flex flex-col gap-3 px-3 py-3">
                    <div className="field-editor-grid grid grid-cols-2 gap-3 max-md:grid-cols-1">
                        <div className="flex flex-col gap-1">
                            <Label>Property name</Label>
                            <Input
                                value={field.name}
                                disabled={isSchemaLocked}
                                onChange={(e) => update({ name: e.target.value })}
                                placeholder="firstName"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label>Title</Label>
                            <Input
                                value={field.title}
                                disabled={isSchemaLocked}
                                onChange={(e) => update({ title: e.target.value })}
                                placeholder="First Name"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label>Type</Label>
                            <Select<FieldType>
                                options={TYPE_OPTIONS}
                                value={field.type}
                                variant="ghost"
                                disabled={isSchemaLocked}
                                onChange={(value) => {
                                    if (!value) return;
                                    update({
                                        type: value,
                                        defaultValue: '',
                                        itemType: value === 'array' ? field.itemType || 'string' : field.itemType,
                                        properties:
                                            value === 'object' || (value === 'array' && field.itemType === 'object')
                                                ? childProperties
                                                : [],
                                    });
                                }}
                            />
                        </div>

                        {field.type === 'array' && (
                            <div className="flex flex-col gap-1">
                                <Label>Array item type</Label>
                                <Select<FieldType>
                                    options={TYPE_OPTIONS}
                                    value={field.itemType || 'string'}
                                    variant="ghost"
                                    disabled={isSchemaLocked}
                                    onChange={(value) => {
                                        if (!value) return;
                                        update({
                                            itemType: value,
                                            properties: value === 'object' ? childProperties : [],
                                        });
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label>Description</Label>
                        <TextareaRoot
                            value={field.description}
                            disabled={isSchemaLocked}
                            onChange={(e) => update({ description: e.target.value })}
                            placeholder="Describe this property"
                            className="max-h-[120px] min-h-[60px]"
                        />
                    </div>

                    <FieldConstraintSections field={field} isSchemaLocked={isSchemaLocked} onPatch={update} />

                    {showEnumAndDefaultGrid && (
                        <EnumRowEditor
                            enumText={field.enumText}
                            enumLabels={field.enumLabels}
                            isSchemaLocked={isSchemaLocked}
                            onChange={update}
                        />
                    )}

                    <div
                        className={cn(
                            showMinMax ? 'field-editor-grid' : 'field-editor-grid-single',
                            'grid grid-cols-2 gap-3 max-md:grid-cols-1',
                        )}
                    >
                        {renderMinMaxInputs()}

                        <div className="flex flex-col gap-1">
                            <Label>Default value</Label>
                            {field.type === 'array' || field.type === 'object' ? (
                                <div className="flex flex-col gap-1">
                                    <JSONEditor
                                        content={stringToJsonContent(field.defaultValue ?? '')}
                                        mode="text"
                                        mainMenuBar={false}
                                        navigationBar={false}
                                        statusBar={false}
                                        readOnly={isSchemaLocked}
                                        onChange={(content: Content) =>
                                            update({ defaultValue: jsonContentToString(content) })
                                        }
                                        className="scrollbar-controller scrollbar-vertical scrollbar-horizontal max-h-[180px] min-h-[80px]"
                                    />
                                    {field.type === 'object' &&
                                        childProperties.length > 0 &&
                                        field.additionalProperties === false && (
                                            <div className="text-xs text-muted-foreground">
                                                Note: The default value must contain only keys that match the nested
                                                properties defined below.
                                            </div>
                                        )}
                                </div>
                            ) : (
                                <Input
                                    value={field.defaultValue}
                                    disabled={isSchemaLocked}
                                    onChange={(e) =>
                                        update({
                                            defaultValue: e.target.value,
                                        })
                                    }
                                    placeholder={getDefaultDefaultValue(field.type, field.itemType)}
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Checkbox
                            id={`schema-field-${field.id}-required`}
                            checked={field.required}
                            disabled={isSchemaLocked}
                            label="Required"
                            onChange={(_, checked) => update({ required: checked })}
                        />
                        {showNestedObject && (
                            <Checkbox
                                id={`schema-field-${field.id}-additional-properties`}
                                checked={field.additionalProperties}
                                disabled={isSchemaLocked}
                                label="Additional properties"
                                onChange={(_, checked) =>
                                    update({
                                        additionalProperties: checked,
                                    })
                                }
                            />
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-0.5">
                            <Label htmlFor={readOnlyToggleId} className="cursor-pointer">
                                Read only
                            </Label>
                            <span className="text-xs text-muted-foreground">
                                Users can see this field but cannot change it.
                            </span>
                        </div>
                        <ToggleSwitch
                            id={readOnlyToggleId}
                            aria-label="Read only"
                            checked={field.readOnly}
                            disabled={isSchemaLocked}
                            onCheckedChange={(checked) => update({ readOnly: checked })}
                        />
                    </div>

                    {showNestedObject && (
                        <div className="nested-fields flex flex-col gap-3 rounded-lg border border-dashed p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium">
                                        {field.type === 'array' ? 'Array item properties' : 'Nested properties'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {field.type === 'array'
                                            ? 'Define object structure inside array items.'
                                            : 'Add fields inside this object.'}
                                    </div>
                                </div>
                                {!isSchemaLocked && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            update({
                                                properties: [...childProperties, createField()],
                                            })
                                        }
                                    >
                                        <PlusIcon className="size-4" />
                                        Add field
                                    </Button>
                                )}
                            </div>

                            <div className="flex flex-col gap-3">
                                {childProperties.map((child) => (
                                    <FieldEditor
                                        key={child.id}
                                        field={child}
                                        depth={depth + 1}
                                        isSchemaLocked={isSchemaLocked}
                                        onChange={(nextChild) =>
                                            update({
                                                properties: childProperties.map((p) =>
                                                    p.id === nextChild.id ? nextChild : p,
                                                ),
                                            })
                                        }
                                        onDelete={() =>
                                            update({
                                                properties: childProperties.filter((p) => p.id !== child.id),
                                            })
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FieldEditor;
