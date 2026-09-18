import { useCallback, useState } from 'react';

import { readSessionStored, readStored, writeSessionStored, writeStored } from './panel-storage';

interface Options {
    /** localStorage key holding the docked open/closed preference. */
    openKey: string;
    /** Whether the window is too narrow to dock both panes. */
    isSinglePane: boolean;
    defaultOpen: boolean;
}

export interface AssistantVisibility {
    isOpen: boolean;
    open: () => void;
    /** `persist: false` keeps the dismissal to this tab, for one the narrow layout forced. */
    close: (options?: { persist?: boolean }) => void;
}

/**
 * Open state for the assistant panel, split in two: a stored preference that belongs to the docked
 * layout, and a per-tab dismissal of the drawer. Keeping them apart means closing the drawer to see
 * the app does not also collapse the panel the next time the window is wide enough to dock it.
 */
export const useAssistantVisibility = ({ openKey, isSinglePane, defaultOpen }: Options): AssistantVisibility => {
    const drawerKey = `${openKey}.drawer`;

    const [isPreferred, setIsPreferred] = useState<boolean>(() => {
        const stored = readStored(openKey);

        if (stored === 'true') return true;

        if (stored === 'false') return false;

        return defaultOpen;
    });
    const [isDrawerDismissed, setIsDrawerDismissed] = useState<boolean>(() => readSessionStored(drawerKey) === 'false');

    const open = useCallback(() => {
        setIsPreferred(true);
        setIsDrawerDismissed(false);
        writeStored(openKey, 'true');
        writeSessionStored(drawerKey, 'true');
    }, [openKey, drawerKey]);

    const close = useCallback(
        ({ persist = true }: { persist?: boolean } = {}) => {
            if (persist) {
                setIsPreferred(false);
                writeStored(openKey, 'false');

                return;
            }

            setIsDrawerDismissed(true);
            writeSessionStored(drawerKey, 'false');
        },
        [openKey, drawerKey],
    );

    return { isOpen: isPreferred && (!isSinglePane || !isDrawerDismissed), open, close };
};
