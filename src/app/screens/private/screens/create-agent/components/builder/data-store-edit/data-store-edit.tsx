import { useQueryClient } from '@tanstack/react-query';
import {
    AlertCircle,
    ChevronLeft,
    Loader2Icon,
    MoreVertical,
    PencilIcon,
    PlugIcon,
    RotateCcw,
    Trash2Icon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import DataStoreFiles from '@/admin/screens/private/screens/admin/components/data-stores/components/data-stores-detail/components/data-stores-files/data-store-files';
import DataStoresWebLinks from '@/admin/screens/private/screens/admin/components/data-stores/components/data-stores-detail/components/data-stores-web-links';
import { DataExplorerStep } from '@/admin/screens/private/screens/admin/components/data-stores/components/wizard-pages/data-explorer-step';
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    dataStoreProviderFilter,
    type DataStoreProviderFilter,
    useDataStoreByIdQuery,
    useDeleteDataStoreMutation,
} from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import { getProviderLabel } from '@/types/admin';
import { showErrorToast, showSuccessToast } from '@/utils';

import { useBuilderRequestHost, usePendingBuilderRequest } from '../builder-requests';

import { DataStoreConnectionModal, dataStoreHasEditableConnection } from './data-store-connection-modal';
import { DataStoreDetailsModal } from './data-store-details-modal';
import { DataStoreEditSkeleton } from './data-store-edit-skeleton';
import LibraryImportModal from './library-import-modal';
import './data-store-edit.scss';

interface DataStoreEditProps {
    dataStoreId: string;
    onBack: () => void;
    onDeleted?: (dataStoreId: string) => void;
    onUpdated?: (dataStore: { _id: string; name: string }) => void;
    agentName: string;
}

const CATEGORY_LABEL: Record<DataStoreProviderFilter, string> = {
    'blob-storage': 'Files Stores',
    api: 'API Stores',
    db: 'DB Stores',
    weblinks: 'Web Links Stores',
};

export const DataStoreEdit = ({ dataStoreId, onBack, onDeleted, onUpdated, agentName }: DataStoreEditProps) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDetailsEdit, setShowDetailsEdit] = useState(false);
    const [showConnectionEdit, setShowConnectionEdit] = useState(false);
    const {
        data: fetchedStore,
        isLoading,
        isError,
        refetch,
        isFetching,
    } = useDataStoreByIdQuery(isDeleting ? undefined : dataStoreId);
    const lastStoreRef = useRef(fetchedStore);

    if (fetchedStore) lastStoreRef.current = fetchedStore;
    const dataStore = fetchedStore ?? (isDeleting ? lastStoreRef.current : undefined);
    const deleteDataStoreMutation = useDeleteDataStoreMutation();
    const queryClient = useQueryClient();

    const user = useSelector(selectUser);
    const userId = user._id;
    const creatorId = dataStore?.creator?._id;
    const isCreator = Boolean(creatorId) && userId === creatorId;
    const canUserEdit = isCreator;
    const canEditConnection = dataStoreHasEditableConnection(dataStore?.provider);

    const requests = useBuilderRequestHost();
    const credentialsRequest = usePendingBuilderRequest('data-store-credentials');
    const isRequestTarget = !!dataStore && credentialsRequest?.dataStoreId === dataStoreId;
    const wantsCredentials = isRequestTarget && canUserEdit && canEditConnection;
    // A weblinks store has no connection: the request stays pending while the user works in the
    // links UI on this page, and handleWeblinksSaved resolves it.
    const wantsWeblinks = isRequestTarget && canUserEdit && dataStore?.provider === 'weblinks';
    const requestsRef = useRef(requests);
    const isRequestTargetRef = useRef(isRequestTarget);

    requestsRef.current = requests;
    isRequestTargetRef.current = isRequestTarget;

    useEffect(() => {
        if (wantsCredentials) {
            setShowConnectionEdit(true);

            return;
        }

        if (wantsWeblinks) return;

        if (isRequestTarget) {
            requests.resolve({
                status: 'cancelled',
                blocked: true,
                summary: canUserEdit
                    ? 'This data store has no editable connection, so there is nothing to fill in.'
                    : 'Only the person who created this data store can edit its connection.',
                dataStoreId,
            });
        }
    }, [wantsCredentials, wantsWeblinks, isRequestTarget, canUserEdit, dataStoreId, requests]);

    // Navigating away unmounts this view without closing the modal; a request left pending would
    // strand the chat card's promise.
    useEffect(
        () => () => {
            if (isRequestTargetRef.current) requestsRef.current.cancel();
        },
        [],
    );

    const handleCloseConnectionEdit = () => {
        setShowConnectionEdit(false);
        if (isRequestTarget) requests.cancel();
    };

    const handleConnectionSaved = () => {
        if (!wantsCredentials || !dataStore) return;

        requests.resolve({
            status: 'completed',
            summary: `The user saved the connection for "${dataStore.name}". The credentials are stored encrypted and are not available to you.`,
            dataStoreId,
        });
    };

    const handleWeblinksSaved = (saved: { name: string }) => {
        if (!wantsWeblinks) return;

        requests.resolve({
            status: 'completed',
            summary: `The user saved the web links for "${saved.name}". Any credentials entered are stored encrypted and are not available to you.`,
            dataStoreId,
        });
    };

    const handleDelete = async () => {
        if (!dataStore || deleteDataStoreMutation.isPending) return;

        setIsDeleting(true);

        try {
            const deletedId = dataStore._id;

            await deleteDataStoreMutation.mutateAsync(deletedId);
            await queryClient.invalidateQueries({ queryKey: ['create-agent', 'datastores'] });
            showSuccessToast('Data store deleted successfully.');
            setShowDeleteConfirm(false);
            if (onDeleted) {
                onDeleted(deletedId);
            } else {
                onBack();
            }
        } catch (error) {
            setIsDeleting(false);
            const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
            const errorMessage =
                axiosError.response?.data?.message || axiosError.message || 'Failed to delete data store.';

            showErrorToast(errorMessage);
        }
    };

    const renderMeta = () => {
        if (!dataStore) return null;

        return (
            <div className="metabar flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm text-text-secondary">{dataStore.name}</span>
                <span className="meta-details-dot inline-block h-1 w-1 rounded-full bg-gray-300" />
                <span className="text-sm text-text-secondary">{getProviderLabel(dataStore.provider)}</span>
                <span className="meta-details-dot inline-block h-1 w-1 rounded-full bg-gray-300" />
                <span className="text-sm text-text-secondary">{dataStore.refName}</span>
                <span className="meta-details-dot inline-block h-1 w-1 rounded-full bg-gray-300" />
                {dataStore?.creator?.name && (
                    <span className="truncate text-sm text-text-secondary">
                        {`${dataStore?.creator?.name?.first} ${dataStore?.creator?.name?.last}`}
                    </span>
                )}
            </div>
        );
    };

    const renderFilesProviderContent = () => {
        if (!dataStore) return null;

        return (
            <>
                <div className="secondary-header flex shrink-0 flex-col border-b border-border-secondary bg-card">
                    {renderMeta()}
                </div>
                <main className="tab-content-area scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col bg-card">
                    <div className="data-store-files-container flex flex-1 flex-col bg-card pb-2">
                        <DataStoreFiles
                            dataStore={dataStore}
                            canUserEdit={canUserEdit}
                            renderLibraryImport={({ onImportFiles }) => (
                                <LibraryImportModal onImportFiles={onImportFiles} />
                            )}
                        />
                    </div>
                </main>
            </>
        );
    };

    const renderWeblinksProviderContent = () => {
        if (!dataStore) return null;

        return (
            <Tabs defaultValue="web-links" className="data-store-edit-tabs flex min-h-0 flex-1 flex-col gap-0">
                <div className="secondary-header flex shrink-0 flex-col border-b border-border-secondary bg-card">
                    {renderMeta()}
                    <div className="shrink-0 bg-card px-2">
                        <TabsList variant="line" className="h-[28px]! w-auto gap-1 p-0 xl:gap-2">
                            <TabsTrigger value="web-links">Web Links</TabsTrigger>
                            <TabsTrigger value="explorer">Data Explorer</TabsTrigger>
                        </TabsList>
                    </div>
                </div>
                {/* `bg-card!`: unscoped global `.tab-content-area` rules set a background that outranks plain utilities. */}
                <main className="tab-content-area scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col bg-card!">
                    <TabsContent value="web-links" className="m-0 flex h-full flex-col data-[state=inactive]:hidden">
                        <div className="flex flex-1 flex-col bg-card pb-2">
                            <DataStoresWebLinks
                                dataStore={dataStore}
                                canUserEdit={canUserEdit}
                                onSubmit={handleWeblinksSaved}
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="explorer" className="m-0 flex h-full flex-col data-[state=inactive]:hidden">
                        <DataExplorerStep isWizardPage={false} commonData={{ dataStore }} />
                    </TabsContent>
                </main>
            </Tabs>
        );
    };

    const renderDefaultContent = () => {
        if (!dataStore) return null;

        return (
            <>
                <div className="secondary-header flex shrink-0 flex-col border-b border-border-secondary bg-card">
                    {renderMeta()}
                </div>
                <main className="tab-content-area scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col bg-background">
                    <DataExplorerStep isWizardPage={false} commonData={{ dataStore }} />
                </main>
            </>
        );
    };

    const renderActionsMenu = () => {
        if (!dataStore || !canUserEdit) return null;

        return (
            <DropdownMenuRoot modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Data store actions"
                        className="hover:text-text-primary h-6 w-6 shrink-0 rounded-md text-text-secondary"
                    >
                        <MoreVertical className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem className="cursor-pointer" onSelect={() => setShowDetailsEdit(true)}>
                        <PencilIcon className="size-4" aria-hidden="true" />
                        Edit data store
                    </DropdownMenuItem>
                    {canEditConnection && (
                        <DropdownMenuItem className="cursor-pointer" onSelect={() => setShowConnectionEdit(true)}>
                            <PlugIcon className="size-4" aria-hidden="true" />
                            Edit connection
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
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
        );
    };

    const renderEditModals = () => {
        if (!dataStore || !canUserEdit) return null;

        return (
            <>
                {showDetailsEdit && (
                    <DataStoreDetailsModal
                        dataStore={dataStore}
                        isOpen={showDetailsEdit}
                        onClose={() => setShowDetailsEdit(false)}
                        onUpdated={onUpdated}
                    />
                )}
                {showConnectionEdit && canEditConnection && (
                    <DataStoreConnectionModal
                        dataStore={dataStore}
                        isOpen={showConnectionEdit}
                        onSaved={handleConnectionSaved}
                        onClose={handleCloseConnectionEdit}
                    />
                )}
            </>
        );
    };

    const renderPageTitle = () => {
        if (isLoading) {
            return <Skeleton className="h-7 w-48 max-w-full rounded-md" />;
        }

        return (
            <span className="text-text-primary text-lg font-semibold tracking-tight">
                {dataStore?.name ?? 'Data store'}
            </span>
        );
    };

    const renderError = () => (
        <div className="flex flex-1 flex-col items-center justify-center bg-card px-6 py-12">
            <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border-secondary bg-background p-8 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <AlertCircle className="size-5" />
                </span>
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">Couldn&apos;t load data store</p>
                    <p className="text-sm text-text-secondary">Something went wrong while fetching store details.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onBack}>
                        Go back
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => {
                            void refetch();
                        }}
                        disabled={isFetching}
                    >
                        <RotateCcw className="size-3.5" />
                        Try again
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderBody = () => {
        if (isLoading || isDeleting) {
            return <DataStoreEditSkeleton />;
        }

        if (isError) {
            return renderError();
        }

        if (dataStore?.provider === 'files') {
            return renderFilesProviderContent();
        }

        if (dataStore?.provider === 'weblinks') {
            return renderWeblinksProviderContent();
        }

        return renderDefaultContent();
    };

    return (
        <div className="data-store-edit-page flex h-full flex-col bg-background">
            <header className="config-topbar z-10 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
                <div className="flex min-w-0 items-center gap-2" aria-live="polite">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onBack}
                        className="hover:text-text-primary h-6 w-6 shrink-0 rounded-md text-text-secondary"
                        aria-label="Back to builder"
                    >
                        <ChevronLeft className="size-5" />
                    </Button>
                    <h1 className="m-0 flex min-w-0 items-center gap-2 text-sm">
                        <span className="truncate font-medium text-text-secondary">{agentName}</span>
                        <span className="shrink-0 font-normal text-text-secondary">/</span>
                        <span className="shrink-0 truncate text-base font-medium text-text-secondary">
                            {dataStore ? CATEGORY_LABEL[dataStoreProviderFilter(dataStore.provider)] : 'Data Stores'}
                        </span>
                    </h1>
                </div>
                {renderActionsMenu()}
            </header>
            <header className="page-header z-10 flex w-full shrink-0 items-center gap-2 bg-card px-4 pt-2">
                <div className="flex w-full min-w-0 items-center gap-1.5" aria-live="polite">
                    {renderPageTitle()}
                </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">{renderBody()}</div>

            {renderEditModals()}

            <AlertDialog
                open={showDeleteConfirm}
                onOpenChange={(next) => {
                    if (!next && !deleteDataStoreMutation.isPending) setShowDeleteConfirm(false);
                }}
            >
                <AlertDialogContent
                    size="sm"
                    className="data-[size=sm]:max-w-lg"
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
                                    <span className="font-medium text-foreground" title={dataStore?.name}>
                                        &ldquo;
                                        {dataStore?.name}
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
        </div>
    );
};
