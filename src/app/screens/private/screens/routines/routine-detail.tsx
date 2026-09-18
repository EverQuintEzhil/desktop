import { isAxiosError } from 'axios';
import { ArrowLeftIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import Spinner from '@/components/ui/spinner';
import {
    useArchiveRoutineMutation,
    useDeleteRoutineMutation,
    usePauseRoutineMutation,
    usePinRoutineMutation,
    useResumeRoutineMutation,
    useRoutineQuery,
    useRunRoutineNowMutation,
    useUnarchiveRoutineMutation,
} from '@/lib/api/app/routines';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { cn } from '@/lib/utils';
import { showErrorToast, showSuccessToast } from '@/utils';

import RoutineDetailInfo from './components/routine-detail-info';
import RoutineFilterMenu from './components/routine-filter-menu';
import RoutineHeader from './components/routine-header';
import RoutineInstructionsCard from './components/routine-instructions-card';
import RoutineRunsBody from './components/routine-runs-body';
import { isRunStatusFilter, RUN_STATUS_FILTER_OPTIONS, type RunStatusFilter } from './constants';
import { useRunNowToast } from './hooks/use-run-now-toast';
import { RoutineFormModal } from './routine-form-modal';

/** Everything except the history filter, which belongs to one routine's page. */
const listSearchOf = (search: string): string => {
    const params = new URLSearchParams(search);

    params.delete('runStatus');

    return params.toString();
};

interface Props {
    /** Present = reached through an agent's own routines list, so edits stay scoped to it. */
    agent?: { _id: string; name: string; slug: string };
}

const RoutineDetail = ({ agent }: Props) => {
    const navigate = useNavigate();
    const { routineId } = useParams();
    const { search } = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const runStatusValue = searchParams.get('runStatus');
    const runStatusFilter: RunStatusFilter = isRunStatusFilter(runStatusValue) ? runStatusValue : 'all';

    const onRunStatusChange = (status: RunStatusFilter) => {
        const next = new URLSearchParams(searchParams);

        if (status === 'all') next.delete('runStatus');
        else next.set('runStatus', status);

        setSearchParams(next, { replace: true });
    };
    const { data: routine, isLoading, isError, error } = useRoutineQuery(routineId);

    const runNowMutation = useRunRoutineNowMutation();
    const runNowToast = useRunNowToast();
    const deleteMutation = useDeleteRoutineMutation();
    const pauseMutation = usePauseRoutineMutation();
    const resumeMutation = useResumeRoutineMutation();
    const pinMutation = usePinRoutineMutation();
    const archiveMutation = useArchiveRoutineMutation();
    const unarchiveMutation = useUnarchiveRoutineMutation();

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);

    // The list forwarded its params (view, agentId, projectId) here so going back restores that view.
    // `runStatus` is this page's own, so it is dropped: carried back it would ride on to the next routine.
    const listPath = {
        pathname: agent ? `/agent/${agent.slug}/routines` : '/settings/routines',
        search: listSearchOf(search),
    };

    const onRunNow = async () => {
        if (!routine) return;
        try {
            await runNowMutation.mutateAsync(routine._id);
            runNowToast.showStarted();
        } catch (err) {
            runNowToast.showFailure(err);
        }
    };

    const onToggleStatus = async () => {
        if (!routine) return;
        try {
            if (routine.status === 'active') {
                await pauseMutation.mutateAsync(routine._id);
                showSuccessToast('Routine paused.');
            } else {
                await resumeMutation.mutateAsync(routine._id);
                showSuccessToast('Routine resumed.');
            }
        } catch (err) {
            showErrorToast(getApiErrorMessage(err, 'Failed to update the routine.'));
        }
    };

    const onTogglePin = async () => {
        if (!routine) return;
        try {
            // `PUT /pin` is a blind toggle, so only its response says which way the routine went.
            const updated = await pinMutation.mutateAsync(routine._id);

            showSuccessToast(updated.pinnedAt ? 'Routine pinned to the top.' : 'Routine unpinned.');
        } catch (err) {
            showErrorToast(getApiErrorMessage(err, 'Failed to update the routine.'));
        }
    };

    const onUnarchive = async () => {
        if (!routine) return;
        try {
            await unarchiveMutation.mutateAsync(routine._id);
            showSuccessToast('Routine unarchived. It stays paused until you resume it.');
        } catch (err) {
            showErrorToast(getApiErrorMessage(err, 'Failed to unarchive the routine.'));
        }
    };

    const onArchive = async () => {
        if (!routine) return;
        try {
            await archiveMutation.mutateAsync(routine._id);
            showSuccessToast('Routine archived.');
            navigate(listPath);
        } catch (err) {
            showErrorToast(getApiErrorMessage(err, 'Failed to archive the routine.'));
        } finally {
            setIsArchiveOpen(false);
        }
    };

    const onDelete = async () => {
        if (!routine) return;
        try {
            await deleteMutation.mutateAsync(routine._id);
            showSuccessToast('Routine deleted.');
            navigate(listPath);
        } catch (err) {
            showErrorToast(getApiErrorMessage(err, 'Failed to delete the routine.'));
        } finally {
            setIsDeleteOpen(false);
        }
    };

    if (isLoading) {
        return (
            <div className="routine-detail-loading flex min-h-[60svh] w-full items-center justify-center">
                <Spinner role="status" aria-label="Loading" />
            </div>
        );
    }

    // The route only carries an id, so another agent's routine would otherwise render inside this agent's shell.
    const isForeignRoutine = Boolean(agent && routine && routine.agentId !== agent._id);

    // A 200 `{success:false}` arrives as a plain Error with the response attached, so it counts as missing too.
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    const isEnvelopeFailure = !isAxiosError(error) && status !== undefined;
    const isMissing = !isError || status === 404 || status === 403 || isEnvelopeFailure;

    if (isError || !routine || isForeignRoutine) {
        return (
            <div className="routine-detail-missing flex min-h-[60svh] w-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex max-w-[320px] flex-col gap-1.5">
                    <h1 className="text-lg font-medium text-(--text-primary)">
                        {isMissing ? 'Routine not found' : 'Something went wrong'}
                    </h1>
                    <p className="text-sm leading-6 text-(--text-secondary)">
                        {isMissing
                            ? 'It may have been deleted, or you may not have access to it.'
                            : 'This routine could not be loaded. Try again in a moment.'}
                    </p>
                </div>
                <Button variant="secondary" size="sm" asChild className="rounded-full px-4">
                    <Link to={listPath}>Back to routines</Link>
                </Button>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'routines-container relative flex w-full min-w-0 flex-col',
                // The settings layout already scrolls, pads and paints; the agent route does not.
                agent && 'h-fit min-h-svh bg-background max-lg:pt-[50px]',
            )}
        >
            <div className="mx-auto flex w-full max-w-7xl items-start justify-center gap-6 px-4">
                <div className="routine-detail-container flex w-full max-w-[928px] min-w-0 flex-col gap-6 pt-4 pb-8">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-fit rounded-full px-2 text-text-secondary hover:text-primary"
                        asChild
                    >
                        <Link to={listPath}>
                            <ArrowLeftIcon className="size-4" />
                            All routines
                        </Link>
                    </Button>

                    <div className="routine-detail-content flex flex-col gap-6">
                        <RoutineHeader
                            routine={routine}
                            isRunPending={runNowMutation.isPending}
                            isStatusPending={pauseMutation.isPending || resumeMutation.isPending}
                            isPinPending={pinMutation.isPending}
                            isArchivePending={archiveMutation.isPending || unarchiveMutation.isPending}
                            onRunNow={() => void onRunNow()}
                            onToggleStatus={() => void onToggleStatus()}
                            onTogglePin={() => void onTogglePin()}
                            onToggleArchive={() => (routine.archivedAt ? void onUnarchive() : setIsArchiveOpen(true))}
                            onEdit={() => setIsEditOpen(true)}
                            onDelete={() => setIsDeleteOpen(true)}
                        />

                        <div className="routine-detail-body grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                            <section
                                className="routine-detail-history flex flex-col gap-5"
                                aria-labelledby="routine-history"
                            >
                                <div className="flex h-9 items-center justify-between gap-2">
                                    <h2 id="routine-history" className="text-sm font-semibold text-foreground">
                                        History
                                    </h2>
                                    <RoutineFilterMenu
                                        value={runStatusFilter}
                                        options={RUN_STATUS_FILTER_OPTIONS}
                                        onChange={onRunStatusChange}
                                        label="All runs"
                                    />
                                </div>
                                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                                    <RoutineRunsBody
                                        routine={routine}
                                        statusFilter={runStatusFilter}
                                        onEditRoutine={() => setIsEditOpen(true)}
                                    />
                                </div>
                            </section>

                            <aside
                                className="routine-detail-aside flex flex-col gap-5"
                                aria-labelledby="routine-details"
                            >
                                <RoutineInstructionsCard
                                    prompt={routine.prompt}
                                    agentId={routine.agentId}
                                    onEdit={() => setIsEditOpen(true)}
                                />
                                <h2 id="routine-details" className="text-sm font-semibold text-foreground">
                                    Details
                                </h2>
                                <RoutineDetailInfo routine={routine} />
                            </aside>
                        </div>
                    </div>
                </div>
            </div>

            {isEditOpen ? (
                <RoutineFormModal
                    open
                    onOpenChange={(isOpen) => !isOpen && setIsEditOpen(false)}
                    routine={routine}
                    agent={agent}
                />
            ) : null}

            <ConfirmationModal
                isOpen={isArchiveOpen}
                title="Archive routine?"
                message={`"${routine.name}" stops running and moves to Archived. Bringing it back leaves it paused until you resume it.`}
                confirmButtonText="Archive"
                isButtonLoading={archiveMutation.isPending}
                onConfirm={() => void onArchive()}
                onClose={() => setIsArchiveOpen(false)}
            />

            <ConfirmationModal
                isOpen={isDeleteOpen}
                title="Delete routine?"
                message={`"${routine.name}" will stop running. Past research conversations are kept.`}
                confirmButtonText="Delete"
                isButtonLoading={deleteMutation.isPending}
                onConfirm={() => void onDelete()}
                onClose={() => setIsDeleteOpen(false)}
            />
        </div>
    );
};

export default RoutineDetail;
