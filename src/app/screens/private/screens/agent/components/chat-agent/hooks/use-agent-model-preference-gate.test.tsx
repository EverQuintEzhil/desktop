import { onlineManager } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAgentModelPreference } from '@/components/agent-chat/hooks/use-agent-model-preference';
import { apiUrl, envelope, server } from '@/test/msw';
import { renderHookWithProviders } from '@/test/test-utils';

import { useAgentModelPreferenceGate } from './use-agent-model-preference-gate';

const AGENT_ID = 'agent-1';

let requestCount = 0;

const respondWithPreference = () => {
    server.use(
        http.get(apiUrl('/agents/:agentId/preferences'), () => {
            requestCount += 1;

            return envelope({ defaultModelId: 'model-deep' });
        }),
    );
};

beforeEach(() => {
    requestCount = 0;
});

afterEach(() => {
    onlineManager.setOnline(true);
});

describe('useAgentModelPreferenceGate', () => {
    it('is unsettled while the preference is in flight and settles once it resolves', async () => {
        respondWithPreference();

        const { result } = renderHookWithProviders(() => useAgentModelPreferenceGate(AGENT_ID));

        expect(result.current).toBe(false);

        await waitFor(() => expect(result.current).toBe(true));
    });

    it('settles when the preference request fails', async () => {
        server.use(
            http.get(apiUrl('/agents/:agentId/preferences'), () => {
                requestCount += 1;

                return HttpResponse.json({ success: false, value: null }, { status: 500 });
            }),
        );

        const { result } = renderHookWithProviders(() => useAgentModelPreferenceGate(AGENT_ID));

        await waitFor(() => expect(result.current).toBe(true));
        expect(requestCount).toBe(1);
    });

    it('settles immediately while the browser is offline and the query is paused', () => {
        respondWithPreference();
        onlineManager.setOnline(false);

        const { result } = renderHookWithProviders(() => useAgentModelPreferenceGate(AGENT_ID));

        expect(result.current).toBe(true);
    });

    it('settles immediately when there is no agent id', () => {
        respondWithPreference();

        const { result } = renderHookWithProviders(() => useAgentModelPreferenceGate(''));

        expect(result.current).toBe(true);
        expect(requestCount).toBe(0);
    });

    it('issues a single request for the gate and the composer preference together', async () => {
        respondWithPreference();

        const { result } = renderHookWithProviders(() => ({
            isSettled: useAgentModelPreferenceGate(AGENT_ID),
            preference: useAgentModelPreference(AGENT_ID),
        }));

        await waitFor(() => expect(result.current.isSettled).toBe(true));
        await waitFor(() => expect(result.current.preference.persistedModelId).toBe('model-deep'));

        expect(requestCount).toBe(1);
    });
});
