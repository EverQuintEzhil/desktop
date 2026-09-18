import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { installElementFromPointShim, installPointerCaptureShims, installWebAnimationsShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';

import type { ParameterSchemaType } from '../../schema';

import ParametersEditor from './parameters-editor';

installWebAnimationsShims();
installPointerCaptureShims();
installElementFromPointShim();

const POINTER_INIT = {
    bubbles: true,
    cancelable: true,
    isPrimary: true,
    button: 0,
    pointerType: 'mouse',
    clientX: 20,
    clientY: 20,
} as const;

/**
 * Presses the grip with no `pointermove` and holds. dnd-kit initialises a drag operation over
 * several frames — `[data-dnd-dragging]`, the placeholder and the live-region announcement all land
 * after the tick that handled `pointerdown` — so the press has to be held across that window for an
 * unwanted drag to be observable at all.
 */
const pressGripAndHold = async (element: Element) => {
    element.dispatchEvent(new PointerEvent('pointerdown', POINTER_INIT));

    await act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, 50);
        });
    });
};

const releaseGrip = (element: Element) => {
    element.dispatchEvent(new PointerEvent('pointerup', POINTER_INIT));
};

const expectNoDragStarted = () => {
    expect(document.querySelector('[data-dnd-dragging]')).toBeNull();
    expect(document.querySelector('[data-dnd-placeholder]')).toBeNull();
    expect(document.querySelector('[aria-live]')?.textContent ?? '').not.toMatch(/Picked up/i);
};

const selectParameter = (label: string): ParameterSchemaType => ({
    type: 'select',
    label,
    default: { label, value: label },
    options: [{ label, value: label }],
});

const parameters: Record<string, ParameterSchemaType> = {
    alpha: selectParameter('Alpha'),
    beta: selectParameter('Beta'),
    gamma: selectParameter('Gamma'),
};

const renderEditor = (onChange = vi.fn()) => {
    const rendered = renderWithProviders(<ParametersEditor value={parameters} onChange={onChange} />);

    return { ...rendered, onChange };
};

describe('ParametersEditor', () => {
    it('renders one row per parameter in object key order', () => {
        renderEditor();

        const labels = screen.getAllByText(/^(Alpha|Beta|Gamma)$/).map((node) => node.textContent);

        expect(labels).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    /**
     * dnd-kit's Accessibility plugin makes the handle focusable and describes it, but batches those
     * attribute writes through its own scheduler, so they land after the render that mounted the row.
     */
    it('gives every row a labelled drag handle that the keyboard sensor can focus', async () => {
        renderEditor();

        const handles = screen.getAllByRole('button', { name: 'Reorder parameter' });

        expect(handles).toHaveLength(3);

        await waitFor(() => {
            handles.forEach((handle) => {
                expect(handle).toHaveAttribute('tabindex', '0');
                expect(handle).toHaveAttribute('aria-roledescription', 'draggable');
            });
        });
    });

    it('leaves the drag handle out of a read-only editor', () => {
        renderWithProviders(<ParametersEditor value={parameters} onChange={vi.fn()} disabled />);

        expect(screen.queryByRole('button', { name: 'Reorder parameter' })).not.toBeInTheDocument();
    });

    /**
     * The 0.5.0 `PointerSensor` binds `pointerdown` to `source.handle ?? source.element`, so a row
     * whose handle is set never arms a drag from its own inputs.
     */
    it('lets a label be typed into while the row is sortable', async () => {
        const user = userEvent.setup();
        const { onChange } = renderEditor();

        await user.click(screen.getAllByRole('button', { name: 'Expand parameter' })[0]);

        await user.type(screen.getByPlaceholderText('Visible control name'), '!');

        expect(onChange).toHaveBeenLastCalledWith({
            ...parameters,
            alpha: { ...parameters.alpha, label: 'Alpha!' },
        });
    });

    it('does not start a drag when the grip is clicked without moving the mouse', async () => {
        const { onChange } = renderEditor();
        const handle = screen.getAllByRole('button', { name: 'Reorder parameter' })[0];

        await waitFor(() => expect(handle).toHaveAttribute('aria-roledescription', 'draggable'));

        await pressGripAndHold(handle);

        expectNoDragStarted();
        expect(handle).toHaveAttribute('aria-pressed', 'false');

        releaseGrip(handle);

        expect(screen.getAllByRole('button', { name: 'Reorder parameter' })).toHaveLength(3);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('removes only the clicked row when its delete button is pressed', async () => {
        const user = userEvent.setup();
        const { onChange } = renderEditor();

        const removeButtons = screen.getAllByRole('button', { name: 'Remove parameter' });

        await user.click(removeButtons[1]);

        expect(onChange).toHaveBeenCalledWith({ alpha: parameters.alpha, gamma: parameters.gamma });
    });
});
