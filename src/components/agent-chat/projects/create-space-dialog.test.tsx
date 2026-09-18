import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ChatHostProvider } from '@/components/chat-host';
import type { ChatHost, InstructionsEditorSlotProps } from '@/components/chat-host/types';
import { InstructionsEditor } from '@/components/instructions-editor';
import { installPointerCaptureShims, installRichTextDomShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';

import CreateSpaceDialog from './create-space-dialog';

installRichTextDomShims();
installPointerCaptureShims();

// `CreateSpaceDialog` reads nothing from the host but `slots`, so the rest of the contract is
// left unbuilt rather than stubbed with values no assertion depends on.
const host = {
    slots: {
        renderInstructionsEditor: (props: InstructionsEditorSlotProps) => <InstructionsEditor {...props} />,
    },
} as unknown as ChatHost;

// `open` is driven by real state, not a bare spy: with a spy the dialog stays mounted whatever
// Radix decides, and every "the dialog is still open" assertion would pass vacuously.
const renderDialog = () => {
    const onOpenChange = vi.fn();

    const Harness = () => {
        const [open, setOpen] = useState(true);

        return (
            <ChatHostProvider value={host}>
                <CreateSpaceDialog
                    agentId="agent-1"
                    open={open}
                    onOpenChange={(next) => {
                        onOpenChange(next);
                        setOpen(next);
                    }}
                />
            </ChatHostProvider>
        );
    };

    const view = renderWithProviders(<Harness />);

    return { ...view, onOpenChange };
};

// The slash popup is portalled to `document.body` by `createSuggestionRender`, outside the
// dialog, so it is found by class rather than by role.
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

describe('CreateSpaceDialog', () => {
    it('renders the host-supplied instructions editor', async () => {
        renderDialog();

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(document.querySelector('.ca-instr-editor')).not.toBeNull();
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

    // Guard: the deferral must not swallow a plain Escape when nothing is mid-edit.
    it('lets Escape close the dialog when no suggestion popup is open', async () => {
        const user = userEvent.setup();
        const { onOpenChange } = renderDialog();

        await screen.findByRole('dialog');
        await user.keyboard('{Escape}');

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
