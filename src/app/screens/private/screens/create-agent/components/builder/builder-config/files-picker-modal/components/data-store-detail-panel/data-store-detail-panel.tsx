import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, Loader2Icon, MoreVertical, Trash2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { PickerDetailSkeleton } from '@/app/components/picker/picker-detail-skeleton';
import { actionBase, actionRemove, pickerFormWrapCls } from '@/app/components/picker/picker-shared';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Tag from '@/components/ui/tag';
import { useDeleteDataStoreMutation } from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import type { DataStoreType } from '@/types/admin';
import { showErrorToast, showSuccessToast } from '@/utils';

import { dsBtnCls } from '../../constants';
import { DataStoreOkfCard } from '../../data-store-okf-card';
import { getDataStoreAbbr } from '../../utils/get-data-store-abbr';
import { getDataStoreColor } from '../../utils/get-data-store-color';

export interface DataStoreDetailPanelProps {
    activePanel: string;
    name: string;
    description?: string;
    provider?: string;
    providerLabel: string;
    tools: { _id: string; name: string }[];
    canManage: boolean;
    isEnabled: boolean;
    detailLoading: boolean;
    detailError: boolean;
    detailData: DataStoreType | undefined;
    onClose: () => void;
    onBack: () => void;
    onToggle: (file: { _id: string; name: string; provider?: string }) => void;
    setDeletingId: (id: string | null) => void;
}

const renderTools = (tools: { _id: string; name: string }[]) => {
    if (tools.length === 0) {
        return <span className="text-sm text-text-secondary">No tools</span>;
    }

    return tools.map((tool) => (
        <Tag key={tool._id} size="small">
            {tool.name}
        </Tag>
    ));
};

/** Renders the detail panel for a selected data store: name, provider, tools, and enable/delete actions. */
const DataStoreDetailPanel = ({
    activePanel,
    name,
    description,
    provider,
    providerLabel,
    tools,
    canManage,
    isEnabled,
    detailLoading,
    detailError,
    detailData,
    onClose,
    onBack,
    onToggle,
    setDeletingId,
}: DataStoreDetailPanelProps) => {
    const queryClient = useQueryClient();
    const deleteDataStoreMutation = useDeleteDataStoreMutation();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const abbr = getDataStoreAbbr(name);
    const color = getDataStoreColor(activePanel);

    const handleDelete = async () => {
        if (deleteDataStoreMutation.isPending) return;

        const idToDelete = activePanel;

        setDeletingId(idToDelete);

        try {
            await deleteDataStoreMutation.mutateAsync(idToDelete);
            await queryClient.invalidateQueries({ queryKey: ['create-agent', 'datastores'] });
            showSuccessToast('Data store deleted successfully.');
            setShowDeleteConfirm(false);
            if (isEnabled) onToggle({ _id: idToDelete, name, provider });
            onBack();
        } catch (err) {
            const axiosError = err as { response?: { data?: { message?: string } }; message?: string };

            showErrorToast(axiosError.response?.data?.message || axiosError.message || 'Failed to delete data store.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <div className="modal-agent-header sticky top-0 z-2 flex h-[80px] items-center gap-3 border-b border-border bg-card px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('sm:hidden', dsBtnCls)}
                    aria-label="Back"
                    onClick={onBack}
                >
                    <ArrowLeftIcon size={17} aria-hidden="true" />
                </Button>
                <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-h4 font-bold text-white"
                    style={{ background: color }}
                >
                    {abbr}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <h3 className="truncate text-lg font-medium tracking-[-0.02em]">{name}</h3>
                    <p className="text-sm text-text-secondary">{providerLabel || 'Data store'}</p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-3">
                    {canManage && (
                        <DropdownMenuRoot modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Data store actions"
                                    className={dsBtnCls}
                                >
                                    <MoreVertical size={17} aria-hidden="true" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                    variant="destructive"
                                    className="cursor-pointer"
                                    onSelect={() => setShowDeleteConfirm(true)}
                                >
                                    <Trash2Icon className="size-4" aria-hidden="true" />
                                    Delete data store
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenuRoot>
                    )}
                    <Button variant="ghost" size="icon" className={dsBtnCls} aria-label="Close" onClick={onClose}>
                        <XIcon size={17} aria-hidden="true" />
                    </Button>
                </div>
            </div>
            <div className="file-detail-pane scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col gap-6 bg-card px-4 py-6">
                {detailLoading && <PickerDetailSkeleton variant="dataStore" />}
                {!detailLoading && detailError && (
                    <div className="px-2 text-sm text-destructive">Error loading details.</div>
                )}
                {!detailLoading && !detailError && detailData && (
                    <div className="flex min-h-0 flex-1 flex-col gap-6">
                        <p
                            className={cn(
                                'm-0 shrink-0 text-sm leading-relaxed',
                                description ? 'text-foreground' : 'text-text-secondary',
                            )}
                        >
                            {description || 'Not available'}
                        </p>

                        <div className="flex min-w-0 shrink-0 flex-col gap-2">
                            <span className="text-sm font-semibold text-text-secondary">Tools</span>
                            <div className="flex flex-wrap gap-2">{renderTools(tools)}</div>
                        </div>

                        <DataStoreOkfCard okf={detailData.okf} />
                    </div>
                )}
            </div>
            <div className="modal-agent-footer sticky bottom-0 z-1 mt-auto border-t border-border bg-card p-4">
                <div className={pickerFormWrapCls}>
                    <button
                        className={cn(actionBase, isEnabled && actionRemove)}
                        onClick={() => onToggle({ _id: activePanel, name, provider })}
                    >
                        {isEnabled ? 'Remove' : 'Enable'}
                    </button>
                </div>
            </div>
            <AlertDialog
                open={showDeleteConfirm}
                onOpenChange={(next) => {
                    if (!next && !deleteDataStoreMutation.isPending) setShowDeleteConfirm(false);
                }}
            >
                <AlertDialogContent
                    size="sm"
                    className="z-60 data-[size=sm]:max-w-lg"
                    overlayClassName="z-60"
                    showCloseButton
                    closeDisabled={deleteDataStoreMutation.isPending}
                >
                    <AlertDialogHeader
                        className={cn(
                            'place-items-center p-6 text-center',
                            'has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr]',
                            'has-data-[slot=alert-dialog-media]:gap-x-0',
                        )}
                    >
                        <AlertDialogMedia className="mx-auto mb-2 bg-destructive/10 text-destructive sm:row-span-1">
                            <Trash2Icon aria-hidden="true" />
                        </AlertDialogMedia>
                        <AlertDialogTitle className="col-start-auto">Delete data store</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-1 text-center text-sm text-muted-foreground">
                                <p>
                                    Are you sure you want to delete{' '}
                                    <span className="font-medium text-foreground" title={name}>
                                        &ldquo;
                                        {name}
                                        &rdquo;
                                    </span>
                                    ?
                                </p>
                                <p>This action cannot be undone.</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="py-6">
                        <AlertDialogCancel disabled={deleteDataStoreMutation.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="default"
                            className="border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleteDataStoreMutation.isPending}
                            onClick={(e) => {
                                e.preventDefault();
                                void handleDelete();
                            }}
                        >
                            {deleteDataStoreMutation.isPending ? (
                                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                            ) : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default DataStoreDetailPanel;
