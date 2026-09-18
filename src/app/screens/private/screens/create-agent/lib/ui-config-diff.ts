import isEqual from 'lodash/isEqual';

import type { ChatAgentUiType } from '@/types/ui';

const EMPTY = '—';

const formatText = (value?: string): string => {
    const trimmed = (value ?? '').trim();

    return trimmed ? trimmed : EMPTY;
};

const formatBoolean = (value?: boolean): string => (value ? 'On' : 'Off');

const formatNumber = (value?: number): string => (typeof value === 'number' ? String(value) : EMPTY);

interface ScalarFieldDescriptor {
    id: string;
    label: string;
    kind: 'text' | 'boolean';
    getValue: (ui?: ChatAgentUiType) => string;
}

export interface ScalarChange {
    id: string;
    label: string;
    kind: 'text' | 'boolean';
    oldValue: string;
    newValue: string;
}

interface QuestionDiff {
    added: string[];
    removed: string[];
}

export interface ModelChange {
    added: string[];
    removed: string[];
    defaultOld?: string;
    defaultNew?: string;
}

const APPEARANCE_FIELDS: ScalarFieldDescriptor[] = [
    {
        id: 'home-title',
        label: 'Home title',
        kind: 'text',
        getValue: (ui) => formatText(ui?.home?.title),
    },
    {
        id: 'placeholder',
        label: 'Composer placeholder',
        kind: 'text',
        getValue: (ui) => formatText(ui?.home?.search?.placeholder),
    },
    {
        id: 'files',
        label: 'File uploads',
        kind: 'boolean',
        getValue: (ui) => formatBoolean(ui?.home?.search?.files),
    },
    {
        id: 'web-search',
        label: 'Web search',
        kind: 'boolean',
        getValue: (ui) => formatBoolean(ui?.home?.search?.showWebSearch),
    },
    {
        id: 'web-search-default',
        label: 'Web search on by default',
        kind: 'boolean',
        getValue: (ui) => formatBoolean(ui?.home?.search?.isWebSearchEnabled),
    },
    {
        id: 'deep-search',
        label: 'Deep search',
        kind: 'boolean',
        getValue: (ui) => formatBoolean(ui?.home?.search?.showDeepSearch),
    },
    {
        id: 'deep-search-default',
        label: 'Deep search on by default',
        kind: 'boolean',
        getValue: (ui) => formatBoolean(ui?.home?.search?.isDeepSearchEnabled),
    },
    {
        id: 'incognito',
        label: 'Incognito mode',
        kind: 'boolean',
        getValue: (ui) => formatBoolean(ui?.home?.search?.isIncognitoEnabled),
    },
    {
        id: 'related-questions',
        label: 'Related questions',
        kind: 'boolean',
        getValue: (ui) => formatBoolean(ui?.home?.search?.isRelatedQuestionsEnabled),
    },
    {
        id: 'related-questions-count',
        label: 'Related questions count',
        kind: 'text',
        getValue: (ui) => formatNumber(ui?.home?.search?.relatedQuestionsCount),
    },
];

export const computeScalarChanges = (original?: ChatAgentUiType, current?: ChatAgentUiType): ScalarChange[] =>
    APPEARANCE_FIELDS.reduce<ScalarChange[]>((acc, field) => {
        const oldValue = field.getValue(original);
        const newValue = field.getValue(current);

        if (oldValue === newValue) return acc;

        return [
            ...acc,
            {
                id: field.id,
                label: field.label,
                kind: field.kind,
                oldValue,
                newValue,
            },
        ];
    }, []);

export const computeQuestionDiff = (original?: ChatAgentUiType, current?: ChatAgentUiType): QuestionDiff => {
    const originalQuestions = original?.home?.questions ?? [];
    const currentQuestions = current?.home?.questions ?? [];

    const added = currentQuestions.filter((q) => !originalQuestions.includes(q));
    const removed = originalQuestions.filter((q) => !currentQuestions.includes(q));

    return { added, removed };
};

const stripModel = (ui?: ChatAgentUiType): Partial<ChatAgentUiType> => {
    if (!ui) {
        return {};
    }

    const rest: Partial<ChatAgentUiType> = { ...ui };

    delete rest.defaultModel;
    delete rest.models;

    return rest;
};

export const hasNonModelChanges = (original?: ChatAgentUiType, current?: ChatAgentUiType): boolean =>
    !isEqual(stripModel(original), stripModel(current));

const nameByModelId = (ui?: ChatAgentUiType): Map<string, string> => {
    const map = new Map<string, string>();

    for (const model of ui?.models ?? []) {
        map.set(model.modelId, formatText(model.name));
    }

    return map;
};

export const getModelChange = (original?: ChatAgentUiType, current?: ChatAgentUiType): ModelChange | null => {
    const originalNames = nameByModelId(original);
    const currentNames = nameByModelId(current);

    const added = [...currentNames.keys()]
        .filter((id) => !originalNames.has(id))
        .map((id) => currentNames.get(id) ?? id);
    const removed = [...originalNames.keys()]
        .filter((id) => !currentNames.has(id))
        .map((id) => originalNames.get(id) ?? id);

    const oldDefaultId = original?.defaultModel?.modelId;
    const newDefaultId = current?.defaultModel?.modelId;
    const defaultChanged = oldDefaultId !== newDefaultId;

    if (added.length === 0 && removed.length === 0 && !defaultChanged) {
        return null;
    }

    return {
        added,
        removed,
        ...(defaultChanged ? { defaultOld: formatText(original?.defaultModel?.name) } : {}),
        ...(defaultChanged ? { defaultNew: formatText(current?.defaultModel?.name) } : {}),
    };
};

export const formatModelChangeSummary = (change: ModelChange): string => {
    const parts: string[] = [];

    if (change.defaultOld !== undefined || change.defaultNew !== undefined) {
        parts.push(`${change.defaultOld ?? EMPTY} → ${change.defaultNew ?? EMPTY}`);
    }

    if (change.added.length) {
        parts.push(`+${change.added.length} added`);
    }

    if (change.removed.length) {
        parts.push(`-${change.removed.length} removed`);
    }

    return parts.join(', ');
};
