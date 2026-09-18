import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { readPersistedModelId, writePersistedModelId } from '@/components/agent-chat/utils/model-selection-persistence';
import type { DropDownValueObject } from '@/components/ui/dropdown-menu';
import { useBuilderAgentModelsQuery } from '@/lib/api/app/about';
import { selectUser } from '@/store/selectors';
import type { ModelValueType } from '@/types/admin';

const getBuilderModelStorageKey = (userId: string): string => `builder-chat-model:${userId || 'anonymous'}`;

export function useBuilderModelSelection() {
    const user = useSelector(selectUser);
    const userId = user?._id ?? '';
    const storageKey = getBuilderModelStorageKey(userId);
    const { data: models = [], isFetched, isError } = useBuilderAgentModelsQuery();
    // True once the About query has settled (success or failure) so the first turn
    // can wait for a resolved selection instead of racing a cold fetch.
    const isModelsReady = isFetched || isError;

    const availableModels = useMemo<DropDownValueObject<ModelValueType>[]>(
        () =>
            models.map((model) => ({
                label: model.modelName,
                value: {
                    modelId: model.modelId,
                    name: model.modelName,
                },
            })),
        [models],
    );

    const [userSelectedModelId, setUserSelectedModelId] = useState<string | null>(null);

    const selectedModel = useMemo(() => {
        if (!isModelsReady || availableModels.length === 0) return null;

        if (userSelectedModelId) {
            const userSelected = availableModels.find((m) => m.value.modelId === userSelectedModelId);

            if (userSelected) return userSelected;
        }

        const persistedModelId = readPersistedModelId(storageKey);

        if (persistedModelId) {
            const persisted = availableModels.find((m) => m.value.modelId === persistedModelId);

            if (persisted) return persisted;
        }

        return availableModels[0] ?? null;
    }, [availableModels, isModelsReady, storageKey, userSelectedModelId]);

    useEffect(() => {
        const modelId = selectedModel?.value.modelId;

        if (!userId || !modelId) return;

        writePersistedModelId(storageKey, modelId);
    }, [selectedModel, storageKey, userId]);

    const setSelectedModel = useCallback((model: DropDownValueObject<ModelValueType> | null) => {
        setUserSelectedModelId(model?.value.modelId ?? null);
    }, []);

    const getModelId = useCallback(() => selectedModel?.value.modelId, [selectedModel]);

    return {
        availableModels,
        selectedModel,
        setSelectedModel,
        getModelId,
        isModelsReady,
    };
}
