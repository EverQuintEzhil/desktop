import { describe, expect, it } from 'vitest';

import type { ChatAgentUiType } from '@/types/ui';

import {
    computeQuestionDiff,
    computeScalarChanges,
    formatModelChangeSummary,
    getModelChange,
    hasNonModelChanges,
} from './ui-config-diff';

const baseUi = (overrides: Partial<ChatAgentUiType> = {}): ChatAgentUiType => ({
    componentType: 'chat',
    type: 'chat',
    home: {
        title: 'Home',
        search: {
            placeholder: 'Ask',
            files: true,
            showWebSearch: false,
        },
        questions: ['Q1'],
    },
    ...overrides,
});

describe('ui-config-diff', () => {
    it('reports scalar appearance changes', () => {
        const original = baseUi();
        const current = baseUi({
            home: {
                title: 'New home',
                search: {
                    placeholder: 'Ask',
                    files: false,
                    showWebSearch: true,
                },
                questions: ['Q1'],
            },
        });

        expect(computeScalarChanges(original, current)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'home-title',
                    oldValue: 'Home',
                    newValue: 'New home',
                }),
                expect.objectContaining({
                    id: 'files',
                    oldValue: 'On',
                    newValue: 'Off',
                }),
                expect.objectContaining({
                    id: 'web-search',
                    oldValue: 'Off',
                    newValue: 'On',
                }),
            ]),
        );
    });

    it('diffs starter questions', () => {
        const original = baseUi();
        const current = baseUi({
            home: {
                ...original.home,
                questions: ['Q2', 'Q3'],
            },
        });

        expect(computeQuestionDiff(original, current)).toEqual({
            added: ['Q2', 'Q3'],
            removed: ['Q1'],
        });
    });

    it('detects non-model changes and ignores model-only edits', () => {
        const original = baseUi({
            models: [{ name: 'A', modelId: 'a' }],
            defaultModel: { name: 'A', modelId: 'a' },
        });
        const modelOnly = baseUi({
            models: [{ name: 'B', modelId: 'b' }],
            defaultModel: { name: 'B', modelId: 'b' },
        });
        const homeChanged = baseUi({
            home: {
                ...original.home,
                title: 'Changed',
            },
            models: original.models,
            defaultModel: original.defaultModel,
        });

        expect(hasNonModelChanges(original, modelOnly)).toBe(false);
        expect(hasNonModelChanges(original, homeChanged)).toBe(true);
    });

    it('summarizes model add/remove/default changes', () => {
        const original = baseUi({
            models: [{ name: 'A', modelId: 'a' }],
            defaultModel: { name: 'A', modelId: 'a' },
        });
        const current = baseUi({
            models: [{ name: 'B', modelId: 'b' }],
            defaultModel: { name: 'B', modelId: 'b' },
        });

        const change = getModelChange(original, current);

        expect(change).toEqual({
            added: ['B'],
            removed: ['A'],
            defaultOld: 'A',
            defaultNew: 'B',
        });
        expect(formatModelChangeSummary(change!)).toBe('A → B, +1 added, -1 removed');
    });
});
