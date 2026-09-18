import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
    installElementFromPointShim,
    installPointerCaptureShims,
    installScrollIntoViewShim,
    installWebAnimationsShims,
} from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';
import type { ModelType } from '@/types/admin';

import type { ModelValueShape } from '../../schema';

import ModelsListEditor from './models-list-editor';

installWebAnimationsShims();
installPointerCaptureShims();
installElementFromPointShim();
installScrollIntoViewShim();

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

const agentModel = (id: string, name: string): ModelType =>
    ({
        _id: id,
        model: name,
        provider: 'openai',
    }) as ModelType;

const agentModels = [agentModel('m1', 'gpt-a'), agentModel('m2', 'gpt-b')];

const models: ModelValueShape[] = [
    { modelId: 'm1', name: 'One' },
    { modelId: 'm2', name: 'Two' },
];

const renderEditor = (value: ModelValueShape[]) => {
    const onChange = vi.fn();
    const rendered = renderWithProviders(
        <ModelsListEditor
            componentType="chat"
            agentModels={agentModels}
            value={value}
            onChange={onChange}
            getError={() => undefined}
        />,
    );

    return { ...rendered, onChange };
};

describe('ModelsListEditor', () => {
    it('renders one row per model, in list order', () => {
        renderEditor(models);

        expect(screen.getByText('One')).toBeInTheDocument();
        expect(screen.getByText('Two')).toBeInTheDocument();
    });

    it('gives every row a labelled drag handle that the keyboard sensor can focus', async () => {
        renderEditor(models);

        const handle = screen.getByRole('button', { name: 'Reorder One' });

        await waitFor(() => {
            expect(handle).toHaveAttribute('tabindex', '0');
            expect(handle).toHaveAttribute('aria-roledescription', 'draggable');
        });
    });

    /** The row key must be the model id: an index in it remounts every row a reorder moves, dropping it out of the expanded set. */
    it('keeps a row expanded after the list is reordered around it', async () => {
        const user = userEvent.setup();
        const { rerender } = renderEditor(models);

        await user.click(screen.getByText('One'));

        expect(screen.getByDisplayValue('One')).toBeInTheDocument();

        rerender(
            <ModelsListEditor
                componentType="chat"
                agentModels={agentModels}
                value={[models[1], models[0]]}
                onChange={vi.fn()}
                getError={() => undefined}
            />,
        );

        expect(screen.getByDisplayValue('One')).toBeInTheDocument();
    });

    it('does not start a drag when the grip is clicked without moving the mouse', async () => {
        const { onChange } = renderEditor(models);
        const handle = screen.getByRole('button', { name: 'Reorder One' });

        await waitFor(() => expect(handle).toHaveAttribute('aria-roledescription', 'draggable'));

        await pressGripAndHold(handle);

        expectNoDragStarted();
        expect(handle).toHaveAttribute('aria-pressed', 'false');

        releaseGrip(handle);

        expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(models.length);
        expect(onChange).not.toHaveBeenCalled();
    });

    /**
     * Passing `sensors` to `DragDropProvider` replaces the default preset instead of extending it, so
     * this guards that `KeyboardSensor` is still in the list. jsdom reports every rect as zero, so an
     * arrow-key move has no target to resolve and the reorder itself is not assertable here.
     */
    it('still picks a row up from the keyboard', async () => {
        renderEditor(models);
        const handle = screen.getByRole('button', { name: 'Reorder One' });

        await waitFor(() => expect(handle).toHaveAttribute('aria-roledescription', 'draggable'));

        handle.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));

        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 50);
            });
        });

        expect(document.querySelector('[data-dnd-dragging]')).not.toBeNull();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }));
    });

    it('removes only the requested model', async () => {
        const user = userEvent.setup();
        const { onChange } = renderEditor(models);

        await user.click(screen.getByRole('button', { name: 'Remove Two' }));

        expect(onChange).toHaveBeenCalledWith([models[0]]);
    });
});
