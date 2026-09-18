import { PlusIcon } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/tag';

interface Props {
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

const StringListEditor = ({ value, onChange, placeholder, disabled }: Props) => {
    const [draft, setDraft] = useState('');
    const items = value ?? [];

    const addItem = () => {
        if (disabled) return;
        const trimmed = draft.trim();

        if (!trimmed) return;
        if (items.includes(trimmed)) {
            setDraft('');

            return;
        }
        onChange([...items, trimmed]);
        setDraft('');
    };

    const removeAt = (index: number) => {
        if (disabled) return;

        onChange(items.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
        }
    };

    const renderChips = () => {
        if (items.length === 0) {
            return <span className="text-xs text-text-secondary">No items yet.</span>;
        }

        return items.map((item, idx) => (
            <Tag
                key={`${item}-${idx}`}
                size="small"
                variant="pill"
                removable
                value={item}
                label={item}
                disabled={disabled}
                onRemove={() => removeAt(idx)}
                className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
            />
        ));
    };

    return (
        <div className="flex flex-col gap-2">
            {!disabled ? (
                <div className="flex gap-2">
                    <Input
                        value={draft}
                        placeholder={placeholder ?? 'Type and press Enter'}
                        onChange={(e) => {
                            setDraft(e.target.value);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                    <Button type="button" variant="outline" size="sm" disabled={!draft.trim()} onClick={addItem}>
                        <PlusIcon className="mr-1" /> Add
                    </Button>
                </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">{renderChips()}</div>
        </div>
    );
};

export default StringListEditor;
