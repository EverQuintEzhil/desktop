import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import Header from './header';

describe('admin Header breadcrumbs', () => {
    it('renders the final crumb as text, not a link', () => {
        renderWithProviders(
            <Header
                breadcrumbs={[
                    { to: '/admin/agents', title: 'Agents' },
                    { to: '/admin/agents/one', title: 'Agent One' },
                ]}
            />,
        );

        expect(screen.getByRole('link', { name: /Agents/ })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Agent One/ })).not.toBeInTheDocument();
        expect(screen.getByText('Agent One')).toBeInTheDocument();
    });

    it('renders a crumb without a target as text rather than an empty link', () => {
        renderWithProviders(<Header breadcrumbs={[{ title: 'Standalone' }]} />);

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Standalone')).toBeInTheDocument();
    });

    it('renders a title-trailing control inside the final crumb, with no separator before it', () => {
        renderWithProviders(
            <Header
                breadcrumbs={[{ title: 'Activity Log' }]}
                titleTrailing={<button type="button">What this means</button>}
            />,
        );

        const control = screen.getByRole('button', { name: 'What this means' });

        expect(control.closest('.breadcrumbs-list-item')).toContainElement(screen.getByText('Activity Log'));
        expect(document.querySelector('.breadcrumbs-list-item-control')).toBeNull();
    });

    describe('with a trailing control', () => {
        it('renders the control', () => {
            renderWithProviders(
                <Header
                    breadcrumbs={[{ to: '/admin/builder-conversations', title: 'Builder Conversations' }]}
                    breadcrumbTrailing={<button type="button">Pick agent</button>}
                />,
            );

            expect(screen.getByRole('button', { name: 'Pick agent' })).toBeInTheDocument();
        });

        /**
         * The control closes the trail, so the crumb before it is no longer where the user is
         * — it has to become a link back, the way any ancestor crumb does.
         */
        it('turns the preceding crumb into a link', () => {
            renderWithProviders(
                <Header
                    breadcrumbs={[{ to: '/admin/builder-conversations', title: 'Builder Conversations' }]}
                    breadcrumbTrailing={<button type="button">Pick agent</button>}
                />,
            );

            expect(screen.getByRole('link', { name: /Builder Conversations/ })).toHaveAttribute(
                'href',
                '/admin/builder-conversations',
            );
        });

        it('runs the crumb onClick when it is followed', async () => {
            const user = userEvent.setup();
            const onClick = vi.fn();

            renderWithProviders(
                <Header
                    breadcrumbs={[
                        {
                            to: '/admin/builder-conversations',
                            title: 'Builder Conversations',
                            onClick,
                        },
                    ]}
                    breadcrumbTrailing={<button type="button">Pick agent</button>}
                />,
            );

            await user.click(screen.getByRole('link', { name: /Builder Conversations/ }));

            expect(onClick).toHaveBeenCalledTimes(1);
        });
    });
});
