import { describe, expect, it } from 'vitest';

import type { ParameterType } from '@/types/admin';

import { resetModelParameters } from './reset-model-parameters';

const toneSelect = {
    label: 'Tone',
    type: 'select',
    default: { label: 'Neutral', value: 'neutral' },
    options: [
        { label: 'Neutral', value: 'neutral' },
        { label: 'Playful', value: 'playful' },
    ],
} as ParameterType;

const toneSelectWithoutPlayful = {
    label: 'Tone',
    type: 'select',
    default: { label: 'Neutral', value: 'neutral' },
    options: [
        { label: 'Neutral', value: 'neutral' },
        { label: 'Formal', value: 'formal' },
    ],
} as ParameterType;

const toneRange = {
    label: 'Tone',
    type: 'range',
    default: 3,
    range: { min: 1, max: 5, step: 1 },
} as ParameterType;

const effortRange = {
    label: 'Effort',
    type: 'range',
    default: 2,
    range: { min: 1, max: 4, step: 1 },
} as ParameterType;

const notesTextbox = { label: 'Notes', component: 'textbox' } as ParameterType;

const thinkingToggle = {
    label: 'Thinking',
    type: 'toggle',
    default: true,
} as ParameterType;

const playful = { label: 'Playful', value: 'playful' };

describe('resetModelParameters', () => {
    it('keeps a preserved value the new model defines the same way', () => {
        const next = resetModelParameters({ tone: playful }, { tone: toneSelect }, new Set(['tone']));

        expect(next.tone).toEqual(playful);
    });

    it('resets a value the user did not set by hand', () => {
        const next = resetModelParameters({ tone: playful }, { tone: toneSelect }, null);

        expect(next.tone).toEqual({ label: 'Neutral', value: 'neutral' });
    });

    it('drops a key the new model does not define', () => {
        const next = resetModelParameters({ tone: playful }, { effort: effortRange }, new Set(['tone']));

        expect(next.tone).toBeUndefined();
    });

    it('adds a key the new model selects by default', () => {
        const next = resetModelParameters({}, { thinking: thinkingToggle }, null);

        expect(next.thinking).toBe(true);
    });

    it('drops a preserved select value the new option list no longer offers', () => {
        const next = resetModelParameters({ tone: playful }, { tone: toneSelectWithoutPlayful }, new Set(['tone']));

        expect(next.tone).toEqual({ label: 'Neutral', value: 'neutral' });
    });

    it('resolves the range default when the new model redefines a preserved select as a range', () => {
        const next = resetModelParameters({ tone: playful }, { tone: toneRange }, new Set(['tone']));

        expect(next.tone).toBe(3);
        expect(Number(next.tone)).not.toBeNaN();
    });

    it('resolves the select default when the new model redefines a preserved range as a select', () => {
        const next = resetModelParameters({ tone: 3 }, { tone: toneSelect }, new Set(['tone']));

        expect(next.tone).toEqual({ label: 'Neutral', value: 'neutral' });
    });

    it('resolves the textbox default when the new model redefines a preserved select as a textbox', () => {
        const next = resetModelParameters({ tone: playful }, { tone: notesTextbox }, new Set(['tone']));

        expect(next.tone).toBe('');
    });

    it('keeps a preserved textbox string and a preserved toggle boolean', () => {
        const next = resetModelParameters(
            { notes: 'draft', thinking: false },
            { notes: notesTextbox, thinking: thinkingToggle },
            new Set(['notes', 'thinking']),
        );

        expect(next.notes).toBe('draft');
        expect(next.thinking).toBe(false);
    });

    it('does not mutate the values it was given', () => {
        const current = { tone: playful };

        resetModelParameters(current, { tone: toneRange }, new Set(['tone']));

        expect(current.tone).toEqual({ label: 'Playful', value: 'playful' });
    });
});
