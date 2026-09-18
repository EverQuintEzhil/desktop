import type { SchemaField } from './schema-field';
import {
    isPartialMinMaxBoundInput,
    isPartialMultipleOfInput,
    parseOptionalMultipleOf,
    parseOptionalNonNegativeInt,
    parseOptionalNumericBound,
    type ValidateSchemaFieldsOptions,
} from './schema-parsers';

export function isValidPatternSource(pattern: string): boolean {
    if (!pattern.trim()) return false;

    try {
        new RegExp(pattern);

        return true;
    } catch {
        return false;
    }
}

const joinFieldPath = (base: string, segment: string): string => (base ? `${base} (${segment})` : segment);

/**
 * Validates builder inputs (regex, min/max ordering). Does not guarantee full JSON Schema semantics.
 */
export function validateSchemaField(
    field: SchemaField,
    path: string,
    options?: ValidateSchemaFieldsOptions,
): string | null {
    const allowPartialMult = options?.allowPartialMultipleOf === true;
    const label = joinFieldPath(path, field.name || 'Untitled field');

    if (field.patternText.trim() && !isValidPatternSource(field.patternText)) {
        return `${label}: Pattern must be a valid regular expression`;
    }

    if (field.type === 'string') {
        const minL = parseOptionalNonNegativeInt(field.minLengthText);
        const maxL = parseOptionalNonNegativeInt(field.maxLengthText);

        if (minL !== undefined && maxL !== undefined && minL > maxL) {
            return `${label}: Min length cannot be greater than max length`;
        }
    }

    if (field.type === 'number' || field.type === 'integer') {
        const mode = field.type === 'integer' ? 'integer' : 'number';
        const minN = parseOptionalNumericBound(field.minText, mode);
        const maxN = parseOptionalNumericBound(field.maxText, mode);
        const skipMinMaxOrder =
            allowPartialMult && (isPartialMinMaxBoundInput(field.minText) || isPartialMinMaxBoundInput(field.maxText));

        if (!skipMinMaxOrder && minN !== undefined && maxN !== undefined && minN > maxN) {
            return `${label}: Minimum cannot be greater than maximum`;
        }

        if (
            field.multipleOfText.trim() &&
            parseOptionalMultipleOf(field.multipleOfText, mode) === undefined &&
            !(allowPartialMult && isPartialMultipleOfInput(field.multipleOfText, mode))
        ) {
            return `${label}: Multiple of must be a positive ${mode === 'integer' ? 'integer' : 'number'}`;
        }
    }

    if (field.type === 'array' && (field.itemType === 'number' || field.itemType === 'integer')) {
        const mode = field.itemType === 'integer' ? 'integer' : 'number';
        const minItem = parseOptionalNumericBound(field.minText, mode);
        const maxItem = parseOptionalNumericBound(field.maxText, mode);
        const skipItemMinMaxOrder =
            allowPartialMult && (isPartialMinMaxBoundInput(field.minText) || isPartialMinMaxBoundInput(field.maxText));

        if (!skipItemMinMaxOrder && minItem !== undefined && maxItem !== undefined && minItem > maxItem) {
            return `${label}: Minimum (array items) cannot be greater than maximum (items)`;
        }

        if (
            field.multipleOfText.trim() &&
            parseOptionalMultipleOf(field.multipleOfText, mode) === undefined &&
            !(allowPartialMult && isPartialMultipleOfInput(field.multipleOfText, mode))
        ) {
            return `${label}: Multiple of (items) must be a positive ${mode === 'integer' ? 'integer' : 'number'}`;
        }
    }

    if (field.type === 'array') {
        const minI = parseOptionalNonNegativeInt(field.minItemsText);
        const maxI = parseOptionalNonNegativeInt(field.maxItemsText);

        if (minI !== undefined && maxI !== undefined && minI > maxI) {
            return `${label}: Min items cannot be greater than max items`;
        }
    }

    if (field.type === 'object') {
        const minP = parseOptionalNonNegativeInt(field.minPropertiesText);
        const maxP = parseOptionalNonNegativeInt(field.maxPropertiesText);

        if (minP !== undefined && maxP !== undefined && minP > maxP) {
            return `${label}: Min properties cannot be greater than max properties`;
        }
    }

    for (const child of field.properties ?? []) {
        const childErr = validateSchemaField(child, joinFieldPath(path, field.name || ''), options);

        if (childErr) return childErr;
    }

    return null;
}

export function validateSchemaFields(fields: SchemaField[], options?: ValidateSchemaFieldsOptions): string | null {
    for (const f of fields) {
        const err = validateSchemaField(f, '', options);

        if (err) return err;
    }

    return null;
}

const formatSchemaLocation = (path: string): string => (path ? `At ${path}: ` : '');

const getSchemaValueKey = (value: unknown): string => {
    if (value === null) return 'null:null';

    if (Array.isArray(value)) {
        return `array:[${value.map(getSchemaValueKey).join(',')}]`;
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, childValue]) => `${JSON.stringify(key)}:${getSchemaValueKey(childValue)}`);

        return `object:{${entries.join(',')}}`;
    }

    return `${typeof value}:${JSON.stringify(value)}`;
};

const findDuplicateSchemaValue = (values: unknown[]): unknown | undefined => {
    const seen = new Set<string>();

    for (const value of values) {
        const key = getSchemaValueKey(value);

        if (seen.has(key)) {
            return value;
        }

        seen.add(key);
    }

    return undefined;
};

const formatSchemaValue = (value: unknown): string => {
    const serialized = JSON.stringify(value);

    return serialized ?? String(value);
};

/**
 * Validates structural consistency of a JSON Schema object (minimum ≤ maximum, etc.),
 * including nested `properties`, `items`, `additionalProperties`, combinators, and `not`.
 */
export function validateJsonSchemaDocument(node: unknown, path: string): string | null {
    if (node === null || typeof node !== 'object') {
        return null;
    }

    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i += 1) {
            const seg = `[${i}]`;
            const nextPath = path ? `${path}.${seg}` : seg;
            const err = validateJsonSchemaDocument(node[i], nextPath);

            if (err) return err;
        }

        return null;
    }

    const s = node as Record<string, unknown>;

    const min = s.minimum;
    const max = s.maximum;

    if (typeof min === 'number' && typeof max === 'number' && min > max) {
        return `${formatSchemaLocation(path)}minimum (${min}) cannot be greater than maximum (${max})`;
    }

    const minItems = s.minItems;
    const maxItems = s.maxItems;

    if (typeof minItems === 'number' && typeof maxItems === 'number' && minItems > maxItems) {
        return `${formatSchemaLocation(path)}minItems (${minItems}) cannot be greater than ` + `maxItems (${maxItems})`;
    }

    const minLen = s.minLength;
    const maxLen = s.maxLength;

    if (typeof minLen === 'number' && typeof maxLen === 'number' && minLen > maxLen) {
        return `${formatSchemaLocation(path)}minLength (${minLen}) cannot be greater than ` + `maxLength (${maxLen})`;
    }

    const minProp = s.minProperties;
    const maxProp = s.maxProperties;

    if (typeof minProp === 'number' && typeof maxProp === 'number' && minProp > maxProp) {
        return (
            `${formatSchemaLocation(path)}minProperties (${minProp}) cannot be greater than ` +
            `maxProperties (${maxProp})`
        );
    }

    if (typeof s.pattern === 'string' && s.pattern.length > 0) {
        try {
            new RegExp(s.pattern);
        } catch {
            return `${formatSchemaLocation(path)}pattern is not a valid regular expression`;
        }
    }

    if (Array.isArray(s.enum)) {
        const duplicateValue = findDuplicateSchemaValue(s.enum);

        if (duplicateValue !== undefined) {
            return `${formatSchemaLocation(path)}enum has duplicate value ${formatSchemaValue(duplicateValue)}`;
        }
    }

    if (Array.isArray(s.oneOf)) {
        const oneOfConstValues = s.oneOf
            .filter(
                (entry): entry is Record<string, unknown> =>
                    entry !== null &&
                    typeof entry === 'object' &&
                    !Array.isArray(entry) &&
                    Object.hasOwn(entry, 'const'),
            )
            .map((entry) => entry.const);
        const duplicateValue = findDuplicateSchemaValue(oneOfConstValues);

        if (duplicateValue !== undefined) {
            return `${formatSchemaLocation(path)}oneOf has duplicate value ${formatSchemaValue(duplicateValue)}`;
        }
    }

    const props = s.properties;

    if (props && typeof props === 'object' && !Array.isArray(props)) {
        for (const [key, child] of Object.entries(props)) {
            const seg = `properties[${JSON.stringify(key)}]`;
            const nextPath = path ? `${path}.${seg}` : seg;
            const err = validateJsonSchemaDocument(child, nextPath);

            if (err) return err;
        }
    }

    const items = s.items;

    if (items !== undefined) {
        if (Array.isArray(items)) {
            for (let i = 0; i < items.length; i += 1) {
                const seg = `items[${i}]`;
                const nextPath = path ? `${path}.${seg}` : seg;
                const err = validateJsonSchemaDocument(items[i], nextPath);

                if (err) return err;
            }
        } else {
            const seg = 'items';
            const nextPath = path ? `${path}.${seg}` : seg;
            const err = validateJsonSchemaDocument(items, nextPath);

            if (err) return err;
        }
    }

    const ap = s.additionalProperties;

    if (ap !== undefined && ap !== true && ap !== false && typeof ap === 'object' && !Array.isArray(ap)) {
        const seg = 'additionalProperties';
        const nextPath = path ? `${path}.${seg}` : seg;
        const err = validateJsonSchemaDocument(ap, nextPath);

        if (err) return err;
    }

    for (const comb of ['allOf', 'anyOf', 'oneOf'] as const) {
        const arr = s[comb];

        if (!Array.isArray(arr)) continue;

        for (let i = 0; i < arr.length; i += 1) {
            const seg = `${comb}[${i}]`;
            const nextPath = path ? `${path}.${seg}` : seg;
            const err = validateJsonSchemaDocument(arr[i], nextPath);

            if (err) return err;
        }
    }

    const notSchema = s.not;

    if (notSchema !== undefined && typeof notSchema === 'object' && notSchema !== null && !Array.isArray(notSchema)) {
        const seg = 'not';
        const nextPath = path ? `${path}.${seg}` : seg;

        return validateJsonSchemaDocument(notSchema, nextPath);
    }

    return null;
}
