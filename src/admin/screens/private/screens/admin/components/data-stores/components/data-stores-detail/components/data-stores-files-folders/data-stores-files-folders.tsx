import { ArrowLeftIcon, ChevronLeftIcon, FolderTreeIcon, TablePropertiesIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import SpinnerBlade from '@/components/ui/spinner';
import Switch from '@/components/ui/switch';
import type { DataStoreType } from '@/types/admin';

import '../../../wizard-pages/configure-files-folders-step/configure-files-folders-step.scss';

import FilesFoldersBreadcrumb from './components/files-folders-breadcrumb';
import FilesFoldersBrowseList from './components/files-folders-browse-list';
import FilesFoldersPagination from './components/files-folders-pagination';
import FilesFoldersTreePanel from './components/files-folders-tree-panel';
import { useFilesFoldersExplorer } from './hooks/use-files-folders-explorer';
import '../../data-stores-detail.scss';

export interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    onSubmit: (value: DataStoreType) => void;
}

const DataStoresFilesFolders = (props: Props) => {
    const { dataStore, onSubmit } = props;
    const navigate = useNavigate();

    const {
        isSubmitting,
        formError,
        viewMode,
        setViewMode,
        provider,
        isSharePoint,
        pathSegments,
        expandedFolderKeys,
        selectedKeys,
        prefixCache,
        loadingPrefixes,
        failedPrefixes,
        currentBrowsePage,
        root,
        currentFolder,
        breadcrumbItems,
        listedChildren,
        hasNextPage,
        isBrowseLoading,
        isBrowseError,
        canGoUp,
        navigateToPath,
        goBack,
        enterFolder,
        handleNextPage,
        handlePrevPage,
        toggleSelectedKey,
        toggleTreeFolderExpanded,
        handleSave,
    } = useFilesFoldersExplorer(dataStore, onSubmit);

    const renderSelectionSummary = () => (
        <span className="text-xs text-muted-foreground sm:text-sm">
            {selectedKeys.size}
            {' path'}
            {selectedKeys.size === 1 ? '' : 's'}
            {' selected'}
        </span>
    );

    const renderViewToggle = () => (
        <div className="inline-flex shrink-0 items-center" role="group" aria-label="Explorer view mode">
            <Switch
                options={[
                    { label: 'Browse', icon: TablePropertiesIcon },
                    { label: 'Tree', icon: FolderTreeIcon },
                ]}
                activeIndex={viewMode === 'browse' ? 0 : 1}
                onChange={(_event, index) => {
                    if (isSubmitting) return;
                    setViewMode(index === 0 ? 'browse' : 'tree');
                }}
                width={100}
            />
        </div>
    );

    const renderBrowseToolbarLeft = () => (
        <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'browse' && (
                <>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={!canGoUp || isSubmitting}
                        onClick={goBack}
                        aria-label="Go up one folder"
                    >
                        <ArrowLeftIcon className="size-4" />
                        Back
                    </Button>
                    {renderSelectionSummary()}
                </>
            )}
            {viewMode === 'tree' && renderSelectionSummary()}
        </div>
    );

    const renderBrowseView = () => (
        <>
            <FilesFoldersBrowseList
                isLoading={isBrowseLoading}
                isError={isBrowseError}
                currentFolder={currentFolder}
                listedChildren={listedChildren}
                pathSegments={pathSegments}
                selectedKeys={selectedKeys}
                isSubmitting={isSubmitting}
                onEnterFolder={enterFolder}
                onToggleSelectedKey={toggleSelectedKey}
            />

            {!isSharePoint && !isBrowseLoading && !isBrowseError && currentFolder && listedChildren.length > 0 && (
                <FilesFoldersPagination
                    currentPage={currentBrowsePage}
                    hasNextPage={hasNextPage}
                    isSubmitting={isSubmitting}
                    onPrevPage={handlePrevPage}
                    onNextPage={handleNextPage}
                />
            )}
        </>
    );

    return (
        <div className="tab-content data-stores-tab flex h-full flex-col">
            <div className="configure-files-folders-step flex min-h-0 min-w-0 flex-1 flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => navigate(`/admin/data-stores/${dataStore._id}/embeddings-index`)}
                    >
                        <ChevronLeftIcon />
                    </Button>
                    <Button type="button" size="sm" onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? <SpinnerBlade className="scale-75" /> : null}
                        {isSubmitting ? 'Saving...' : 'Save'}
                    </Button>
                </div>

                {formError && (
                    <div className="add-data-store-error py-2">
                        <span className="text-sm font-medium text-destructive">{formError}</span>
                    </div>
                )}
                <div className="flex flex-col gap-3 border-b border-border pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        {renderBrowseToolbarLeft()}
                        {renderViewToggle()}
                    </div>
                    {viewMode === 'browse' && (
                        <FilesFoldersBreadcrumb
                            items={breadcrumbItems}
                            isSubmitting={isSubmitting}
                            onNavigate={navigateToPath}
                        />
                    )}
                </div>

                {viewMode === 'browse' && renderBrowseView()}

                {viewMode === 'tree' && (
                    <FilesFoldersTreePanel
                        root={root}
                        prefixCache={prefixCache}
                        loadingPrefixes={loadingPrefixes}
                        failedPrefixes={failedPrefixes}
                        expandedFolderKeys={expandedFolderKeys}
                        selectedKeys={selectedKeys}
                        isSubmitting={isSubmitting}
                        provider={provider}
                        onToggleTreeFolderExpanded={toggleTreeFolderExpanded}
                        onToggleSelectedKey={toggleSelectedKey}
                    />
                )}
            </div>
        </div>
    );
};

export default DataStoresFilesFolders;
