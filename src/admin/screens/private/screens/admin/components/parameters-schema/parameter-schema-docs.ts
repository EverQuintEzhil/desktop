import { buildRequestValueFromSchema, resolveToolParameterProperties } from '../code-manager/code-manager.utils';

import type { ParameterFieldDocRow, ToolParameterSchema } from './tool-parameter-schema.types';

const joinSchemaPathForDocs = (parentPath: string, key: string): string => {
    if (!parentPath) return key;
    if (parentPath.endsWith('[]')) {
        return `${parentPath.slice(0, -2)}[].${key}`;
    }

    return `${parentPath}.${key}`;
};

const inferSchemaType = (schema?: ToolParameterSchema): string | undefined =>
    schema?.type ?? (schema?.properties ? 'object' : undefined) ?? (schema?.items ? 'array' : undefined);

/**
 * Example JSON value for documentation (enum first value, min/max bounds, nested objects, etc.).
 */
export const buildExampleForParameterSchema = (schema?: ToolParameterSchema): unknown => {
    if (!schema) return null;
    if (schema.default !== undefined) return schema.default;
    if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

    const inferred = inferSchemaType(schema);

    if ((inferred === 'object' || Boolean(schema.properties)) && schema.properties) {
        return Object.fromEntries(
            Object.entries(schema.properties).map(([k, child]) => [k, buildExampleForParameterSchema(child)]),
        );
    }

    if (inferred === 'array') {
        const itemExample = schema.items ? buildExampleForParameterSchema(schema.items) : null;

        return itemExample === null || itemExample === undefined ? [] : [itemExample];
    }

    if (inferred === 'boolean' || schema.type === 'boolean') return false;

    if (inferred === 'number' || inferred === 'integer' || schema.type === 'number' || schema.type === 'integer') {
        if (schema.minimum !== undefined) return schema.minimum;
        if (schema.maximum !== undefined) return schema.maximum;

        return 0;
    }

    if (inferred === 'string' || schema.type === 'string') {
        const minL = schema.minLength;

        if (minL !== undefined && minL > 0) {
            return 'x'.repeat(Math.min(minL, 64));
        }

        return 'example';
    }

    return buildRequestValueFromSchema(schema);
};

const collectParameterConstraintLines = (schema: ToolParameterSchema, isRequired: boolean): string[] => {
    const out: string[] = [];

    if (isRequired) {
        out.push('Required');
    }

    if (schema.description) {
        out.push(schema.description);
    }

    if (schema.enum !== undefined) {
        out.push(`Allowed values: ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`);
    }

    if (schema.default !== undefined) {
        out.push(`Default: ${JSON.stringify(schema.default)}`);
    }

    if (schema.minLength !== undefined) {
        out.push(`Minimum length: ${schema.minLength}`);
    }

    if (schema.maxLength !== undefined) {
        out.push(`Maximum length: ${schema.maxLength}`);
    }

    if (schema.pattern !== undefined) {
        out.push(`Pattern: ${schema.pattern}`);
    }

    if (schema.format !== undefined) {
        out.push(`Format: ${schema.format}`);
    }

    if (schema.minimum !== undefined) {
        out.push(`Minimum: ${schema.minimum}`);
    }

    if (schema.maximum !== undefined) {
        out.push(`Maximum: ${schema.maximum}`);
    }

    if (schema.multipleOf !== undefined) {
        out.push(`Multiple of: ${schema.multipleOf}`);
    }

    if (schema.minItems !== undefined) {
        out.push(`Minimum items: ${schema.minItems}`);
    }

    if (schema.maxItems !== undefined) {
        out.push(`Maximum items: ${schema.maxItems}`);
    }

    if (schema.uniqueItems === true) {
        out.push('Array items must be unique');
    }

    if (schema.minProperties !== undefined) {
        out.push(`Minimum properties: ${schema.minProperties}`);
    }

    if (schema.maxProperties !== undefined) {
        out.push(`Maximum properties: ${schema.maxProperties}`);
    }

    if (schema.additionalProperties === false) {
        out.push('Additional properties are not allowed');
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        out.push('Additional properties must match the extra-property schema');
    }

    return out;
};

const flattenItemParameterDocs = (itemSchema: ToolParameterSchema, itemPath: string): ParameterFieldDocRow[] => {
    const inferred = inferSchemaType(itemSchema) ?? 'unknown';
    const typeLabel = itemSchema.enum ? `${inferred} (enum)` : inferred;
    const example = buildExampleForParameterSchema(itemSchema);
    const rows: ParameterFieldDocRow[] = [
        {
            path: `${itemPath} (item shape)`,
            typeLabel,
            constraints: collectParameterConstraintLines(itemSchema, false),
            exampleJson: JSON.stringify(example, null, 2),
        },
    ];

    if (inferred === 'object' && itemSchema.properties) {
        const req = new Set(itemSchema.required ?? []);

        for (const [childKey, childSchema] of Object.entries(itemSchema.properties)) {
            rows.push(...flattenPropertyParameterDocs(childSchema, childKey, itemPath, req.has(childKey)));
        }
    }

    if (inferred === 'array' && itemSchema.items) {
        rows.push(...flattenItemParameterDocs(itemSchema.items, `${itemPath}[]`));
    }

    return rows;
};

const flattenPropertyParameterDocs = (
    schema: ToolParameterSchema,
    key: string,
    parentPath: string,
    isRequired: boolean,
): ParameterFieldDocRow[] => {
    const fullPath = joinSchemaPathForDocs(parentPath, key);
    const inferred = inferSchemaType(schema) ?? 'unknown';
    const typeLabel = schema.enum ? `${inferred} (enum)` : inferred;
    const example = buildExampleForParameterSchema(schema);

    const rows: ParameterFieldDocRow[] = [
        {
            path: fullPath,
            typeLabel,
            constraints: collectParameterConstraintLines(schema, isRequired),
            exampleJson: JSON.stringify(example, null, 2),
        },
    ];

    if (inferred === 'object' && schema.properties) {
        const req = new Set(schema.required ?? []);

        for (const [childKey, childSchema] of Object.entries(schema.properties)) {
            rows.push(...flattenPropertyParameterDocs(childSchema, childKey, fullPath, req.has(childKey)));
        }
    }

    if (inferred === 'array' && schema.items) {
        rows.push(...flattenItemParameterDocs(schema.items, `${fullPath}[]`));
    }

    return rows;
};

/**
 * Flattened rows for tool parameter JSON Schema (for documentation UI).
 */
export const buildParameterFieldDocs = (root?: ToolParameterSchema): ParameterFieldDocRow[] => {
    if (!root || Object.keys(root).length === 0) return [];

    const props = resolveToolParameterProperties(root);

    if (Object.keys(props).length === 0) return [];

    const required = new Set(root.required ?? []);

    return Object.entries(props).flatMap(([paramKey, schema]) =>
        flattenPropertyParameterDocs(schema, paramKey, '', required.has(paramKey)),
    );
};
