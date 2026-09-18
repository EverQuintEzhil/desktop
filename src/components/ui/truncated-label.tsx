import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface TruncatedLabelProps {
    text: string;
    className?: string;
}

const TruncatedLabel = ({ text, className }: TruncatedLabelProps) => {
    const labelRef = useRef<HTMLElement>(null);
    const [isTruncated, setIsTruncated] = useState(false);

    // Measured on hover so the native title only exists when the text is actually clipped.
    const measure = () => {
        const label = labelRef.current;

        if (label) {
            setIsTruncated(label.scrollWidth > label.clientWidth);
        }
    };

    return (
        <abbr
            ref={labelRef}
            title={isTruncated ? text : undefined}
            onPointerEnter={measure}
            className={cn('min-w-0 truncate no-underline', className)}
        >
            {text}
        </abbr>
    );
};

export { TruncatedLabel };
