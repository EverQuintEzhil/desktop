import { ClockIcon, FileTextIcon, LayersIcon, OctagonAlertIcon, RefreshCwIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import Markdown from '@/components/markdown/markdown';
import { MarkdownViewToggle, type MarkdownViewMode } from '@/components/markdown/markdown-view-toggle';
import { Button } from '@/components/ui/button';
import SpinnerBlade from '@/components/ui/spinner';
import { useRegenerateOkfMutation } from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import type { DataStoreType } from '@/types/admin';
import { showErrorToast, showSuccessToast } from '@/utils';
import { formatDateTime } from '@/utils/date';

import '../../data-stores-detail.scss';

import OkfFileTree from './okf-file-tree';
import { OKF_STATUS_MAP } from './okf-status';
import { buildOkfTree, collectOkfFolderPaths } from './okf-tree';
import { useOkfPanelHeight } from './use-okf-panel-height';

interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    onSubmit: (value: DataStoreType) => void;
}

const DataStoresOkf = ({ dataStore, canUserEdit }: Props) => {
    const regenerateMutation = useRegenerateOkfMutation();
    const files = dataStore.okf?.files ?? [];

    const [selectedPath, setSelectedPath] = useState<string | undefined>(files[0]?.path);
    const [viewMode, setViewMode] = useState<MarkdownViewMode>('rendered');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(collectOkfFolderPaths(files)));

    const panelRef = useRef<HTMLDivElement>(null);

    const tree = useMemo(() => buildOkfTree(files), [files]);

    useOkfPanelHeight(panelRef);

    useEffect(() => {
        const okfFiles = dataStore.okf?.files ?? [];

        setSelectedPath(okfFiles[0]?.path);
        setExpandedFolders(new Set(collectOkfFolderPaths(okfFiles)));
        setViewMode('rendered');
    }, [dataStore.okf]);

    const selectedFile = files.find((file) => file.path === selectedPath) ?? files[0];
    const statusInfo = dataStore.okfStatus ? OKF_STATUS_MAP[dataStore.okfStatus] : null;
    const isBusy = dataStore.okfStatus === 'pending' || dataStore.okfStatus === 'generating';

    const handleRegenerate = async () => {
        try {
            await regenerateMutation.mutateAsync(dataStore._id);
            showSuccessToast('OKF regeneration started.');
        } catch (error) {
            console.error(error);
            showErrorToast('Failed to start OKF regeneration.');
        }
    };

    const handleToggleFolder = (path: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);

            if (next.has(path)) next.delete(path);
            else next.add(path);

            return next;
        });
    };

    const renderHeader = () => (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border-secondary px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <LayersIcon className="size-4.5" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-text-primary text-sm font-semibold">OKF Bundle</span>
                        {dataStore.okf?.version && (
                            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
                                {`v${dataStore.okf.version}`}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
                        {statusInfo && (
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium',
                                    statusInfo.pillClassName,
                                )}
                            >
                                <span className={cn('size-1.5 shrink-0 rounded-full', statusInfo.dotClassName)} />
                                {statusInfo.label}
                            </span>
                        )}
                        {dataStore.okfGeneratedAt && (
                            <span className="inline-flex items-center gap-1.5">
                                <ClockIcon className="size-3 shrink-0" />
                                {formatDateTime(dataStore.okfGeneratedAt)}
                            </span>
                        )}
                        {files.length > 0 && (
                            <>
                                <span aria-hidden className="text-border">
                                    •
                                </span>
                                <span>{`${files.length} ${files.length === 1 ? 'file' : 'files'}`}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {canUserEdit && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    aria-label="Regenerate"
                    onClick={handleRegenerate}
                    disabled={isBusy || regenerateMutation.isPending}
                >
                    {regenerateMutation.isPending || isBusy ? (
                        <SpinnerBlade className="scale-75" />
                    ) : (
                        <RefreshCwIcon className="size-3.5" />
                    )}
                    {isBusy ? 'Generating...' : 'Regenerate'}
                </Button>
            )}
        </div>
    );

    const renderEmptyState = () => (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileTextIcon className="size-6" />
            </span>
            <span className="text-sm font-medium">Not generated yet</span>
            <span className="max-w-sm text-sm text-text-secondary">
                {canUserEdit
                    ? 'Generate an OKF bundle to describe what this data store contains.'
                    : 'An OKF bundle will appear here once generated.'}
            </span>
        </div>
    );

    const renderExplorerPanel = () => (
        <div
            className={
                'flex max-h-[180px] min-h-0 w-full shrink-0 flex-col border-b border-border-secondary ' +
                'md:max-h-none md:w-[220px] md:border-r md:border-b-0'
            }
        >
            <div className="flex min-h-[41px] shrink-0 items-center justify-between gap-2 border-b border-border-secondary px-3 py-2">
                <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">Explorer</span>
                <span className="text-text-tertiary text-xs">{files.length}</span>
            </div>
            <div className="scrollbar-controller scrollbar-vertical min-h-0 flex-1 py-1">
                <OkfFileTree
                    nodes={tree}
                    depth={0}
                    selectedPath={selectedFile?.path}
                    expandedFolders={expandedFolders}
                    onToggleFolder={handleToggleFolder}
                    onSelectFile={setSelectedPath}
                />
            </div>
        </div>
    );

    const renderContentPanel = () => (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-[41px] shrink-0 items-center justify-between gap-2 border-b border-border-secondary px-4 py-2">
                <span className="text-text-primary flex min-w-0 items-center gap-1.5 text-sm font-medium">
                    <FileTextIcon className="size-3.5 shrink-0 text-text-secondary" />
                    <span className="truncate">{selectedFile?.path}</span>
                </span>
                {selectedFile?.path.endsWith('.md') && (
                    <MarkdownViewToggle mode={viewMode} onModeChange={setViewMode} />
                )}
            </div>
            <div className="scrollbar-controller scrollbar-vertical min-h-0 flex-1 p-6">
                {viewMode === 'code' || !selectedFile?.path.endsWith('.md') ? (
                    <pre className="text-xs whitespace-pre-wrap text-foreground">{selectedFile?.content}</pre>
                ) : (
                    <Markdown>{selectedFile?.content ?? ''}</Markdown>
                )}
            </div>
        </div>
    );

    const renderErrorBanner = () => {
        if (dataStore.okfStatus !== 'failed' || !dataStore.okfError) return null;

        return (
            <div className="flex shrink-0 items-start gap-2 border-b border-border-secondary bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <OctagonAlertIcon className="mt-0.5 size-4 shrink-0" />
                <span>{dataStore.okfError}</span>
            </div>
        );
    };

    const renderBody = () => {
        if (files.length === 0) return renderEmptyState();

        return (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
                {renderExplorerPanel()}
                {renderContentPanel()}
            </div>
        );
    };

    return (
        <div className="tab-content data-stores-tab flex flex-col">
            <div
                ref={panelRef}
                style={{ height: 'var(--okf-panel-h, calc(100svh - 190px))' }}
                className="flex min-h-0 flex-col overflow-hidden border border-border-secondary p-0!"
            >
                {renderHeader()}
                {renderErrorBanner()}
                {renderBody()}
            </div>
        </div>
    );
};

export default DataStoresOkf;
