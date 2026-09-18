import { cn } from '@/lib/utils';

import type { BuilderResizeHandleProps } from '../../../hooks/use-builder-chat-width';

/**
 * Vertical splitter between the builder chat panel and the config panel.
 * Desktop only — below `md` the two panels are a tab switch, so there is
 * nothing to drag.
 */
const BuilderResizeHandle = ({ width, minWidth, maxWidth, isResizing, ...handlers }: BuilderResizeHandleProps) => (
    <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="Resize chat panel"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        title="Drag to resize. Double-click to reset."
        className={cn(
            'builder-resize-handle relative z-20 hidden w-px shrink-0 self-stretch md:block',
            'cursor-col-resize touch-none bg-border transition-colors',
            // The line stays 1px wide; a transparent overlay widens the grab area.
            'after:absolute after:inset-y-0 after:-right-1.5 after:-left-1.5 after:content-[""]',
            'hover:bg-primary focus-visible:bg-primary',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus-ring)',
            isResizing && 'bg-primary',
        )}
        {...handlers}
    />
);

export default BuilderResizeHandle;
