import type { ModelType } from '@/types/admin';
import type { ParameterType } from '@/types/ui';

type JsonSchemaProperty = {
    type?: unknown;
    title?: unknown;
    enum?: unknown;
    oneOf?: unknown;
    default?: unknown;
    minimum?: unknown;
    maximum?: unknown;
    multipleOf?: unknown;
};

type OneOfEntry = { const?: unknown; title?: string };

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const numberOrUndefined = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const toSelectParameter = (
    key: string,
    property: JsonSchemaProperty,
    options: { label: string; value: string }[],
): ParameterType => {
    const defaultValue = property.default !== undefined ? String(property.default) : (options[0]?.value ?? '');
    const defaultOption = options.find((o) => o.value === defaultValue) ?? {
        label: defaultValue,
        value: defaultValue,
    };

    return {
        type: 'select',
        label: typeof property.title === 'string' ? property.title : key,
        default: defaultOption,
        options,
    };
};

const toRangeParameter = (key: string, property: JsonSchemaProperty): ParameterType => {
    const min = numberOrUndefined(property.minimum) ?? 0;
    const max = numberOrUndefined(property.maximum) ?? 1;
    const defaultValue = numberOrUndefined(property.default) ?? min;
    const step = numberOrUndefined(property.multipleOf) ?? (property.type === 'integer' ? 1 : 0.1);

    return {
        type: 'range',
        label: typeof property.title === 'string' ? property.title : key,
        default: defaultValue,
        range: { min, max, step },
    };
};

const jsonSchemaPropertyToUiParameter = (key: string, property: JsonSchemaProperty): ParameterType | undefined => {
    if (Array.isArray(property.oneOf) && property.oneOf.length > 0) {
        const entries = property.oneOf as OneOfEntry[];
        const options = entries
            .filter((e) => e.const !== undefined)
            .map((e) => {
                const value = String(e.const);

                return { label: e.title ?? value, value };
            });

        if (options.length > 0) return toSelectParameter(key, property, options);
    }

    if (Array.isArray(property.enum) && property.enum.length > 0) {
        const options = (property.enum as unknown[]).map((value) => {
            const stringValue = String(value);

            return { label: stringValue, value: stringValue };
        });

        return toSelectParameter(key, property, options);
    }

    if (property.type === 'number' || property.type === 'integer') {
        return toRangeParameter(key, property);
    }

    if (property.type === 'boolean') {
        return {
            type: 'toggle',
            label: typeof property.title === 'string' ? property.title : key,
            default: property.default === true,
        };
    }

    if (property.type === 'string') {
        return {
            component: 'textbox' as const,
            label: typeof property.title === 'string' ? property.title : key,
        };
    }

    return undefined;
};

/**
 * Converts a model's JSON schema parameters object into UI parameter definitions.
 * Supports both `{ properties: { ... } }` and flat `{ key: property }` shapes.
 */
export const copyModelParameters = (
    parameters: ModelType['parameters'] | undefined,
): Record<string, ParameterType> | undefined => {
    if (!isPlainRecord(parameters)) return undefined;

    const properties = isPlainRecord(parameters.properties) ? parameters.properties : parameters;

    const entries = Object.entries(properties).flatMap(([key, property]) => {
        if (!isPlainRecord(property)) return [];
        const parameter = jsonSchemaPropertyToUiParameter(key, property);

        return parameter ? [[key, parameter] as const] : [];
    });

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};
