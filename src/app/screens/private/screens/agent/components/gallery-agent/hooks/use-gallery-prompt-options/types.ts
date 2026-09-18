import type { SelectSuggestionItem } from '@/components';
import { type DropDownValueObject } from '@/components/ui/dropdown-menu';
import type { GalleryAgentType, ModelValueType } from '@/types/admin';

export interface Props {
    agent: GalleryAgentType;
    initialPrompt?: string;
    initialIsPublic?: boolean;
}

export interface ParameterPopupStylesOverrides {
    parameterSelectPopupStyles?: string;
    parameterStepperPopupStyles?: string;
    /** When set, used for the selected-parameters pill Button (select and range) to match e.g. usePlusOptions. */
    parameterButtonStyles?: string;
}

export interface ParametersState {
    [key: string]: number | boolean | string | SelectSuggestionItem<string>;
}

export interface ModelParamState {
    selectedModel: DropDownValueObject<ModelValueType> | null;
    parameters: ParametersState;
    snapshot: {
        model: DropDownValueObject<ModelValueType> | null;
        parameters: ParametersState;
    } | null;
}

export type ModelParamAction =
    | { type: 'SET_MODEL'; model: DropDownValueObject<ModelValueType> | null }
    | { type: 'SET_PARAMETER'; key: string; value: number | boolean | string | SelectSuggestionItem<string> }
    | { type: 'SET_PARAMETERS'; parameters: ParametersState }
    | { type: 'REMOVE_PARAMETER'; key: string }
    | { type: 'APPLY_DEFAULT_PARAMETERS'; model: DropDownValueObject<ModelValueType>; parameters: ParametersState }
    | { type: 'RESTORE_PERSISTED'; model: DropDownValueObject<ModelValueType> | null; parameters: ParametersState }
    | { type: 'RESET_TO_SNAPSHOT' };
