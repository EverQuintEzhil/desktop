import cloneDeep from 'lodash/cloneDeep';

import type { SelectSuggestionItem } from '@/components';
import { getSelectedParameterValue, isToggleParameter, shouldSelectParameterByDefault } from '@/lib/agent-parameters';
import type { ParameterType, ParameterTypeSelect } from '@/types/admin';
import type { ParameterValue } from '@/types/chat';

type ParameterDefinitions = Record<string, ParameterType>;

const resolveDefaultValue = (definition: ParameterType): ParameterValue => {
    if ('component' in definition && definition.component === 'textbox') return '';

    return getSelectedParameterValue(definition);
};

const isSelectedOptionStillOffered = (value: ParameterValue, definition: ParameterTypeSelect): boolean => {
    if (typeof value !== 'object' || value === null) return false;

    const selected = String((value as SelectSuggestionItem<string>).value);

    return definition.options.some((option) => String(option.value) === selected);
};

/**
 * A key both models define can still be defined differently. A select turned
 * into a range reaches the stepper as `NaN`, and a select whose option list no
 * longer offers the stored value sends a value the backend rejects, so a value
 * only survives while it still fits the new definition.
 */
const isValueCompatible = (value: ParameterValue, definition: ParameterType): boolean => {
    if ('component' in definition && definition.component === 'textbox') return typeof value === 'string';
    if (isToggleParameter(definition)) return typeof value === 'boolean';
    if (definition.type === 'range') return typeof value === 'number';
    if (definition.type === 'select') return isSelectedOptionStillOffered(value, definition as ParameterTypeSelect);

    return false;
};

/**
 * Re-seeds the composer parameters for a newly selected model: known keys go back
 * to their default, keys the new model does not define are dropped, and keys the
 * model selects by default are added.
 *
 * `preservedKeys` holds parameters the user set by hand. They survive when the
 * model changed without the user asking for it — a persisted preference resolving
 * after mount — and are ignored on a real model switch.
 */
export const resetModelParameters = (
    current: Record<string, ParameterValue>,
    definitions: ParameterDefinitions,
    preservedKeys: ReadonlySet<string> | null,
): Record<string, ParameterValue> => {
    const next = cloneDeep(current);

    Object.keys(next).forEach((key) => {
        const definition = definitions[key];

        if (!definition) {
            delete next[key];

            return;
        }

        if (preservedKeys?.has(key) && isValueCompatible(next[key], definition)) return;

        next[key] = resolveDefaultValue(definition);
    });

    Object.keys(definitions).forEach((key) => {
        if (!shouldSelectParameterByDefault(definitions[key]) || next[key] !== undefined) return;

        next[key] = resolveDefaultValue(definitions[key]);
    });

    return next;
};
