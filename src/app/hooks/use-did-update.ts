import { useEffect, useRef } from 'react';
import type { DependencyList } from 'react';

const useDidUpdate = (callback: () => void, dep: DependencyList) => {
    const isMounted = useRef<boolean>(false);

    useEffect(() => {
        if (isMounted.current) {
            callback();
        } else {
            isMounted.current = true;
        }
    }, dep);
};

export default useDidUpdate;
