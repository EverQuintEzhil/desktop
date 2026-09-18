import { describe, expect, it } from 'vitest';

import { buildDoc, docToText } from './serialize';

const roundTrip = (value: string): string => docToText(buildDoc(value));

describe('chat-editor serialize round-trip', () => {
    const cases: { name: string; value: string }[] = [
        { name: 'empty string', value: '' },
        { name: 'plain text', value: 'hello world' },
        { name: 'directive with label only', value: ':tool[Web_Search]' },
        { name: 'directive with encoded label and name', value: ':skill[My%20Skill]{name=abc123}' },
        { name: 'text with directive and variable', value: 'use :tool[Web_Search] then {{topic}} please' },
        { name: 'multi-line text', value: 'line one\nline two' },
    ];

    cases.forEach(({ name, value }) => {
        it(`round-trips ${name}`, () => {
            expect(roundTrip(value)).toBe(value);
        });
    });

    it('omits {{name=}} when the encoded label equals the encoded id', () => {
        const value = ':skill[Research]';

        expect(roundTrip(value)).toBe(value);
    });

    it('keeps a variable as literal editable text', () => {
        const doc = buildDoc('hi {{name}}');
        const paragraph = doc.content?.[0];

        expect(paragraph?.content?.every((node) => node.type !== 'directiveMention')).toBe(true);
    });
});
