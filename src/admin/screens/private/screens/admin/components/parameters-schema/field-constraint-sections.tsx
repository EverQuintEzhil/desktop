import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { SchemaField } from './schema-utils';

const FORMAT_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'None' },
    { value: 'email', label: 'email' },
    { value: 'uri', label: 'uri' },
];

type FieldConstraintSectionsProps = {
    field: SchemaField;
    isSchemaLocked: boolean;
    onPatch: (patch: Partial<SchemaField>) => void;
};

const FieldConstraintSections = ({ field, isSchemaLocked, onPatch }: FieldConstraintSectionsProps) => {
    const showString = field.type === 'string';
    const showNumericExtras =
        field.type === 'number' ||
        field.type === 'integer' ||
        (field.type === 'array' && (field.itemType === 'number' || field.itemType === 'integer'));
    const showArray = field.type === 'array';
    const showObject = field.type === 'object';

    const renderStringSection = () => {
        if (!showString) return null;

        const formatSelectValue = field.formatText === 'email' || field.formatText === 'uri' ? field.formatText : '';

        const renderFormatLegacyNote = () => {
            const ft = field.formatText;

            if (!ft || ft === 'email' || ft === 'uri') {
                return null;
            }

            const legacyMsg = `Format in schema is "${ft}". Choose email or uri to replace it.`;

            return <div className="col-span-2 text-xs text-muted-foreground max-md:col-span-1">{legacyMsg}</div>;
        };

        return (
            <div className={cn('rounded-md border border-border-secondary p-3', 'flex flex-col gap-3')}>
                <div className="text-xs font-medium text-muted-foreground">String constraints</div>
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                    <div className="flex flex-col gap-1">
                        <Label>Min length</Label>
                        <Input
                            value={field.minLengthText}
                            disabled={isSchemaLocked}
                            onChange={(e) => onPatch({ minLengthText: e.target.value })}
                            placeholder="0"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label>Max length</Label>
                        <Input
                            value={field.maxLengthText}
                            disabled={isSchemaLocked}
                            onChange={(e) => onPatch({ maxLengthText: e.target.value })}
                            placeholder="255"
                        />
                    </div>
                    <div className="col-span-2 flex flex-col gap-1 max-md:col-span-1">
                        <Label>Pattern (regex)</Label>
                        <Input
                            value={field.patternText}
                            disabled={isSchemaLocked}
                            onChange={(e) => onPatch({ patternText: e.target.value })}
                            placeholder="^[a-z]+$"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label>Format</Label>
                        <Select<string>
                            options={FORMAT_OPTIONS}
                            value={formatSelectValue}
                            variant="ghost"
                            disabled={isSchemaLocked}
                            onChange={(v) => {
                                onPatch({ formatText: v ?? '' });
                            }}
                        />
                    </div>
                    {renderFormatLegacyNote()}
                </div>
            </div>
        );
    };

    const renderNumericExtrasSection = () => {
        if (!showNumericExtras) return null;

        const integerItem = field.type === 'array' && field.itemType === 'integer';

        const phMult = field.type === 'integer' || integerItem ? '2' : '0.5';

        return (
            <div className={cn('rounded-md border border-border-secondary p-3', 'flex flex-col gap-3')}>
                <div className="text-xs font-medium text-muted-foreground">
                    {field.type === 'array' ? 'Numeric item constraints' : 'Number constraints'}
                </div>
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                    <div className="col-span-2 flex flex-col gap-1 max-md:col-span-1">
                        <Label>Multiple of</Label>
                        <Input
                            value={field.multipleOfText}
                            disabled={isSchemaLocked}
                            onChange={(e) => onPatch({ multipleOfText: e.target.value })}
                            placeholder={phMult}
                        />
                    </div>
                </div>
            </div>
        );
    };

    const renderArraySection = () => {
        if (!showArray) return null;

        return (
            <div className={cn('rounded-md border border-border-secondary p-3', 'flex flex-col gap-3')}>
                <div className="text-xs font-medium text-muted-foreground">Array constraints</div>
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                    <div className="flex flex-col gap-1">
                        <Label>Min items</Label>
                        <Input
                            value={field.minItemsText}
                            disabled={isSchemaLocked}
                            onChange={(e) => onPatch({ minItemsText: e.target.value })}
                            placeholder="0"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label>Max items</Label>
                        <Input
                            value={field.maxItemsText}
                            disabled={isSchemaLocked}
                            onChange={(e) => onPatch({ maxItemsText: e.target.value })}
                            placeholder="10"
                        />
                    </div>
                </div>
                <Checkbox
                    id={`schema-field-${field.id}-unique-items`}
                    checked={field.uniqueItems}
                    disabled={isSchemaLocked}
                    label="Unique items"
                    onChange={(_, checked) => onPatch({ uniqueItems: checked })}
                />
            </div>
        );
    };

    const renderObjectSection = () => {
        if (!showObject) return null;

        return (
            <div className={cn('rounded-md border border-border-secondary p-3', 'flex flex-col gap-3')}>
                <div className="text-xs font-medium text-muted-foreground">Object constraints</div>
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                    <div className="flex flex-col gap-1">
                        <Label>Min properties</Label>
                        <Input
                            value={field.minPropertiesText}
                            disabled={isSchemaLocked}
                            onChange={(e) => onPatch({ minPropertiesText: e.target.value })}
                            placeholder="0"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label>Max properties</Label>
                        <Input
                            value={field.maxPropertiesText}
                            disabled={isSchemaLocked}
                            onChange={(e) => onPatch({ maxPropertiesText: e.target.value })}
                            placeholder="20"
                        />
                    </div>
                </div>
            </div>
        );
    };

    const hasAnySection = showString || showNumericExtras || showArray || showObject;

    if (!hasAnySection) return null;

    return (
        <div className="field-constraint-sections flex flex-col gap-3">
            {renderStringSection()}
            {renderNumericExtrasSection()}
            {renderArraySection()}
            {renderObjectSection()}
        </div>
    );
};

export default FieldConstraintSections;
