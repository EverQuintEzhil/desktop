import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import { type TextAreaRef } from '@/components/text-area';

const useTextWrapDetection = (textAreaRef: RefObject<TextAreaRef | null>, query: string): boolean => {
    const [hasTextWrapped, setHasTextWrapped] = useState(false);

    useEffect(() => {
        if (!query.trim()) {
            setHasTextWrapped(false);

            return;
        }

        const checkTextWrap = () => {
            const textAreaElement = textAreaRef.current?.element;

            if (textAreaElement) {
                const computedStyle = window.getComputedStyle(textAreaElement);
                const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.6;
                const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
                const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
                const singleLineHeight = lineHeight + paddingTop + paddingBottom;

                const isWrapped = textAreaElement.scrollHeight > singleLineHeight * 1.1;

                if (isWrapped) {
                    setHasTextWrapped(true);
                }
            }
        };

        checkTextWrap();
        const timeoutId = setTimeout(checkTextWrap, 0);

        window.addEventListener('resize', checkTextWrap);

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', checkTextWrap);
        };
    }, [query, textAreaRef]);

    return hasTextWrapped;
};

export default useTextWrapDetection;
