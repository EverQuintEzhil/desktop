import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../client';

import { adminDataStoresApi, shouldPollOkfStatus, useRegenerateOkfMutation } from './data-stores';

vi.mock('../client', () => ({
    apiClient: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });

    const Wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { queryClient, Wrapper };
};

describe('adminDataStoresApi.regenerateOkf', () => {
    afterEach(() => {
        vi.mocked(apiClient.post).mockReset();
    });

    it('POSTs to the wizard okf/regenerate endpoint with no body', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ success: true });

        await adminDataStoresApi.regenerateOkf('ds-1');

        expect(apiClient.post).toHaveBeenCalledWith('/datastores/wizard/ds-1/okf/regenerate', undefined, undefined);
    });
});

describe('useRegenerateOkfMutation', () => {
    afterEach(() => {
        vi.mocked(apiClient.post).mockReset();
    });

    it('invalidates the datastore detail query (exact) on success', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ success: true });

        const { queryClient, Wrapper } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(() => useRegenerateOkfMutation(), { wrapper: Wrapper });

        result.current.mutate('ds-1');

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ['admin', 'dataStores', 'detail', 'ds-1'],
            exact: true,
        });
    });
});

describe('shouldPollOkfStatus', () => {
    it('polls while generation is pending or in flight', () => {
        expect(shouldPollOkfStatus('pending')).toBe(true);
        expect(shouldPollOkfStatus('generating')).toBe(true);
    });

    it('does not poll once settled or when never generated', () => {
        expect(shouldPollOkfStatus('completed')).toBe(false);
        expect(shouldPollOkfStatus('failed')).toBe(false);
        expect(shouldPollOkfStatus(undefined)).toBe(false);
        expect(shouldPollOkfStatus(null)).toBe(false);
    });
});
