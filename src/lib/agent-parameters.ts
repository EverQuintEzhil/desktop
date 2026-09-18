import type { SelectSuggestionItem } from '@/components';
import type { ParameterType, ParameterTypeRange, ParameterTypeSelect, ParameterTypeToggle } from '@/types/admin';

export type AgentParameterValue = SelectSuggestionItem<string> | number | boolean | string;

type ToggleParameter = Extract<ParameterType, { type: 'toggle' }>;

export const isToggleParameter = (parameter: ParameterType): parameter is ToggleParameter =>
    !('component' in parameter) && parameter.type === 'toggle';

export const shouldSelectParameterByDefault = (parameter: ParameterType): boolean => {
    if (isToggleParameter(parameter)) {
        return parameter.default;
    }

    return parameter.showDefault ?? false;
};

export const getSelectedToggleValue = (parameter: ParameterTypeToggle): boolean => (parameter.inverse ? false : true);

export const shouldApplyToggleValue = (value: unknown, parameter: ParameterTypeToggle): boolean => {
    const defaultValue = typeof value === 'boolean' ? value : parameter.default;

    return defaultValue === getSelectedToggleValue(parameter);
};

export const getSelectedParameterValue = (parameter: ParameterType): AgentParameterValue => {
    if ('component' in parameter && parameter.component === 'textbox') {
        return '';
    }

    if (parameter.type === 'range') {
        return (parameter as ParameterTypeRange).default;
    }

    if (isToggleParameter(parameter)) {
        return getSelectedToggleValue(parameter);
    }

    return (parameter as ParameterTypeSelect).default as SelectSuggestionItem<string>;
};
