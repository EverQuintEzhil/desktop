import type { SelectSuggestionItem } from '@/components';
import type { ParameterTypeSelect } from '@/types/admin';

export interface Props {
    parameterKey: string;
    parameter: ParameterTypeSelect & { label: string };
    parameters: { [key: string]: number | boolean | string | SelectSuggestionItem<string> };
    isDarkMode?: boolean;
    removeParameter: (key: string) => void;
    setParameter: (key: string, value: number | boolean | SelectSuggestionItem<string>) => void;
}
