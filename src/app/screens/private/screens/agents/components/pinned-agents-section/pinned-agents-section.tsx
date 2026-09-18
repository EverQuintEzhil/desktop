import { PointerActivationConstraints } from '@dnd-kit/dom';
import { move } from '@dnd-kit/helpers';
import {
    DragDropProvider,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useMediaQuery } from '@/hooks';
import type { LauncherType } from '@/types/admin';

import AgentCard, { type PinDisabledReason } from '../agent-card';

import SortableAgentCard from './components/sortable-agent-card';
import './pinned-agents-section.scss';

const SECTION_VALUE = 'pinned-agents';
const DRAGGING_BODY_CLASS = 'agent-drag-active';

const DRAG_ACTIVATION_DISTANCE = 4;

const TOUCH_ACTIVATION_DELAY_MS = 250;

/**
 * dnd-kit 0.5 activates a mouse drag with no movement at all when the press lands on the
 * draggable's own handle, so a plain click on the grip runs a whole drag. Touch keeps the library's
 * long-press default, so a scroll starting on the grip is still a scroll. Listing `KeyboardSensor`
 * is not optional: passing `sensors` replaces the default preset, not extends it.
 */
const PINNED_DRAG_SENSORS = [
    PointerSensor.configure({
        activationConstraints: (event) => {
            if (event.pointerType === 'touch') {
                return [new PointerActivationConstraints.Delay({ value: TOUCH_ACTIVATION_DELAY_MS, tolerance: 5 })];
            }

            return [new PointerActivationConstraints.Distance({ value: DRAG_ACTIVATION_DISTANCE })];
        },
    }),
    KeyboardSensor,
];

/** Matches `defaultSortableTransition`, so the preview lands on the frame the neighbours settle on. */
const DROP_ANIMATION = {
    duration: 250,
    easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
};

interface Props {
    agents: LauncherType[];
    editToPrefix?: string;
    isOwned?: boolean;
    onTogglePin: (agentId: string) => void;
    /** Present only when unpinning would be refused; every pinned tile shares the one reason. */
    pinDisabledReason?: PinDisabledReason;
    onReorder: (activeId: string, overId: string) => void;
}

const PinnedAgentsSection = (props: Props) => {
    const { agents, editToPrefix, isOwned = false, onTogglePin, pinDisabledReason, onReorder } = props;

    const [activeId, setActiveId] = useState<string | null>(null);
    const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

    const sortableIds = useMemo(() => agents.map((agent) => agent._id), [agents]);
    const activeAgent = agents.find((agent) => agent._id === activeId) ?? null;

    // Suppresses the text selection the pointer would drag along, and keeps the grabbing cursor
    // while the pointer is outside the grip it started on.
    useEffect(() => {
        if (activeId === null) return undefined;

        document.body.classList.add(DRAGGING_BODY_CLASS);

        return () => document.body.classList.remove(DRAGGING_BODY_CLASS);
    }, [activeId]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { source } = event.operation;

        if (source) {
            setActiveId(String(source.id));
        }
    }, []);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { source } = event.operation;

            setActiveId(null);

            if (event.canceled || !source) {
                return;
            }

            // The sortable plugin reorders optimistically during the drag, so by the drop the target is
            // the dragged tile itself and only its projected index, which `move` reads, says where it
            // landed. `move` returns the array it was given when nothing moved.
            const reordered = move(sortableIds, event);

            if (reordered === sortableIds) {
                return;
            }

            const draggedId = String(source.id);
            const overId = sortableIds[reordered.indexOf(draggedId)];

            if (overId === undefined || overId === draggedId) {
                return;
            }

            onReorder(draggedId, overId);
        },
        [sortableIds, onReorder],
    );

    /** Steps to the next *rendered* neighbour: a stored pin whose agent lives on an unfetched page has no tile. */
    const handleMove = useCallback(
        (agentId: string, direction: -1 | 1) => {
            const from = agents.findIndex((agent) => agent._id === agentId);

            if (from < 0) {
                return;
            }

            const neighbour = agents[from + direction];

            if (!neighbour) {
                return;
            }

            onReorder(agentId, neighbour._id);
        },
        [agents, onReorder],
    );

    /** The overlay is `position: fixed` and no longer inside a tile, so the pinned-tile class has to travel with it. */
    const renderDragOverlay = () => {
        if (!activeAgent) return null;

        return (
            <div className="agent-pinned-tile is-drag-preview h-full" aria-hidden="true">
                <AgentCard agent={activeAgent} isOwned={isOwned} isPreview />
            </div>
        );
    };

    const renderGrid = () => (
        <div className="agents-block grid grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-6">
            {agents.map((agent, index) => (
                <SortableAgentCard
                    key={agent._id}
                    agent={agent}
                    index={index}
                    editTo={editToPrefix ? `${editToPrefix}/${agent._id}` : undefined}
                    isOwned={isOwned}
                    pinDisabledReason={pinDisabledReason}
                    onTogglePin={() => onTogglePin(agent._id)}
                    onMove={(direction) => handleMove(agent._id, direction)}
                />
            ))}
        </div>
    );

    return (
        <section className="agents-section pinned-agents-section flex flex-col">
            {/* The overlay sits outside the collapsible panel, which clips its overflow while it animates. */}
            <DragDropProvider sensors={PINNED_DRAG_SENSORS} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <Accordion type="single" collapsible defaultValue={SECTION_VALUE}>
                    <AccordionItem value={SECTION_VALUE} className="border-b-0">
                        <AccordionTrigger className="agents-section-heading items-start justify-start gap-2 py-0 no-underline hover:no-underline">
                            Pinned
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 pb-1">{renderGrid()}</AccordionContent>
                    </AccordionItem>
                </Accordion>
                <DragOverlay dropAnimation={prefersReducedMotion ? null : DROP_ANIMATION}>
                    {renderDragOverlay()}
                </DragOverlay>
            </DragDropProvider>
        </section>
    );
};

export default PinnedAgentsSection;
