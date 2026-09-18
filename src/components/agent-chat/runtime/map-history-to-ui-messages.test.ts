import { describe, expect, it } from 'vitest';

import type { ConversationMessage } from '@/components/agent-chat/types';

import { mapHistoryToUIMessages } from './map-history-to-ui-messages';

/** The research data parts are not in the declared part union, so reads go through this. */
interface LoosePart {
    type: string;
    data?: { markdown?: string; round?: number };
}

const assistantMessage = (overrides: Partial<ConversationMessage> = {}): ConversationMessage => ({
    _id: 'a1',
    conversation_id: 'c1',
    role: 'assistant',
    content: [],
    ...overrides,
});

describe('mapHistoryToUIMessages', () => {
    it('drops an empty assistant message marked pending', () => {
        const mapped = mapHistoryToUIMessages([assistantMessage({ metadata: { pending: true } })]);

        expect(mapped).toEqual([]);
    });

    it('keeps an empty assistant message marked partial', () => {
        const mapped = mapHistoryToUIMessages([assistantMessage({ metadata: { partial: true } })]);

        expect(mapped).toHaveLength(1);
        expect(mapped[0].metadata?.custom?.partial).toBe(true);
    });

    it('keeps an empty assistant message carrying an error', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({ metadata: { error: 'Generation produced no output.' } }),
        ]);

        expect(mapped).toHaveLength(1);
        expect(mapped[0].metadata?.custom?.error).toBe('Generation produced no output.');
    });

    it('keeps an empty assistant message with no metadata at all', () => {
        const mapped = mapHistoryToUIMessages([assistantMessage()]);

        expect(mapped).toHaveLength(1);
    });

    it('keeps an assistant message that has parts', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({ content: [{ type: 'text', text: 'hello' }] as ConversationMessage['content'] }),
        ]);

        expect(mapped).toHaveLength(1);
        expect(mapped[0].parts).toHaveLength(1);
    });

    it('keeps a pending message that already streamed parts', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({
                content: [{ type: 'text', text: 'partial answer' }] as ConversationMessage['content'],
                metadata: { pending: true },
            }),
        ]);

        expect(mapped).toHaveLength(1);
        expect(mapped[0].metadata?.custom?.pending).toBe(true);
    });

    it('rebuilds the research parts ahead of the report and keeps the duration receipt', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({
                content: [{ type: 'text', text: 'the report' }] as ConversationMessage['content'],
                metadata: {
                    research_plan: { queries: ['what is amp'] },
                    research_rounds: [
                        {
                            round: 1,
                            queries: ['amp docs'],
                            summary: 'read the docs',
                            sources: [{ title: 'Amp docs', url: 'https://amp.example.com/docs' }],
                        },
                    ],
                    deep_research: { durationMs: 92_000 },
                } as unknown as ConversationMessage['metadata'],
            }),
        ]);

        expect(mapped[0].parts.map((part) => part.type)).toEqual(['data-research-plan', 'data-research-round', 'text']);
        expect(mapped[0].metadata?.custom?.deepResearch).toEqual({ durationMs: 92_000 });
    });

    it('accepts the boolean deep-research flag without a duration', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({
                metadata: { deep_research: true } as unknown as ConversationMessage['metadata'],
            }),
        ]);

        expect(mapped[0].metadata?.custom?.deepResearch).toEqual({});
    });

    it('rebuilds no research part from a malformed persisted payload', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({
                content: [{ type: 'text', text: 'the report' }] as ConversationMessage['content'],
                metadata: {
                    research_plan: { queries: 'not an array' },
                    research_rounds: [{ round: 'one' }],
                    deep_research: 'yes',
                } as unknown as ConversationMessage['metadata'],
            }),
        ]);

        expect(mapped[0].parts.map((part) => part.type)).toEqual(['text']);
        expect(mapped[0].metadata?.custom?.deepResearch).toBeUndefined();
    });

    it('still rebuilds the plan and rounds when the report arrived as its own part', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({
                content: [
                    { type: 'data-research-report', data: { markdown: '# Full report' } },
                    { type: 'text', text: 'a brief lead-in' },
                ] as unknown as ConversationMessage['content'],
                metadata: {
                    research_plan: { queries: ['Compare pricing'] },
                    research_rounds: [{ round: 0, queries: [] }],
                } as unknown as ConversationMessage['metadata'],
            }),
        ]);

        expect(mapped[0].parts.map((part) => part.type)).toEqual([
            'data-research-plan',
            'data-research-round',
            'data-research-report',
            'text',
        ]);
    });

    it('keeps a streamed plan single while still rebuilding the rounds beside it', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({
                content: [
                    { type: 'data-research-plan', data: { queries: ['Compare pricing'] } },
                ] as unknown as ConversationMessage['content'],
                metadata: {
                    research_plan: { queries: ['Compare pricing'] },
                    research_rounds: [{ round: 0, queries: [] }],
                } as unknown as ConversationMessage['metadata'],
            }),
        ]);

        expect(mapped[0].parts.map((part) => part.type)).toEqual(['data-research-round', 'data-research-plan']);
    });

    // The grouping spans the first research part to the last, so anything before the run must stay
    // before the rebuilt phases — otherwise the card's span swallows it and the step disappears.
    it('splices the rebuilt phases against the run, not the message head', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({
                content: [
                    { type: 'reasoning', text: 'Thinking about pricing.' },
                    { type: 'data-research-report', data: { markdown: '# Full report' } },
                    { type: 'text', text: 'a lead-in' },
                ] as unknown as ConversationMessage['content'],
                metadata: {
                    research_plan: { queries: ['Compare pricing'] },
                    research_rounds: [{ round: 0, queries: [] }],
                } as unknown as ConversationMessage['metadata'],
            }),
        ]);

        expect(mapped[0].parts.map((part) => part.type)).toEqual([
            'reasoning',
            'data-research-plan',
            'data-research-round',
            'data-research-report',
            'text',
        ]);
    });

    // The backend can deliver a report part carrying nothing; the document itself is then only in
    // metadata, so a present-but-blank part must not stand in for it.
    it('rebuilds the report when the delivered part carries no markdown', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({
                content: [
                    { type: 'data-research-report', data: { markdown: '' } },
                    { type: 'text', text: 'See the report in the pane.' },
                ] as unknown as ConversationMessage['content'],
                metadata: {
                    research_report: '# Full report\n\nBody.',
                } as unknown as ConversationMessage['metadata'],
            }),
        ]);

        const parts = mapped[0].parts as unknown as LoosePart[];
        const report = parts.find((part) => part.type === 'data-research-report' && part.data?.markdown);

        expect(report?.data?.markdown).toBe('# Full report\n\nBody.');
    });

    // Rounds are many parts under one type, so suppressing by type would drop every round the
    // stream did not happen to re-send.
    it('rebuilds every persisted round even when the stream delivered one of them', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({
                content: [
                    { type: 'data-research-round', data: { round: 1, queries: ['a'] } },
                ] as unknown as ConversationMessage['content'],
                metadata: {
                    research_rounds: [
                        { round: 1, queries: ['a'] },
                        { round: 2, queries: ['b'] },
                    ],
                } as unknown as ConversationMessage['metadata'],
            }),
        ]);

        const parts = mapped[0].parts as unknown as LoosePart[];
        const rounds = parts.filter((part) => part.type === 'data-research-round');

        expect(rounds).toHaveLength(3);
        expect(rounds.map((part) => part.data?.round)).toEqual([1, 2, 1]);
    });

    it('survives a persisted content entry with no type', () => {
        const mapped = mapHistoryToUIMessages([
            assistantMessage({
                content: [null, {}, { type: 'text', text: 'the report' }] as unknown as ConversationMessage['content'],
                metadata: { deep_research: true } as unknown as ConversationMessage['metadata'],
            }),
        ]);

        expect(mapped[0].metadata?.custom?.deepResearch).toEqual({});
    });

    it('keeps user messages with no parts', () => {
        const mapped = mapHistoryToUIMessages([
            {
                _id: 'u1',
                conversation_id: 'c1',
                role: 'user',
                content: [],
            },
        ]);

        expect(mapped).toHaveLength(1);
        expect(mapped[0].role).toBe('user');
    });

    it('marks a user message the backend flagged as deep research', () => {
        const mapped = mapHistoryToUIMessages([
            {
                _id: 'u1',
                conversation_id: 'c1',
                role: 'user',
                content: [{ type: 'text', text: 'compare vector databases' }],
                metadata: { deep_research: true } as unknown as ConversationMessage['metadata'],
            },
        ]);

        expect(mapped[0].metadata?.custom?.deepResearch).toEqual({});
    });

    it('leaves an ordinary user message without metadata', () => {
        const mapped = mapHistoryToUIMessages([
            {
                _id: 'u1',
                conversation_id: 'c1',
                role: 'user',
                content: [{ type: 'text', text: 'hello' }],
            },
        ]);

        expect(mapped[0].metadata).toBeUndefined();
    });
});
