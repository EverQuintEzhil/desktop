import type { ExternalToast } from 'sonner';

import './toast-feedback.scss';

const baseToastOptions = {
    duration: 5000,
    closeButton: true,
} satisfies Pick<ExternalToast, 'duration' | 'closeButton'>;

export function getDefaultToastOptions(): ExternalToast {
    return {
        ...baseToastOptions,
        className: 'toast-feedback',
    };
}

/** Success / confirmation toasts — green accent from `--success` */
export function getSuccessToastOptions(): ExternalToast {
    return {
        ...baseToastOptions,
        className: 'toast-feedback toast-feedback--success',
    };
}

/** Error toasts — red accent from `--destructive` */
export function getErrorToastOptions(): ExternalToast {
    return {
        ...baseToastOptions,
        className: 'toast-feedback toast-feedback--error',
    };
}
