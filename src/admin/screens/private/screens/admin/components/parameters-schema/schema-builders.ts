import { createField, type FieldType, type SchemaField } from './schema-field';
import {
    parseDefaultValue,
    parseNumericEnumTokens,
    parseOptionalMultipleOf,
    parseOptionalNonNegativeInt,
    parseOptionalNumericBoundForSchemaEmit,
} from './schema-parsers';
import { isValidPatternSource } from './schema-validation';

/** Sets `oneOf`/`enum` on an array's `itemsSchema` from the field's enum tokens/labels. */
function applyArrayItemEnum(
    itemsSchema: Record<string, unknown>,
    itemType: string,
    enumValues: string[],
    enumLabelValues: string[],
    hasLabels: boolean,
): void {
    if (hasLabels) {
        if (itemType === 'string') {
            itemsSchema.oneOf = enumValues.map((val, i) => ({
                const: val,
                title: enumLabelValues[i] || val,
            }));
        } else {
            const nums = parseNumericEnumTokens(enumValues, itemType === 'integer' ? 'integer' : 'number');

            if (nums !== undefined) {
                itemsSchema.oneOf = nums.map((num, i) => ({
                    const: num,
                    title: enumLabelValues[i] || String(num),
                }));
            }
        }
    } else if (itemType === 'string') {
        itemsSchema.enum = enumValues;
    } else {
        const nums = parseNumericEnumTokens(enumValues, itemType === 'integer' ? 'integer' : 'number');

        if (nums !== undefined) itemsSchema.enum = nums;
    }
}

function buildPropertySchema(field: SchemaField): Record<string, unknown> {
    const schema: Record<string, unknown> = { type: field.type };

    if (field.title) schema.title = field.title;
    if (field.description) schema.description = field.description;
    if (field.readOnly) schema.readOnly = true;

    const enumValues = (field.enumText || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

    const enumLabelValues = (field.enumLabels || '').split(',').map((v) => v.trim());

    const hasLabels =
        enumValues.length > 0 && enumLabelValues.length === enumValues.length && enumLabelValues.some((l) => l !== '');

    if (enumValues.length > 0 && ['string', 'number', 'integer'].includes(field.type)) {
        if (hasLabels) {
            if (field.type === 'string') {
                schema.oneOf = enumValues.map((val, i) => ({
                    const: val,
                    title: enumLabelValues[i] || val,
                }));
            } else {
                const nums = parseNumericEnumTokens(enumValues, field.type === 'integer' ? 'integer' : 'number');

                if (nums !== undefined) {
                    schema.oneOf = nums.map((num, i) => ({
                        const: num,
                        title: enumLabelValues[i] || String(num),
                    }));
                }
            }
        } else if (field.type === 'string') {
            schema.enum = enumValues;
        } else {
            const nums = parseNumericEnumTokens(enumValues, field.type === 'integer' ? 'integer' : 'number');

            if (nums !== undefined) schema.enum = nums;
        }
    }

    if (field.type === 'string') {
        const minL = parseOptionalNonNegativeInt(field.minLengthText);
        const maxL = parseOptionalNonNegativeInt(field.maxLengthText);

        if (minL !== undefined) schema.minLength = minL;
        if (maxL !== undefined) schema.maxLength = maxL;

        if (field.patternText.trim() && isValidPatternSource(field.patternText)) {
            schema.pattern = field.patternText;
        }

        if (field.formatText.trim()) schema.format = field.formatText.trim();
    }

    if (field.type === 'number' || field.type === 'integer') {
        const mode = field.type === 'integer' ? 'integer' : 'number';
        const min = parseOptionalNumericBoundForSchemaEmit(field.minText, mode);
        const max = parseOptionalNumericBoundForSchemaEmit(field.maxText, mode);

        if (min !== undefined) schema.minimum = min;
        if (max !== undefined) schema.maximum = max;

        const mult = parseOptionalMultipleOf(field.multipleOfText, mode);

        if (mult !== undefined) schema.multipleOf = mult;
    }

    const parsedDefault = parseDefaultValue(field.type, field.defaultValue);

    if (parsedDefault !== undefined) schema.default = parsedDefault;

    if (field.type === 'array') {
        if (field.itemType === 'object') {
            const nested = buildObjectSchema(field.properties || []);

            schema.items = {
                type: 'object',
                properties: nested.properties,
                ...(nested.required?.length ? { required: nested.required } : {}),
                additionalProperties: field.additionalProperties,
            };
        } else {
            const itemType = field.itemType || 'string';
            const itemsSchema: Record<string, unknown> = { type: itemType };

            if (enumValues.length > 0 && ['string', 'number', 'integer'].includes(itemType)) {
                applyArrayItemEnum(itemsSchema, itemType, enumValues, enumLabelValues, hasLabels);
            }

            if (itemType === 'number' || itemType === 'integer') {
                const mode = itemType === 'integer' ? 'integer' : 'number';
                const min = parseOptionalNumericBoundForSchemaEmit(field.minText, mode);
                const max = parseOptionalNumericBoundForSchemaEmit(field.maxText, mode);

                if (min !== undefined) itemsSchema.minimum = min;
                if (max !== undefined) itemsSchema.maximum = max;

                const mult = parseOptionalMultipleOf(field.multipleOfText, mode);

                if (mult !== undefined) itemsSchema.multipleOf = mult;
            }

            schema.items = itemsSchema;
        }

        const minI = parseOptionalNonNegativeInt(field.minItemsText);
        const maxI = parseOptionalNonNegativeInt(field.maxItemsText);

        if (minI !== undefined) schema.minItems = minI;
        if (maxI !== undefined) schema.maxItems = maxI;
        if (field.uniqueItems) schema.uniqueItems = true;
    }

    if (field.type === 'object') {
        const nested = buildObjectSchema(field.properties || []);

        schema.properties = nested.properties;
        if (nested.required?.length) schema.required = nested.required;
        schema.additionalProperties = field.additionalProperties;

        const minP = parseOptionalNonNegativeInt(field.minPropertiesText);
        const maxP = parseOptionalNonNegativeInt(field.maxPropertiesText);

        if (minP !== undefined) schema.minProperties = minP;
        if (maxP !== undefined) schema.maxProperties = maxP;
    }

    return schema;
}

interface ObjectSchema {
    type: string;
    properties: Record<string, Record<string, unknown>>;
    required?: string[];
    additionalProperties?: boolean;
}

export function buildObjectSchema(fields: SchemaField[], additionalProperties?: boolean): ObjectSchema {
    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];

    fields.forEach((field) => {
        if (!field.name) return;
        properties[field.name] = buildPropertySchema(field);
        if (field.required) required.push(field.name);
    });

    return {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        ...(additionalProperties !== undefined ? { additionalProperties } : {}),
    };
}

export function fieldsToSchema(fields: SchemaField[], additionalProperties?: boolean): object {
    return buildObjectSchema(fields, additionalProperties);
}

/**
 * Reverse: parse a JSON Schema object into SchemaField[] representation.
 * Handles nested objects and arrays of objects.
 */
export function schemaToFields(schema: Record<string, unknown> | null | undefined): SchemaField[] {
    if (!schema || typeof schema !== 'object') return [];

    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;

    if (!properties || typeof properties !== 'object') return [];

    const requiredList = Array.isArray(schema.required) ? (schema.required as string[]) : [];

    return Object.entries(properties).map(([name, prop]) => {
        const type = (prop.type as FieldType) || 'string';

        let defaultValueStr = '';

        if (prop.default !== undefined) {
            if (typeof prop.default === 'object') {
                defaultValueStr = JSON.stringify(prop.default);
            } else {
                defaultValueStr = String(prop.default);
            }
        }

        const items = prop.items as Record<string, unknown> | undefined;

        let enumText = '';
        let enumLabels = '';

        type OneOfEntry = { const?: unknown; title?: string };

        if (type === 'array' && Array.isArray(items?.oneOf)) {
            const entries = items.oneOf as OneOfEntry[];

            enumText = entries.map((e) => String(e.const ?? '')).join(', ');
            enumLabels = entries.map((e) => e.title ?? '').join(', ');
        } else if (type === 'array' && Array.isArray(items?.enum)) {
            enumText = (items.enum as unknown[]).join(', ');
        } else if (Array.isArray(prop.oneOf)) {
            const entries = prop.oneOf as OneOfEntry[];

            enumText = entries.map((e) => String(e.const ?? '')).join(', ');
            enumLabels = entries.map((e) => e.title ?? '').join(', ');
        } else if (Array.isArray(prop.enum)) {
            enumText = prop.enum.join(', ');
        }

        let minText = '';
        let maxText = '';
        let multipleOfText = '';
        let minLengthText = '';
        let maxLengthText = '';
        let patternText = '';
        let formatText = '';
        let minItemsText = '';
        let maxItemsText = '';
        let uniqueItems = false;
        let minPropertiesText = '';
        let maxPropertiesText = '';

        if (type === 'string') {
            if (prop.minLength !== undefined) {
                minLengthText = String(prop.minLength);
            }
            if (prop.maxLength !== undefined) {
                maxLengthText = String(prop.maxLength);
            }
            if (typeof prop.pattern === 'string') {
                patternText = prop.pattern;
            }
            if (typeof prop.format === 'string') {
                formatText = prop.format;
            }
        }

        if (type === 'number' || type === 'integer') {
            if (prop.minimum !== undefined) minText = String(prop.minimum);
            if (prop.maximum !== undefined) maxText = String(prop.maximum);
            if (typeof prop.multipleOf === 'number') {
                multipleOfText = String(prop.multipleOf);
            }
        } else if (type === 'array' && items) {
            const itemType = (items.type as FieldType) || 'string';

            if (itemType === 'number' || itemType === 'integer') {
                if (items.minimum !== undefined) minText = String(items.minimum);
                if (items.maximum !== undefined) maxText = String(items.maximum);
                if (typeof items.multipleOf === 'number') {
                    multipleOfText = String(items.multipleOf);
                }
            }
        }

        if (type === 'array') {
            if (prop.minItems !== undefined) minItemsText = String(prop.minItems);
            if (prop.maxItems !== undefined) maxItemsText = String(prop.maxItems);
            if (prop.uniqueItems === true) uniqueItems = true;
        }

        if (type === 'object') {
            if (prop.minProperties !== undefined) {
                minPropertiesText = String(prop.minProperties);
            }
            if (prop.maxProperties !== undefined) {
                maxPropertiesText = String(prop.maxProperties);
            }
        }

        const field = createField({
            name,
            title: (prop.title as string) || '',
            description: (prop.description as string) || '',
            type,
            required: requiredList.includes(name),
            readOnly: prop.readOnly === true,
            enumText,
            enumLabels,
            minText,
            maxText,
            multipleOfText,
            minLengthText,
            maxLengthText,
            patternText,
            formatText,
            minItemsText,
            maxItemsText,
            uniqueItems,
            minPropertiesText,
            maxPropertiesText,
            defaultValue: defaultValueStr,
        });

        if (type === 'array') {
            if (items?.type === 'object') {
                field.itemType = 'object';
                field.properties = schemaToFields(items);
                field.additionalProperties = items.additionalProperties === true;
            } else {
                field.itemType = (items?.type as FieldType) || 'string';
            }
        }

        if (type === 'object') {
            field.properties = schemaToFields(prop);
            field.additionalProperties = prop.additionalProperties === true;
        }

        return field;
    });
}
