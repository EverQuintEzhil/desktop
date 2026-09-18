import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import { DataStoreEditSkeleton } from './data-store-edit-skeleton';

describe('DataStoreEditSkeleton', () => {
    it('announces itself as a busy loading region', () => {
        renderWithProviders(<DataStoreEditSkeleton />);

        const region = screen.getByLabelText('Loading data store');

        expect(region).toHaveAttribute('aria-busy', 'true');
    });

    it('renders the metabar placeholders the loaded header will replace', () => {
        const { container } = renderWithProviders(<DataStoreEditSkeleton />);

        expect(container.querySelectorAll('.metabar [data-slot="skeleton"]')).toHaveLength(4);
    });
});
