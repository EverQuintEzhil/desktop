import { useAuiState, useThreadViewport } from '@assistant-ui/react';
import { useEffect, useRef } from 'react';

export const useScrollToBottomOnLoad = () => {
    const scrollToBottom = useThreadViewport((s) => s.scrollToBottom);
    const hasScrolled = useRef(false);
    const messageCount = useAuiState((s) => s.thread.messages.length);

    useEffect(() => {
        if (hasScrolled.current || messageCount === 0) return;

        hasScrolled.current = true;
        scrollToBottom({ behavior: 'instant' });
    }, [messageCount, scrollToBottom]);
};
