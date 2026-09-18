import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { installPointerCaptureShims } from '@/test/dom-shims';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

import IntensityControl from './intensity-control';

const ALLOWED = /^-?\d*$/;

type Props = Parameters<typeof IntensityControl>[0];

installPointerCaptureShims();

const renderControl = (overrides: Partial<Props> = {}) => {
    const onChange = vi.fn();
    const onSliderStart = vi.fn();
    const onEditStart = vi.fn();

    const view = render(
        <IntensityControl
            label="Brightness"
            value={20}
            min={-100}
            max={100}
            pattern="-?[0-9]*"
            allowedPattern={ALLOWED}
            onChange={onChange}
            onSliderStart={onSliderStart}
            onEditStart={onEditStart}
            {...overrides}
        />,
    );

    return {
        ...view,
        onChange,
        onSliderStart,
        onEditStart,
    };
};

// Mirrors how `image-editor-modal.tsx` mounts the control: inside a Radix Dialog, whose
// DismissableLayer listens for Escape at the document level.
const renderInDialog = (overrides: Partial<Props> = {}) => {
    const onChange = vi.fn();

    const Harness = () => {
        const [open, setOpen] = useState(true);

        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    onEscapeKeyDown={(event) => {
                        if (shouldEscapeKeepDialogOpen(event)) {
                            event.preventDefault();
                        }
                    }}
                >
                    <DialogTitle className="sr-only">Image Editor</DialogTitle>
                    <IntensityControl
                        label="Brightness"
                        value={20}
                        min={-100}
                        max={100}
                        pattern="-?[0-9]*"
                        allowedPattern={ALLOWED}
                        onChange={onChange}
                        {...overrides}
                    />
                </DialogContent>
            </Dialog>
        );
    };

    const view = render(<Harness />);

    return { ...view, onChange };
};

const flushFrame = () =>
    act(() => {
        vi.advanceTimersByTime(32);
    });

describe('IntensityControl', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the label, the read-only number and the slider', () => {
        renderControl();

        expect(screen.getByText('Brightness')).toBeInTheDocument();
        expect(screen.getByLabelText('Intensity')).toHaveValue('20');
        expect(screen.getByLabelText('Intensity')).toHaveAttribute('readonly');
        expect(screen.getByLabelText('Intensity slider')).toHaveValue('20');
    });

    it('hides the label when asked', () => {
        renderControl({ showLabel: false });

        expect(screen.queryByText('Brightness')).not.toBeInTheDocument();
    });

    it('prefers an explicit display value over the raw number', () => {
        renderControl({ displayValue: '20%' });

        expect(screen.getByLabelText('Intensity')).toHaveValue('20%');
    });

    it('uses the supplied aria labels', () => {
        renderControl({ ariaLabelNumber: 'Blur amount', ariaLabelSlider: 'Blur slider' });

        expect(screen.getByLabelText('Blur amount')).toBeInTheDocument();
        expect(screen.getByLabelText('Blur slider')).toBeInTheDocument();
    });

    it('throttles slider input into one change per frame', () => {
        const { onChange } = renderControl();
        const slider = screen.getByLabelText('Intensity slider');

        fireEvent.change(slider, { target: { value: '55' } });
        fireEvent.change(slider, { target: { value: '60' } });

        expect(onChange).not.toHaveBeenCalled();

        flushFrame();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(60);
    });

    it('reports the drag start once per press', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onSliderStart } = renderControl();
        const slider = screen.getByLabelText('Intensity slider');

        await user.pointer({ keys: '[MouseLeft>]', target: slider });

        expect(onSliderStart).toHaveBeenCalledTimes(1);

        await user.pointer({ keys: '[/MouseLeft]', target: slider });
        await user.pointer({ keys: '[MouseLeft>]', target: slider });

        expect(onSliderStart).toHaveBeenCalledTimes(2);
    });

    it('switches to an editable input from the pencil button without reporting an edit', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onEditStart } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        expect(onEditStart).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Intensity')).not.toHaveAttribute('readonly');
        expect(screen.queryByLabelText('Intensity slider')).not.toBeInTheDocument();
    });

    it('reports the edit start on the first value-changing keystroke, once per session', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onEditStart } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        expect(onEditStart).not.toHaveBeenCalled();

        const input = screen.getByLabelText('Intensity');

        await user.clear(input);
        await user.type(input, '55');

        expect(onEditStart).toHaveBeenCalledTimes(1);
    });

    it('reports no edit start when the field is opened and left untouched', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onEditStart, onChange } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));
        await user.tab();

        expect(screen.getByLabelText('Intensity')).toHaveAttribute('readonly');
        expect(onEditStart).not.toHaveBeenCalled();
        expect(onChange).toHaveBeenLastCalledWith(20);
    });

    it('reports an edit start when a blank field commits zero on blur', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onEditStart } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));
        await user.clear(screen.getByLabelText('Intensity'));
        await user.tab();

        expect(onEditStart).toHaveBeenCalledTimes(1);
    });

    it('hides the edit affordance while disabled', () => {
        renderControl({ disabled: true });

        expect(screen.queryByRole('button', { name: 'Edit value' })).not.toBeInTheDocument();
        expect(screen.getByLabelText('Intensity slider')).toBeDisabled();
    });

    it('clamps a typed value into range', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onChange } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        const input = screen.getByLabelText('Intensity');

        await user.clear(input);
        await user.type(input, '250');

        expect(onChange).toHaveBeenLastCalledWith(100);
    });

    it('rejects characters the allowed pattern forbids', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onChange } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        const input = screen.getByLabelText('Intensity');

        await user.clear(input);
        await user.type(input, 'abc');

        // The guard has to swallow the keystrokes, not merely fail to parse them:
        // `Number('abc')` is `NaN`, so `onChange` stays silent either way.
        expect(input).toHaveValue('');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('treats a blank input on blur as zero', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onChange } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        const input = screen.getByLabelText('Intensity');

        await user.clear(input);
        await user.tab();

        expect(onChange).toHaveBeenLastCalledWith(0);
    });

    it('commits the typed value on blur', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onChange } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        const input = screen.getByLabelText('Intensity');

        await user.clear(input);
        await user.type(input, '42');
        await user.tab();

        expect(onChange).toHaveBeenLastCalledWith(42);
    });

    it('steps the value with the arrow keys and ×10 with shift', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onChange } = renderControl({ step: 2 });

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        const input = screen.getByLabelText('Intensity');

        await user.type(input, '{ArrowUp}');

        expect(onChange).toHaveBeenLastCalledWith(22);

        await user.type(input, '{Shift>}{ArrowDown}{/Shift}');

        expect(onChange).toHaveBeenLastCalledWith(2);
    });

    it('steps from the current value when the field has been cleared', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onChange, onEditStart } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        const input = screen.getByLabelText('Intensity');

        await user.clear(input);
        await user.type(input, '{ArrowUp}');

        expect(onChange).toHaveBeenLastCalledWith(21);
        expect(onEditStart).toHaveBeenCalledTimes(1);
    });

    it('re-arms the edit report for a second session', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onEditStart } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));
        await user.type(screen.getByLabelText('Intensity'), '55{Escape}');
        await user.click(screen.getByRole('button', { name: 'Edit value' }));
        await user.type(screen.getByLabelText('Intensity'), '7');

        expect(onEditStart).toHaveBeenCalledTimes(2);
    });

    it('leaves edit mode on Escape without committing', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onChange } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        const input = screen.getByLabelText('Intensity');

        await user.clear(input);
        onChange.mockClear();
        await user.type(input, '{Escape}');

        expect(screen.getByLabelText('Intensity')).toHaveAttribute('readonly');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('returns focus to the edit button when Escape cancels', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));
        await user.type(screen.getByLabelText('Intensity'), '55{Escape}');

        expect(screen.getByRole('button', { name: 'Edit value' })).toHaveFocus();
    });

    it('restores the value committed before the edit when Escape is pressed', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const onChange = vi.fn();

        // Controlled, like the real consumers: typing commits live, so cancelling has to be a
        // compensating write back to the pre-edit value.
        const Harness = () => {
            const [value, setValue] = useState(20);

            return (
                <IntensityControl
                    label="Brightness"
                    value={value}
                    min={-100}
                    max={100}
                    pattern="-?[0-9]*"
                    allowedPattern={ALLOWED}
                    onChange={(next) => {
                        onChange(next);
                        setValue(next);
                    }}
                />
            );
        };

        render(<Harness />);

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        const input = screen.getByLabelText('Intensity');

        await user.clear(input);
        await user.type(input, '55');

        expect(onChange).toHaveBeenLastCalledWith(55);

        await user.type(input, '{Escape}');

        expect(onChange).toHaveBeenLastCalledWith(20);
        expect(screen.getByLabelText('Intensity')).toHaveValue('20');
    });

    it('keeps the surrounding dialog open when Escape cancels an edit', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        renderInDialog();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        const input = screen.getByLabelText('Intensity');

        await user.clear(input);
        await user.type(input, '55{Escape}');

        expect(screen.getByLabelText('Intensity')).toHaveAttribute('readonly');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('keeps the dialog open when Escape auto-repeats after cancelling an edit', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        renderInDialog();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));
        await user.type(screen.getByLabelText('Intensity'), '55{Escape}');

        // The cancel blurs the field and hands focus back to the pencil, so the auto-repeats no
        // longer reach the input. `event.repeat` gates the dialog independently of the target.
        fireEvent.keyDown(screen.getByRole('button', { name: 'Edit value' }), { key: 'Escape', repeat: true });

        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('restores the value after arrow-key stepping is cancelled with Escape', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onChange } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        const input = screen.getByLabelText('Intensity');

        await user.type(input, '{ArrowUp}');

        expect(onChange).toHaveBeenLastCalledWith(21);

        await user.type(input, '{Escape}');

        expect(onChange).toHaveBeenLastCalledWith(20);
    });

    it('writes nothing when Escape cancels an edit that changed nothing', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onChange } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));
        await user.type(screen.getByLabelText('Intensity'), '{Escape}');

        expect(onChange).not.toHaveBeenCalled();
    });

    it('lets a second, deliberate Escape close the dialog after an edit was cancelled', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        renderInDialog();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));
        await user.type(screen.getByLabelText('Intensity'), '55{Escape}');
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('lets Escape close the dialog when the number is not being edited', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        renderInDialog();

        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('commits on Enter and leaves the field', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { onChange } = renderControl();

        await user.click(screen.getByRole('button', { name: 'Edit value' }));

        const input = screen.getByLabelText('Intensity');

        await user.clear(input);
        await user.type(input, '55{Enter}');

        expect(onChange).toHaveBeenLastCalledWith(55);
    });
});
