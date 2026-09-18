import { useEffect } from 'react';

let overlayCount = 0;

const useOverlayManager = (isOpen: boolean) => {
    useEffect(() => {
        if (isOpen) {
            overlayCount++;
            document.body.classList.add('overlay-open');
        }

        return () => {
            if (isOpen) {
                overlayCount--;
                if (overlayCount <= 0) {
                    overlayCount = 0;
                    document.body.classList.remove('overlay-open');
                }
            }
        };
    }, [isOpen]);
};

export default useOverlayManager;
