import { useCallback, useMemo, useState } from 'react';

import { useWizardSaveCronMutation } from '@/lib/api/admin/data-stores';
import { showErrorToast } from '@/utils';

import type { WizardCommonData } from '../types';
import { buildWizardPages } from '../utils/build-wizard-pages';

interface UseWizardFlowParams {
    onComplete: () => void;
}

export const useWizardFlow = ({ onComplete }: UseWizardFlowParams) => {
    const saveCronMutation = useWizardSaveCronMutation();

    const [isWizardCloseConfirmOpen, setIsWizardCloseConfirmOpen] = useState(false);
    const [isEmbeddingFieldsChoiceOpen, setIsEmbeddingFieldsChoiceOpen] = useState(false);
    const [isCronChoiceOpen, setIsCronChoiceOpen] = useState(false);
    const [currentWizardPage, setCurrentWizardPage] = useState(0);
    const [wizardCommonData, setWizardCommonData] = useState<WizardCommonData>(null);

    const wizardPages = useMemo(() => buildWizardPages(wizardCommonData), [wizardCommonData]);

    const openEmbeddingFieldsChoiceModal = useCallback(() => setIsEmbeddingFieldsChoiceOpen(true), []);
    const openCronChoiceModal = useCallback(() => setIsCronChoiceOpen(true), []);
    const requestCloseWizard = useCallback(() => setIsWizardCloseConfirmOpen(true), []);

    const resetWizard = useCallback(() => {
        setIsWizardCloseConfirmOpen(false);
        setIsEmbeddingFieldsChoiceOpen(false);
        setIsCronChoiceOpen(false);
        setCurrentWizardPage(0);
        setWizardCommonData(null);
    }, []);

    const completeWizard = useCallback(() => {
        resetWizard();
        onComplete();
    }, [resetWizard, onComplete]);

    /**
     * Answering a choice modal with "Skip" removes a page, so the step that raised the modal can
     * end up being the last one. Finish the wizard in that case instead of moving past the end,
     * which would render an empty dialog body.
     */
    const advanceOrComplete = useCallback(
        (nextCommonData: WizardCommonData) => {
            const nextPageCount = buildWizardPages(nextCommonData).length;

            if (currentWizardPage + 1 >= nextPageCount) {
                completeWizard();

                return;
            }

            setCurrentWizardPage(currentWizardPage + 1);
        },
        [currentWizardPage, completeWizard],
    );

    const confirmEmbeddingFieldsChoice = useCallback(
        (dontSkipEmbeddingFields: boolean) => {
            const nextCommonData = {
                ...(wizardCommonData ?? {}),
                dontSkipEmbeddingFields,
            } as WizardCommonData;

            setWizardCommonData(nextCommonData);
            setIsEmbeddingFieldsChoiceOpen(false);
            advanceOrComplete(nextCommonData);
        },
        [wizardCommonData, advanceOrComplete],
    );

    const confirmCronChoice = useCallback(
        async (dontSkipCron: boolean) => {
            const id = wizardCommonData?.dataStore?._id;
            const nextCommonData = {
                ...(wizardCommonData ?? {}),
                dontSkipCron,
            } as WizardCommonData;

            // Clear the schedule before moving on: skipping can end the wizard, so a failure here must
            // not be hidden behind a success toast — keep the modal open and let the user retry.
            if (!dontSkipCron && id) {
                try {
                    await saveCronMutation.mutateAsync({ id, data: { cron: null } });
                } catch (e) {
                    console.error(e);
                    showErrorToast('Could not skip the sync schedule. Please try again.');

                    return;
                }
            }

            setWizardCommonData(nextCommonData);
            setIsCronChoiceOpen(false);
            advanceOrComplete(nextCommonData);
        },
        [wizardCommonData, advanceOrComplete, saveCronMutation],
    );

    const wizardCommonDataForForm = useMemo(
        () => ({
            ...(wizardCommonData ?? {}),
            requestEmbeddingFieldsChoice: openEmbeddingFieldsChoiceModal,
            requestCronChoice: openCronChoiceModal,
        }),
        [wizardCommonData, openEmbeddingFieldsChoiceModal, openCronChoiceModal],
    );

    return {
        isWizardCloseConfirmOpen,
        setIsWizardCloseConfirmOpen,
        isEmbeddingFieldsChoiceOpen,
        setIsEmbeddingFieldsChoiceOpen,
        isCronChoiceOpen,
        setIsCronChoiceOpen,
        currentWizardPage,
        setCurrentWizardPage,
        setWizardCommonData,
        wizardPages,
        wizardCommonDataForForm,
        saveCronMutation,
        requestCloseWizard,
        resetWizard,
        completeWizard,
        confirmEmbeddingFieldsChoice,
        confirmCronChoice,
    };
};
