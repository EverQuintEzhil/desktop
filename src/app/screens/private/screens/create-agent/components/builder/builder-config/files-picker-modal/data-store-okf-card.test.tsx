import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import { DataStoreOkfCard } from './data-store-okf-card';

describe('DataStoreOkfCard', () => {
    it('shows the empty state when the datastore has no OKF bundle', () => {
        renderWithProviders(<DataStoreOkfCard okf={null} />);

        expect(screen.getByText('Open Knowledge Format (OKF)')).toBeInTheDocument();
        expect(screen.getByText('Not generated yet')).toBeInTheDocument();
        expect(screen.queryByText(/regenerate/i)).not.toBeInTheDocument();
    });

    it('defaults to store.md and renders it read-only', () => {
        renderWithProviders(
            <DataStoreOkfCard
                okf={{
                    version: '0.2',
                    files: [
                        { path: 'collections/todos.md', content: '# todos\n\nOne document per task.' },
                        { path: 'store.md', content: '# Store overview\n\nThis store tracks todos.' },
                    ],
                }}
            />,
        );

        expect(screen.getByText('Store overview')).toBeInTheDocument();
        expect(screen.queryByText('One document per task.')).not.toBeInTheDocument();
    });

    it('switches the rendered content when another file is selected', () => {
        renderWithProviders(
            <DataStoreOkfCard
                okf={{
                    version: '0.2',
                    files: [
                        { path: 'store.md', content: '# Store overview\n\nThis store tracks todos.' },
                        { path: 'collections/todos.md', content: '# todos\n\nOne document per task.' },
                    ],
                }}
            />,
        );

        fireEvent.click(screen.getByText('collections/todos.md'));

        expect(screen.getByText('One document per task.')).toBeInTheDocument();
        expect(screen.queryByText('This store tracks todos.')).not.toBeInTheDocument();
    });
});
