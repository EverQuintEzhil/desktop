import { z } from 'zod';

import type { SchemaField } from '@/admin/screens/private/screens/admin/components/parameters-schema/schema-field';

export type FieldValue = string | boolean;
export type FieldValues = Record<string, FieldValue>;

export interface LeafEntry {
    key: string;
    path: string[];
    field: SchemaField;
}

const userProfileSchemaShape = z.object({
    type: z.string().optional(),
    properties: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    required: z.array(z.string()).optional(),
});

export function parseUserProfileSchema(value: unknown): Record<string, unknown> | null {
    const result = userProfileSchemaShape.safeParse(value);

    if (!result.success) return null;
    if (!result.data.properties || Object.keys(result.data.properties).length === 0) return null;

    return value as Record<string, unknown>;
}

export const fieldLabel = (field: SchemaField): string => field.title || field.name;

export const isGroup = (field: SchemaField): boolean => field.type === 'object' && field.properties.length > 0;

export function collectLeaves(fields: SchemaField[], prefix: string[] = []): LeafEntry[] {
    return fields.flatMap((field) => {
        if (!field.name) return [];

        const path = [...prefix, field.name];

        if (isGroup(field)) return collectLeaves(field.properties, path);

        return [{ key: path.join('.'), path, field }];
    });
}

function getAtPath(source: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = source;

    for (const segment of path) {
        if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
        current = (current as Record<string, unknown>)[segment];
    }

    return current;
}

function setAtPath(target: Record<string, unknown>, path: string[], value: unknown): void {
    let current = target;

    for (const segment of path.slice(0, -1)) {
        const next = current[segment];

        if (!next || typeof next !== 'object' || Array.isArray(next)) {
            current[segment] = {};
        }
        current = current[segment] as Record<string, unknown>;
    }

    current[path[path.length - 1]] = value;
}

function deleteAtPath(target: Record<string, unknown>, path: string[]): void {
    let current = target;

    for (const segment of path.slice(0, -1)) {
        const next = current[segment];

        if (!next || typeof next !== 'object' || Array.isArray(next)) return;
        current = next as Record<string, unknown>;
    }

    delete current[path[path.length - 1]];
}

export function toEditorValue(field: SchemaField, raw: unknown): FieldValue {
    if (field.type === 'boolean') return raw === true;
    if (raw === undefined || raw === null) return '';
    if (typeof raw === 'object') return JSON.stringify(raw, null, 2);

    return String(raw);
}

export function initialFieldValues(leaves: LeafEntry[], customFields: Record<string, unknown>): FieldValues {
    const values: FieldValues = {};

    leaves.forEach((leaf) => {
        values[leaf.key] = toEditorValue(leaf.field, getAtPath(customFields, leaf.path));
    });

    return values;
}

export interface BuildOutcome {
    customFields?: Record<string, unknown>;
    errors: Record<string, string>;
}

function parseLeafValue(leaf: LeafEntry, text: string): { value?: unknown; error?: string } {
    const label = fieldLabel(leaf.field);

    if (leaf.field.type === 'number' || leaf.field.type === 'integer') {
        const parsed = Number(text);

        if (!Number.isFinite(parsed)) return { error: `${label} must be a number.` };
        if (leaf.field.type === 'integer' && !Number.isInteger(parsed)) {
            return { error: `${label} must be a whole number.` };
        }

        return { value: parsed };
    }

    if (leaf.field.type === 'array' || leaf.field.type === 'object') {
        let parsed: unknown;

        try {
            parsed = JSON.parse(text);
        } catch {
            return { error: `${label} must be valid JSON.` };
        }

        if (leaf.field.type === 'array' && !Array.isArray(parsed)) {
            return { error: `${label} must be a JSON array.` };
        }
        if (leaf.field.type === 'object' && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) {
            return { error: `${label} must be a JSON object.` };
        }

        return { value: parsed };
    }

    return { value: text };
}

/**
 * The API replaces `customFields` wholesale, so the result starts from the stored object
 * and keeps keys the schema no longer describes.
 */
export function buildCustomFields(
    existing: Record<string, unknown>,
    leaves: LeafEntry[],
    values: FieldValues,
): BuildOutcome {
    const next = structuredClone(existing);
    const errors: Record<string, string> = {};

    leaves.forEach((leaf) => {
        const raw = values[leaf.key];

        if (leaf.field.type === 'boolean') {
            setAtPath(next, leaf.path, raw === true);

            return;
        }

        const text = typeof raw === 'string' ? raw.trim() : '';

        if (!text) {
            if (leaf.field.required) {
                errors[leaf.key] = `${fieldLabel(leaf.field)} is required.`;

                return;
            }
            deleteAtPath(next, leaf.path);

            return;
        }

        const parsed = parseLeafValue(leaf, text);

        if (parsed.error) {
            errors[leaf.key] = parsed.error;

            return;
        }

        setAtPath(next, leaf.path, parsed.value);
    });

    if (Object.keys(errors).length > 0) return { errors };

    return { customFields: next, errors };
}

export interface EnumOption {
    value: string;
    label: string;
}

export function enumOptions(field: SchemaField): EnumOption[] {
    const values = field.enumText
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);
    const labels = field.enumLabels.split(',').map((token) => token.trim());

    return values.map((value, index) => ({ value, label: labels[index] || value }));
}
