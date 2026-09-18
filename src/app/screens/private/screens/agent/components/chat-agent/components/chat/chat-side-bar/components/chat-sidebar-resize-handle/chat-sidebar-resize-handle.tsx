import { cn } from '@/lib/utils';

import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '../../constants';
import type { ChatSidebarResizeHandleProps } from '../../hooks/use-chat-sidebar-width';

import './chat-sidebar-resize-handle.scss';

/**
 * Splitter on the right edge of the chat sidebar. It is a sibling of the
 * `<aside>` rather than a child because the aside is the scroll container —
 * a child would scroll away with the history list.
 */
const ChatSidebarResizeHandle = ({ width, isResizing, ...handlers }: ChatSidebarResizeHandleProps) => (
    <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={width}
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        title="Drag to resize. Double-click to reset."
        className={cn(
            'chat-sidebar-resize-handle relative w-px shrink-0 touch-none',
            // The line stays 1px wide; a transparent overlay widens the grab area.
            // It may only grow rightwards: a left overhang would sit over the aside's 6px scrollbar gutter.
            'after:absolute after:inset-y-0 after:-right-2 after:left-0 after:content-[""]',
            isResizing && 'resizing',
        )}
        {...handlers}
    />
);

export default ChatSidebarResizeHandle;
