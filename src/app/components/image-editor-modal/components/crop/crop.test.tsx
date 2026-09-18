import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { installPointerCaptureShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

import { DEFAULT_CROP_STATE } from '../../constants';
import { EditorProvider } from '../../context/editor-context';

import Crop from './crop';

installPointerCaptureShims();

const INITIAL_CROP = {
    ...DEFAULT_CROP_STATE,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
};

const renderCrop = () => {
    const recordSnapshot = vi.fn();

    const view = renderWithProviders(
        <EditorProvider initialCropState={INITIAL_CROP}>
            <Crop imageUrl="" recordSnapshot={recordSnapshot} />
        </EditorProvider>,
    );

    return { ...view, recordSnapshot };
};

// Mirrors how `image-editor-modal.tsx` mounts the panel: inside a Radix Dialog whose
// DismissableLayer listens for Escape at the document level. The modal's own half of the
// wiring is covered by `image-editor-modal.test.tsx`.
const renderCropInDialog = () => {
    const recordSnapshot = vi.fn();

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
                    <EditorProvider initialCropState={INITIAL_CROP}>
                        <Crop imageUrl="" recordSnapshot={recordSnapshot} />
                    </EditorProvider>
                </DialogContent>
            </Dialog>
        );
    };

    const view = renderWithProviders(<Harness />);

    return { ...view, recordSnapshot };
};

const widthInput = () => screen.getByLabelText('Width');
const heightInput = () => screen.getByLabelText('Height');

describe('Crop', () => {
    it('seeds the Width and Height drafts from the crop state', () => {
        renderCrop();

        expect(widthInput()).toHaveValue(200);
        expect(heightInput()).toHaveValue(100);
    });

    it('restores the pre-edit width when Escape cancels the edit', async () => {
        const user = userEvent.setup();

        renderCrop();

        await user.clear(widthInput());
        await user.type(widthInput(), '150');

        expect(widthInput()).toHaveValue(150);

        await user.keyboard('{Escape}');

        expect(widthInput()).toHaveValue(200);
    });

    it('restores the pre-edit height when Escape cancels the edit', async () => {
        const user = userEvent.setup();

        renderCrop();

        await user.clear(heightInput());
        await user.type(heightInput(), '60');

        expect(heightInput()).toHaveValue(60);

        await user.keyboard('{Escape}');

        expect(heightInput()).toHaveValue(100);
    });

    it('restores both dimensions when a locked aspect ratio moved the other field', async () => {
        const user = userEvent.setup();

        renderCrop();

        await user.click(screen.getByRole('button', { name: 'Lock aspect ratio' }));
        await user.clear(widthInput());
        await user.type(widthInput(), '400');

        expect(heightInput()).not.toHaveValue(100);

        await user.keyboard('{Escape}');

        expect(widthInput()).toHaveValue(200);
        expect(heightInput()).toHaveValue(100);
    });

    it('keeps the surrounding dialog open when Escape cancels a Width edit', async () => {
        const user = userEvent.setup();

        renderCropInDialog();

        await user.clear(widthInput());
        await user.type(widthInput(), '150');
        await user.keyboard('{Escape}');

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(widthInput()).toHaveValue(200);
    });

    it('keeps the dialog open when Escape auto-repeats after cancelling a Width edit', async () => {
        const user = userEvent.setup();

        renderCropInDialog();

        await user.clear(widthInput());
        await user.type(widthInput(), '150');
        await user.keyboard('{Escape}');

        // The cancel blurs the field, so the auto-repeats target the body, not the input.
        fireEvent.keyDown(document.body, { key: 'Escape', repeat: true });

        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('lets a second, deliberate Escape close the dialog after a cancel', async () => {
        const user = userEvent.setup();

        renderCropInDialog();

        await user.clear(widthInput());
        await user.type(widthInput(), '150');
        await user.keyboard('{Escape}');
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('lets Escape close the dialog when neither dimension is being edited', async () => {
        const user = userEvent.setup();

        renderCropInDialog();

        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('still validates a later blur after an Escape cancelled an earlier edit', async () => {
        const user = userEvent.setup();

        renderCrop();

        await user.clear(widthInput());
        await user.type(widthInput(), '150');
        await user.keyboard('{Escape}');

        // The escaping flag is one-shot: leaving it set would make the next blur skip the
        // empty-draft reset and strand the field showing nothing.
        await user.clear(widthInput());
        await user.tab();

        expect(widthInput()).toHaveValue(200);
    });

    it('leaves the crop untouched when Escape cancels an edit started before the image sized it', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <EditorProvider initialCropState={DEFAULT_CROP_STATE}>
                <Crop imageUrl="" recordSnapshot={vi.fn()} />
            </EditorProvider>,
        );

        await user.clear(widthInput());
        await user.type(widthInput(), '300');
        await user.keyboard('{Escape}');

        // A 0×0 rect is the pre-decode placeholder, not a frame worth restoring.
        expect(widthInput()).toHaveValue(300);
        expect(heightInput()).toHaveValue(0);
    });

    it('still commits a Width edit that is confirmed by blurring', async () => {
        const user = userEvent.setup();

        renderCrop();

        await user.clear(widthInput());
        await user.type(widthInput(), '150');
        await user.tab();

        expect(widthInput()).toHaveValue(150);
    });
});
