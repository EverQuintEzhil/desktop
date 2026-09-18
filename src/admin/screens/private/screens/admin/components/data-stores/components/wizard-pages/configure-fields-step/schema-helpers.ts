export function setsEqualString(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) {
        if (!b.has(x)) return false;
    }

    return true;
}

export interface SchemaField {
    path: string;
    name: string;
    type: string;
    format?: string;
    nullable: boolean;
    depth: number;
    hasChildren: boolean;
}

export function resolveSchemaType(schema: Record<string, unknown>): {
    type: string;
    format?: string;
    nullable: boolean;
    resolvedSchema: Record<string, unknown>;
} {
    if (schema.anyOf && Array.isArray(schema.anyOf)) {
        const anyOf = schema.anyOf as Record<string, unknown>[];
        const nonNull = anyOf.filter((s) => s.type !== 'null');
        const hasNull = anyOf.some((s) => s.type === 'null');

        if (nonNull.length === 1) {
            const inner = resolveSchemaType(nonNull[0]);

            return { ...inner, nullable: hasNull || inner.nullable };
        }

        const types = nonNull.map((s) => s.type ?? 'unknown').join(' | ');

        return {
            type: types as string,
            nullable: hasNull,
            resolvedSchema: schema,
        };
    }

    if (Array.isArray(schema.type)) {
        const types = schema.type as string[];
        const nonNull = types.filter((t) => t !== 'null');
        const hasNull = types.includes('null');

        return {
            type: nonNull.join(' | '),
            format: schema.format as string | undefined,
            nullable: hasNull,
            resolvedSchema: schema,
        };
    }

    return {
        type: (schema.type as string) ?? 'unknown',
        format: schema.format as string | undefined,
        nullable: false,
        resolvedSchema: schema,
    };
}

export function flattenSchema(properties: Record<string, unknown>, parentPath = '', depth = 0): SchemaField[] {
    const fields: SchemaField[] = [];

    for (const [key, rawDef] of Object.entries(properties)) {
        const schemaDef = rawDef as Record<string, unknown>;
        const path = parentPath ? `${parentPath}.${key}` : key;
        const { type, format, nullable, resolvedSchema } = resolveSchemaType(schemaDef);

        const items = resolvedSchema.items as Record<string, unknown> | undefined;
        const resolvedProps = resolvedSchema.properties as Record<string, unknown> | undefined;
        const itemProps = items?.properties as Record<string, unknown> | undefined;

        const isObjectWithProps = type === 'object' && resolvedProps != null;
        const isArrayWithObjectItems = type === 'array' && items?.type === 'object' && itemProps != null;
        const hasChildren = isObjectWithProps || isArrayWithObjectItems;

        fields.push({
            path,
            name: key,
            type,
            format,
            nullable,
            depth,
            hasChildren,
        });

        if (isObjectWithProps && resolvedProps) {
            fields.push(...flattenSchema(resolvedProps, path, depth + 1));
        } else if (isArrayWithObjectItems && itemProps) {
            fields.push(...flattenSchema(itemProps, path, depth + 1));
        }
    }

    return fields;
}

const FIELDS_TYPE_BADGE_CLASS: Record<string, string> = {
    string: 'field-type-string',
    integer: 'field-type-number',
    number: 'field-type-number',
    boolean: 'field-type-boolean',
    object: 'field-type-object',
    array: 'field-type-array',
};

export function getFieldsTypeBadgeClass(type: string): string {
    for (const [key, cls] of Object.entries(FIELDS_TYPE_BADGE_CLASS)) {
        if (type.includes(key)) return `field-type-badge ${cls}`;
    }

    return 'field-type-badge field-type-other';
}

export type FieldsState = {
    data: null | {
        totalCount: number;
        schema: { type: string; properties: Record<string, unknown> };
        sample: Record<string, unknown>[];
    };
    loading: boolean;
    error: boolean;
};

export const FIELDS_STEPS = [
    { step: 1, label: 'Embedding Fields' },
    { step: 2, label: 'Metadata Fields' },
] as const;
