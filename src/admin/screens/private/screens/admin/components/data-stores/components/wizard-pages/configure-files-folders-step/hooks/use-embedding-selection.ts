import { useCallback, useEffect, useState } from 'react';

import type { ProviderType } from '@/types/admin';

import { getFetchKeyForFolderKeyPath } from '../files-folders-explore-helpers';
import { isStrictPathAncestor, normalizeSelectionKeys } from '../tree-utils';
import type { WizardCommonSlice } from '../types';

export interface UseEmbeddingSelectionResult {
    selectedKeys: Set<string>;
    expandedFolderKeys: Set<string>;
    toggleSelectedKey: (keyPath: string, checked: boolean) => void;
    toggleTreeFolderExpanded: (keyPath: string) => void;
}

/**
 * Owns the selected embedding-field paths (folders/files checked in either explorer view) and
 * tree-mode expansion, and keeps `setCanGoNext` in sync with whether anything is selected.
 */
export function useEmbeddingSelection(
    wizardData: WizardCommonSlice,
    setCanGoNext: (canGoNext: boolean) => void,
    fetchPrefix: (cacheKey: string, continuationToken?: string) => Promise<void>,
    provider: ProviderType | null | undefined,
): UseEmbeddingSelectionResult {
    const dataStore = wizardData?.dataStore;

    const [expandedFolderKeys, setExpandedFolderKeys] = useState<Set<string>>(() => new Set());
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
        if (wizardData?.selectedEmbeddingKeys !== undefined) {
            return normalizeSelectionKeys(wizardData.selectedEmbeddingKeys);
        }

        const legacy = [...(wizardData?.selectedFolderKeys ?? []), ...(wizardData?.selectedFileKeys ?? [])];

        if (legacy.length > 0) {
            return normalizeSelectionKeys(legacy);
        }

        return normalizeSelectionKeys(dataStore?.embeddingConfig?.embeddingFields ?? []);
    });

    useEffect(() => {
        setCanGoNext(selectedKeys.size > 0);
    }, [selectedKeys.size, setCanGoNext]);

    useEffect(() => {
        if (dataStore?.embeddingConfig) {
            setSelectedKeys(normalizeSelectionKeys(dataStore.embeddingConfig.embeddingFields ?? []));
        }
    }, [dataStore?.embeddingConfig]);

    const toggleSelectedKey = useCallback((keyPath: string, checked: boolean) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);

            if (checked) {
                for (const x of prev) {
                    if (x !== keyPath && isStrictPathAncestor(keyPath, x)) {
                        next.delete(x);
                    }
                }
                next.add(keyPath);
            } else {
                next.delete(keyPath);
            }

            return next;
        });
    }, []);

    const toggleTreeFolderExpanded = useCallback(
        (keyPath: string) => {
            setExpandedFolderKeys((prev) => {
                const next = new Set(prev);

                if (next.has(keyPath)) {
                    next.delete(keyPath);
                } else {
                    next.add(keyPath);
                    if (provider != null) void fetchPrefix(getFetchKeyForFolderKeyPath(provider, keyPath));
                }

                return next;
            });
        },
        [fetchPrefix, provider],
    );

    return {
        selectedKeys,
        expandedFolderKeys,
        toggleSelectedKey,
        toggleTreeFolderExpanded,
    };
}
