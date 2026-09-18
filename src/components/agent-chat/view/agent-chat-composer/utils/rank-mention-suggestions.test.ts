import { WrenchIcon } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import type { DirectiveSuggestionBase } from '@/lib/chat/directives';

import { rankMentionSuggestions } from './rank-mention-suggestions';

interface SuggestionFixture extends Partial<DirectiveSuggestionBase> {
    label: string;
}

const makeSuggestion = ({ label, ...rest }: SuggestionFixture): DirectiveSuggestionBase => ({
    id: label,
    label,
    type: 'tool',
    icon: WrenchIcon,
    ...rest,
});

const labelsOf = (suggestions: DirectiveSuggestionBase[]) => suggestions.map((suggestion) => suggestion.label);

const typeRunsOf = (suggestions: DirectiveSuggestionBase[]) =>
    suggestions.reduce<string[]>((runs, suggestion) => {
        if (runs[runs.length - 1] === suggestion.type) {
            return runs;
        }

        return [...runs, suggestion.type];
    }, []);

const mixedTypes = [
    makeSuggestion({ label: 'tool-1' }),
    makeSuggestion({ label: 'tool-2' }),
    makeSuggestion({ label: 'tool-3' }),
    makeSuggestion({ label: 'tool-4' }),
    makeSuggestion({ label: 'tool-5' }),
    makeSuggestion({ label: 'skill-1', type: 'skill' }),
    makeSuggestion({ label: 'skill-2', type: 'skill' }),
    makeSuggestion({ label: 'mcp-1', type: 'mcp' }),
];

describe('rankMentionSuggestions — empty query', () => {
    it('gives every type a slot even when one type alone exceeds the limit', () => {
        const result = rankMentionSuggestions(mixedTypes, '', 4);

        expect(labelsOf(result)).toEqual(['tool-1', 'tool-2', 'skill-1', 'mcp-1']);
    });

    it('returns exactly min(total, limit) entries', () => {
        expect(rankMentionSuggestions(mixedTypes, '', 4)).toHaveLength(4);
        expect(rankMentionSuggestions(mixedTypes, '', 8)).toHaveLength(8);
        expect(rankMentionSuggestions(mixedTypes, '', 20)).toHaveLength(8);
        expect(rankMentionSuggestions(mixedTypes, '   ', 3)).toHaveLength(3);
    });

    it('never repeats an entry', () => {
        const result = rankMentionSuggestions(mixedTypes, '', 6);

        expect(new Set(labelsOf(result)).size).toBe(result.length);
    });

    it('keeps each type contiguous and in source order within its type', () => {
        const result = rankMentionSuggestions(mixedTypes, '', 6);
        const runs = typeRunsOf(result);

        expect(runs).toEqual(['tool', 'skill', 'mcp']);
        expect(new Set(runs).size).toBe(runs.length);
        expect(labelsOf(result.filter((suggestion) => suggestion.type === 'tool'))).toEqual([
            'tool-1',
            'tool-2',
            'tool-3',
        ]);
    });
});

describe('rankMentionSuggestions — ranking', () => {
    it('orders exact label, then prefix, then word start, then substring, then a secondary-field match', () => {
        const suggestions = [
            makeSuggestion({ label: 'lookup', description: 'full text search results' }),
            makeSuggestion({ label: 'researcher' }),
            makeSuggestion({ label: 'searchable index' }),
            makeSuggestion({ label: 'web-search' }),
            makeSuggestion({ label: 'search' }),
        ];

        expect(labelsOf(rankMentionSuggestions(suggestions, 'search', 10))).toEqual([
            'search',
            'searchable index',
            'web-search',
            'researcher',
            'lookup',
        ]);
    });

    it('ranks a hyphen or space word start above a mid-word substring', () => {
        const suggestions = [
            makeSuggestion({ label: 'researcher' }),
            makeSuggestion({ label: 'web-search' }),
            makeSuggestion({ label: 'Web Search' }),
        ];

        expect(labelsOf(rankMentionSuggestions(suggestions, 'search', 10))).toEqual([
            'web-search',
            'Web Search',
            'researcher',
        ]);
    });

    it('matches on the id when the label does not match', () => {
        const suggestions = [
            makeSuggestion({ label: 'Lookup', id: 'web_search_tool' }),
            makeSuggestion({ label: 'Unrelated', id: 'calculator' }),
        ];

        expect(labelsOf(rankMentionSuggestions(suggestions, 'search', 10))).toEqual(['Lookup']);
    });

    it('keeps source order for entries of the same rank', () => {
        const suggestions = [makeSuggestion({ label: 'search beta' }), makeSuggestion({ label: 'search alpha' })];

        expect(labelsOf(rankMentionSuggestions(suggestions, 'search', 10))).toEqual(['search beta', 'search alpha']);
    });

    it('excludes entries that match neither the label, the id nor the description', () => {
        const suggestions = [
            makeSuggestion({ label: 'Web Search', description: 'searches the web' }),
            makeSuggestion({ label: 'Calculator', id: 'calc', description: 'does maths' }),
        ];

        expect(labelsOf(rankMentionSuggestions(suggestions, 'search', 10))).toEqual(['Web Search']);
        expect(rankMentionSuggestions(suggestions, 'zzz', 10)).toEqual([]);
    });

    it('ignores case and surrounding whitespace in the query', () => {
        const suggestions = [makeSuggestion({ label: 'Web Search Extra' }), makeSuggestion({ label: 'Web  Search' })];

        expect(labelsOf(rankMentionSuggestions(suggestions, '  WEB   search  ', 10))).toEqual([
            'Web  Search',
            'Web Search Extra',
        ]);
    });

    it('treats regex-special characters in the query literally', () => {
        const suggestions = [
            makeSuggestion({ label: 'a+b tool' }),
            makeSuggestion({ label: 'v.*x' }),
            makeSuggestion({ label: 'fn(x)' }),
            makeSuggestion({ label: 'ab vx fnx' }),
        ];

        expect(() => rankMentionSuggestions(suggestions, 'a+b', 10)).not.toThrow();
        expect(labelsOf(rankMentionSuggestions(suggestions, 'a+b', 10))).toEqual(['a+b tool']);
        expect(labelsOf(rankMentionSuggestions(suggestions, '.*', 10))).toEqual(['v.*x']);
        expect(labelsOf(rankMentionSuggestions(suggestions, '(', 10))).toEqual(['fn(x)']);
    });

    it('regroups the ranked result so each type stays contiguous', () => {
        const suggestions = [
            makeSuggestion({ label: 'search' }),
            makeSuggestion({ label: 'searchable', type: 'mcp' }),
            makeSuggestion({ label: 'web-search' }),
        ];

        const result = rankMentionSuggestions(suggestions, 'search', 10);

        expect(labelsOf(result)).toEqual(['search', 'web-search', 'searchable']);
        expect(typeRunsOf(result)).toEqual(['tool', 'mcp']);
    });

    it('respects the limit on the ranked path', () => {
        const suggestions = [
            makeSuggestion({ label: 'web-search' }),
            makeSuggestion({ label: 'searchable index' }),
            makeSuggestion({ label: 'search' }),
            makeSuggestion({ label: 'researcher' }),
            makeSuggestion({ label: 'lookup', description: 'search everything' }),
        ];

        expect(labelsOf(rankMentionSuggestions(suggestions, 'search', 2))).toEqual(['search', 'searchable index']);
    });

    it('does not mutate the input array', () => {
        const suggestions = [
            makeSuggestion({ label: 'researcher' }),
            makeSuggestion({ label: 'search' }),
            makeSuggestion({ label: 'web-search' }),
        ];
        const snapshot = [...suggestions];

        rankMentionSuggestions(suggestions, 'search', 10);
        rankMentionSuggestions(suggestions, '', 2);

        expect(suggestions).toEqual(snapshot);
        expect(labelsOf(suggestions)).toEqual(['researcher', 'search', 'web-search']);
    });
});
