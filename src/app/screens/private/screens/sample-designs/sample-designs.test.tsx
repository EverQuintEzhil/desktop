import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installScrollIntoViewShim } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';

import SampleDesigns from './sample-designs';

// cmdk scrolls the active command item into view on mount.
installScrollIntoViewShim();

// `SECTIONS` is module-private in the product, so this list is a copy. The count
// assertion below is what makes a section added there fail here.
const SECTION_LABELS = [
    'Button',
    'Badge',
    'Input',
    'Label',
    'Checkbox',
    'Radio Group',
    'Avatar',
    'Progress',
    'Skeleton',
    'Tag',
    'Spinner',
    'Dialog',
    'Alert Dialog',
    'Dropdown Menu',
    'Select',
    'Multi Select',
    'Popover',
    'Sheet',
    'Calendar',
    'Command',
    'OTP Input',
    'Textarea',
    'Date Range',
    'Confirmation Modal',
    'Switch',
];

describe('Sample designs', () => {
    it('renders the design playground without crashing', () => {
        renderWithProviders(<SampleDesigns />, { route: '/sample-designs' });

        expect(screen.getByText('UI Components')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Button' })).toBeInTheDocument();
    });

    it('lists a nav entry for every section and nothing else', () => {
        renderWithProviders(<SampleDesigns />, { route: '/sample-designs' });

        const nav = screen.getByRole('navigation');

        SECTION_LABELS.forEach((label) => {
            expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument();
        });
        expect(within(nav).getAllByRole('button')).toHaveLength(SECTION_LABELS.length);
    });

    it('opens the Button section by default', () => {
        renderWithProviders(<SampleDesigns />, { route: '/sample-designs' });

        expect(screen.getByRole('heading', { level: 1, name: 'Button' })).toBeInTheDocument();
    });

    it.each(SECTION_LABELS)('renders the %s section when its nav entry is clicked', async (label) => {
        const user = userEvent.setup();

        renderWithProviders(<SampleDesigns />, { route: '/sample-designs' });

        const nav = screen.getByRole('navigation');

        // Leave the default section first, so the 'Button' case is not trivially
        // satisfied by the initial state — and never step away to the section
        // under test, or that row becomes trivial instead.
        const away = label === 'Switch' ? 'Button' : 'Switch';

        await user.click(within(nav).getByRole('button', { name: away }));
        await user.click(within(nav).getByRole('button', { name: label }));

        expect(screen.getByRole('heading', { level: 1, name: label })).toBeInTheDocument();
    });

    it('shows only one section at a time', async () => {
        const user = userEvent.setup();

        renderWithProviders(<SampleDesigns />, { route: '/sample-designs' });

        const nav = screen.getByRole('navigation');

        await user.click(within(nav).getByRole('button', { name: 'Badge' }));

        expect(screen.queryByRole('heading', { level: 1, name: 'Button' })).not.toBeInTheDocument();
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });
});
