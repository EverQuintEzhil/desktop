import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';

import LibraryEntitySelect from './library-entity-select';

const OPTIONS = [
    { value: 'agent-1', label: 'Research agent' },
    { value: 'agent-2', label: 'Support agent' },
];

type Props = Parameters<typeof LibraryEntitySelect>[0];

const renderSelect = (overrides: Partial<Props> = {}) =>
    render(
        <TooltipProvider>
            <LibraryEntitySelect label="All Agents" options={OPTIONS} onChange={() => {}} {...overrides} />
        </TooltipProvider>,
    );

describe('LibraryEntitySelect', () => {
    it('exposes the popover state on the enabled trigger', () => {
        renderSelect();

        const trigger = screen.getByRole('combobox', { name: 'All Agents' });

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not claim a combobox role on the disabled trigger, which opens nothing', () => {
        renderSelect({ disabled: true, disabledHint: 'Pick an agent first' });

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'All Agents' })).toBeDisabled();
    });
});
