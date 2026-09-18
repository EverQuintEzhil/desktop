import { useAui } from '@assistant-ui/react';
import { useEffect, useState } from 'react';

// visibility-only: an in-tab focus change must not trigger the invite
const isTabBackgrounded = (): boolean => {
    if (typeof document === 'undefined') {
        return false;
    }

    return document.visibilityState !== 'visible';
};

export const useAwayDuringRun = (): boolean => {
    const aui = useAui();
    const [wasAwayDuringRun, setWasAwayDuringRun] = useState(false);

    useEffect(() => {
        let isRunning = aui.thread.getState().isRunning;

        const markIfAwayDuringRun = (): void => {
            if (isRunning && isTabBackgrounded()) {
                setWasAwayDuringRun(true);
            }
        };

        const handleRunStart = (): void => {
            isRunning = true;
            markIfAwayDuringRun();
        };

        const handleRunEnd = (): void => {
            isRunning = false;
        };

        document.addEventListener('visibilitychange', markIfAwayDuringRun);
        window.addEventListener('pagehide', markIfAwayDuringRun);

        const unsubscribeRunStart = aui.on('thread.runStart', handleRunStart);
        const unsubscribeRunEnd = aui.on('thread.runEnd', handleRunEnd);

        markIfAwayDuringRun();

        return () => {
            unsubscribeRunStart();
            unsubscribeRunEnd();
            document.removeEventListener('visibilitychange', markIfAwayDuringRun);
            window.removeEventListener('pagehide', markIfAwayDuringRun);
        };
    }, [aui]);

    return wasAwayDuringRun;
};
