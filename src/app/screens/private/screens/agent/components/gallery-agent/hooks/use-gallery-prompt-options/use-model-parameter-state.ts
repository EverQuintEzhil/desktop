import cloneDeep from 'lodash/cloneDeep';
import type React from 'react';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type { SelectSuggestionItem } from '@/components';
import { type DropDownValueObject } from '@/components/ui/dropdown-menu';
import { getSelectedParameterValue, shouldSelectParameterByDefault } from '@/lib/agent-parameters';
import type { GalleryAgentType, ModelValueType, ParameterType } from '@/types/admin';

import { buildMergedParameterConfig, buildParametersFromArgs, reconcileParameterValue } from './parameter-defaults';
import type { ModelParamAction, ModelParamState } from './types';

const modelParamReducer = (state: ModelParamState, action: ModelParamAction): ModelParamState => {
    switch (action.type) {
        case 'SET_MODEL':
            return { ...state, selectedModel: action.model };

        case 'SET_PARAMETER':
            return { ...state, parameters: { ...state.parameters, [action.key]: action.value } };

        case 'SET_PARAMETERS':
            return { ...state, parameters: action.parameters };

        case 'REMOVE_PARAMETER': {
            const next = { ...state.parameters };

            delete next[action.key];

            return { ...state, parameters: next };
        }

        case 'APPLY_DEFAULT_PARAMETERS':
            return {
                ...state,
                selectedModel: action.model,
                parameters: action.parameters,
                snapshot: state.snapshot ?? {
                    model: state.selectedModel,
                    parameters: cloneDeep(state.parameters),
                },
            };

        case 'RESTORE_PERSISTED':
            return {
                ...state,
                selectedModel: action.model ?? state.selectedModel,
                parameters: action.parameters,
            };

        case 'RESET_TO_SNAPSHOT':
            if (!state.snapshot) {
                return state;
            }

            return {
                ...state,
                selectedModel: state.snapshot.model,
                parameters: state.snapshot.parameters,
                snapshot: null,
            };

        default:
            return state;
    }
};

interface UseModelParameterStateArgs {
    agent: GalleryAgentType;
    agentRef: React.RefObject<GalleryAgentType>;
    availableModels: DropDownValueObject<ModelValueType>[];
    initialSelectedModel: DropDownValueObject<ModelValueType> | null;
    clearActiveTextboxParameterKey: (key: string) => void;
}

export interface UseModelParameterStateResult {
    modelParamState: ModelParamState;
    dispatch: React.Dispatch<ModelParamAction>;
    setParameter: (key: string, value: number | boolean | string | SelectSuggestionItem<string>) => void;
    removeParameter: (key: string) => void;
    setSelectedModel: (model: DropDownValueObject<ModelValueType> | null) => void;
    setDefaultParameters: (defaultParameters: unknown, modelId: string) => void;
    resetDefaultParameters: () => void;
    mergedParameters: Record<string, ParameterType>;
    mergedParametersRef: React.RefObject<Record<string, ParameterType>>;
    stateRef: React.RefObject<ModelParamState>;
    skipNextSyncRef: React.RefObject<boolean>;
}

export const useModelParameterState = (args: UseModelParameterStateArgs): UseModelParameterStateResult => {
    const { agent, agentRef, availableModels, initialSelectedModel, clearActiveTextboxParameterKey } = args;

    const [modelParamState, dispatch] = useReducer(modelParamReducer, {
        selectedModel: initialSelectedModel,
        parameters: {},
        snapshot: null,
    });

    const { selectedModel, parameters } = modelParamState;

    const stateRef = useRef(modelParamState);

    stateRef.current = modelParamState;

    const skipNextSyncRef = useRef(false);

    const setParameter = useCallback((key: string, value: number | boolean | string | SelectSuggestionItem<string>) => {
        dispatch({ type: 'SET_PARAMETER', key, value });
    }, []);

    const removeParameter = useCallback(
        (key: string) => {
            clearActiveTextboxParameterKey(key);
            dispatch({ type: 'REMOVE_PARAMETER', key });
        },
        [clearActiveTextboxParameterKey],
    );

    const setSelectedModel = useCallback((model: DropDownValueObject<ModelValueType> | null) => {
        dispatch({ type: 'SET_MODEL', model });
    }, []);

    const setDefaultParameters = useCallback(
        (defaultParameters: unknown, modelId: string) => {
            if (!defaultParameters) {
                return;
            }

            const model = availableModels.find((m) => m.value.modelId === modelId);

            if (model) {
                const newParameters = buildParametersFromArgs(
                    defaultParameters as Record<string, unknown>,
                    buildMergedParameterConfig(agentRef.current.uiConfig.parameters, model.value.parameters),
                );

                if (stateRef.current.selectedModel !== model) {
                    skipNextSyncRef.current = true;
                }

                dispatch({ type: 'APPLY_DEFAULT_PARAMETERS', model, parameters: newParameters });

                return;
            }

            const currentModel = stateRef.current.selectedModel;

            if (!currentModel) {
                return;
            }

            const merged = buildMergedParameterConfig(
                agentRef.current.uiConfig.parameters,
                currentModel.value.parameters,
            );
            const survivingParameters = buildParametersFromArgs(
                defaultParameters as Record<string, unknown>,
                merged,
                true,
            );

            if (Object.keys(survivingParameters).length === 0) {
                return;
            }

            dispatch({ type: 'APPLY_DEFAULT_PARAMETERS', model: currentModel, parameters: survivingParameters });
        },
        [availableModels, agentRef],
    );

    const resetDefaultParameters = useCallback(() => {
        const { snapshot, selectedModel: current } = stateRef.current;

        if (!snapshot) {
            return;
        }

        if (current !== snapshot.model) {
            skipNextSyncRef.current = true;
        }

        dispatch({ type: 'RESET_TO_SNAPSHOT' });
    }, []);

    const mergedParameters = useMemo(() => {
        return buildMergedParameterConfig(agent.uiConfig.parameters, selectedModel?.value.parameters);
    }, [agent.uiConfig.parameters, selectedModel]);

    const parametersRef = useRef(parameters);

    parametersRef.current = parameters;

    const mergedParametersRef = useRef(mergedParameters);

    mergedParametersRef.current = mergedParameters;

    useEffect(() => {
        if (skipNextSyncRef.current) {
            skipNextSyncRef.current = false;

            return;
        }

        const currentParams = parametersRef.current;
        const merged = mergedParametersRef.current;
        const newParameters = cloneDeep(currentParams);

        Object.keys(newParameters).forEach((key) => {
            if (merged[key]) {
                newParameters[key] = reconcileParameterValue(newParameters[key], merged[key]);
            } else {
                delete newParameters[key];
            }
        });

        Object.keys(merged).forEach((key) => {
            if (!shouldSelectParameterByDefault(merged[key]) || newParameters[key] !== undefined) {
                return;
            }

            const param = merged[key];

            if ('component' in param && param.component === 'textbox') {
                newParameters[key] = '';
            } else {
                newParameters[key] = getSelectedParameterValue(param);
            }
        });

        dispatch({ type: 'SET_PARAMETERS', parameters: newParameters });
    }, [selectedModel]);

    return {
        modelParamState,
        dispatch,
        setParameter,
        removeParameter,
        setSelectedModel,
        setDefaultParameters,
        resetDefaultParameters,
        mergedParameters,
        mergedParametersRef,
        stateRef,
        skipNextSyncRef,
    };
};
