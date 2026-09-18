import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import LibraryPage from './library-page';

vi.mock('./global-library', () => ({
    default: ({ basePath }: { basePath: string }) => <div>{`Global library (${basePath})`}</div>,
}));

const renderLibraryPage = () =>
    renderWithProviders(
        <Routes>
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/" element={<div>Home screen</div>} />
        </Routes>,
        { route: '/library' },
    );

describe('Library page', () => {
    it('renders the header with the tenant logo and the global library content', () => {
        renderLibraryPage();

        expect(screen.getByAltText('Fluent Mind')).toBeInTheDocument();
        expect(screen.getByText('Global library (/library)')).toBeInTheDocument();
    });

    it('navigates home when the back button is clicked', async () => {
        const user = userEvent.setup();

        renderLibraryPage();

        await user.click(screen.getByRole('button', { name: 'Back to home' }));

        await waitFor(() => {
            expect(screen.getByText('Home screen')).toBeInTheDocument();
        });
    });
});
