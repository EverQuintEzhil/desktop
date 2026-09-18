import type { SuggestionItem } from '../types';

export function suggestionItemsEqual<T>(a: SuggestionItem<T>, b: SuggestionItem<T>): boolean {
    return a.label === b.label && JSON.stringify(a.value) === JSON.stringify(b.value);
}
