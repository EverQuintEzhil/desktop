import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';

import type { WizardFormPageHandle, WizardFormPageProps } from '@/admin/components/wizard';
import { CronGenerator } from '@/components';
import { useWizardSaveCronMutation } from '@/lib/api/admin/data-stores';
import type { DataStoreType } from '@/types/admin';

export const ConfigureCronStep = forwardRef<WizardFormPageHandle, WizardFormPageProps>(
    ({ currentPage, setCanGoNext, onPageComplete, handleCommonDataChange, commonData }, ref) => {
        const saveCronMutation = useWizardSaveCronMutation();
        const wizardData = commonData as { dataStore?: DataStoreType; completedPages?: number[] } | null;
        const dataStore = wizardData?.dataStore;
        const isAlreadyAdded = wizardData?.completedPages?.includes(currentPage);

        const [cron, setCron] = useState(dataStore?.embeddingConfig?.cron ?? '');
        const [formError, setFormError] = useState('');

        useEffect(() => {
            setCanGoNext(true);
        }, [setCanGoNext]);

        useEffect(() => {
            if (dataStore?.embeddingConfig) {
                setCron(dataStore.embeddingConfig.cron ?? '');
            }
        }, [dataStore?.embeddingConfig]);

        const submitStep = useCallback(async (): Promise<boolean> => {
            if (!dataStore?._id || !wizardData) return false;
            if (!cron.trim()) return false;

            const savedCron = (dataStore.embeddingConfig?.cron ?? '').trim();

            if (isAlreadyAdded && cron.trim() === savedCron) {
                return true;
            }

            try {
                const result = await saveCronMutation.mutateAsync({
                    id: dataStore._id,
                    data: { cron },
                });

                onPageComplete?.(result, { currentPage, method: 'PUT' });
                handleCommonDataChange?.({
                    ...wizardData,
                    dataStore: { ...dataStore, ...result },
                    completedPages: [...(wizardData.completedPages ?? []), currentPage],
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
            }
        }, [
            cron,
            currentPage,
            dataStore,
            handleCommonDataChange,
            isAlreadyAdded,
            onPageComplete,
            saveCronMutation,
            setCanGoNext,
            wizardData,
        ]);

        useImperativeHandle(ref, () => ({ submitStep }), [submitStep]);

        const renderSchedule = () => (
            <div className="schedule-config flex flex-col gap-4">
                <div className="schedule-config-header flex flex-col gap-1">
                    <span className="font-medium">Sync Schedule</span>
                    <span className="text-sm text-muted-foreground">
                        Configure how often data should be synced from this data store.
                    </span>
                </div>
                <CronGenerator value={cron} onChange={setCron} />
            </div>
        );

        return (
            <div className="tab-content data-stores-tab flex flex-1 flex-col">
                <div className="data-stores-fields-wizard flex min-w-0 flex-1 flex-col gap-4">
                    {renderSchedule()}
                    {formError && (
                        <div className="add-data-store-error py-2">
                            <span className="text-center text-sm font-medium text-destructive">{formError}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    },
);

ConfigureCronStep.displayName = 'ConfigureCronStep';
