import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import GlobalLibrary from './global-library';

interface StubLibraryContentProps {
    agentId?: string;
    userId: string;
    scope: string;
    onScopeChange: (scope: string) => void;
    previewId?: string | null;
    onPreviewChange?: (id: string | null, intent: 'open' | 'step' | 'close' | 'leave') => void;
}

vi.mock('@/app/screens/private/screens/agent/components/chat-agent/components/library/library-content', () => ({
    default: ({ agentId, userId, scope, onScopeChange, previewId, onPreviewChange }: StubLibraryContentProps) => (
        <div>
            <span>Library content</span>
            <span>{`agent:${agentId ?? 'none'}`}</span>
            <span>{`user:${userId}`}</span>
            <span>{`scope:${scope}`}</span>
            <span>{`preview:${previewId ?? 'none'}`}</span>
            <button onClick={() => onScopeChange('yours')}>Switch to yours</button>
            <button onClick={() => onScopeChange('all')}>Switch to all</button>
            <button
                onClick={() => {
                    // One real tab click: mousedown activates, then focus activates again
                    // before React has re-rendered with the new scope.
                    onScopeChange('all');
                    onScopeChange('all');
                }}
            >
                Switch to all twice
            </button>
            <button onClick={() => onPreviewChange?.('file-1', 'open')}>Open file 1</button>
            <button onClick={() => onPreviewChange?.('file-2', 'step')}>Step to file 2</button>
            <button onClick={() => onPreviewChange?.(null, 'close')}>Close preview</button>
            <button onClick={() => onPreviewChange?.(null, 'leave')}>Leave library</button>
        </div>
    ),
}));

/** Reports the live URL and stands in for the browser's Back button. */
const LocationProbe = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <>
            <span>{`url:${location.pathname}${location.search}`}</span>
            <button onClick={() => navigate(-1)}>Browser back</button>
        </>
    );
};

const renderGlobalLibrary = (route: string) =>
    renderWithProviders(
        <>
            <Routes>
                <Route path="/library" element={<GlobalLibrary basePath="/library" />} />
            </Routes>
            <LocationProbe />
        </>,
        { route },
    );

const url = () => screen.getByText(/^url:/).textContent;

describe('GlobalLibrary', () => {
    it('passes the current user id and defaults to the "yours" scope', () => {
        renderGlobalLibrary('/library');

        expect(screen.getByText('agent:none')).toBeInTheDocument();
        expect(screen.getByText('user:user-1')).toBeInTheDocument();
        expect(screen.getByText('scope:yours')).toBeInTheDocument();
    });

    it('normalizes an unknown tab query param to "yours"', () => {
        renderGlobalLibrary('/library?tab=bogus');

        expect(screen.getByText('scope:yours')).toBeInTheDocument();
    });

    it('reads a valid tab query param as the active scope', () => {
        renderGlobalLibrary('/library?tab=all');

        expect(screen.getByText('scope:all')).toBeInTheDocument();
    });

    it('navigates back to the base path without a query param when the scope changes to "yours"', async () => {
        const user = userEvent.setup();

        renderGlobalLibrary('/library?tab=all');

        await user.click(screen.getByRole('button', { name: 'Switch to yours' }));

        await waitFor(() => {
            expect(screen.getByText('scope:yours')).toBeInTheDocument();
        });
    });

    it('navigates to the scoped basePath for the "all" scope', async () => {
        const user = userEvent.setup();

        renderGlobalLibrary('/library');

        await user.click(screen.getByRole('button', { name: 'Switch to all' }));

        await waitFor(() => {
            expect(screen.getByText('scope:all')).toBeInTheDocument();
        });
    });

    /**
     * A real tab click reaches the handler twice — mousedown, then the focus that follows — and
     * the second call still sees the pre-navigation scope. Each duplicate used to cost a history
     * entry, so returning to the base path took two Back presses per tab switch.
     */
    it('spends one history entry on a scope change the tab reports twice', async () => {
        const user = userEvent.setup();

        renderGlobalLibrary('/library');

        await user.click(screen.getByRole('button', { name: 'Switch to all twice' }));

        await waitFor(() => expect(url()).toBe('url:/library?tab=all'));

        await user.click(screen.getByRole('button', { name: 'Browser back' }));

        await waitFor(() => expect(url()).toBe('url:/library'));
    });

    it('lets a tab be re-selected by hand after a Back moved off it', async () => {
        const user = userEvent.setup();

        renderGlobalLibrary('/library');

        await user.click(screen.getByRole('button', { name: 'Switch to all' }));
        await waitFor(() => expect(url()).toBe('url:/library?tab=all'));

        await user.click(screen.getByRole('button', { name: 'Browser back' }));
        await waitFor(() => expect(url()).toBe('url:/library'));

        await user.click(screen.getByRole('button', { name: 'Switch to all' }));
        await waitFor(() => expect(url()).toBe('url:/library?tab=all'));
    });

    it('puts the open file in the URL so Back closes the preview and keeps the tab', async () => {
        const user = userEvent.setup();

        renderGlobalLibrary('/library?tab=all');

        await user.click(screen.getByRole('button', { name: 'Open file 1' }));

        await waitFor(() => expect(url()).toBe('url:/library?tab=all&file=file-1'));
        expect(screen.getByText('preview:file-1')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Browser back' }));

        await waitFor(() => expect(url()).toBe('url:/library?tab=all'));
        expect(screen.getByText('preview:none')).toBeInTheDocument();
        expect(screen.getByText('scope:all')).toBeInTheDocument();
    });

    it('keeps one history entry while stepping between files', async () => {
        const user = userEvent.setup();

        renderGlobalLibrary('/library?tab=all');

        await user.click(screen.getByRole('button', { name: 'Open file 1' }));
        await user.click(screen.getByRole('button', { name: 'Step to file 2' }));

        await waitFor(() => expect(url()).toBe('url:/library?tab=all&file=file-2'));

        await user.click(screen.getByRole('button', { name: 'Browser back' }));

        await waitFor(() => expect(url()).toBe('url:/library?tab=all'));
    });

    it('pops the pushed entry when the preview closes itself', async () => {
        const user = userEvent.setup();

        renderGlobalLibrary('/library?tab=all');

        await user.click(screen.getByRole('button', { name: 'Open file 1' }));
        await waitFor(() => expect(screen.getByText('preview:file-1')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Close preview' }));

        await waitFor(() => expect(url()).toBe('url:/library?tab=all'));
    });

    it('opens a deep-linked file and drops the param again on close', async () => {
        const user = userEvent.setup();

        renderGlobalLibrary('/library?tab=all&file=file-9');

        expect(screen.getByText('preview:file-9')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Close preview' }));

        await waitFor(() => expect(url()).toBe('url:/library?tab=all'));
    });

    it('leaves the URL alone when the caller routes away from the library', async () => {
        const user = userEvent.setup();

        renderGlobalLibrary('/library?tab=all&file=file-9');

        await user.click(screen.getByRole('button', { name: 'Leave library' }));

        expect(url()).toBe('url:/library?tab=all&file=file-9');
    });
});
