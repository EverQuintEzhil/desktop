import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

import FieldHelp from '../primitives/field-help';

const FILE_TYPE_GROUPS = [
    { key: 'images', label: 'Images', mime: 'image/*' },
    { key: 'pdf', label: 'PDF', mime: 'application/pdf' },
    { key: 'word', label: 'Word docs', mime: '.doc,.docx' },
    { key: 'spreadsheets', label: 'Spreadsheets', mime: '.xls,.xlsx,.csv' },
    { key: 'video', label: 'Videos', mime: 'video/*' },
    { key: 'audio', label: 'Audio', mime: 'audio/*' },
] as const;

const ALL_GROUP_TOKENS = new Set(FILE_TYPE_GROUPS.flatMap((g) => g.mime.split(',')));

const parseTokens = (accept: string | undefined): string[] =>
    (accept ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

const toAcceptString = (tokens: string[]): string | undefined => (tokens.length ? tokens.join(',') : undefined);

interface Props {
    value: string | undefined;
    onChange: (next: string | undefined) => void;
    disabled?: boolean;
}

const FileTypeSelector = ({ value, onChange, disabled }: Props) => {
    const allFiles = value === undefined;
    const tokens = parseTokens(value);

    const toggleAllFiles = (checked: boolean) => {
        onChange(checked ? undefined : '');
    };

    const isGroupChecked = (mime: string) => {
        const groupTokens = mime.split(',');

        return groupTokens.every((t) => tokens.includes(t));
    };

    const toggleGroup = (mime: string, checked: boolean) => {
        const groupTokens = mime.split(',');
        const next = checked
            ? [...tokens, ...groupTokens.filter((t) => !tokens.includes(t))]
            : tokens.filter((t) => !groupTokens.includes(t));

        onChange(toAcceptString(next));
    };

    const customTokens = tokens.filter((t) => !ALL_GROUP_TOKENS.has(t));

    const onCustomChange = (raw: string) => {
        const customNew = raw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        const groupTokens = tokens.filter((t) => ALL_GROUP_TOKENS.has(t));

        onChange(toAcceptString([...groupTokens, ...customNew]));
    };

    const renderTypeControls = () => {
        if (allFiles) return null;

        return (
            <div className="flex flex-col gap-2 pl-0">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {FILE_TYPE_GROUPS.map((group) => (
                        <Checkbox
                            key={group.key}
                            disabled={disabled}
                            label={group.label}
                            checked={isGroupChecked(group.mime)}
                            onChange={(_, checked) => toggleGroup(group.mime, checked)}
                        />
                    ))}
                </div>
                <div className="flex flex-col gap-1">
                    <FieldHelp
                        label="Custom types"
                        description="Additional MIME types or file extensions (e.g. .zip, text/plain)"
                    />
                    <Input
                        readOnly={disabled}
                        value={customTokens.join(',')}
                        placeholder=".zip,text/plain"
                        onChange={(e) => onCustomChange(e.target.value)}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-2">
            <Checkbox
                disabled={disabled}
                label="All file types"
                checked={allFiles}
                onChange={(_, checked) => toggleAllFiles(checked)}
            />
            {renderTypeControls()}
        </div>
    );
};

export default FileTypeSelector;
