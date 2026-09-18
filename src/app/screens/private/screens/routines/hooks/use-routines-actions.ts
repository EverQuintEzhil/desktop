import { useState } from 'react';

import {
    useArchiveRoutineMutation,
    useDeleteRoutineMutation,
    usePauseRoutineMutation,
    usePinRoutineMutation,
    useResumeRoutineMutation,
    useRunRoutineNowMutation,
    useUnarchiveRoutineMutation,
} from '@/lib/api/app/routines';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import type { RoutineType } from '@/types/routines';
import { showErrorToast, showSuccessToast } from '@/utils';

import { useRunNowToast } from './use-run-now-toast';

/** The list's row actions with their toasts, plus the confirm state the archive/delete modals run on. */
export const useRoutinesActions = () => {
    const runNowMutation = useRunRoutineNowMutation();
    const runNowToast = useRunNowToast();
    const pauseMutation = usePauseRoutineMutation();
    const resumeMutation = useResumeRoutineMutation();
    const deleteMutation = useDeleteRoutineMutation();
    const pinMutation = usePinRoutineMutation();
    const archiveMutation = useArchiveRoutineMutation();
    const unarchiveMutation = useUnarchiveRoutineMutation();

    const [deletingRoutine, setDeletingRoutine] = useState<RoutineType | null>(null);
    const [archivingRoutine, setArchivingRoutine] = useState<RoutineType | null>(null);

    const onRunNow = async (routine: RoutineType) => {
        try {
            await runNowMutation.mutateAsync(routine._id);
            runNowToast.showStarted();
        } catch (err) {
            runNowToast.showFailure(err);
        }
    };

    const onToggleStatus = async (routine: RoutineType) => {
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

    const isRunPending = (routine: RoutineType): boolean =>
        runNowMutation.isPending && runNowMutation.variables === routine._id;

    const isStatusPending = (routine: RoutineType): boolean =>
        (pauseMutation.isPending && pauseMutation.variables === routine._id) ||
        (resumeMutation.isPending && resumeMutation.variables === routine._id);

    const isPinPending = (routine: RoutineType): boolean =>
        pinMutation.isPending && pinMutation.variables === routine._id;

    const isUnarchivePending = (routine: RoutineType): boolean =>
        unarchiveMutation.isPending && unarchiveMutation.variables === routine._id;

    const onUnarchive = async (routine: RoutineType) => {
        try {
            await unarchiveMutation.mutateAsync(routine._id);
            showSuccessToast('Routine unarchived. It stays paused until you resume it.');
        } catch (err) {
            showErrorToast(getApiErrorMessage(err, 'Failed to unarchive the routine.'));
        }
    };

    const onTogglePin = async (routine: RoutineType) => {
        try {
            // `PUT /pin` is a blind toggle, so only its response says which way the row went.
            const updated = await pinMutation.mutateAsync(routine._id);

            showSuccessToast(updated.pinnedAt ? 'Routine pinned to the top.' : 'Routine unpinned.');
        } catch (err) {
            showErrorToast(getApiErrorMessage(err, 'Failed to update the routine.'));
        }
    };

    const onArchive = async () => {
        if (!archivingRoutine) return;
        try {
            await archiveMutation.mutateAsync(archivingRoutine._id);
            showSuccessToast('Routine archived.');
        } catch (err) {
            showErrorToast(getApiErrorMessage(err, 'Failed to archive the routine.'));
        } finally {
            setArchivingRoutine(null);
        }
    };

    const onDelete = async () => {
        if (!deletingRoutine) return;
        try {
            await deleteMutation.mutateAsync(deletingRoutine._id);
            showSuccessToast('Routine deleted.');
        } catch (err) {
            showErrorToast(getApiErrorMessage(err, 'Failed to delete the routine.'));
        } finally {
            setDeletingRoutine(null);
        }
    };

    return {
        isRunPending,
        isStatusPending,
        isPinPending,
        isUnarchivePending,
        onRunNow,
        onToggleStatus,
        onUnarchive,
        onTogglePin,
        archivingRoutine,
        setArchivingRoutine,
        onArchive,
        isArchivePending: archiveMutation.isPending,
        deletingRoutine,
        setDeletingRoutine,
        onDelete,
        isDeletePending: deleteMutation.isPending,
    };
};
