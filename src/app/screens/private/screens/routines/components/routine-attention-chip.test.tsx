import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import RoutineAttentionChip from './routine-attention-chip';

const render = (counts: { needsReconnect: number; failed: number }, to: string | null = '/runs') =>
    renderWithProviders(<RoutineAttentionChip counts={counts} routineName="Weekly scan" to={to} />);

describe('RoutineAttentionChip', () => {
    it('renders nothing when nothing needs attention', () => {
        const { container } = render({ needsReconnect: 0, failed: 0 });

        expect(container).toBeEmptyDOMElement();
    });

    it('stays neutral and plugged for a reconnect-only count', () => {
        const { container } = render({ needsReconnect: 1, failed: 0 });
        const chip = screen.getByRole('link', { name: '1 needs attention for Weekly scan' });

        expect(chip).toHaveAttribute('data-tone', 'neutral');
        expect(container.querySelector('.lucide-plug-zap')).toBeInTheDocument();
        expect(container.querySelector('.lucide-circle-alert')).not.toBeInTheDocument();
    });

    it('takes the destructive tone from a single real failure in the group', () => {
        const { container } = render({ needsReconnect: 3, failed: 1 });
        const chip = screen.getByRole('link', { name: '4 need attention for Weekly scan' });

        expect(chip).toHaveAttribute('data-tone', 'destructive');
        expect(container.querySelector('.lucide-circle-alert')).toBeInTheDocument();
        expect(container.querySelector('.lucide-plug-zap')).not.toBeInTheDocument();
    });

    it('falls back to a plain glyph where the routine cannot be opened', () => {
        render({ needsReconnect: 0, failed: 2 }, null);

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        // By role, not by raw attribute: `aria-label` alone on a generic span computes to no name.
        expect(screen.getByRole('img', { name: '2 need attention' })).toBeInTheDocument();
    });

    // The sentence is the tooltip and the accessible name, never the chip's own width.
    it('shows the count as a glyph rather than as text', () => {
        render({ needsReconnect: 1, failed: 0 });

        expect(screen.getByRole('link', { name: '1 needs attention for Weekly scan' })).toBeInTheDocument();
        expect(screen.queryByText('1 needs attention')).not.toBeInTheDocument();
    });
});
