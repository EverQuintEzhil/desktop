import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import RelativeTimestamp from './relative-timestamp';

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

describe('RelativeTimestamp', () => {
    it('labels the relative distance', () => {
        renderWithProviders(<RelativeTimestamp label="Updated" date={daysAgo(3)} />);

        expect(screen.getByText('Updated 3 days ago')).toBeInTheDocument();
    });

    it('reveals the exact timestamp on hover', async () => {
        const user = userEvent.setup();

        renderWithProviders(<RelativeTimestamp label="Created" date="2026-01-02T09:30:00.000Z" />);

        await user.hover(screen.getByText(/^Created /, { selector: '[aria-hidden="true"]' }));

        expect(await screen.findByRole('tooltip')).toHaveTextContent(/^Created at: January 2nd 2026/);
    });

    it('exposes the exact timestamp to assistive tech without a hover', () => {
        renderWithProviders(<RelativeTimestamp label="Updated" date="2026-01-02T09:30:00.000Z" />);

        expect(screen.getByText(/^Updated at: January 2nd 2026/)).toBeInTheDocument();
    });

    it('renders nothing without a date', () => {
        const { container } = renderWithProviders(<RelativeTimestamp label="Updated" date={undefined} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('stands in the empty text when there is no date', () => {
        renderWithProviders(<RelativeTimestamp label="Last used" date={null} emptyText="Not used yet" />);

        expect(screen.getByText('Not used yet')).toBeInTheDocument();
    });

    it('renders nothing for a value that is not a date', () => {
        const { container } = renderWithProviders(<RelativeTimestamp label="Updated" date="not-a-date" />);

        expect(container).toBeEmptyDOMElement();
    });

    it('keeps the empty text out of an unparseable date, which is not the same as having none', () => {
        const { container } = renderWithProviders(
            <RelativeTimestamp label="Last used" date="not-a-date" emptyText="Not used yet" />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
