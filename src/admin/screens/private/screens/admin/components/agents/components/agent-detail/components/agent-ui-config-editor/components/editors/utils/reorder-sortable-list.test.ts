import type { DragEndEvent } from '@dnd-kit/react';
import { describe, expect, it } from 'vitest';

import type { ModelValueShape, ParameterSchemaType } from '../../../schema';

import { reorderModels, reorderParameters } from './reorder-sortable-list';

/**
 * `@dnd-kit/helpers`' `move` reads only `event.operation.{source,target,canceled}`, and for a source
 * carrying `index`/`initialIndex` it trusts the projected index over the target's position — the path
 * both sensors take. The real `move` runs against these; only the operation is synthesised.
 */
const dragEvent = (options: {
    sourceId: string;
    targetId?: string;
    initialIndex?: number;
    index?: number;
    canceled?: boolean;
}): DragEndEvent => {
    const { sourceId, targetId, initialIndex, index, canceled = false } = options;

    return {
        operation: {
            source: {
                id: sourceId,
                ...(initialIndex === undefined ? {} : { initialIndex }),
                ...(index === undefined ? {} : { index }),
            },
            target: targetId === undefined ? null : { id: targetId },
            canceled,
        },
        preventDefault: () => {},
    } as unknown as DragEndEvent;
};

const model = (modelId: string, name: string): ModelValueShape => ({ modelId, name });

const selectParameter = (label: string): ParameterSchemaType => ({
    type: 'select',
    label,
    default: { label, value: label },
    options: [{ label, value: label }],
});

describe('reorderModels', () => {
    const items = [model('m1', 'One'), model('m2', 'Two'), model('m3', 'Three')];

    it('moves the dragged model to the projected index', () => {
        const next = reorderModels(
            items,
            dragEvent({
                sourceId: 'm1',
                targetId: 'm3',
                initialIndex: 0,
                index: 2,
            }),
        );

        expect(next?.map((item) => item.modelId)).toEqual(['m2', 'm3', 'm1']);
    });

    it('moves a model upwards', () => {
        const next = reorderModels(
            items,
            dragEvent({
                sourceId: 'm3',
                targetId: 'm1',
                initialIndex: 2,
                index: 0,
            }),
        );

        expect(next?.map((item) => item.modelId)).toEqual(['m3', 'm1', 'm2']);
    });

    it('carries each row its own data, not the data of the row that took its slot', () => {
        const withParameters = [
            { ...model('m1', 'One'), parameters: { seed: selectParameter('Seed') } },
            { ...model('m2', 'Two'), options: { mask: true } },
            model('m3', 'Three'),
        ];

        const next = reorderModels(
            withParameters,
            dragEvent({
                sourceId: 'm1',
                targetId: 'm3',
                initialIndex: 0,
                index: 2,
            }),
        );

        expect(next).toEqual([
            { modelId: 'm2', name: 'Two', options: { mask: true } },
            { modelId: 'm3', name: 'Three' },
            { modelId: 'm1', name: 'One', parameters: { seed: selectParameter('Seed') } },
        ]);
    });

    it('does not mutate the list it was given', () => {
        const snapshot = JSON.stringify(items);

        reorderModels(
            items,
            dragEvent({
                sourceId: 'm1',
                targetId: 'm3',
                initialIndex: 0,
                index: 2,
            }),
        );

        expect(JSON.stringify(items)).toBe(snapshot);
    });

    it('returns null for a cancelled drag', () => {
        expect(
            reorderModels(
                items,
                dragEvent({
                    sourceId: 'm1',
                    targetId: 'm3',
                    initialIndex: 0,
                    index: 2,
                    canceled: true,
                }),
            ),
        ).toBeNull();
    });

    it('returns null when the drag has no drop target', () => {
        expect(reorderModels(items, dragEvent({ sourceId: 'm1', initialIndex: 0, index: 2 }))).toBeNull();
    });

    it('returns null when the model was dropped back onto itself', () => {
        expect(
            reorderModels(
                items,
                dragEvent({
                    sourceId: 'm2',
                    targetId: 'm2',
                    initialIndex: 1,
                    index: 1,
                }),
            ),
        ).toBeNull();
    });

    it('returns null when the dragged id is not in the list', () => {
        expect(reorderModels(items, dragEvent({ sourceId: 'gone', targetId: 'm2' }))).toBeNull();
    });
});

describe('reorderParameters', () => {
    const parameters = {
        alpha: selectParameter('Alpha'),
        beta: selectParameter('Beta'),
        gamma: selectParameter('Gamma'),
    };

    it('rewrites the key order and keeps every key paired with its own parameter', () => {
        const next = reorderParameters(
            parameters,
            dragEvent({
                sourceId: 'gamma',
                targetId: 'alpha',
                initialIndex: 2,
                index: 0,
            }),
        );

        expect(Object.keys(next ?? {})).toEqual(['gamma', 'alpha', 'beta']);
        expect(next).toEqual({
            gamma: selectParameter('Gamma'),
            alpha: selectParameter('Alpha'),
            beta: selectParameter('Beta'),
        });
    });

    it('preserves parameters of mixed shapes across a reorder', () => {
        const mixed: Record<string, ParameterSchemaType> = {
            steps: {
                type: 'range',
                label: 'Steps',
                default: 4,
                range: { min: 1, max: 8, step: 1 },
            },
            hd: { type: 'toggle', label: 'HD', default: true },
            style: selectParameter('Style'),
        };

        const next = reorderParameters(
            mixed,
            dragEvent({
                sourceId: 'style',
                targetId: 'steps',
                initialIndex: 2,
                index: 0,
            }),
        );

        expect(next).toEqual({ style: mixed.style, steps: mixed.steps, hd: mixed.hd });
    });

    it('returns null for a cancelled drag', () => {
        expect(
            reorderParameters(
                parameters,
                dragEvent({
                    sourceId: 'alpha',
                    targetId: 'gamma',
                    initialIndex: 0,
                    index: 2,
                    canceled: true,
                }),
            ),
        ).toBeNull();
    });

    it('returns null when the parameter was dropped back onto itself', () => {
        expect(
            reorderParameters(
                parameters,
                dragEvent({
                    sourceId: 'beta',
                    targetId: 'beta',
                    initialIndex: 1,
                    index: 1,
                }),
            ),
        ).toBeNull();
    });

    it('returns null for an empty parameter map', () => {
        expect(reorderParameters({}, dragEvent({ sourceId: 'alpha', targetId: 'beta' }))).toBeNull();
    });
});
