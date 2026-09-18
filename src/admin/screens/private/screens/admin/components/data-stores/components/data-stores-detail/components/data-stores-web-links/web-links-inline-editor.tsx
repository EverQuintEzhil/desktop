import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import SpinnerBlade from '@/components/ui/spinner';
import type { WeblinkSpec } from '@/lib/api/admin/data-stores';

import WeblinkRowEditor from '../../../wizard-pages/configure-weblinks-step/weblink-row-editor';
import {
    buildWeblinksAuthPayload,
    createEmptyWeblinkRow,
    toWeblinkRow,
    toWeblinkSpec,
    validateWeblinkRows,
    type WeblinkAuthSecretEntry,
    type WeblinkFormRow,
} from '../../../wizard-pages/configure-weblinks-step/weblinks-validation';

interface Props {
    initialLinks: WeblinkSpec[];
    isSaving: boolean;
    /** Entered via "Add link": seeds a blank row at the end, expanded and ready to type into. */
    startWithNewRow?: boolean;
    onCancel: () => void;
    onSave: (
        links: WeblinkSpec[],
        authPayload: { auth: Record<string, WeblinkAuthSecretEntry> } | null,
    ) => Promise<void>;
}

/**
 * Inline (in-page) editor for a weblinks data store's links. Mounted only while edit mode is on, so
 * `rows` seeds itself from the saved links on entry and nothing has to sync back out on exit.
 */
export const WebLinksInlineEditor = ({ initialLinks, isSaving, startWithNewRow, onCancel, onSave }: Props) => {
    // Frozen at mount, not memoized: rebuilding mints fresh row ids, which would flip `isDirty` on any
    // background refetch. Doubles as the dirty baseline, so an untouched "Add link" row isn't a change.
    const [seed] = useState(() => {
        const existingRows = initialLinks.map(toWeblinkRow);
        const needsBlankRow = startWithNewRow || existingRows.length === 0;
        const rows: WeblinkFormRow[] = needsBlankRow ? [...existingRows, createEmptyWeblinkRow()] : existingRows;

        return { rows, expandedIds: needsBlankRow ? [rows[rows.length - 1].id] : [] };
    });

    const initialRows = seed.rows;

    const [rows, setRows] = useState<WeblinkFormRow[]>(initialRows);
    const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(() => new Set(seed.expandedIds));
    const [showErrors, setShowErrors] = useState(false);
    const [formError, setFormError] = useState('');
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    const toggleExpanded = (id: string) => {
        setExpandedRowIds((prev) => {
            const next = new Set(prev);

            if (next.has(id)) next.delete(id);
            else next.add(id);

            return next;
        });
    };

    const updateRow = (id: string, patch: Partial<WeblinkFormRow>) => {
        setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    };

    const addRow = () => {
        const row = createEmptyWeblinkRow();

        setRows((prev) => [...prev, row]);
        setExpandedRowIds((prev) => new Set(prev).add(row.id));
    };

    const removeRow = (id: string) => {
        setRows((prev) => prev.filter((row) => row.id !== id));
    };

    // Compares against `initialRows` (not `initialLinks` directly) so optional-key round-tripping
    // through toWeblinkRow/toWeblinkSpec can't produce a false "dirty" on an untouched editor.
    const isDirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(initialRows), [rows, initialRows]);

    const handleCancel = () => {
        if (isSaving) return;

        if (isDirty) {
            setShowDiscardConfirm(true);

            return;
        }

        onCancel();
    };

    const handleSave = async () => {
        setFormError('');

        const validationError = validateWeblinkRows(rows);

        if (validationError) {
            setShowErrors(true);
            setFormError(validationError);

            return;
        }

        try {
            const links = rows.map(toWeblinkSpec);
            const authPayload = buildWeblinksAuthPayload(rows);

            await onSave(links, authPayload);
        } catch (error: unknown) {
            console.error(error);

            const axiosError = error as { response?: { data?: { message?: string } } };

            setFormError(axiosError.response?.data?.message || 'Something went wrong. Please try again.');
        }
    };

    const renderSaveButton = () => {
        if (isSaving) {
            return (
                <Button type="button" size="sm" disabled>
                    <SpinnerBlade className="scale-75" />
                    Saving
                </Button>
            );
        }

        return (
            <Button
                type="button"
                size="sm"
                onClick={() => {
                    void handleSave();
                }}
            >
                Save changes
            </Button>
        );
    };

    const renderHeader = () => (
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{`Editing Web Links (${rows.length})`}</span>
            <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={handleCancel}>
                    Cancel
                </Button>
                {renderSaveButton()}
            </div>
        </div>
    );

    const renderRows = () => {
        if (rows.length === 0) {
            return <span className="block px-4 py-3 text-sm text-text-secondary">No links added yet.</span>;
        }

        return (
            <div className="flex flex-col">
                {rows.map((row) => (
                    <WeblinkRowEditor
                        key={row.id}
                        row={row}
                        isExpanded={expandedRowIds.has(row.id)}
                        disabled={isSaving}
                        showErrors={showErrors}
                        onToggleExpanded={() => toggleExpanded(row.id)}
                        onChange={(patch) => updateRow(row.id, patch)}
                        onRemove={() => removeRow(row.id)}
                    />
                ))}
            </div>
        );
    };

    const renderFormError = () => {
        if (!formError) return null;

        return (
            <span className="text-sm font-medium text-destructive" role="alert">
                {formError}
            </span>
        );
    };

    return (
        <div className="flex flex-col gap-3">
            {renderHeader()}

            <div className="overflow-hidden rounded-2xl border border-border-secondary bg-card">
                {renderRows()}
                <div className="flex items-center justify-end gap-3 border-t border-border-secondary px-4 py-3">
                    <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={addRow}>
                        <PlusIcon className="size-3.5" />
                        Add link
                    </Button>
                </div>
            </div>

            {renderFormError()}

            <ConfirmationModal
                isOpen={showDiscardConfirm}
                title="Discard changes"
                message="You have unsaved changes to these links. Discard them?"
                confirmButtonText="Discard"
                cancelButtonText="Keep editing"
                onClose={() => setShowDiscardConfirm(false)}
                onConfirm={() => {
                    setShowDiscardConfirm(false);
                    onCancel();
                }}
            />
        </div>
    );
};

export default WebLinksInlineEditor;
