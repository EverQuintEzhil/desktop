import { DragDropProvider } from '@dnd-kit/react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { sampleLauncher } from '@/test/fixtures/agents';
import { renderWithProviders } from '@/test/test-utils';
import type { LauncherType } from '@/types/admin';

import AgentCard from '../../agent-card';

import SortableAgentCard from './sortable-agent-card';

const agent = {
    ...sampleLauncher,
    _id: 'launcher-1',
    name: 'Agent 1',
    urlOrSlug: 'agent-1',
} as LauncherType;

const linkAgent = {
    ...agent,
    type: 'link',
    urlOrSlug: 'https://example.com/tool',
} as LauncherType;

interface HarnessProps {
    agent: LauncherType;
    editTo?: string;
    onTogglePin: () => void;
    onMove: (direction: -1 | 1) => void;
}

/** Mirrors the provider and the grid wrapper the section puts around every tile. */
const Harness = (props: HarnessProps) => (
    <DragDropProvider>
        <div className="agents-block">
            <SortableAgentCard {...props} index={0} />
        </div>
    </DragDropProvider>
);

const renderCard = (overrides: Partial<HarnessProps> = {}) => {
    const onMove = vi.fn<(direction: -1 | 1) => void>();
    const onTogglePin = vi.fn<() => void>();

    const view = renderWithProviders(
        <Harness agent={agent} onMove={onMove} onTogglePin={onTogglePin} {...overrides} />,
    );

    return { ...view, onMove, onTogglePin };
};

const grip = () => screen.getByRole('button', { name: 'Reorder Agent 1' });

const tile = () => grip().closest('.agent-pinned-tile') as HTMLElement;

describe('SortableAgentCard', () => {
    it('renders the tile with a labelled reorder grip', () => {
        renderCard();

        expect(grip()).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Agent 1/ })).toBeInTheDocument();
    });

    it('keeps the grip out of the anchor of an external-link tile', () => {
        renderCard({ agent: linkAgent });

        const anchor = screen.getByRole('link', { name: /Agent 1/ });

        expect(anchor).toHaveAttribute('href', 'https://example.com/tool');
        expect(grip().closest('a')).toBeNull();
        expect(anchor.contains(grip())).toBe(false);
    });

    it('gives the pinned card the same box as a card in the grid', () => {
        // A pinned tile is only a wrapper: the section stylesheet must not reach into `.agent-card`
        // to change its box.
        const { unmount } = renderCard();
        const pinned = tile().querySelector('.agent-card')?.className;

        unmount();
        renderWithProviders(<AgentCard agent={agent} />);

        expect(pinned).toBe(document.querySelector('.agent-card')?.className);
    });

    // The grip overlays the top-left corner instead of claiming padding, which keeps a pinned card
    // the same box as a grid card.
    describe('grip placement', () => {
        it.each([
            ['a slug launcher with no edit control', {}],
            ['a slug launcher with an edit control', { editTo: '/agent-builder/launcher-1' }],
            ['a link launcher with no edit control', { agent: linkAgent }],
            ['a link launcher with an edit control', { agent: linkAgent, editTo: '/agent-builder/launcher-1' }],
        ])('sits at the top-left for %s', (_label, overrides: Partial<HarnessProps>) => {
            renderCard(overrides);

            expect(grip()).toHaveClass('absolute', 'top-1', 'left-1');
        });
    });

    it('forwards the pin control to the section', async () => {
        const { onTogglePin } = renderCard();

        await userEvent.click(screen.getByRole('button', { name: 'Unpin Agent 1' }));

        expect(onTogglePin).toHaveBeenCalledTimes(1);
    });

    describe('arrow-key reorder fallback', () => {
        it('moves forward on ArrowRight and swallows the key', () => {
            const { onMove } = renderCard();

            // fireEvent returns false when the handler called preventDefault, which is what stops
            // the arrow from also scrolling the grid.
            expect(fireEvent.keyDown(grip(), { key: 'ArrowRight' })).toBe(false);
            expect(onMove).toHaveBeenCalledWith(1);
        });

        it('moves backward on ArrowLeft and swallows the key', () => {
            const { onMove } = renderCard();

            expect(fireEvent.keyDown(grip(), { key: 'ArrowLeft' })).toBe(false);
            expect(onMove).toHaveBeenCalledWith(-1);
        });

        it.each(['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'a'])('ignores %s', (key) => {
            const { onMove } = renderCard();

            fireEvent.keyDown(grip(), { key });

            expect(onMove).not.toHaveBeenCalled();
        });
    });

    it('cancels the native drag the browser would start on the tile', () => {
        renderCard();

        // The tile contains an anchor, so a press inside it also arms the browser's own link drag,
        // which would cancel the dnd-kit gesture.
        expect(fireEvent.dragStart(tile())).toBe(false);
    });

    // The live drag states are asserted in pinned-agents-section.test.tsx, where a real keyboard drag
    // runs: dnd-kit drives them from its own signals.
    it('leaves an idle tile unmarked and unstyled', () => {
        renderCard();

        expect(tile()).not.toHaveClass('is-dragging');
        expect(tile().getAttribute('style')).toBeNull();
    });
});
