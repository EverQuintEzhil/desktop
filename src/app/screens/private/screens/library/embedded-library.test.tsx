import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import EmbeddedLibrary from './embedded-library';

interface StubLibraryContentProps {
    agentId?: string;
    userId: string;
    title: string;
    scope: string;
    scrollMode?: string;
    enableSelection?: boolean;
    originTypes?: string[];
    containerClassName?: string;
    onScopeChange: (scope: string) => void;
}

/**
 * `LibraryContent` is the shared library surface and owns its own tests
 * (`library.test.tsx`). Stubbed the same way `global-library.test.tsx` does it,
 * so the wiring this thin shell contributes stays assertable.
 */
vi.mock('@/app/screens/private/screens/agent/components/chat-agent/components/library/library-content', () => ({
    default: ({
        agentId,
        userId,
        title,
        scope,
        scrollMode,
        enableSelection,
        originTypes,
        containerClassName,
        onScopeChange,
    }: StubLibraryContentProps) => (
        <div data-testid="library-content" className={containerClassName}>
            <span>{`agent:${agentId ?? 'none'}`}</span>
            <span>{`user:${userId}`}</span>
            <span>{`title:${title}`}</span>
            <span>{`scope:${scope}`}</span>
            <span>{`scrollMode:${scrollMode}`}</span>
            <span>{`selection:${String(enableSelection)}`}</span>
            <span>{`origins:${(originTypes ?? []).join(',')}`}</span>
            <button onClick={() => onScopeChange('all')}>Switch to all</button>
        </div>
    ),
}));

describe('EmbeddedLibrary', () => {
    it('renders the library for the signed-in user with no agent scope', () => {
        renderWithProviders(<EmbeddedLibrary />);

        expect(screen.getByText('agent:none')).toBeInTheDocument();
        expect(screen.getByText('user:user-1')).toBeInTheDocument();
        expect(screen.getByText('title:Library')).toBeInTheDocument();
    });

    it('starts on the "yours" scope and holds it in local state rather than the URL', async () => {
        const user = userEvent.setup();

        renderWithProviders(<EmbeddedLibrary />, { route: '/settings/library?tab=all' });

        expect(screen.getByText('scope:yours')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Switch to all' }));

        await waitFor(() => {
            expect(screen.getByText('scope:all')).toBeInTheDocument();
        });
    });

    it('configures container scrolling, selection and the three origin types', () => {
        renderWithProviders(<EmbeddedLibrary />);

        expect(screen.getByText('scrollMode:container')).toBeInTheDocument();
        expect(screen.getByText('selection:true')).toBeInTheDocument();
        expect(screen.getByText('origins:chat,gallery,project')).toBeInTheDocument();
    });

    it('falls back to an empty user id when the store has none', () => {
        renderWithProviders(<EmbeddedLibrary />, { preloadedState: { user: { _id: '' } } });

        expect(screen.getByText('user:')).toBeInTheDocument();
    });
});
