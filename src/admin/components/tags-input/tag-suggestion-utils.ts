import { type TagSuggestionItem } from './tags-input.types';

export const tagSuggestionValuesEqual = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

export const tagSuggestionsEqual = <T>(a: TagSuggestionItem<T>, b: TagSuggestionItem<T>) =>
    a.label === b.label && tagSuggestionValuesEqual(a.value, b.value);
