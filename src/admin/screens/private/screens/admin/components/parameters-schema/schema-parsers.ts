import type { FieldType } from './schema-field';

export function parseDefaultValue(type: FieldType, value: string): unknown {
    if (value === '') return undefined;
    try {
        if (type === 'number' || type === 'integer') return Number(value);
        if (type === 'boolean') return value === 'true';
        if (type === 'array' || type === 'object') return JSON.parse(value);

        return value;
    } catch {
        return value;
    }
}

/** JSON.stringify drops NaN (becomes null). Only emit numeric enums when every token parses. */
export function parseOptionalNumericBound(value: string, mode: 'number' | 'integer'): number | undefined {
    const trimmed = value.trim();

    if (trimmed === '') return undefined;

    const n = Number(trimmed);

    if (!Number.isFinite(n)) return undefined;
    if (mode === 'integer' && !Number.isInteger(n)) return undefined;

    return n;
}

export function parseOptionalNonNegativeInt(value: string): number | undefined {
    const trimmed = value.trim();

    if (trimmed === '') return undefined;

    const n = Number(trimmed);

    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return undefined;

    return n;
}

/** Positive finite number; for `integer` schema type, value must be a positive integer. */
export function parseOptionalMultipleOf(value: string, mode: 'number' | 'integer'): number | undefined {
    const trimmed = value.trim();

    if (trimmed === '') return undefined;

    const n = Number(trimmed);

    if (!Number.isFinite(n) || n <= 0) return undefined;
    if (mode === 'integer' && !Number.isInteger(n)) return undefined;

    return n;
}

/**
 * True when the value might still be mid-edit (e.g. "0" before "0.1", "0." before "0.2").
 * We skip the "Multiple of must be a positive number" check in that case for live validation only.
 */
export const isPartialMultipleOfInput = (value: string, mode: 'number' | 'integer'): boolean => {
    const t = value.trim();

    if (t === '' || mode === 'integer') {
        return false;
    }

    if (t === '.' || t === '-' || t === '-.') {
        return true;
    }

    if (/^-?\d+\.$/.test(t)) {
        return true;
    }

    if (t === '0') {
        return true;
    }

    if (/^0\.0+$/.test(t)) {
        return true;
    }

    return false;
};

/**
 * Minimum/maximum are unconstrained on sign; only detect inputs still being edited
 * (e.g. "0." before "0.25", "-" before "-1"). Unlike {@link isPartialMultipleOfInput}, bare "0" is final.
 */
export const isPartialMinMaxBoundInput = (value: string): boolean => {
    const t = value.trim();

    if (t === '') {
        return false;
    }

    if (t === '.' || t === '-' || t === '-.') {
        return true;
    }

    if (/^-?\d+\.$/.test(t)) {
        return true;
    }

    return false;
};

/**
 * Use when writing JSON Schema so partial min/max text does not become a misleading number
 * (e.g. `Number("0.") === 0` would falsely satisfy minimum vs maximum checks mid-edit).
 */
export const parseOptionalNumericBoundForSchemaEmit = (
    value: string,
    mode: 'number' | 'integer',
): number | undefined => {
    if (isPartialMinMaxBoundInput(value)) {
        return undefined;
    }

    return parseOptionalNumericBound(value, mode);
};

export type ValidateSchemaFieldsOptions = {
    /**
     * When true, tolerate in-progress numeric fields during live validation: multipleOf (e.g. "0"
     * before "0.1"), and minimum/maximum ordering while either bound still looks mid-edit.
     */
    allowPartialMultipleOf?: boolean;
};

export function parseNumericEnumTokens(tokens: string[], mode: 'number' | 'integer'): number[] | undefined {
    const out: number[] = [];

    for (const raw of tokens) {
        const n = Number(raw);

        if (!Number.isFinite(n)) return undefined;
        if (mode === 'integer' && !Number.isInteger(n)) return undefined;

        out.push(n);
    }

    return out;
}
