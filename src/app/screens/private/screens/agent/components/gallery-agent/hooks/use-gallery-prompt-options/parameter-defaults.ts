import cloneDeep from 'lodash/cloneDeep';

import type { SelectSuggestionItem } from '@/components';
import {
    getSelectedParameterValue,
    getSelectedToggleValue,
    shouldApplyToggleValue,
    isToggleParameter,
} from '@/lib/agent-parameters';
import type {
    ModelValueType,
    ParameterType,
    ParameterTypeRange,
    ParameterTypeSelect,
    ParameterTypeTextbox,
    ParameterTypeToggle,
} from '@/types/admin';

import type { ParametersState } from './types';

const clampToRange = (value: number, range: ParameterTypeRange['range']): number => {
    return Math.min(Math.max(value, range.min), range.max);
};

export function buildParametersFromArgs(
    defaultsRecord: Record<string, unknown>,
    modelParams: ModelValueType['parameters'],
    strict = false,
): ParametersState {
    const newParameters: ParametersState = {};

    Object.keys(defaultsRecord).forEach((key) => {
        const parameter = modelParams?.[key] as
            | ParameterTypeSelect
            | ParameterTypeRange
            | ParameterTypeToggle
            | ParameterTypeTextbox
            | undefined;

        if (!parameter) {
            return;
        }

        if ('component' in parameter && parameter.component === 'textbox') {
            if (typeof defaultsRecord[key] === 'string') {
                newParameters[key] = defaultsRecord[key] as string;
            } else if (!strict) {
                newParameters[key] = '';
            }

            return;
        }

        const typedParam = parameter as ParameterTypeRange | ParameterTypeToggle | ParameterTypeSelect;

        if (typedParam.type === 'range') {
            if (strict) {
                if (typeof defaultsRecord[key] === 'number') {
                    newParameters[key] = clampToRange(defaultsRecord[key] as number, typedParam.range);
                }

                return;
            }

            newParameters[key] = defaultsRecord[key] as number;

            return;
        }

        if (typedParam.type === 'toggle') {
            if (shouldApplyToggleValue(defaultsRecord[key], typedParam)) {
                newParameters[key] = getSelectedToggleValue(typedParam);
            }

            return;
        }

        const selectParam = typedParam as ParameterTypeSelect;
        const option = selectParam.options.find((o) => o.value === defaultsRecord[key]);

        if (option) {
            newParameters[key] = option as SelectSuggestionItem<string>;
        } else if (!strict && selectParam.default !== undefined) {
            newParameters[key] = selectParam.default as SelectSuggestionItem<string>;
        }
    });

    return newParameters;
}

export const reconcileParameterValue = (
    currentValue: number | boolean | string | SelectSuggestionItem<string>,
    param: ParameterType,
): number | boolean | string | SelectSuggestionItem<string> => {
    if ('component' in param && param.component === 'textbox') {
        if (typeof currentValue === 'string') {
            return currentValue;
        }

        return '';
    }

    if (param.type === 'range') {
        const range = (param as ParameterTypeRange).range;

        if (typeof currentValue === 'number') {
            return clampToRange(currentValue, range);
        }

        return getSelectedParameterValue(param);
    }

    if (isToggleParameter(param)) {
        return getSelectedToggleValue(param);
    }

    const selectParam = param as ParameterTypeSelect;

    if (typeof currentValue === 'object' && currentValue !== null && typeof currentValue.value === 'string') {
        const matchingOption = selectParam.options.find((option) => option.value === currentValue.value);

        if (matchingOption) {
            return matchingOption as SelectSuggestionItem<string>;
        }
    }

    return getSelectedParameterValue(param);
};

export const buildMergedParameterConfig = (
    agentParameters: Record<string, ParameterType> | undefined,
    modelParameters: Record<string, ParameterType> | undefined,
): Record<string, ParameterType> => {
    const base = cloneDeep(agentParameters || {});

    if (modelParameters) {
        Object.keys(modelParameters).forEach((key) => {
            base[key] = modelParameters[key];
        });
    }

    return base;
};
