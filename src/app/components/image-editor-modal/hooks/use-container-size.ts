import { useLayoutEffect, useState } from 'react';

export const useContainerSize = (containerRef: React.RefObject<HTMLElement | null>) => {
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        const container = containerRef.current;

        if (!container) return;

        const update = () => {
            setContainerSize({
                width: container.clientWidth,
                height: container.clientHeight,
            });
        };

        update();

        const resizeObserver = new ResizeObserver(() => update());

        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, [containerRef]);

    return containerSize;
};
