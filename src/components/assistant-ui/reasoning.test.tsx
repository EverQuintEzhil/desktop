import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Collapsible } from '@/components/ui/collapsible';

import { ReasoningTrigger } from './reasoning';

vi.mock('./use-reasoning-elapsed', () => ({
    useReasoningElapsed: () => ({ isStreaming: false, elapsedMs: 5_000 }),
}));

describe('ReasoningTrigger', () => {
    it('no longer renders a brain icon', () => {
        const { container } = render(
            <Collapsible>
                <ReasoningTrigger durationMs={5_000} />
            </Collapsible>,
        );

        expect(screen.getByText('Thought for 5s')).toBeInTheDocument();
        expect(container.querySelector('.lucide-brain')).toBeNull();
    });
});
