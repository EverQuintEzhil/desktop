import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import type { AgentType } from '@/types/admin';

import {
    ADMIN_AGENT_DETAIL_KEY,
    cancelAgentCaches,
    patchAgentCaches,
    PREVIEW_AGENT_DETAIL_KEY,
    setEnabledById,
} from './agent-cache';

const makeAgent = (id: string, skillEnabled: boolean): AgentType =>
    ({
        _id: id,
        skills: [
            { _id: 's1', effectiveEnabled: skillEnabled, agentEnabled: skillEnabled },
            { _id: 's2', effectiveEnabled: true, agentEnabled: true },
        ],
    }) as unknown as AgentType;

const flipS1 = (agent: AgentType): AgentType => ({
    ...agent,
    skills: setEnabledById(agent.skills ?? [], 's1', false),
});

describe('setEnabledById', () => {
    it('writes both enablement flags on the matching row and leaves the rest untouched', () => {
        const items = [
            { _id: 'a', effectiveEnabled: false, agentEnabled: false },
            { _id: 'b', effectiveEnabled: false, agentEnabled: false },
        ];

        const next = setEnabledById(items, 'a', true);

        expect(next[0]).toEqual({ _id: 'a', effectiveEnabled: true, agentEnabled: true });
        expect(next[1]).toBe(items[1]);
        expect(next).not.toBe(items);
    });

    it('returns an equivalent list when no id matches', () => {
        const items = [{ _id: 'a', effectiveEnabled: true, agentEnabled: true }];

        expect(setEnabledById(items, 'missing', false)).toEqual(items);
    });
});

describe('patchAgentCaches', () => {
    it('patches the app agent cache and every admin-detail cache holding the same agent', () => {
        const queryClient = new QueryClient();

        queryClient.setQueryData(['agent', 'a1'], makeAgent('a1', true));
        queryClient.setQueryData([...ADMIN_AGENT_DETAIL_KEY, 'slug-a1'], makeAgent('a1', true));
        queryClient.setQueryData([...ADMIN_AGENT_DETAIL_KEY, 'slug-other'], makeAgent('other', true));

        patchAgentCaches(queryClient, 'a1', flipS1);

        const app = queryClient.getQueryData<AgentType>(['agent', 'a1']);
        const detail = queryClient.getQueryData<AgentType>([...ADMIN_AGENT_DETAIL_KEY, 'slug-a1']);
        const otherDetail = queryClient.getQueryData<AgentType>([...ADMIN_AGENT_DETAIL_KEY, 'slug-other']);

        expect(app?.skills?.find((s) => s._id === 's1')?.effectiveEnabled).toBe(false);
        expect(detail?.skills?.find((s) => s._id === 's1')?.effectiveEnabled).toBe(false);
        // A detail cache for a different agent must not be touched.
        expect(otherDetail?.skills?.find((s) => s._id === 's1')?.effectiveEnabled).toBe(true);
    });

    it('patches the app agent cache keyed by slug rather than by id', () => {
        const queryClient = new QueryClient();

        queryClient.setQueryData(['agent', 'my-agent'], makeAgent('a1', true));

        patchAgentCaches(queryClient, 'a1', flipS1);

        const app = queryClient.getQueryData<AgentType>(['agent', 'my-agent']);

        expect(app?.skills?.find((s) => s._id === 's1')?.effectiveEnabled).toBe(false);
    });

    it('patches the builder preview cache', () => {
        const queryClient = new QueryClient();

        queryClient.setQueryData([...PREVIEW_AGENT_DETAIL_KEY, 'a1'], makeAgent('a1', true));

        patchAgentCaches(queryClient, 'a1', flipS1);

        const preview = queryClient.getQueryData<AgentType>([...PREVIEW_AGENT_DETAIL_KEY, 'a1']);

        expect(preview?.skills?.find((s) => s._id === 's1')?.effectiveEnabled).toBe(false);
    });

    it('leaves nested agent-scoped caches alone', () => {
        const queryClient = new QueryClient();
        const memories = [{ _id: 'm1' }];

        queryClient.setQueryData(['agent', 'a1', 'memories'], memories);

        patchAgentCaches(queryClient, 'a1', flipS1);

        expect(queryClient.getQueryData(['agent', 'a1', 'memories'])).toBe(memories);
    });

    it('no-ops when the target caches are empty', () => {
        const queryClient = new QueryClient();

        expect(() => patchAgentCaches(queryClient, 'a1', flipS1)).not.toThrow();
        expect(queryClient.getQueryData(['agent', 'a1'])).toBeUndefined();
    });
});

describe('cancelAgentCaches', () => {
    const hang = () => new Promise<AgentType>(() => {});

    it('cancels every in-flight refetch of the given agent, whatever key it sits under', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        queryClient.setQueryData(['agent', 'my-agent'], makeAgent('a1', true));
        queryClient.setQueryData([...PREVIEW_AGENT_DETAIL_KEY, 'a1'], makeAgent('a1', true));
        void queryClient.prefetchQuery({ queryKey: ['agent', 'my-agent'], queryFn: hang, staleTime: 0 });
        void queryClient.prefetchQuery({
            queryKey: [...PREVIEW_AGENT_DETAIL_KEY, 'a1'],
            queryFn: hang,
            staleTime: 0,
        });

        await cancelAgentCaches(queryClient, 'a1');

        expect(queryClient.getQueryState(['agent', 'my-agent'])?.fetchStatus).toBe('idle');
        expect(queryClient.getQueryState([...PREVIEW_AGENT_DETAIL_KEY, 'a1'])?.fetchStatus).toBe('idle');
    });

    it('leaves another agent loading — a cancelled first fetch is never re-issued', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        void queryClient.prefetchQuery({ queryKey: ['agent', 'other-agent'], queryFn: hang });

        await cancelAgentCaches(queryClient, 'a1');

        expect(queryClient.getQueryState(['agent', 'other-agent'])?.fetchStatus).toBe('fetching');
    });
});
