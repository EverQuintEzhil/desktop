import { useEffect } from 'react';

const TOAST_TOP_VAR = '--toast-top';
const TOAST_TOP_DEFAULT = '68px';

const useToastOffsetFromRef = (ref: React.RefObject<HTMLElement | null>) => {
    useEffect(() => {
        const el = ref?.current;

        if (!el) return;

        const setOffset = () => {
            const bottom = Math.max(0, el.getBoundingClientRect().bottom);

            document.documentElement.style.setProperty(TOAST_TOP_VAR, `${bottom}px`);
        };

        setOffset();
        const observer = new ResizeObserver(setOffset);

        observer.observe(el);
        window.addEventListener('scroll', setOffset, { passive: true });

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', setOffset);
            document.documentElement.style.setProperty(TOAST_TOP_VAR, TOAST_TOP_DEFAULT);
        };
    }, [ref]);
};

export default useToastOffsetFromRef;
