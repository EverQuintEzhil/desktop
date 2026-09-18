import type { SelectSuggestionItem } from '@/components';
import { adminModelsApi } from '@/lib/api/admin/models';
import { modelDisplayName, type ModelType } from '@/types/admin';

export type ModelSuggestion = SelectSuggestionItem<string> & {
    modelId: string;
    modelName: string;
};

const PAGE_SIZE = 30;

/**
 * Async loader suitable for `MultiSelect`/`Select` `data` prop.
 * Resolves each `ModelType` into a `{ value: _id, label: "label (provider)" }` suggestion,
 * falling back to the raw `model` when the model has no label yet.
 */
export const fetchModelsSuggestion = async (search: string): Promise<ModelSuggestion[]> => {
    const result = await adminModelsApi.list({ page: 0, size: PAGE_SIZE, search });

    const values = (result?.values ?? []) as ModelType[];

    return values.map((model) => ({
        value: model._id,
        label: `${modelDisplayName(model)} (${model.provider})`,
        modelId: model._id,
        modelName: modelDisplayName(model),
    }));
};

/**
 * Resolve a list of modelIds to full model objects (used when hydrating a form
 * value that only carries the `modelId`).
 */
export const fetchModelsByIds = async (modelIds: string[]): Promise<ModelType[]> => {
    if (modelIds.length === 0) return [];

    const result = await adminModelsApi.list({ page: 0, size: modelIds.length, ids: modelIds });

    return (result?.values ?? []) as ModelType[];
};
