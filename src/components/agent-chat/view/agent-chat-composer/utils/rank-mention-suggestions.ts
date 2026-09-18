import type { DirectiveSuggestionBase } from '@/lib/chat/directives';

const RANK_EXACT_LABEL = 0;
const RANK_LABEL_PREFIX = 1;
const RANK_LABEL_WORD_START = 2;
const RANK_LABEL_SUBSTRING = 3;
const RANK_SECONDARY_FIELD = 4;
const RANK_NO_MATCH = Number.POSITIVE_INFINITY;

const normalizeSearchText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

// A word start is any occurrence not preceded by a letter or digit, so "search" matches
// "web-search" and "Web Search" but not "researcher".
const hasWordStartMatch = (haystack: string, needle: string) => {
    for (let index = haystack.indexOf(needle); index > 0; index = haystack.indexOf(needle, index + 1)) {
        if (!/[a-z0-9]/.test(haystack.charAt(index - 1))) {
            return true;
        }
    }

    return false;
};

const getMatchRank = (suggestion: DirectiveSuggestionBase, query: string) => {
    const label = normalizeSearchText(suggestion.label);

    if (label === query) {
        return RANK_EXACT_LABEL;
    }

    const labelIndex = label.indexOf(query);

    if (labelIndex === 0) {
        return RANK_LABEL_PREFIX;
    }

    if (labelIndex > 0) {
        return hasWordStartMatch(label, query) ? RANK_LABEL_WORD_START : RANK_LABEL_SUBSTRING;
    }

    const matchesSecondary =
        normalizeSearchText(suggestion.id).includes(query) ||
        normalizeSearchText(suggestion.description ?? '').includes(query);

    return matchesSecondary ? RANK_SECONDARY_FIELD : RANK_NO_MATCH;
};

const collectTypeGroups = (suggestions: DirectiveSuggestionBase[]): DirectiveSuggestionBase[][] => {
    const groups = new Map<string, DirectiveSuggestionBase[]>();

    suggestions.forEach((suggestion) => {
        const group = groups.get(suggestion.type);

        if (group) {
            group.push(suggestion);

            return;
        }

        groups.set(suggestion.type, [suggestion]);
    });

    return Array.from(groups.values());
};

// `renderMentionSections` groups by section while keyboard navigation walks the flat array, so
// entries of one type must stay contiguous or the highlight jumps around the rendered list.
const groupByType = (suggestions: DirectiveSuggestionBase[]): DirectiveSuggestionBase[] =>
    collectTypeGroups(suggestions).flat();

// A flat prefix slice of the type-ordered list would spend the whole limit on the first type, so
// an agent with more tools than `limit` would show no skills and no connectors at all. One item
// per group per pass guarantees every present type a slot while `limit` >= the number of types.
const takeAcrossTypes = (suggestions: DirectiveSuggestionBase[], limit: number): DirectiveSuggestionBase[] => {
    const groups = collectTypeGroups(suggestions);
    const longestGroup = groups.reduce((longest, group) => Math.max(longest, group.length), 0);
    const taken: DirectiveSuggestionBase[] = [];

    for (let pass = 0; pass < longestGroup && taken.length < limit; pass += 1) {
        groups.forEach((group) => {
            if (taken.length >= limit || pass >= group.length) return;

            taken.push(group[pass]);
        });
    }

    return groupByType(taken);
};

/**
 * Ranked "@" mention search: exact label, then label prefix, then a word start inside the label,
 * then any label substring, then a match on the id or description. Ties keep source order, and
 * the result is regrouped by type so it still renders as contiguous sections. An empty query
 * fills the limit round-robin across the types instead of ranking.
 */
export const rankMentionSuggestions = (
    suggestions: DirectiveSuggestionBase[],
    rawQuery: string,
    limit: number,
): DirectiveSuggestionBase[] => {
    const query = normalizeSearchText(rawQuery);

    if (!query) {
        return takeAcrossTypes(suggestions, limit);
    }

    const matches = suggestions
        .map((suggestion, sourceIndex) => ({ suggestion, sourceIndex, rank: getMatchRank(suggestion, query) }))
        .filter((entry) => entry.rank !== RANK_NO_MATCH);

    matches.sort((first, second) => first.rank - second.rank || first.sourceIndex - second.sourceIndex);

    return groupByType(matches.slice(0, limit).map((entry) => entry.suggestion));
};

export default rankMentionSuggestions;
