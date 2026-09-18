import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import TextAreaForm from '@/components/ui/textarea-form';
import { cn } from '@/lib/utils';

import {
    buildRequestValueFromSchema,
    resolveToolParameterProperties,
} from '../../../../../../code-manager/code-manager.utils';
import type { ToolParameterSchema } from '../../../../../../parameters-schema';
import FieldHelp from '../../agent-ui-config-editor/components/primitives/field-help';

const MAX_OBJECT_DEPTH = 5;

const isPlainObjectRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const resolveEnumSelectValue = (raw: unknown, fallback: unknown): string | null => {
    if (raw === undefined || raw === null) {
        if (fallback === undefined || fallback === null) {
            return null;
        }

        return String(fallback);
    }

    return String(raw);
};

const parseNumericRaw = (raw: unknown): number => {
    if (typeof raw === 'number') {
        return raw;
    }
    if (typeof raw === 'string') {
        return Number(raw);
    }

    return Number.NaN;
};

const resolveNumberDisplay = (parsed: number, fallback: unknown): number => {
    if (Number.isFinite(parsed)) {
        return parsed;
    }
    if (typeof fallback === 'number') {
        return fallback;
    }

    return 0;
};

const resolveStepAttribute = (prop: ToolParameterSchema): number | undefined => {
    if (typeof prop.multipleOf === 'number' && prop.multipleOf > 0) {
        return prop.multipleOf;
    }
    if (prop.type === 'integer') {
        return 1;
    }

    return undefined;
};

const resolveBooleanChecked = (raw: unknown, fallback: unknown): boolean => {
    if (typeof raw === 'boolean') {
        return raw;
    }
    if (typeof fallback === 'boolean') {
        return fallback;
    }

    return false;
};

const resolveTextDisplay = (raw: unknown, fallback: unknown): string => {
    if (raw === undefined || raw === null) {
        return typeof fallback === 'string' ? fallback : '';
    }

    return String(raw);
};

const resolveNestedRecord = (raw: unknown, fallback: unknown): Record<string, unknown> => {
    if (isPlainObjectRecord(raw)) {
        return raw;
    }
    if (isPlainObjectRecord(fallback)) {
        return fallback;
    }

    return {};
};

type Props = {
    rootSchema?: ToolParameterSchema;
    value: Record<string, unknown>;
    onChange: (next: Record<string, unknown>) => void;
    disabled?: boolean;
    depth?: number;
};

const schemaTitle = (prop: ToolParameterSchema): string | undefined => {
    const raw = (prop as { title?: unknown }).title;

    return typeof raw === 'string' && raw.trim() ? raw : undefined;
};

const inferFieldKind = (
    prop: ToolParameterSchema,
): 'enum' | 'number' | 'boolean' | 'string' | 'object' | 'array' | 'other' => {
    if (Array.isArray(prop.oneOf) && prop.oneOf.length > 0) {
        return 'enum';
    }
    if (Array.isArray(prop.enum) && prop.enum.length > 0) {
        return 'enum';
    }
    if (prop.type === 'boolean') {
        return 'boolean';
    }
    if (prop.type === 'number' || prop.type === 'integer') {
        return 'number';
    }
    if (prop.type === 'string') {
        return 'string';
    }
    if (prop.type === 'object' || Boolean(prop.properties)) {
        return 'object';
    }
    if (prop.type === 'array') {
        return 'array';
    }

    return 'other';
};

const AgentModelParameterFields = ({ rootSchema, value, onChange, disabled, depth = 0 }: Props) => {
    const properties = useMemo(() => resolveToolParameterProperties(rootSchema), [rootSchema]);

    const requiredKeys = useMemo(() => {
        const req = rootSchema?.required;

        return Array.isArray(req) ? req : [];
    }, [rootSchema]);

    const patchField = (key: string, nextVal: unknown) => {
        if (disabled) return;

        onChange({ ...value, [key]: nextVal });
    };

    const renderEnumField = (fieldKey: string, prop: ToolParameterSchema): ReactNode => {
        type OneOfEntry = { const?: unknown; title?: string };

        const oneOfEntries = Array.isArray(prop.oneOf) ? (prop.oneOf as OneOfEntry[]) : null;
        const enums = prop.enum ?? [];

        const options = oneOfEntries
            ? oneOfEntries
                  .filter((e) => e.const !== undefined)
                  .map((e) => ({ value: String(e.const), label: e.title ?? String(e.const) }))
            : enums.map((ev) => ({ value: String(ev), label: String(ev) }));

        const rawValues = oneOfEntries ? oneOfEntries.filter((e) => e.const !== undefined).map((e) => e.const) : enums;

        const raw = value[fieldKey];
        const fallback = buildRequestValueFromSchema(prop);
        const selected = resolveEnumSelectValue(raw, fallback);

        const handleEnumChange = (next: string | null) => {
            if (next === null) {
                if (rawValues.length === 0) return;

                const first = rawValues[0];

                patchField(fieldKey, typeof first === 'number' ? Number(first) : first);

                return;
            }

            const match = rawValues.find((ev) => String(ev) === next);

            patchField(fieldKey, match !== undefined ? match : next);
        };

        return (
            <Select
                options={options}
                value={selected}
                onChange={(v) => handleEnumChange(v)}
                disabled={disabled}
                variant="ghost"
                className="w-full max-w-sm rounded-md"
                placeholder="Select…"
                allowDeselect={false}
            />
        );
    };

    const renderNumberField = (fieldKey: string, prop: ToolParameterSchema): ReactNode => {
        const raw = value[fieldKey];
        const fallback = buildRequestValueFromSchema(prop);
        const parsed = parseNumericRaw(raw);
        const display = resolveNumberDisplay(parsed, fallback);
        const step = resolveStepAttribute(prop);

        const handleNumberChange = (s: string) => {
            if (s === '' || s === '-') {
                patchField(fieldKey, typeof fallback === 'number' ? fallback : 0);

                return;
            }

            const n = prop.type === 'integer' ? Number.parseInt(s, 10) : Number.parseFloat(s);

            if (!Number.isFinite(n)) {
                return;
            }

            patchField(fieldKey, n);
        };

        return (
            <Input
                type="number"
                readOnly={disabled}
                value={display}
                className="max-w-sm"
                min={typeof prop.minimum === 'number' ? prop.minimum : undefined}
                max={typeof prop.maximum === 'number' ? prop.maximum : undefined}
                step={step === undefined ? 'any' : step}
                onChange={(e) => handleNumberChange(e.target.value)}
            />
        );
    };

    const renderBooleanField = (fieldKey: string, prop: ToolParameterSchema): ReactNode => {
        const raw = value[fieldKey];
        const fallback = buildRequestValueFromSchema(prop);
        const checked = resolveBooleanChecked(raw, fallback);
        const ariaLabel = schemaTitle(prop) ?? fieldKey;

        return (
            <Checkbox
                disabled={disabled}
                checked={checked}
                onChange={(_, next) => patchField(fieldKey, next)}
                aria-label={ariaLabel}
            />
        );
    };

    const renderStringField = (fieldKey: string, prop: ToolParameterSchema): ReactNode => {
        const raw = value[fieldKey];
        const fallback = buildRequestValueFromSchema(prop);
        const display = resolveTextDisplay(raw, fallback);

        return (
            <Input
                type="text"
                readOnly={disabled}
                value={display}
                className="max-w-sm"
                onChange={(e) => patchField(fieldKey, e.target.value)}
            />
        );
    };

    const renderArrayFallback = (fieldKey: string): ReactNode => {
        const raw = value[fieldKey];
        const text = JSON.stringify(raw ?? [], null, 2);

        return (
            <TextAreaForm
                readOnly={disabled}
                value={text}
                className="min-h-[96px] font-mono text-xs"
                onChange={(next) => {
                    try {
                        patchField(fieldKey, JSON.parse(next) as unknown);
                    } catch {
                        /* ignore until valid */
                    }
                }}
            />
        );
    };

    const renderObjectNested = (fieldKey: string, prop: ToolParameterSchema): ReactNode => {
        if (depth >= MAX_OBJECT_DEPTH) {
            return (
                <span className="text-xs text-text-secondary">
                    Nesting limit reached — use the JSON tab to edit this object.
                </span>
            );
        }

        const raw = value[fieldKey];
        const fallback = buildRequestValueFromSchema(prop);
        const nestedValue = resolveNestedRecord(raw, fallback);

        return (
            <div className="border-l border-border-secondary pl-3">
                <AgentModelParameterFields
                    rootSchema={prop}
                    value={nestedValue}
                    onChange={(next) => patchField(fieldKey, next)}
                    disabled={disabled}
                    depth={depth + 1}
                />
            </div>
        );
    };

    const renderOtherFallback = (fieldKey: string): ReactNode => {
        const raw = value[fieldKey];

        return (
            <Input
                type="text"
                readOnly={disabled}
                value={raw === undefined || raw === null ? '' : JSON.stringify(raw)}
                className="font-mono text-xs"
                onChange={(e) => {
                    const trimmed = e.target.value.trim();

                    if (trimmed === '') {
                        patchField(fieldKey, '');

                        return;
                    }

                    try {
                        patchField(fieldKey, JSON.parse(trimmed) as unknown);
                    } catch {
                        patchField(fieldKey, trimmed);
                    }
                }}
            />
        );
    };

    const renderControl = (fieldKey: string, prop: ToolParameterSchema): ReactNode => {
        const kind = inferFieldKind(prop);

        if (kind === 'enum') {
            return renderEnumField(fieldKey, prop);
        }

        if (kind === 'number') {
            return renderNumberField(fieldKey, prop);
        }

        if (kind === 'boolean') {
            return renderBooleanField(fieldKey, prop);
        }

        if (kind === 'string') {
            return renderStringField(fieldKey, prop);
        }

        if (kind === 'object') {
            return renderObjectNested(fieldKey, prop);
        }

        if (kind === 'array') {
            return renderArrayFallback(fieldKey);
        }

        return renderOtherFallback(fieldKey);
    };

    const renderFieldRow = (fieldKey: string, prop: ToolParameterSchema): ReactNode => {
        const label = schemaTitle(prop) ?? fieldKey;
        const description = typeof prop.description === 'string' ? prop.description : undefined;
        const required = requiredKeys.includes(fieldKey);
        const kind = inferFieldKind(prop);
        const isWide = kind === 'object' || kind === 'array' || kind === 'other';

        return (
            <div key={fieldKey} className={cn('flex flex-col gap-1.5', isWide ? 'col-span-full' : 'max-w-xl')}>
                <FieldHelp
                    label={label}
                    description={description}
                    required={required}
                    className="text-xs! font-medium text-text-secondary"
                />
                {renderControl(fieldKey, prop)}
            </div>
        );
    };

    const renderFields = () => {
        const keys = Object.keys(properties);

        if (keys.length === 0) {
            return <span className="text-xs text-text-secondary">No fields defined in this part of the schema.</span>;
        }

        return (
            <div className="@container">
                <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
                    {keys.map((fieldKey) => renderFieldRow(fieldKey, properties[fieldKey]))}
                </div>
            </div>
        );
    };

    return renderFields();
};

export default AgentModelParameterFields;
