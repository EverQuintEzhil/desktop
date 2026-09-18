import { describe, expect, it } from 'vitest';

import { fieldsToSchema, schemaToFields } from './schema-builders';
import { createField } from './schema-field';

type JsonSchema = Record<string, unknown>;

const propsOf = (schema: object): Record<string, JsonSchema> =>
    (schema as JsonSchema).properties as Record<string, JsonSchema>;

const propertyOf = (schema: object, name: string): JsonSchema => propsOf(schema)[name];

describe('schemaToFields — readOnly', () => {
    it('reads readOnly: true off a property', () => {
        const [field] = schemaToFields({
            type: 'object',
            properties: { companyName: { type: 'string', readOnly: true } },
        });

        expect(field.readOnly).toBe(true);
    });

    it('reads readOnly: false as not read only', () => {
        const [field] = schemaToFields({
            type: 'object',
            properties: { companyName: { type: 'string', readOnly: false } },
        });

        expect(field.readOnly).toBe(false);
    });

    it('treats an absent readOnly as not read only', () => {
        const [field] = schemaToFields({
            type: 'object',
            properties: { companyName: { type: 'string' } },
        });

        expect(field.readOnly).toBe(false);
    });
});

describe('fieldsToSchema — readOnly', () => {
    it('emits readOnly: true when the field is flagged', () => {
        const schema = fieldsToSchema([createField({ name: 'companyName', readOnly: true })]);

        expect(propertyOf(schema, 'companyName').readOnly).toBe(true);
    });

    it('omits the keyword entirely when the field is not flagged', () => {
        const schema = fieldsToSchema([createField({ name: 'companyName' })]);

        expect(propertyOf(schema, 'companyName')).not.toHaveProperty('readOnly');
    });
});

describe('readOnly round-trip', () => {
    it('survives schema to fields to schema', () => {
        const original = {
            type: 'object',
            properties: {
                companyName: { type: 'string', title: 'Company Name', readOnly: true },
                nickname: { type: 'string' },
            },
        };

        const rebuilt = fieldsToSchema(schemaToFields(original));

        expect(propertyOf(rebuilt, 'companyName').readOnly).toBe(true);
        expect(propertyOf(rebuilt, 'nickname')).not.toHaveProperty('readOnly');
    });

    it('survives on a nested object property without leaking to the parent', () => {
        const original = {
            type: 'object',
            properties: {
                employer: {
                    type: 'object',
                    properties: {
                        companyName: { type: 'string', readOnly: true },
                        role: { type: 'string' },
                    },
                    additionalProperties: true,
                },
            },
        };

        const fields = schemaToFields(original);

        expect(fields[0].readOnly).toBe(false);
        expect(fields[0].properties[0].readOnly).toBe(true);
        expect(fields[0].properties[1].readOnly).toBe(false);

        const rebuilt = fieldsToSchema(fields);
        const employer = propertyOf(rebuilt, 'employer');

        expect(employer).not.toHaveProperty('readOnly');
        expect(propsOf(employer).companyName.readOnly).toBe(true);
        expect(propsOf(employer).role).not.toHaveProperty('readOnly');
    });

    it('survives on an array-of-object item property', () => {
        const original = {
            type: 'object',
            properties: {
                offices: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            city: { type: 'string', readOnly: true },
                            desk: { type: 'string' },
                        },
                        additionalProperties: true,
                    },
                },
            },
        };

        const fields = schemaToFields(original);

        expect(fields[0].readOnly).toBe(false);
        expect(fields[0].properties[0].readOnly).toBe(true);

        const rebuilt = fieldsToSchema(fields);
        const offices = propertyOf(rebuilt, 'offices');

        expect(offices).not.toHaveProperty('readOnly');
        expect(propsOf(offices.items as JsonSchema).city.readOnly).toBe(true);
        expect(propsOf(offices.items as JsonSchema).desk).not.toHaveProperty('readOnly');
    });

    it('keeps a read only flag on the array field itself', () => {
        const rebuilt = fieldsToSchema(
            schemaToFields({
                type: 'object',
                properties: {
                    offices: { type: 'array', readOnly: true, items: { type: 'string' } },
                },
            }),
        );

        expect(propertyOf(rebuilt, 'offices').readOnly).toBe(true);
    });
});
