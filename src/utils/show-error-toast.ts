import { toast } from 'sonner';

import { getErrorToastOptions } from './toast-theme';

const showErrorToast = (message: string) => {
    toast.error(message, getErrorToastOptions());
};

export default showErrorToast;
