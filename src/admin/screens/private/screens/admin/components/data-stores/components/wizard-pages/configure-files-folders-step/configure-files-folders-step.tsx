import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';

import type { WizardFormPageHandle, WizardFormPageProps } from '@/admin/components/wizard';
import { useWizardSaveEmbeddingConfigMutation } from '@/lib/api/admin/data-stores';
import { showErrorToast } from '@/utils';

import BrowsePanel from './components/browse-panel';
import ExplorerToolbar from './components/explorer-toolbar';
import TreePanel from './components/tree-panel';
import { isSharePointProvider } from './files-folders-explore-helpers';
import { useEmbeddingSelection } from './hooks/use-embedding-selection';
import { useFileExplorer } from './hooks/use-file-explorer';
import { setsEqualString } from './tree-utils';
import type { ExplorerViewMode, WizardCommonSlice } from './types';
import './configure-files-folders-step.scss';

export const ConfigureFilesFoldersStep = forwardRef<WizardFormPageHandle, WizardFormPageProps>(
    ({ currentPage, setCanGoNext, onPageComplete, handleCommonDataChange, commonData }, ref) => {
        const saveEmbeddingMutation = useWizardSaveEmbeddingConfigMutation();

        const wizardData = commonData as WizardCommonSlice;
        const dataStore = wizardData?.dataStore;
        const provider = dataStore?.provider;
        const isSharePoint = provider != null && isSharePointProvider(provider);
        const isAlreadyAdded = wizardData?.completedPages?.includes(currentPage);

        const [isSubmitting, setIsSubmitting] = useState(false);
        const [formError, setFormError] = useState('');
        const [viewMode, setViewMode] = useState<ExplorerViewMode>('browse');

        const explorer = useFileExplorer(dataStore?._id, provider, isSharePoint);
        const selection = useEmbeddingSelection(wizardData, setCanGoNext, explorer.fetchPrefix, provider);

        const submitFilesFoldersConfig = useCallback(
            async (embeddingFieldKeys: string[]): Promise<boolean> => {
                if (!dataStore?._id || !wizardData) return false;

                setIsSubmitting(true);
                setFormError('');
                try {
                    const result = await saveEmbeddingMutation.mutateAsync({
                        id: dataStore._id,
                        data: {
                            embeddingFields: embeddingFieldKeys,
                        },
                    });

                    onPageComplete?.(result, { currentPage, method: 'PUT' });
                    handleCommonDataChange?.({
                        ...wizardData,
                        dataStore: { ...dataStore, ...result },
                        completedPages: [...(wizardData.completedPages ?? []), currentPage],
                        selectedEmbeddingKeys: embeddingFieldKeys,
                    });

                    setCanGoNext(true);

                    return true;
                } catch (error: unknown) {
                    console.error(error);

                    const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                    const message = axiosError.response?.data?.message || 'Something went wrong. Please try again.';

                    setFormError(
                        axiosError.response?.status === 500 ? 'Internal server error, Please try again.' : message,
                    );

                    return false;
                } finally {
                    setIsSubmitting(false);
                }
            },
            [
                currentPage,
                dataStore,
                handleCommonDataChange,
                onPageComplete,
                saveEmbeddingMutation,
                setCanGoNext,
                wizardData,
            ],
        );

        const submitStep = useCallback(async (): Promise<boolean> => {
            if (!dataStore?._id || !wizardData) return false;

            const keys = [...new Set(Array.from(selection.selectedKeys))].sort();

            if (keys.length === 0) {
                showErrorToast('Please select at least one folder or file.');

                return false;
            }

            if (isAlreadyAdded && dataStore.embeddingConfig) {
                const saved = new Set(dataStore.embeddingConfig.embeddingFields ?? []);

                if (setsEqualString(selection.selectedKeys, saved)) {
                    handleCommonDataChange?.({
                        ...wizardData,
                        selectedEmbeddingKeys: keys,
                    });

                    return true;
                }
            }

            return submitFilesFoldersConfig(keys);
        }, [
            dataStore,
            handleCommonDataChange,
            isAlreadyAdded,
            selection.selectedKeys,
            submitFilesFoldersConfig,
            wizardData,
        ]);

        useImperativeHandle(ref, () => ({ submitStep }), [submitStep]);

        const canGoUp = explorer.pathSegments.length > 0;

        return (
            <div className="configure-files-folders-step tab-content flex min-h-0 min-w-0 flex-1 flex-col gap-4">
                {formError && (
                    <div className="add-data-store-error py-2">
                        <span className="text-sm font-medium text-destructive">{formError}</span>
                    </div>
                )}
                <ExplorerToolbar
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    isSubmitting={isSubmitting}
                    canGoUp={canGoUp}
                    onGoBack={explorer.goBack}
                    selectedKeysSize={selection.selectedKeys.size}
                    breadcrumbItems={explorer.breadcrumbItems}
                    onNavigateToPath={explorer.navigateToPath}
                />

                {viewMode === 'browse' && (
                    <BrowsePanel
                        isBrowseLoading={explorer.isBrowseLoading}
                        isBrowseError={explorer.isBrowseError}
                        currentFolder={explorer.currentFolder}
                        listedChildren={explorer.listedChildren}
                        pathSegmentsLength={explorer.pathSegments.length}
                        selectedKeys={selection.selectedKeys}
                        isSubmitting={isSubmitting}
                        toggleSelectedKey={selection.toggleSelectedKey}
                        enterFolder={explorer.enterFolder}
                        isSharePoint={isSharePoint}
                        currentBrowsePage={explorer.currentBrowsePage}
                        hasNextPage={explorer.hasNextPage}
                        onPrevPage={explorer.handlePrevPage}
                        onNextPage={explorer.handleNextPage}
                    />
                )}

                {viewMode === 'tree' && (
                    <TreePanel
                        nodes={explorer.root.children}
                        expandedFolderKeys={selection.expandedFolderKeys}
                        selectedKeys={selection.selectedKeys}
                        isSubmitting={isSubmitting}
                        toggleTreeFolderExpanded={selection.toggleTreeFolderExpanded}
                        toggleSelectedKey={selection.toggleSelectedKey}
                        loadingPrefixes={explorer.loadingPrefixes}
                        failedPrefixes={explorer.failedPrefixes}
                        prefixCache={explorer.prefixCache}
                        provider={provider}
                        hasDataStore={!!dataStore?._id}
                    />
                )}
            </div>
        );
    },
);

ConfigureFilesFoldersStep.displayName = 'ConfigureFilesFoldersStep';
