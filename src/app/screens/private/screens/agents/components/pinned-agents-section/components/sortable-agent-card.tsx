import { useSortable } from '@dnd-kit/react/sortable';
import { GripVerticalIcon } from 'lucide-react';
import React, { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LauncherType } from '@/types/admin';

import AgentCard, { type PinDisabledReason } from '../../agent-card';

interface Props {
    agent: LauncherType;
    index: number;
    editTo?: string;
    isOwned?: boolean;
    onTogglePin: () => void;
    /** Present only when unpinning this tile would be refused; the card explains why. */
    pinDisabledReason?: PinDisabledReason;
    onMove: (direction: -1 | 1) => void;
}

const SortableAgentCard = (props: Props) => {
    const { agent, index, editTo, isOwned = false, onTogglePin, pinDisabledReason, onMove } = props;

    const { ref, handleRef, isDragging, isDropping } = useSortable({ id: agent._id, index });

    const handleGripKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>) => {
            // Once a keyboard drag is live the arrows belong to the KeyboardSensor, which listens on the
            // document and has already moved the tile.
            if (isDragging) {
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                onMove(-1);

                return;
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                onMove(1);
            }
        },
        [isDragging, onMove],
    );

    const handleNativeDragStart = useCallback((event: React.DragEvent) => {
        // A press inside the tile also arms the browser's native link drag, which cancels the
        // dnd-kit pointer gesture mid-reorder.
        event.preventDefault();
    }, []);

    /**
     * The grip must stay a sibling of the card, never a descendant of its anchor: dnd-kit ends a
     * pointer drag by stopping the trailing click's propagation, which cannot cancel a native
     * anchor's default action.
     */
    const renderGrip = () => (
        <Button
            ref={handleRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Reorder ${agent.name}`}
            className={cn(
                'agent-grip-handle absolute top-1 left-1 z-1 cursor-grab rounded-full',
                'active:cursor-grabbing',
            )}
            onKeyDown={handleGripKeyDown}
        >
            <GripVerticalIcon className="size-4" />
        </Button>
    );

    return (
        <div
            ref={ref}
            // `isDropping` is dropped-but-not-yet-idle: without it the placeholder snaps back to
            // full opacity under the preview still flying towards it.
            className={cn('agent-pinned-tile relative h-full', (isDragging || isDropping) && 'is-dragging')}
            onDragStart={handleNativeDragStart}
        >
            {renderGrip()}
            <AgentCard
                agent={agent}
                editTo={editTo}
                isOwned={isOwned}
                isPinned
                pinDisabledReason={pinDisabledReason}
                onTogglePin={onTogglePin}
            />
        </div>
    );
};

export default SortableAgentCard;
