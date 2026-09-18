import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssistantActions } from './assistant-actions';

const auiState = { thread: { isRunning: false }, message: { isLast: true } };

vi.mock('@assistant-ui/react', () => ({
    ActionBarPrimitive: { Root: ({ children }: { children?: unknown }) => <div>{children as never}</div> },
    ActionBarMorePrimitive: { Root: ({ children }: { children?: unknown }) => <div>{children as never}</div> },
    useAuiState: (selector: (s: typeof auiState) => unknown) => selector(auiState),
}));

vi.mock('@/components/chat/primitives/message-copy-button', () => ({ default: () => null }));
vi.mock('@/components/chat/primitives/message-copy-formatted-button', () => ({ default: () => null }));
vi.mock('./regenerate-menu', () => ({ RegenerateMenu: () => null }));

describe('the Deep Research provenance tag', () => {
    beforeEach(() => {
        auiState.thread.isRunning = false;
        auiState.message.isLast = true;
    });

    it('labels a finished answer as researched', () => {
        render(<AssistantActions deepResearch />);

        expect(screen.getByText('Deep Research')).toBeInTheDocument();
    });

    it('stays away while the answer is still streaming', () => {
        auiState.thread.isRunning = true;

        render(<AssistantActions deepResearch />);

        expect(screen.queryByText('Deep Research')).not.toBeInTheDocument();
    });
});
