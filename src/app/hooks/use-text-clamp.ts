import { useEffect, useRef, useState } from 'react';

const useTextClamp = <T extends HTMLElement>(text: string | undefined) => {
    const ref = useRef<T>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isClamped, setIsClamped] = useState(false);

    useEffect(() => {
        setIsExpanded(false);
    }, [text]);

    useEffect(() => {
        const node = ref.current;

        if (!node) return;

        const measure = () => {
            const wasExpanded = node.classList.contains('line-clamp-none');

            if (wasExpanded) node.classList.remove('line-clamp-none');
            setIsClamped(node.scrollHeight > node.clientHeight + 1);
            if (wasExpanded) node.classList.add('line-clamp-none');
        };

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(node);

        return () => observer.disconnect();
    }, [text]);

    return {
        ref,
        isExpanded,
        setIsExpanded,
        isClamped,
    };
};

export default useTextClamp;
