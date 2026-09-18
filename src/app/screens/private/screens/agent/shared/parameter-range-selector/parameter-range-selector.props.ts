import type { SelectSuggestionItem } from '@/components';
import type { ParameterTypeRange } from '@/types/admin';

export interface Props {
    parameterKey: string;
    parameter: ParameterTypeRange & { label: string };
    parameters: { [key: string]: number | boolean | string | SelectSuggestionItem<string> };
    isDarkMode?: boolean;
    removeParameter: (key: string) => void;
    setParameter: (key: string, value: number | boolean | SelectSuggestionItem<string>) => void;
    stepperPopupStyles?: string;
}
