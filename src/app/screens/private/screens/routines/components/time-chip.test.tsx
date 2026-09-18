import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import TimeChip from './time-chip';

const renderChip = (initial: string) => {
    const onChange = vi.fn();

    const Harness = () => {
        const [value, setValue] = useState(initial);

        return (
            <TimeChip
                value={value}
                onChange={(next) => {
                    setValue(next);
                    onChange(next);
                }}
            />
        );
    };

    renderWithProviders(<Harness />);

    return onChange;
};

const open = async () => userEvent.click(await screen.findByRole('button', { name: 'Time of day' }));

const typeInto = async (label: string, text: string) => {
    const field = await screen.findByLabelText(label);

    await userEvent.clear(field);
    if (text) await userEvent.type(field, text);
};

describe('TimeChip', () => {
    it('keeps a typed hour when the popover is dismissed with Escape', async () => {
        const onChange = renderChip('09:00');

        await open();
        await typeInto('Hour', '11');
        await userEvent.keyboard('{Escape}');

        expect(onChange).toHaveBeenLastCalledWith('11:00');
        expect(await screen.findByRole('button', { name: 'Time of day' })).toHaveTextContent('11:00 AM');
    });

    it('keeps both parts when hour and minute are typed before dismissing', async () => {
        const onChange = renderChip('09:00');

        await open();
        await typeInto('Hour', '11');
        await typeInto('Minute', '45');
        await userEvent.keyboard('{Escape}');

        expect(onChange).toHaveBeenLastCalledWith('11:45');
        expect(await screen.findByRole('button', { name: 'Time of day' })).toHaveTextContent('11:45 AM');
    });

    it('falls back to the committed time when a dismissed draft is empty or out of range', async () => {
        const onChange = renderChip('09:30');

        await open();
        await typeInto('Hour', '');
        await typeInto('Minute', '99');
        await userEvent.keyboard('{Escape}');

        expect(await screen.findByRole('button', { name: 'Time of day' })).toHaveTextContent('9:59 AM');
        expect(onChange).toHaveBeenLastCalledWith('09:59');
    });

    it('leaves the time alone when the popover is dismissed untouched', async () => {
        const onChange = renderChip('09:00');

        await open();
        await userEvent.keyboard('{Escape}');

        expect(onChange).not.toHaveBeenCalled();
    });

    it('round-trips midnight and noon through a dismissal', async () => {
        const onChange = renderChip('00:30');

        expect(await screen.findByRole('button', { name: 'Time of day' })).toHaveTextContent('12:30 AM');

        await open();
        await typeInto('Minute', '45');
        await userEvent.keyboard('{Escape}');

        expect(onChange).toHaveBeenLastCalledWith('00:45');
    });

    it('keeps noon in the afternoon when a dismissed draft commits', async () => {
        const onChange = renderChip('12:30');

        expect(await screen.findByRole('button', { name: 'Time of day' })).toHaveTextContent('12:30 PM');

        await open();
        await typeInto('Minute', '45');
        await userEvent.keyboard('{Escape}');

        expect(onChange).toHaveBeenLastCalledWith('12:45');
    });
});
