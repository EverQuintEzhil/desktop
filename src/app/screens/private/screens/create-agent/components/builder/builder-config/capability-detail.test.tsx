import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import CapabilityDetail from './capability-detail';

describe('CapabilityDetail', () => {
    it('renders nothing for an empty detail body', () => {
        const { container } = renderWithProviders(<CapabilityDetail detail="" />);

        expect(container.querySelectorAll('p, ul')).toHaveLength(0);
    });

    it('renders a "What it is" section as plain prose without a label', () => {
        renderWithProviders(<CapabilityDetail detail={'**What it is**\nA bridge to an outside service.'} />);

        expect(screen.getByText('A bridge to an outside service.')).toBeInTheDocument();
        expect(screen.queryByText('What it is')).not.toBeInTheDocument();
    });

    it('labels the Example and Good to know callouts', () => {
        renderWithProviders(
            <CapabilityDetail detail={'**Example**\nConnect Slack.\n\n**Good to know**\nYou can disconnect later.'} />,
        );

        expect(screen.getByText('Example')).toBeInTheDocument();
        expect(screen.getByText('Connect Slack.')).toBeInTheDocument();
        expect(screen.getByText('Good to know')).toBeInTheDocument();
        expect(screen.getByText('You can disconnect later.')).toBeInTheDocument();
    });

    it('renders a dash block as a list, one item per line', () => {
        renderWithProviders(<CapabilityDetail detail={'**Why it matters**\n- Saves time\n- Avoids copy-paste'} />);

        const items = screen.getAllByRole('listitem');

        expect(items.map((item) => item.textContent)).toEqual(['Saves time', 'Avoids copy-paste']);
    });

    it('splits a section into several paragraphs on a blank line', () => {
        renderWithProviders(<CapabilityDetail detail={'**What it is**\nFirst para.\n\nSecond para.'} />);

        expect(screen.getByText('First para.')).toBeInTheDocument();
        expect(screen.getByText('Second para.')).toBeInTheDocument();
    });

    it('renders bold and italic inline markup', () => {
        const { container } = renderWithProviders(
            <CapabilityDetail detail={'**What it is**\nUse **bold** and *italic* text.'} />,
        );

        expect(container.querySelector('strong')?.textContent).toBe('bold');
        expect(container.querySelector('em')?.textContent).toBe('italic');
    });

    it('ignores lines that appear before the first section header', () => {
        renderWithProviders(<CapabilityDetail detail={'Loose intro line\n**Example**\nInside the section.'} />);

        expect(screen.queryByText('Loose intro line')).not.toBeInTheDocument();
        expect(screen.getByText('Inside the section.')).toBeInTheDocument();
    });
});
