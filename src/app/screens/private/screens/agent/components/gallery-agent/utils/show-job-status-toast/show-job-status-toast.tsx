import { CircleCheckIcon, CircleXIcon } from 'lucide-react';
import { toast } from 'sonner';

import { getErrorToastOptions, getSuccessToastOptions } from '@/utils/toast-theme';

import { getJobToastLifecycleHandlers, registerJobToast } from '../job-toasts';

import './show-job-status-toast.scss';

function JobStatusToastContent({ message }: { message: string }) {
    return (
        <div className="toast-content flex w-full min-w-[200px] items-center justify-start gap-2 rounded-[inherit]">
            <CircleCheckIcon className="toast-icon size-8 shrink-0 text-2xl text-(--success)" />
            <span className="text-sm">{message}</span>
        </div>
    );
}

function JobErrorToastContent({ message }: { message: string }) {
    return (
        <div className="toast-content flex w-full min-w-[200px] items-center justify-start gap-2 rounded-[inherit]">
            <CircleXIcon className="toast-icon toast-icon-error size-8 shrink-0 text-2xl text-destructive" />
            <span className="text-sm">{message}</span>
        </div>
    );
}

export function showJobStatusToast(message: string) {
    const toastId = toast(<JobStatusToastContent message={message} />, {
        ...getSuccessToastOptions(),
        ...getJobToastLifecycleHandlers(),
    });

    registerJobToast(toastId);
}

export function showJobErrorToast(message: string) {
    const toastId = toast(<JobErrorToastContent message={message} />, {
        ...getErrorToastOptions(),
        ...getJobToastLifecycleHandlers(),
    });

    registerJobToast(toastId);
}
