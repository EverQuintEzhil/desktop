import { toast, type ToastT } from 'sonner';

type ToastId = ToastT['id'];

const jobToastIds = new Set<ToastId>();

export const registerJobToast = (toastId: ToastId) => {
    jobToastIds.add(toastId);

    return toastId;
};

export const dismissJobToasts = () => {
    const toastIds = Array.from(jobToastIds);

    jobToastIds.clear();
    toastIds.forEach((toastId) => toast.dismiss(toastId));
};

export const getJobToastLifecycleHandlers = () => ({
    onDismiss: (dismissedToast: ToastT) => {
        jobToastIds.delete(dismissedToast.id);
    },
    onAutoClose: (dismissedToast: ToastT) => {
        jobToastIds.delete(dismissedToast.id);
    },
});
