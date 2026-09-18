import { describe, expect, it } from 'vitest';

import { renderWithProviders, screen } from '@/test/test-utils';

import BlogByline from './blog-byline';

describe('BlogByline', () => {
    it('shows the day it was written', () => {
        renderWithProviders(<BlogByline date="2026-01-01T12:00:00.000Z" />);

        expect(screen.getByText(/^January 1, 2026$/)).toHaveAttribute('title', expect.stringContaining('Updated'));
    });

    /** Read as UTC midnight, this lands on the last day of 2025 anywhere west of Greenwich. */
    it('keeps a date-only value on its own calendar day', () => {
        renderWithProviders(<BlogByline date="2026-01-01" />);

        const stamp = screen.getByText(/^January 1, 2026$/);

        expect(stamp).toBeInTheDocument();
        expect(stamp).toHaveAttribute('datetime', '2026-01-01');
    });

    it('runs the collection line together with its count', () => {
        renderWithProviders(<BlogByline layout="inline" meta="4 articles" date="2026-01-01" />);

        expect(screen.getByText(/4 articles/)).toHaveTextContent('4 articles · January 1, 2026');
    });

    it('renders nothing without a count or a date', () => {
        const { container } = renderWithProviders(<BlogByline />);

        expect(container).toBeEmptyDOMElement();
    });
});
