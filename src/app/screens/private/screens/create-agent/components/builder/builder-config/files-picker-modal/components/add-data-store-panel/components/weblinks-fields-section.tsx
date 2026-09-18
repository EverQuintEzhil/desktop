import { PlusIcon } from 'lucide-react';
import { type Dispatch, type SetStateAction } from 'react';

import WeblinkRowEditor from '@/admin/screens/private/screens/admin/components/data-stores/components/wizard-pages/configure-weblinks-step/weblink-row-editor';
import {
    createEmptyWeblinkRow,
    type WeblinkFormRow,
} from '@/admin/screens/private/screens/admin/components/data-stores/components/wizard-pages/configure-weblinks-step/weblinks-validation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface WeblinksFieldsSectionProps {
    weblinkRows: WeblinkFormRow[];
    setWeblinkRows: Dispatch<SetStateAction<WeblinkFormRow[]>>;
    expandedWeblinkRowIds: Set<string>;
    setExpandedWeblinkRowIds: Dispatch<SetStateAction<Set<string>>>;
    showWeblinkErrors: boolean;
}

/** Renders the editable list of weblink rows for the `weblinks` provider, with add/remove/expand controls. */
const WeblinksFieldsSection = ({
    weblinkRows,
    setWeblinkRows,
    expandedWeblinkRowIds,
    setExpandedWeblinkRowIds,
    showWeblinkErrors,
}: WeblinksFieldsSectionProps) => {
    const toggleWeblinkRowExpanded = (id: string) => {
        setExpandedWeblinkRowIds((prev) => {
            const next = new Set(prev);

            if (next.has(id)) next.delete(id);
            else next.add(id);

            return next;
        });
    };

    const updateWeblinkRow = (id: string, patch: Partial<WeblinkFormRow>) => {
        setWeblinkRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    };

    const addWeblinkRow = () => {
        const row = createEmptyWeblinkRow();

        setWeblinkRows((prev) => [...prev, row]);
        setExpandedWeblinkRowIds((prev) => new Set(prev).add(row.id));
    };

    const removeWeblinkRow = (id: string) => {
        setWeblinkRows((prev) => prev.filter((row) => row.id !== id));
    };

    const renderWeblinkRows = () => {
        if (weblinkRows.length === 0) {
            return <span className="block px-3 py-2 text-xs text-text-secondary">No links added yet.</span>;
        }

        return weblinkRows.map((row) => (
            <WeblinkRowEditor
                key={row.id}
                row={row}
                isExpanded={expandedWeblinkRowIds.has(row.id)}
                showErrors={showWeblinkErrors}
                onToggleExpanded={() => toggleWeblinkRowExpanded(row.id)}
                onChange={(patch) => updateWeblinkRow(row.id, patch)}
                onRemove={() => removeWeblinkRow(row.id)}
            />
        ));
    };

    return (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
                <Label className="text-sm text-[11px] font-semibold tracking-wider text-text-secondary uppercase">
                    Links <span className="text-destructive">*</span>
                </Label>
                <span className="text-xs text-text-secondary">
                    Add the pages or sites this store should index. Crawl links index an entire site; scrape links index
                    exactly one page.
                </span>
            </div>
            <div className="flex flex-col overflow-hidden rounded-md border border-border bg-(--bg-surface)">
                {renderWeblinkRows()}
                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-3 py-2">
                    <Button type="button" variant="outline" size="sm" onClick={addWeblinkRow}>
                        <PlusIcon className="mr-1" size={14} aria-hidden="true" />
                        Add link
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default WeblinksFieldsSection;
