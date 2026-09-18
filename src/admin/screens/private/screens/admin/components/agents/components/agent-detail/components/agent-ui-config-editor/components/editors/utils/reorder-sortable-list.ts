import { move } from '@dnd-kit/helpers';
import type { DragEndEvent } from '@dnd-kit/react';

import type { ModelValueShape, ParameterSchemaType } from '../../../schema';

type ParameterMap = Record<string, ParameterSchemaType>;

/**
 * `move` returns the array it was given when the drag produced no reorder (cancelled, dropped on
 * itself, no target). Both helpers return `null` for that, and for a reordered id with no matching
 * entry, so a caller never writes a list that lost or duplicated a row.
 */
export const reorderModels = (items: ModelValueShape[], event: DragEndEvent): ModelValueShape[] | null => {
    const itemIds = items.map((item) => item.modelId);
    const nextIds = move(itemIds, event);

    if (nextIds === itemIds) return null;

    const itemByModelId = new Map(items.map((item) => [item.modelId, item]));
    const nextItems = nextIds
        .map((id) => itemByModelId.get(id))
        .filter((item): item is ModelValueShape => item !== undefined);

    return nextItems.length === items.length ? nextItems : null;
};

export const reorderParameters = (parameters: ParameterMap, event: DragEndEvent): ParameterMap | null => {
    const keys = Object.keys(parameters);
    const nextKeys = move(keys, event);

    if (nextKeys === keys) return null;

    const nextEntries = nextKeys
        .filter((key) => key in parameters)
        .map((key): [string, ParameterSchemaType] => [key, parameters[key]]);

    return nextEntries.length === keys.length ? Object.fromEntries(nextEntries) : null;
};
