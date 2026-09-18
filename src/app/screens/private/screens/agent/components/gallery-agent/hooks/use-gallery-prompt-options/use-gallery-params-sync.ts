import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';

import { type DropDownValueObject } from '@/components/ui/dropdown-menu';
import type { GalleryAgentType, ModelValueType, ParameterType } from '@/types/admin';

import {
    applyKnownKeysBackfill,
    parsePersistedGalleryParams,
    readPersistedGalleryParams,
    serializeParametersForStorage,
    serializePersistedGalleryParams,
    writeSerializedGalleryParams,
} from '../../utils/gallery-params-persistence';

import { buildMergedParameterConfig, buildParametersFromArgs } from './parameter-defaults';
import type { ModelParamAction, ModelParamState } from './types';

interface UseGalleryParamsSyncArgs {
    agentRef: React.RefObject<GalleryAgentType>;
    availableModels: DropDownValueObject<ModelValueType>[];
    storageKey: string;
    modelParamState: ModelParamState;
    dispatch: React.Dispatch<ModelParamAction>;
    stateRef: React.RefObject<ModelParamState>;
    skipNextSyncRef: React.RefObject<boolean>;
    mergedParametersRef: React.RefObject<Record<string, ParameterType>>;
}

/**
 * Restores persisted gallery model/parameter selections on mount, keeps
 * localStorage in sync with subsequent changes, and reconciles cross-tab
 * `storage` events. Restore order and the "unsupported ratio dropped by the
 * new model" behaviour are load-bearing — do not reorder these effects.
 */
export const useGalleryParamsSync = (args: UseGalleryParamsSyncArgs): void => {
    const {
        agentRef,
        availableModels,
        storageKey,
        modelParamState,
        dispatch,
        stateRef,
        skipNextSyncRef,
        mergedParametersRef,
    } = args;

    const storageKeyRef = useRef(storageKey);

    storageKeyRef.current = storageKey;

    const availableModelsRef = useRef(availableModels);

    availableModelsRef.current = availableModels;

    const restoreCompleteRef = useRef(false);

    const lastWrittenRef = useRef<string | null>(null);

    const pendingStorageEventRef = useRef<string | null>(null);

    const applyExternalRecord = useCallback(
        (raw: string): boolean => {
            const saved = parsePersistedGalleryParams(raw);

            if (!saved) {
                return false;
            }

            const currentModel = stateRef.current.selectedModel;
            const resolvedModel =
                availableModelsRef.current.find((model) => model.value.modelId === saved.modelId) ?? currentModel;
            const merged = buildMergedParameterConfig(
                agentRef.current.uiConfig.parameters,
                resolvedModel?.value.parameters,
            );
            const restoredParameters = buildParametersFromArgs(saved.parameters, merged, true);

            lastWrittenRef.current = raw;

            if (resolvedModel !== currentModel) {
                skipNextSyncRef.current = true;
            }

            dispatch({
                type: 'RESTORE_PERSISTED',
                model: resolvedModel,
                parameters: applyKnownKeysBackfill(restoredParameters, saved.knownKeys, merged),
            });

            return true;
        },
        [agentRef, dispatch, skipNextSyncRef, stateRef],
    );

    useEffect(() => {
        if (!restoreCompleteRef.current) {
            return;
        }

        if (modelParamState.snapshot !== null) {
            return;
        }

        const pendingRecord = pendingStorageEventRef.current;

        if (pendingRecord !== null) {
            pendingStorageEventRef.current = null;

            if (applyExternalRecord(pendingRecord)) {
                return;
            }
        }

        const serialized = serializePersistedGalleryParams({
            modelId: modelParamState.selectedModel?.value.modelId ?? null,
            parameters: serializeParametersForStorage(modelParamState.parameters),
            knownKeys: Object.keys(mergedParametersRef.current),
        });

        if (serialized === lastWrittenRef.current) {
            return;
        }

        lastWrittenRef.current = serialized;
        writeSerializedGalleryParams(storageKeyRef.current, serialized);
    }, [modelParamState, applyExternalRecord, mergedParametersRef]);

    useEffect(() => {
        const stored = readPersistedGalleryParams(storageKeyRef.current);

        if (!stored) {
            restoreCompleteRef.current = true;

            return;
        }

        const { record: saved, raw } = stored;

        lastWrittenRef.current = raw;

        const currentModel = stateRef.current.selectedModel;
        const resolvedModel =
            availableModelsRef.current.find((model) => model.value.modelId === saved.modelId) ?? currentModel;
        const merged = buildMergedParameterConfig(
            agentRef.current.uiConfig.parameters,
            resolvedModel?.value.parameters,
        );

        const restoredParameters = buildParametersFromArgs(saved.parameters, merged, true);
        const modelChanged = resolvedModel !== currentModel;
        const savedHadParameters = Object.keys(saved.parameters).length > 0;
        const restoredAnyParameter = Object.keys(restoredParameters).length > 0;

        if (!modelChanged && savedHadParameters && !restoredAnyParameter) {
            restoreCompleteRef.current = true;

            return;
        }

        if (modelChanged) {
            skipNextSyncRef.current = true;
        }

        dispatch({
            type: 'RESTORE_PERSISTED',
            model: resolvedModel,
            parameters: applyKnownKeysBackfill(restoredParameters, saved.knownKeys, merged),
        });
        restoreCompleteRef.current = true;
    }, []);

    useEffect(() => {
        const handleStorageEvent = (event: StorageEvent) => {
            if (event.key !== storageKeyRef.current || event.newValue === null) {
                return;
            }

            if (!restoreCompleteRef.current) {
                pendingStorageEventRef.current = event.newValue;

                return;
            }

            if (stateRef.current.snapshot !== null) {
                pendingStorageEventRef.current = event.newValue;

                return;
            }

            pendingStorageEventRef.current = null;
            applyExternalRecord(event.newValue);
        };

        window.addEventListener('storage', handleStorageEvent);

        return () => window.removeEventListener('storage', handleStorageEvent);
    }, [applyExternalRecord]);
};
