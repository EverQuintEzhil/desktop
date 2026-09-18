import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { showSuccessToast } from '@/utils';
import { getErrorToastOptions } from '@/utils/toast-theme';

import { runRefusalOf } from '../components/run-refusal';

export const RUN_STARTED_MESSAGE = 'Research run started. You will be notified when the report is ready.';

export const RUN_FAILED_MESSAGE = 'Failed to start the run.';

/**
 * Every Run now button shares these two toasts, so a refusal cannot read as a failure on one surface
 * and as a connector problem on another.
 */
export const useRunNowToast = () => {
    const navigate = useNavigate();

    const showStarted = (): void => showSuccessToast(RUN_STARTED_MESSAGE);

    /** `fallback` names the routine where the toast is not anchored to the row it came from. */
    const showFailure = (error: unknown, fallback: string = RUN_FAILED_MESSAGE): void => {
        const refusal = runRefusalOf(error);

        if (!refusal) {
            toast.error(getApiErrorMessage(error, fallback), getErrorToastOptions());

            return;
        }

        toast.error(refusal.message, {
            ...getErrorToastOptions(),
            action: {
                label: refusal.action.label,
                onClick: () => navigate(refusal.action.to),
            },
        });
    };

    return { showStarted, showFailure };
};
