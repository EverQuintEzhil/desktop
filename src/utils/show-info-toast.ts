import { toast } from 'sonner';

import { getDefaultToastOptions } from './toast-theme';

const showInfoToast = (message: string) => {
    toast(message, getDefaultToastOptions());
};

export default showInfoToast;
