import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims, installRichTextDomShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';

import SpaceEditDialog, { type SpaceEditValues } from './space-edit-dialog';

installRichTextDomShims();
installPointerCaptureShims();

const initialValues: SpaceEditValues = {
    name: 'Design Space',
    description: 'Everything design',
    instructions: 'Always cite sources.',
    folderPath: '',
};

// `open` is driven by real state, not a bare spy: with a spy the dialog stays mounted whatever
// Radix decides, and every "the dialog is still open" assertion would pass vacuously.
const renderDialog = () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn<(patch: Partial<SpaceEditValues>) => Promise<void>>(() => Promise.resolve());

    const Harness = () => {
        const [open, setOpen] = useState(true);

        return (
            <SpaceEditDialog
                open={open}
                initial={initialValues}
                onOpenChange={(next) => {
                    onOpenChange(next);
                    setOpen(next);
                }}
                onSave={onSave}
            />
        );
    };

    const view = renderWithProviders(<Harness />);

    return { ...view, onOpenChange, onSave };
};

const getEditor = () => {
    const editor = document.querySelector('.ca-instr-editor');

    if (!editor) throw new Error('instructions editor never mounted');

    return editor as HTMLElement;
};

// The slash popup is portalled to `document.body` by `createSuggestionRender`, outside the
// dialog, so it is found by class rather than by role.
const findSlashPopup = () =>
    waitFor(() => {
        const popup = document.querySelector('.ca-suggest__popover');

        if (!popup) throw new Error('slash popup never opened');

        return popup as HTMLElement;
    });

const openSlashPopup = async (user: ReturnType<typeof userEvent.setup>) => {
    const editor = getEditor();

    await user.click(editor);
    await user.keyboard('/');

    return findSlashPopup();
};

describe('SpaceEditDialog', () => {
    it('seeds the fields from the initial values', async () => {
        renderDialog();

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByLabelText('Name *')).toHaveValue('Design Space');
        expect(screen.getByText('Always cite sources.')).toBeInTheDocument();
    });

    it('dismisses the slash popup on Escape without closing the dialog', async () => {
        const user = userEvent.setup();
        const { onOpenChange } = renderDialog();

        await screen.findByRole('dialog');
        await openSlashPopup(user);

        await user.keyboard('{Escape}');

        await waitFor(() => {
            expect(document.querySelector('.ca-suggest__popover')).toBeNull();
        });
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('keeps the dialog open when a held Escape auto-repeats after dismissing the popup', async () => {
        const user = userEvent.setup();
        const { onOpenChange } = renderDialog();

        await screen.findByRole('dialog');
        await openSlashPopup(user);

        await user.keyboard('{Escape}');
        fireEvent.keyDown(document.body, { key: 'Escape', repeat: true });

        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('lets a second, deliberate Escape close the dialog once the popup is gone', async () => {
        const user = userEvent.setup();
        const { onOpenChange } = renderDialog();

        await screen.findByRole('dialog');
        await openSlashPopup(user);

        await user.keyboard('{Escape}');
        await user.keyboard('{Escape}');

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('lets Escape close the dialog when no suggestion popup is open', async () => {
        const user = userEvent.setup();
        const { onOpenChange } = renderDialog();

        await screen.findByRole('dialog');
        await user.keyboard('{Escape}');

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
