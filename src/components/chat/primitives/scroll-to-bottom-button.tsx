import { ThreadPrimitive } from '@assistant-ui/react';
import { ArrowDownIcon } from 'lucide-react';

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';

const ScrollToBottomButton = () => (
    <ThreadPrimitive.ScrollToBottom asChild>
        <TooltipIconButton
            tooltip="Scroll to bottom"
            variant="outline"
            className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:border-border dark:bg-background dark:hover:bg-accent"
        >
            <ArrowDownIcon />
        </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
);

export default ScrollToBottomButton;
