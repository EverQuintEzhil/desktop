import { CheckIcon, PlusIcon, TrashIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

import './key-value-table.scss';

interface EditingCell {
    key: string;
    column: 'key' | 'value';
}

interface Props {
    data: Record<string, string>;
    isEditable?: boolean;
    onChange?: (data: Record<string, string>) => void;
    keyColumnLabel?: string;
    valueColumnLabel?: string;
    emptyStateMessage?: string;
}

const KeyValueTable = ({
    data,
    isEditable = false,
    onChange,
    keyColumnLabel = 'Key',
    valueColumnLabel = 'Value',
    emptyStateMessage = 'No entries yet.',
}: Props) => {
    const [editing, setEditing] = useState<EditingCell | null>(null);
    const [editingText, setEditingText] = useState('');
    const [editError, setEditError] = useState('');

    const [isAddingRow, setIsAddingRow] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [newKeyError, setNewKeyError] = useState('');

    const newValueRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isEditable) {
            setEditing(null);
            setEditingText('');
            setEditError('');
            setIsAddingRow(false);
            setNewKey('');
            setNewValue('');
            setNewKeyError('');
        }
    }, [isEditable]);

    const validateKey = (key: string, excludeKey?: string): string => {
        if (!key.trim()) return 'Key cannot be empty';
        if (!/^[a-zA-Z_][a-zA-Z0-9_\-.]*$/.test(key.trim())) {
            return 'Key must start with a letter or underscore and contain only letters, digits, underscores, hyphens, or dots';
        }
        const existing = Object.keys(data).filter((k) => k !== excludeKey);

        if (existing.includes(key.trim())) return 'Key already exists';

        return '';
    };

    const startEdit = (key: string, column: 'key' | 'value') => {
        if (!isEditable) return;
        setEditing({ key, column });
        setEditingText(column === 'key' ? key : data[key]);
        setEditError('');
    };

    const doCommit = () => {
        if (!editing || !onChange) return;
        const { key, column } = editing;
        const newData = { ...data };

        if (column === 'key') {
            const val = newData[key];

            delete newData[key];
            newData[editingText.trim()] = val;
        } else {
            newData[key] = editingText;
        }
        onChange(newData);
        setEditing(null);
        setEditError('');
    };

    const commitEdit = () => {
        if (!editing) return;
        const { key, column } = editing;

        if (column === 'key') {
            const error = validateKey(editingText, key);

            if (error) {
                setEditError(error);

                return;
            }
        }
        doCommit();
    };

    const blurEdit = () => {
        if (!editing) return;
        const { key, column } = editing;

        if (column === 'key') {
            const error = validateKey(editingText, key);

            if (error) {
                setEditError(error);

                return;
            }
        }
        doCommit();
    };

    const cancelEdit = () => {
        setEditing(null);
        setEditError('');
    };

    const handleCellKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitEdit();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    };

    const handleCellDivKeyDown = (e: KeyboardEvent<HTMLDivElement>, key: string, column: 'key' | 'value') => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            startEdit(key, column);
        }
    };

    const handleDelete = (key: string) => {
        if (!onChange) return;
        const newData = { ...data };

        delete newData[key];
        onChange(newData);
    };

    const startAddRow = () => {
        setIsAddingRow(true);
        setNewKey('');
        setNewValue('');
        setNewKeyError('');
    };

    const commitAddRow = () => {
        const error = validateKey(newKey);

        if (error) {
            setNewKeyError(error);

            return;
        }
        onChange?.({ ...data, [newKey.trim()]: newValue });
        setIsAddingRow(false);
        setNewKey('');
        setNewValue('');
        setNewKeyError('');
    };

    const cancelAddRow = () => {
        setIsAddingRow(false);
        setNewKey('');
        setNewValue('');
        setNewKeyError('');
    };

    const handleNewKeyKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            const error = validateKey(newKey);

            if (error) {
                setNewKeyError(error);

                return;
            }
            setNewKeyError('');
            newValueRef.current?.focus();
        }
        if (e.key === 'Escape') cancelAddRow();
    };

    const handleNewValueKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') commitAddRow();
        if (e.key === 'Escape') cancelAddRow();
    };

    const isEditingCell = (key: string, column: 'key' | 'value') => editing?.key === key && editing?.column === column;

    const entries = Object.entries(data);

    return (
        <>
            <div className="key-value-table">
                <div className="kv-header flex">
                    <div className="kv-col kv-key-col px-3 py-2">
                        <span className="text-xs font-medium">{keyColumnLabel}</span>
                    </div>
                    <div className="kv-col kv-value-col px-3 py-2">
                        <span className="text-xs font-medium">{valueColumnLabel}</span>
                    </div>
                    {isEditable && (
                        <div className="kv-col kv-actions-col px-3 py-2">
                            <span className="text-xs font-medium">Actions</span>
                        </div>
                    )}
                </div>

                {entries.length === 0 && !isAddingRow && (
                    <div className="kv-empty flex items-center justify-center py-6">
                        <span className="text-xs font-medium">{emptyStateMessage}</span>
                    </div>
                )}
                <div className="kv-body flex flex-col">
                    {entries.map(([key, value]) => (
                        <div key={key} className="kv-row flex items-stretch">
                            <div
                                className={cn(
                                    'kv-col kv-key-col flex flex-col px-3 py-1',
                                    isEditingCell(key, 'key') ? 'editing' : '',
                                    isEditable && !isAddingRow && !isEditingCell(key, 'key') && 'editable',
                                )}
                                onClick={() =>
                                    isEditable && !isAddingRow && !isEditingCell(key, 'key') && startEdit(key, 'key')
                                }
                                role={isEditable && !isAddingRow && !isEditingCell(key, 'key') ? 'button' : undefined}
                                tabIndex={isEditable && !isAddingRow && !isEditingCell(key, 'key') ? 0 : undefined}
                                onKeyDown={(e) =>
                                    isEditable &&
                                    !isAddingRow &&
                                    !isEditingCell(key, 'key') &&
                                    handleCellDivKeyDown(e, key, 'key')
                                }
                                aria-label={isEditable && !isAddingRow ? `Edit key: ${key}` : undefined}
                            >
                                {isEditingCell(key, 'key') ? (
                                    <>
                                        <Input
                                            value={editingText}
                                            onChange={(e) => {
                                                setEditingText(e.target.value);
                                                setEditError('');
                                            }}
                                            onBlur={blurEdit}
                                            onKeyDown={handleCellKeyDown}
                                            isErrored={!!editError}
                                            autoFocus
                                            className="kv-input"
                                        />
                                    </>
                                ) : (
                                    <div className="flex min-h-[32px] items-center">
                                        <span className="text-sm">{key}</span>
                                    </div>
                                )}
                            </div>

                            <div
                                className={cn(
                                    'kv-col kv-value-col flex-co flex px-3 py-1',
                                    isEditingCell(key, 'value') ? 'editing' : '',
                                    isEditable && !isAddingRow && !isEditingCell(key, 'value') && 'editable',
                                )}
                                onClick={() =>
                                    isEditable &&
                                    !isAddingRow &&
                                    !isEditingCell(key, 'value') &&
                                    startEdit(key, 'value')
                                }
                                role={isEditable && !isAddingRow && !isEditingCell(key, 'value') ? 'button' : undefined}
                                tabIndex={isEditable && !isAddingRow && !isEditingCell(key, 'value') ? 0 : undefined}
                                onKeyDown={(e) =>
                                    isEditable &&
                                    !isAddingRow &&
                                    !isEditingCell(key, 'value') &&
                                    handleCellDivKeyDown(e, key, 'value')
                                }
                                aria-label={isEditable && !isAddingRow ? `Edit value for ${key}` : undefined}
                            >
                                {isEditingCell(key, 'value') ? (
                                    <Input
                                        value={editingText}
                                        onChange={(e) => setEditingText(e.target.value)}
                                        onBlur={blurEdit}
                                        onKeyDown={handleCellKeyDown}
                                        autoFocus
                                        className="kv-input"
                                    />
                                ) : (
                                    <div className="flex min-h-[32px] items-center">
                                        <span className="text-sm">{value}</span>
                                    </div>
                                )}
                            </div>

                            {isEditable && (
                                <div className="kv-col kv-actions-col flex items-center justify-center">
                                    <SimpleTooltip content="Delete key" side="bottom">
                                        <Button
                                            variant="destructive"
                                            size="icon-xs"
                                            className="kv-delete-btn"
                                            onClick={() => handleDelete(key)}
                                            type="button"
                                            disabled={isAddingRow}
                                        >
                                            <TrashIcon />
                                        </Button>
                                    </SimpleTooltip>
                                </div>
                            )}
                        </div>
                    ))}

                    {isAddingRow && (
                        <div className="kv-row kv-new-row flex items-stretch">
                            <div className="kv-col kv-key-col editing relative flex items-center px-3 py-1">
                                <Input
                                    value={newKey}
                                    onChange={(e) => {
                                        setNewKey(e.target.value);
                                        setNewKeyError('');
                                    }}
                                    onKeyDown={handleNewKeyKeyDown}
                                    isErrored={!!newKeyError}
                                    placeholder="key"
                                    autoFocus
                                    className="kv-input"
                                />
                            </div>
                            <div className="kv-col kv-value-col editing relative flex items-center px-3 py-1">
                                <Input
                                    ref={newValueRef}
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    onKeyDown={handleNewValueKeyDown}
                                    placeholder="value"
                                    className="kv-input"
                                />
                            </div>
                            <div className="kv-col kv-actions-col relative flex items-center justify-center gap-2 px-3 py-1">
                                <Button variant="ghost" size="icon-xs" onClick={cancelAddRow} type="button">
                                    <XIcon />
                                </Button>
                                <Button variant="default" size="icon-xs" onClick={commitAddRow} type="button">
                                    <CheckIcon />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {isEditable && !isAddingRow && (
                    <div className="kv-footer flex items-center px-2 py-1">
                        <Button variant="ghost" size="sm" onClick={startAddRow} type="button">
                            <PlusIcon />
                            Add key
                        </Button>
                    </div>
                )}
            </div>
            <div className="flex flex-col">
                {newKeyError && <span className="kv-error-msg text-[11px] font-medium">{newKeyError}</span>}
                {editError && <span className="kv-error-msg px-2 py-1 text-xs">{editError}</span>}
            </div>
        </>
    );
};

export default KeyValueTable;
