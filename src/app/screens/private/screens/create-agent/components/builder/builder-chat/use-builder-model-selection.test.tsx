import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BUILDER_AGENT_MODELS_ABOUT_KEY } from '@/lib/api/app/about';
import { pagedEnvelope, respond, server } from '@/test/msw';
import { renderHookWithProviders } from '@/test/test-utils';

import { useBuilderModelSelection } from './use-builder-model-selection';

const stubModels = (
    models: { modelId: string; modelName: string }[] = [
        { modelId: 'model-gpt', modelName: 'gpt-5.5' },
        { modelId: 'model-claude', modelName: 'claude-sonnet-4-6' },
    ],
) => {
    server.use(
        respond('get', '/abouts', () => pagedEnvelope([{ key: BUILDER_AGENT_MODELS_ABOUT_KEY, value: models }])),
    );
};

describe('useBuilderModelSelection', () => {
    it('defaults to the first About model and exposes its id', async () => {
        stubModels();

        const { result } = renderHookWithProviders(() => useBuilderModelSelection());

        await waitFor(() => expect(result.current.availableModels).toHaveLength(2));

        expect(result.current.selectedModel?.value.modelId).toBe('model-gpt');
        expect(result.current.getModelId()).toBe('model-gpt');
    });

    it('restores a persisted model id when it is still in the About list', async () => {
        window.localStorage.setItem('builder-chat-model:user-1', 'model-claude');
        stubModels();

        const { result } = renderHookWithProviders(() => useBuilderModelSelection());

        await waitFor(() => expect(result.current.selectedModel?.value.modelId).toBe('model-claude'));
        expect(result.current.getModelId()).toBe('model-claude');
    });

    it('persists the selection when the user switches models', async () => {
        stubModels();

        const { result } = renderHookWithProviders(() => useBuilderModelSelection());

        await waitFor(() => expect(result.current.availableModels).toHaveLength(2));

        act(() => {
            result.current.setSelectedModel(result.current.availableModels[1]);
        });

        await waitFor(() => {
            expect(window.localStorage.getItem('builder-chat-model:user-1')).toBe('model-claude');
        });
        expect(result.current.getModelId()).toBe('model-claude');
    });

    it('falls back to an empty selection when About has no models', async () => {
        stubModels([]);

        const { result } = renderHookWithProviders(() => useBuilderModelSelection());

        await waitFor(() => expect(result.current.availableModels).toEqual([]));

        expect(result.current.selectedModel).toBeNull();
        expect(result.current.getModelId()).toBeUndefined();
    });
});
