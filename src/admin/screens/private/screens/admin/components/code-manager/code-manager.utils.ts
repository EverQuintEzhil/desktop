import { StreamLanguage } from '@codemirror/language';
import { lua } from '@codemirror/legacy-modes/mode/lua';

import type { CodeLangEnum, ModelType } from '@/types/admin';

import type { ToolParameterSchema } from '../parameters-schema/tool-parameter-schema.types';

export const luaExtensions = [StreamLanguage.define(lua)];

export const langLabel = (l: CodeLangEnum): string => {
    const map: Record<CodeLangEnum, string> = {
        lua: 'Lua',
        markdown: 'Markdown',
        plain_text: 'Plain Text',
        json: 'JSON',
    };

    return map[l] ?? l;
};

export const executionResultPlainText = (data: unknown): string => {
    if (typeof data === 'string') {
        return data;
    }
    if (data == null) {
        return '';
    }

    return String(data);
};

const joinSchemaPath = (path: string, segment: string): string => (path ? `${path}.${segment}` : segment);

const inferSchemaType = (schema?: ToolParameterSchema): string | undefined =>
    schema?.type ?? (schema?.properties ? 'object' : undefined) ?? (schema?.items ? 'array' : undefined);

/** Required fields must be present and not "empty" for the given type (string trim, array length, etc.). */
const validateRequiredPropertyValue = (
    value: unknown,
    propSchema: ToolParameterSchema | undefined,
    path: string,
): string | null => {
    if (value === undefined || value === null) {
        return `${path} is required`;
    }

    const inferred = inferSchemaType(propSchema);

    if (inferred === 'string') {
        if (typeof value !== 'string') {
            return `${path} must be string`;
        }
        if (value.trim() === '') {
            return `${path} cannot be empty`;
        }

        return null;
    }

    if (inferred === 'array') {
        if (!Array.isArray(value)) {
            return `${path} must be array`;
        }
        if (value.length === 0) {
            return `${path} must have at least one item`;
        }

        return null;
    }

    if (inferred === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return `${path} must be object`;
        }

        return null;
    }

    if (inferred === 'number') {
        return typeof value === 'number' && !Number.isNaN(value) ? null : `${path} must be number`;
    }

    if (inferred === 'integer') {
        return typeof value === 'number' && Number.isInteger(value) && !Number.isNaN(value)
            ? null
            : `${path} must be integer`;
    }

    if (inferred === 'boolean') {
        return typeof value === 'boolean' ? null : `${path} must be boolean`;
    }

    if (typeof value === 'string') {
        return value.trim() === '' ? `${path} cannot be empty` : null;
    }

    if (Array.isArray(value)) {
        return value.length === 0 ? `${path} must have at least one item` : null;
    }

    return null;
};

export const buildRequestValueFromSchema = (schema?: ToolParameterSchema): unknown => {
    if (!schema) return '';

    if (schema.default !== undefined) {
        return schema.default;
    }

    if (schema.type === 'object') {
        const properties = schema.properties ?? {};

        return Object.entries(properties).reduce<Record<string, unknown>>((acc, [key, value]) => {
            acc[key] = buildRequestValueFromSchema(value);

            return acc;
        }, {});
    }

    if (schema.type === 'array') {
        return [];
    }

    if (schema.type === 'boolean') {
        return false;
    }

    if (schema.type === 'number' || schema.type === 'integer') {
        return 0;
    }

    return '';
};

export const buildRequestBodyFromParameterSchema = (rootSchema?: ToolParameterSchema): Record<string, unknown> => {
    if (!rootSchema) return {};

    const isObjectSchema = rootSchema.type === 'object' || Boolean(rootSchema.properties);

    if (!isObjectSchema) return {};

    const properties = rootSchema.properties ?? {};

    return Object.entries(properties).reduce<Record<string, unknown>>((acc, [key, value]) => {
        acc[key] = buildRequestValueFromSchema(value);

        return acc;
    }, {});
};

const coerceModelConfigPayload = (value: unknown): Record<string, unknown> => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    return {};
};

const isPlainObjectRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * JSON Schema-style parameter object → map of property key → property schema.
 * Supports either `{ type: 'object', properties: { ... } }` or a flat `{ key: schema }` map.
 */
export const resolveToolParameterProperties = (
    parameters?: ToolParameterSchema,
): Record<string, ToolParameterSchema> => {
    if (!isPlainObjectRecord(parameters)) return {};
    if (isPlainObjectRecord(parameters.properties)) {
        return parameters.properties as Record<string, ToolParameterSchema>;
    }

    return parameters as Record<string, ToolParameterSchema>;
};

/**
 * Parse agent model config JSON into a map of model identifier → per-model settings object.
 * Invalid JSON or non-object roots yield {}. Non-object values under a key become {}.
 */
export const parseAgentModelConfigObject = (code: string): Record<string, Record<string, unknown>> => {
    const trimmed = (code ?? '').trim();

    if (!trimmed) {
        return {};
    }

    try {
        const parsed = JSON.parse(trimmed) as unknown;

        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }

        return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, Record<string, unknown>>>(
            (acc, [key, val]) => {
                acc[key] = coerceModelConfigPayload(val);

                return acc;
            },
            {},
        );
    } catch {
        return {};
    }
};

/**
 * Stable key order: agent models in definition order, then extra keys (e.g. legacy) sorted lexically.
 */
export const stringifyAgentModelConfig = (
    config: Record<string, Record<string, unknown>>,
    agentModels: ModelType[] | undefined,
): string => {
    const ordered: Record<string, Record<string, unknown>> = {};
    const seen = new Set<string>();

    for (const model of agentModels ?? []) {
        if (Object.prototype.hasOwnProperty.call(config, model.model)) {
            ordered[model.model] = config[model.model];
            seen.add(model.model);
        }
    }

    const extraKeys = Object.keys(config)
        .filter((key) => !seen.has(key))
        .sort((a, b) => a.localeCompare(b));

    for (const key of extraKeys) {
        ordered[key] = config[key];
    }

    return JSON.stringify(ordered, null, 2);
};

/** Returns null when JSON is invalid or not a plain object (e.g. mid-edit in the JSON tab). */
export const tryParseAgentModelConfigObject = (code: string): Record<string, Record<string, unknown>> | null => {
    const trimmed = (code ?? '').trim();

    if (!trimmed) {
        return {};
    }

    try {
        const parsed = JSON.parse(trimmed) as unknown;

        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, Record<string, unknown>>>(
            (acc, [key, val]) => {
                acc[key] = coerceModelConfigPayload(val);

                return acc;
            },
            {},
        );
    } catch {
        return null;
    }
};

const hasRootToolParameterSchema = (parameters: unknown): boolean =>
    Object.keys(resolveToolParameterProperties(parameters as ToolParameterSchema | undefined)).length > 0;

/** Default JSON for the agent model config editor: model id → body from each model’s parameter schema. */
export const stringifyAgentModelConfigDefaults = (models: ModelType[] | undefined): string => {
    const record: Record<string, Record<string, unknown>> = Object.fromEntries(
        (models ?? [])
            .filter((model) => hasRootToolParameterSchema(model.parameters))
            .map((model) => [
                model.model,
                coerceModelConfigPayload(buildRequestBodyFromParameterSchema(model.parameters as ToolParameterSchema)),
            ]),
    );

    return stringifyAgentModelConfig(record, models);
};

/**
 * Validates parsed model-config JSON against each agent model’s parameter schema when that model has a payload.
 * Returns a user-facing message or null. Handles invalid / non-object JSON safely.
 */
export const getAgentModelConfigValidationError = (
    parsedConfig: unknown,
    models: ModelType[] | undefined,
): string | null => {
    if (!models?.length) {
        return null;
    }

    if (
        parsedConfig === undefined ||
        parsedConfig === null ||
        typeof parsedConfig !== 'object' ||
        Array.isArray(parsedConfig)
    ) {
        return 'Invalid JSON object';
    }

    const byModelId = parsedConfig as Record<string, unknown>;

    for (const model of models) {
        const payload = byModelId[model.model];

        if (!payload) {
            continue;
        }

        const modelSchemaError = validateRequestBodyWithToolParameters(payload, model.parameters || {});

        if (modelSchemaError) {
            return `Model ${model.model} : ${modelSchemaError}`;
        }
    }

    return null;
};

const getSchemaType = (value: unknown): string => {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';

    return typeof value;
};

const isIntegralMultipleQuotient = (q: number): boolean => {
    const rounded = Math.round(q);

    return Math.abs(q - rounded) <= 1e-10 * Math.max(1, Math.abs(q));
};

const validateStringFormat = (s: string, format: string, fieldPath: string): string | null => {
    switch (format) {
        case 'email':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? null : `${fieldPath} must match format "email"`;
        case 'uri': {
            try {
                const u = new URL(s);

                if (!u.protocol) {
                    return `${fieldPath} must match format "uri"`;
                }
            } catch {
                return `${fieldPath} must match format "uri"`;
            }

            return null;
        }
        default:
            return null;
    }
};

const validateStringConstraints = (s: string, schema: ToolParameterSchema, fieldPath: string): string | null => {
    if (schema.minLength !== undefined && s.length < schema.minLength) {
        return `${fieldPath} must be at least ${schema.minLength} characters`;
    }

    if (schema.maxLength !== undefined && s.length > schema.maxLength) {
        return `${fieldPath} must be at most ${schema.maxLength} characters`;
    }

    if (schema.pattern !== undefined) {
        let re: RegExp;

        try {
            re = new RegExp(schema.pattern);
        } catch {
            return `${fieldPath} schema pattern is invalid`;
        }

        if (!re.test(s)) {
            return `${fieldPath} does not match the required pattern`;
        }
    }

    if (schema.format !== undefined) {
        return validateStringFormat(s, schema.format, fieldPath);
    }

    return null;
};

const validateNumberConstraints = (n: number, schema: ToolParameterSchema, fieldPath: string): string | null => {
    if (schema.minimum !== undefined && n < schema.minimum) {
        return `${fieldPath} must be >= ${schema.minimum}`;
    }

    if (schema.maximum !== undefined && n > schema.maximum) {
        return `${fieldPath} must be <= ${schema.maximum}`;
    }

    if (schema.multipleOf !== undefined && schema.multipleOf > 0) {
        const m = schema.multipleOf;
        const q = n / m;

        if (!isIntegralMultipleQuotient(q)) {
            return `${fieldPath} must be a multiple of ${m}`;
        }
    }

    return null;
};

const validateSchemaValue = (value: unknown, schema: ToolParameterSchema, path: string): string | null => {
    const inferredType = inferSchemaType(schema);
    const fieldPath = path || 'Parameter';
    const enumApplicableTypes = ['string', 'number', 'integer'];

    if (schema.enum !== undefined && inferredType && enumApplicableTypes.includes(inferredType)) {
        const isEmpty = value === null || value === undefined || value === '';

        if (isEmpty) return null;

        const allowed = schema.enum;
        const isAllowed = allowed.some((v) => JSON.stringify(v) === JSON.stringify(value));

        if (!isAllowed) {
            const allowedList = allowed.map((v) => JSON.stringify(v)).join(', ');

            return `${fieldPath} must be one of [${allowedList}]`;
        }
    }

    if (!inferredType) return null;

    if (inferredType === 'string') {
        if (typeof value !== 'string') {
            return `${fieldPath} must be string`;
        }

        return validateStringConstraints(value, schema, fieldPath);
    }

    if (inferredType === 'boolean') {
        return typeof value === 'boolean' ? null : `${fieldPath} must be boolean`;
    }

    if (inferredType === 'number') {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            return `${fieldPath} must be number`;
        }

        return validateNumberConstraints(value, schema, fieldPath);
    }

    if (inferredType === 'integer') {
        if (typeof value !== 'number' || !Number.isInteger(value) || Number.isNaN(value)) {
            return `${fieldPath} must be integer`;
        }

        return validateNumberConstraints(value, schema, fieldPath);
    }

    if (inferredType === 'array') {
        if (!Array.isArray(value)) {
            return `${fieldPath} must be array`;
        }

        const arr = value as unknown[];

        if (schema.minItems !== undefined && arr.length < schema.minItems) {
            return `${fieldPath} must have at least ${schema.minItems} items`;
        }

        if (schema.maxItems !== undefined && arr.length > schema.maxItems) {
            return `${fieldPath} must have at most ${schema.maxItems} items`;
        }

        if (schema.uniqueItems === true) {
            const seen = new Set<string>();

            for (let i = 0; i < arr.length; i += 1) {
                const el = arr[i];
                const key = el !== null && typeof el === 'object' ? JSON.stringify(el) : String(el);

                if (seen.has(key)) {
                    return `${fieldPath} must have unique items (duplicate at index ${i})`;
                }

                seen.add(key);
            }
        }

        if (!schema.items) return null;

        for (let i = 0; i < arr.length; i += 1) {
            const itemError = validateSchemaValue(arr[i], schema.items, `${fieldPath}[${i}]`);

            if (itemError) {
                return itemError;
            }
        }

        return null;
    }

    if (inferredType === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return `${fieldPath} must be object`;
        }

        const objValue = value as Record<string, unknown>;
        const keys = Object.keys(objValue);

        if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
            return `${fieldPath} must have at least ${schema.minProperties} properties`;
        }

        if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
            return `${fieldPath} must have at most ${schema.maxProperties} properties`;
        }

        const properties = schema.properties ?? {};
        const requiredKeys = schema.required ?? [];
        const ap = schema.additionalProperties;

        for (const key of requiredKeys) {
            const childPath = joinSchemaPath(path, key);

            if (!(key in objValue)) {
                return `${childPath} is required`;
            }

            const requiredValueError = validateRequiredPropertyValue(objValue[key], properties[key], childPath);

            if (requiredValueError) {
                return requiredValueError;
            }
        }

        for (const key of Object.keys(objValue)) {
            const childPath = joinSchemaPath(path, key);
            const propSchema = properties[key];

            if (propSchema) {
                const childError = validateSchemaValue(objValue[key], propSchema, childPath);

                if (childError) {
                    return childError;
                }

                continue;
            }

            if (ap === false) {
                return `Unexpected property '${childPath}' (additional properties are not allowed)`;
            }

            if (ap && typeof ap === 'object' && !Array.isArray(ap)) {
                const extraError = validateSchemaValue(objValue[key], ap, childPath);

                if (extraError) {
                    return extraError;
                }
            }
        }

        return null;
    }

    return `Unsupported schema type for ${fieldPath}: expected ${inferredType}, got ${getSchemaType(value)}`;
};

export const validateRequestBodyWithToolParameters = (
    requestBody: unknown,
    rootParameterSchema?: ToolParameterSchema,
): string | null => {
    if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
        return 'Parameters must be a valid JSON object';
    }

    if (!rootParameterSchema || Object.keys(rootParameterSchema).length === 0) {
        return null;
    }

    return validateSchemaValue(requestBody, rootParameterSchema, '');
};
