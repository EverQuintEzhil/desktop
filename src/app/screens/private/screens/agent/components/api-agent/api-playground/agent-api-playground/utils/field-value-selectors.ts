import type { SelectSuggestionItem } from '@/components/multi-select';

export const isSelectSuggestionItem = (
    fieldValue: unknown,
): fieldValue is SelectSuggestionItem<string> & { value: string } => {
    return (
        typeof fieldValue === 'object' &&
        fieldValue !== null &&
        'value' in fieldValue &&
        typeof fieldValue.value === 'string'
    );
};

export const getFieldValueAsStringArray = (fieldValue: unknown): string[] => {
    if (!Array.isArray(fieldValue)) return [];
    if (fieldValue.length === 0) return [];
    if (typeof fieldValue[0] === 'string') return [...fieldValue] as string[];

    return (fieldValue as { value: string }[]).map((item) => item.value);
};

export const getFieldValueAsString = (fieldValue: unknown): string => {
    if (Array.isArray(fieldValue)) return fieldValue.join(', ');
    if (typeof fieldValue === 'string') return fieldValue;
    if (isSelectSuggestionItem(fieldValue)) {
        return fieldValue.value;
    }

    return '';
};

export const getMultiSelectFieldValue = (fieldValue: unknown): SelectSuggestionItem<string>[] => {
    if (Array.isArray(fieldValue) && fieldValue.length > 0 && typeof fieldValue[0] !== 'object') {
        return fieldValue.map((val) => ({ label: String(val), value: val }));
    }

    return (fieldValue as SelectSuggestionItem<string>[] | undefined) ?? [];
};
