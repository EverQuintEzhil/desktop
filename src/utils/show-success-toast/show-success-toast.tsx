import { CircleCheckIcon } from 'lucide-react';
import { toast } from 'sonner';

import { getSuccessToastOptions } from '../toast-theme';

import './show-success-toast.scss';

function SuccessToastContent({ message }: { message: string }) {
    return (
        <div className="success-toast-content flex w-full min-w-[200px] items-center justify-start gap-2 py-0.5">
            <CircleCheckIcon className="success-toast-icon size-8 shrink-0" />
            <span className="text-sm">{message}</span>
        </div>
    );
}

interface SuccessToastOptions {
    /** Sonner's action button beside the message. */
    action?: { label: string; onClick: () => void };
}

const showSuccessToast = (message: string, options: SuccessToastOptions = {}) => {
    toast(<SuccessToastContent message={message} />, { ...getSuccessToastOptions(), ...options });
};

export default showSuccessToast;
