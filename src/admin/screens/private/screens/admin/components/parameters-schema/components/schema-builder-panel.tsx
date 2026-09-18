import { BracesIcon, LayersIcon, PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Spinner from '@/components/ui/spinner';

import FieldEditor from '../field-editor';
import type { SchemaField } from '../schema-utils';

export interface SchemaBuilderPanelProps {
    canUserEdit: boolean;
    fields: SchemaField[];
    rootAdditionalProps: boolean;
    isSaving?: boolean;
    onShowJson?: () => void;
    onSave?: () => void;
    onAddField: () => void;
    onFieldChange: (field: SchemaField) => void;
    onFieldDelete: (fieldId: string) => void;
    onRootAdditionalPropsChange: (value: string | number | readonly string[] | undefined, checked: boolean) => void;
}

const renderEmptyState = (canUserEdit: boolean, onAddField: () => void) => (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <LayersIcon className="size-6 text-primary" />
        </div>
        <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">No properties defined yet</span>
            <span className="text-xs text-text-secondary">Add a field to start building your schema.</span>
        </div>
        {canUserEdit && (
            <Button size="sm" variant="outline" onClick={onAddField}>
                <PlusIcon className="size-3.5" />
                Add first field
            </Button>
        )}
    </div>
);

/** The left-hand "Properties" pane of the schema builder tab: header actions, the root
 * additional-properties toggle, the empty state, and the list of field editors. */
const SchemaBuilderPanel = ({
    canUserEdit,
    fields,
    rootAdditionalProps,
    isSaving,
    onShowJson,
    onSave,
    onAddField,
    onFieldChange,
    onFieldDelete,
    onRootAdditionalPropsChange,
}: SchemaBuilderPanelProps) => (
    <div className="schema-builder flex flex-col gap-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">Properties</span>
                <span className="text-xs text-text-secondary">Build the schema structure visually.</span>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
                {onShowJson && (
                    <Button size="xs" variant="outline" className="lg:hidden" onClick={onShowJson}>
                        <BracesIcon className="size-3.5" />
                        Show JSON
                    </Button>
                )}
                {canUserEdit && (
                    <Button size="xs" variant="outline" onClick={onAddField}>
                        <PlusIcon className="size-3.5" />
                        Add field
                    </Button>
                )}
                {canUserEdit && onSave && (
                    <Button size="xs" onClick={onSave} disabled={isSaving}>
                        {isSaving ? <Spinner className="scale-75" /> : null}
                        {isSaving ? 'Saving…' : 'Save'}
                    </Button>
                )}
            </div>
        </div>

        <Checkbox
            id="parameters-schema-root-additional-properties"
            checked={rootAdditionalProps}
            disabled={!canUserEdit}
            label="Additional properties"
            onChange={onRootAdditionalPropsChange}
        />

        {fields.length === 0 ? renderEmptyState(canUserEdit, onAddField) : null}

        <div className="mt-3 flex flex-col gap-3">
            {fields.map((field) => (
                <FieldEditor
                    key={field.id}
                    field={field}
                    isSchemaLocked={!canUserEdit}
                    onChange={onFieldChange}
                    onDelete={() => onFieldDelete(field.id)}
                />
            ))}
        </div>
    </div>
);

export default SchemaBuilderPanel;
