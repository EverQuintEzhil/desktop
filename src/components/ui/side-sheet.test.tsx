import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { InstructionsEditor } from '@/components/instructions-editor';
import { installPointerCaptureShims, installRichTextDomShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';

import SideSheet from './side-sheet';

installRichTextDomShims();
installPointerCaptureShims();

// `isOpen` is driven by real state, not a bare spy: with a spy the sheet stays mounted whatever
// Radix decides, and every "the sheet is still open" assertion would pass vacuously.
const renderSheet = () => {
    const onClose = vi.fn();

    const Harness = () => {
        const [isOpen, setIsOpen] = useState(true);
        const [instructions, setInstructions] = useState('');

        return (
            <SideSheet
                isOpen={isOpen}
                onClose={() => {
                    onClose();
                    setIsOpen(false);
                }}
                renderTitle={() => 'Edit About'}
            >
                <InstructionsEditor value={instructions} onChange={setInstructions} enableMentions={false} />
            </SideSheet>
        );
    };

    const view = renderWithProviders(<Harness />);

    return { ...view, onClose };
};

// The slash popup is portalled to `document.body` by `createSuggestionRender`, outside the
// sheet, so it is found by class rather than by role.
const openSlashPopup = async (user: ReturnType<typeof userEvent.setup>) => {
    const editor = document.querySelector('.ca-instr-editor');

    if (!editor) throw new Error('instructions editor never mounted');

    await user.click(editor);
    await user.keyboard('/');

    return waitFor(() => {
        const popup = document.querySelector('.ca-suggest__popover');

        if (!popup) throw new Error('slash popup never opened');

        return popup as HTMLElement;
    });
};

describe('SideSheet', () => {
    it('dismisses the slash popup on Escape without closing the sheet', async () => {
        const user = userEvent.setup();
        const { onClose } = renderSheet();

        await screen.findByRole('dialog');
        await openSlashPopup(user);

        await user.keyboard('{Escape}');

        await waitFor(() => {
            expect(document.querySelector('.ca-suggest__popover')).toBeNull();
        });
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // `shouldEscapeKeepDialogOpen` swallows `event.repeat` unconditionally, so this half of the
    // deferral now applies to every SideSheet consumer, not only ones holding a marked field: a
    // held Escape dismisses one layer per deliberate press instead of cascading through them.
    // Pinned here because it is a behaviour change to ~40 consumers, none of which had it before.
    it('keeps the sheet open when a held Escape auto-repeats after dismissing the popup', async () => {
        const user = userEvent.setup();
        const { onClose } = renderSheet();

        await screen.findByRole('dialog');
        await openSlashPopup(user);

        await user.keyboard('{Escape}');
        fireEvent.keyDown(document.body, { key: 'Escape', repeat: true });

        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('lets a second, deliberate Escape close the sheet once the popup is gone', async () => {
        const user = userEvent.setup();
        const { onClose } = renderSheet();

        await screen.findByRole('dialog');
        await openSlashPopup(user);

        await user.keyboard('{Escape}');
        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Guard: the deferral must not swallow a plain Escape when nothing is mid-edit.
    it('lets Escape close the sheet when no suggestion popup is open', async () => {
        const user = userEvent.setup();
        const { onClose } = renderSheet();

        await screen.findByRole('dialog');
        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
