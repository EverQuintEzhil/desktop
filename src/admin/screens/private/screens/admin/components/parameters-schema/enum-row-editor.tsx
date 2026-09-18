import { PlusIcon, TrashIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';

interface EnumRow {
    value: string;
    label: string;
}

type EnumMode = 'enum' | 'oneOf';

const MODE_OPTIONS: { value: EnumMode; label: string }[] = [
    { value: 'enum', label: 'enum' },
    { value: 'oneOf', label: 'oneOf (with labels)' },
];

interface EnumRowEditorProps {
    enumText: string;
    enumLabels: string;
    isSchemaLocked: boolean;
    onChange: (patch: { enumText: string; enumLabels: string }) => void;
}

function parseRows(enumText: string, enumLabels: string): EnumRow[] {
    const values = enumText ? enumText.split(',').map((v) => v.trim()) : [];

    if (values.length === 0) return [];

    const labels = enumLabels ? enumLabels.split(',').map((l) => l.trim()) : [];

    return values.map((value, i) => ({ value, label: labels[i] ?? '' }));
}

function rowsToStrings(rows: EnumRow[], mode: EnumMode): { enumText: string; enumLabels: string } {
    return {
        enumText: rows.map((r) => r.value).join(', '),
        enumLabels: mode === 'oneOf' ? rows.map((r) => r.label).join(', ') : '',
    };
}

const EnumRowEditor = ({ enumText, enumLabels, isSchemaLocked, onChange }: EnumRowEditorProps) => {
    const hasLabels = enumLabels.trim().length > 0;
    const [mode, setMode] = useState<EnumMode>(hasLabels ? 'oneOf' : 'enum');
    const [rows, setRows] = useState<EnumRow[]>(() => parseRows(enumText, enumLabels));

    useEffect(() => {
        const current = rowsToStrings(rows, mode);

        if (current.enumText !== enumText || current.enumLabels !== enumLabels) {
            setMode(enumLabels.trim().length > 0 ? 'oneOf' : 'enum');
            setRows(parseRows(enumText, enumLabels));
        }
    }, [enumText, enumLabels]);

    const updateRow = (index: number, patch: Partial<EnumRow>) => {
        const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));

        setRows(next);
        onChange(rowsToStrings(next, mode));
    };

    const addRow = () => {
        const next = [...rows, { value: '', label: '' }];

        setRows(next);
        onChange(rowsToStrings(next, mode));
    };

    const removeRow = (index: number) => {
        const next = rows.filter((_, i) => i !== index);

        setRows(next);
        onChange(rowsToStrings(next, mode));
    };

    const handleModeChange = (next: EnumMode | null) => {
        if (!next) return;

        setMode(next);

        const cleared = rows.map((r) => ({ ...r, label: '' }));

        onChange(rowsToStrings(cleared, next));
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <Label>Enum options</Label>
                <div className="flex items-center gap-2">
                    <Select<EnumMode>
                        options={MODE_OPTIONS}
                        value={mode}
                        variant="ghost"
                        disabled={isSchemaLocked}
                        onChange={handleModeChange}
                    />
                    {!isSchemaLocked && (
                        <Button variant="outline" size="sm" onClick={addRow}>
                            <PlusIcon className="size-3" />
                            Add option
                        </Button>
                    )}
                </div>
            </div>

            {rows.length > 0 && (
                <div className="flex flex-col gap-1">
                    <div
                        className={
                            mode === 'oneOf'
                                ? 'grid grid-cols-[1fr_1fr_auto] gap-2 px-1'
                                : 'grid grid-cols-[1fr_auto] gap-2 px-1'
                        }
                    >
                        <span className="text-xs text-muted-foreground">Value</span>
                        {mode === 'oneOf' && <span className="text-xs text-muted-foreground">Label</span>}
                    </div>
                    {rows.map((row, i) => (
                        <div
                            key={i}
                            className={
                                mode === 'oneOf'
                                    ? 'grid grid-cols-[1fr_1fr_auto] items-center gap-2'
                                    : 'grid grid-cols-[1fr_auto] items-center gap-2'
                            }
                        >
                            <Input
                                value={row.value}
                                disabled={isSchemaLocked}
                                onChange={(e) => updateRow(i, { value: e.target.value })}
                                placeholder="value"
                            />
                            {mode === 'oneOf' && (
                                <Input
                                    value={row.label}
                                    disabled={isSchemaLocked}
                                    onChange={(e) => updateRow(i, { label: e.target.value })}
                                    placeholder="Display label"
                                />
                            )}
                            {!isSchemaLocked && (
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeRow(i)}>
                                    <TrashIcon className="size-3.5" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {rows.length === 0 && !isSchemaLocked && <p className="text-xs text-muted-foreground">No options yet.</p>}
        </div>
    );
};

export default EnumRowEditor;
