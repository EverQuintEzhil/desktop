export const FIELD_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object'] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export interface SchemaField {
    id: string;
    name: string;
    title: string;
    description: string;
    type: FieldType;
    required: boolean;
    readOnly: boolean;
    enumText: string;
    enumLabels: string;
    minText: string;
    maxText: string;
    multipleOfText: string;
    minLengthText: string;
    maxLengthText: string;
    patternText: string;
    formatText: string;
    minItemsText: string;
    maxItemsText: string;
    uniqueItems: boolean;
    minPropertiesText: string;
    maxPropertiesText: string;
    defaultValue: string;
    itemType: FieldType;
    properties: SchemaField[];
    additionalProperties: boolean;
}

function uid(): string {
    return Math.random().toString(36).slice(2, 10);
}

export function createField(overrides: Partial<SchemaField> = {}): SchemaField {
    return {
        id: uid(),
        name: '',
        title: '',
        description: '',
        type: 'string',
        required: false,
        readOnly: false,
        enumText: '',
        enumLabels: '',
        minText: '',
        maxText: '',
        multipleOfText: '',
        minLengthText: '',
        maxLengthText: '',
        patternText: '',
        formatText: '',
        minItemsText: '',
        maxItemsText: '',
        uniqueItems: false,
        minPropertiesText: '',
        maxPropertiesText: '',
        defaultValue: '',
        itemType: 'string',
        properties: [],
        additionalProperties: true,
        ...overrides,
    };
}

export function getSchemaAdditionalProperties(schema: Record<string, unknown> | null | undefined): boolean {
    if (!schema || typeof schema !== 'object') return false;

    return schema.additionalProperties === true;
}

/**
 * Carry over `id` from previous fields so React keys stay stable
 * and local component state (e.g. accordion open/closed) is preserved.
 */
export function mergeFieldIds(next: SchemaField[], prev: SchemaField[]): SchemaField[] {
    const prevByName = new Map(prev.filter((f) => f.name).map((f) => [f.name, f]));

    return next.map((field) => {
        const existing = prevByName.get(field.name);

        if (!existing) return field;

        const merged = { ...field, id: existing.id };

        if (merged.properties.length > 0 && existing.properties.length > 0) {
            merged.properties = mergeFieldIds(merged.properties, existing.properties);
        }

        return merged;
    });
}
