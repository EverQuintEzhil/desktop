import { useEffect, useRef } from 'react';

const useIsMounted = () => {
    const isMountedRef = useRef<boolean>(false);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
        };
    });

    return isMountedRef;
};

export default useIsMounted;
