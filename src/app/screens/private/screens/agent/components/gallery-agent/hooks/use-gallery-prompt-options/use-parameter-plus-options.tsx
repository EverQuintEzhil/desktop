import { SettingsIcon } from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo } from 'react';

import type { SelectSuggestionItem } from '@/components';
import { type DropDownValueObject } from '@/components/ui/dropdown-menu';
import { getSelectedParameterValue } from '@/lib/agent-parameters';
import { getLucideIcon } from '@/lib/icons/lucide-icons';
import type {
    GalleryAgentType,
    ModelValueType,
    ParameterType,
    ParameterTypeRange,
    ParameterTypeSelect,
    ParameterTypeTextbox,
    ParameterTypeToggle,
} from '@/types/admin';
import type { PlusDropdownOption } from '@/types/chat';

import {
    ParameterSelector,
    ParameterRangeSelector,
    ParameterTextboxSelector,
    ParameterToggleSelector,
} from '../../../../shared';

import type { ParameterPopupStylesOverrides, ParametersState } from './types';

interface UseParameterPlusOptionsArgs {
    agent: GalleryAgentType;
    selectedModel: DropDownValueObject<ModelValueType> | null;
    parameters: ParametersState;
    setParameter: (key: string, value: number | boolean | string | SelectSuggestionItem<string>) => void;
    removeParameter: (key: string) => void;
    activeTextboxParameterKey: string | null;
    setActiveTextboxParameterKey: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface UseParameterPlusOptionsResult {
    plusDropdownOptions: PlusDropdownOption[];
    handlePlusDropdownSelect: (value: PlusDropdownOption) => void;
    getParameter: (key: string) => ParameterType | undefined;
    renderSelectedParameters: (overrides?: ParameterPopupStylesOverrides, isDarkMode?: boolean) => React.ReactNode;
}

export const useParameterPlusOptions = (args: UseParameterPlusOptionsArgs): UseParameterPlusOptionsResult => {
    const {
        agent,
        selectedModel,
        parameters,
        setParameter,
        removeParameter,
        activeTextboxParameterKey,
        setActiveTextboxParameterKey,
    } = args;

    const getParameter = useCallback(
        (key: string) => {
            if (selectedModel?.value.parameters) {
                if (selectedModel.value.parameters[key]) {
                    return selectedModel.value.parameters[key];
                }
            }

            return agent.uiConfig.parameters?.[key];
        },
        [selectedModel, agent.uiConfig.parameters],
    );

    const plusDropdownOptions: PlusDropdownOption[] = useMemo(() => {
        const options: PlusDropdownOption[] = [];

        const openTextboxParameter = (key: string, param: ReturnType<typeof getParameter>) => {
            if (param && 'component' in param && param.component === 'textbox') {
                setActiveTextboxParameterKey(key);
            }
        };

        const resolveSelectedParamValue = (
            param: ReturnType<typeof getParameter>,
        ): number | boolean | string | SelectSuggestionItem<string> => {
            if (!param) return '';
            if ('component' in param && param.component === 'textbox') return '';

            return getSelectedParameterValue(param);
        };

        if (agent.uiConfig.parameters && Object.keys(agent.uiConfig.parameters).length > 0) {
            Object.keys(agent.uiConfig.parameters).forEach((key) => {
                if (parameters[key] !== undefined) {
                    return;
                }

                if (agent.uiConfig.parameters?.[key]) {
                    options.push({
                        label: agent.uiConfig.parameters[key].label,
                        value: key,
                        icon: getLucideIcon(agent.uiConfig.parameters[key].icon) ?? SettingsIcon,
                        onClick: () => {
                            const parameter = agent.uiConfig.parameters?.[key];

                            setParameter(key, resolveSelectedParamValue(parameter));
                            openTextboxParameter(key, parameter);
                        },
                    });
                }
            });
        }

        if (selectedModel?.value.parameters) {
            Object.keys(selectedModel.value.parameters).forEach((key) => {
                if (parameters[key] !== undefined) {
                    return;
                }

                if (selectedModel.value?.parameters?.[key]) {
                    const index = options.findIndex((option) => option.value === key);
                    const entry: PlusDropdownOption = {
                        label: selectedModel.value.parameters[key].label,
                        value: key,
                        icon: getLucideIcon(selectedModel.value.parameters[key].icon) ?? SettingsIcon,
                        onClick: () => {
                            const parameter = selectedModel.value.parameters?.[key];

                            setParameter(key, resolveSelectedParamValue(parameter));
                            openTextboxParameter(key, parameter);
                        },
                    };

                    if (index !== -1) {
                        options[index] = entry;
                    } else {
                        options.push(entry);
                    }
                }
            });
        }

        return options;
    }, [agent.uiConfig, parameters, selectedModel, setParameter]);

    const handlePlusDropdownSelect = useCallback((value: PlusDropdownOption) => {
        if (value.onClick) {
            value.onClick();
        }
    }, []);

    const renderSelectedParameters = (overrides?: ParameterPopupStylesOverrides, isDarkMode?: boolean) => {
        const stepperPopupStyles = overrides?.parameterStepperPopupStyles;

        return Object.keys(parameters).map((key) => {
            const parameter = getParameter(key) as
                | ParameterTypeSelect
                | ParameterTypeRange
                | ParameterTypeToggle
                | ParameterTypeTextbox;

            if (!parameter || parameters[key] === undefined) {
                return null;
            }

            if ('component' in parameter && parameter.component === 'textbox') {
                return (
                    <ParameterTextboxSelector
                        key={key}
                        parameterKey={key}
                        parameter={parameter as ParameterTypeTextbox & { label: string }}
                        value={typeof parameters[key] === 'string' ? (parameters[key] as string) : ''}
                        setParameter={setParameter}
                        removeParameter={removeParameter}
                        isDarkMode={isDarkMode}
                        editorMode="dialog"
                        autoOpen={activeTextboxParameterKey === key}
                        onOpenChange={(open) => {
                            if (!open) {
                                setActiveTextboxParameterKey((currentKey) => (currentKey === key ? null : currentKey));
                            }
                        }}
                    />
                );
            }

            const parameterType = parameter.type || 'select';

            if (parameterType === 'select') {
                const selectParameter = parameter as ParameterTypeSelect & { label: string };

                return (
                    <ParameterSelector
                        key={key}
                        parameterKey={key}
                        parameter={selectParameter}
                        parameters={parameters}
                        removeParameter={removeParameter}
                        setParameter={setParameter}
                        isDarkMode={isDarkMode}
                    />
                );
            }

            if (parameterType === 'range') {
                const rangeParameter = parameter as ParameterTypeRange & { label: string };

                return (
                    <ParameterRangeSelector
                        key={key}
                        parameterKey={key}
                        parameter={rangeParameter}
                        parameters={parameters}
                        stepperPopupStyles={stepperPopupStyles}
                        removeParameter={removeParameter}
                        setParameter={setParameter}
                        isDarkMode={isDarkMode}
                    />
                );
            }

            if (parameterType === 'toggle') {
                const toggleParameter = parameter as ParameterTypeToggle & { label: string };

                return (
                    <ParameterToggleSelector
                        key={key}
                        parameterKey={key}
                        parameter={toggleParameter}
                        removeParameter={removeParameter}
                        isDarkMode={isDarkMode}
                    />
                );
            }

            return null;
        });
    };

    return {
        plusDropdownOptions,
        handlePlusDropdownSelect,
        getParameter,
        renderSelectedParameters,
    };
};
