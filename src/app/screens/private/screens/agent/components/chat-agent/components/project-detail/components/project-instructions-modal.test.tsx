import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims, installRichTextDomShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';

import ProjectInstructionsModal from './project-instructions-modal';

installRichTextDomShims();
installPointerCaptureShims();

// `isOpen` is driven by real state here, unlike `renderModal` below: with a fixed `isOpen`
// the dialog stays mounted whatever Radix decides, so "the dialog is still open" would pass
// vacuously. Only the escape-behaviour tests need this.
const renderStatefulModal = () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    const Harness = () => {
        const [isOpen, setIsOpen] = useState(true);

        return (
            <ProjectInstructionsModal
                isOpen={isOpen}
                projectName="Design Space"
                initialValue="Always cite sources."
                onClose={() => {
                    onClose();
                    setIsOpen(false);
                }}
                onSave={onSave}
            />
        );
    };

    const view = renderWithProviders(<Harness />);

    return { ...view, onClose, onSave };
};

// The slash popup is portalled to `document.body` by `createSuggestionRender`, outside the
// dialog, so it is found by class rather than by role.
const openSlashPopup = async (user: ReturnType<typeof userEvent.setup>) => {
    const editor = document.querySelector('.ca-instr-editor');

    if (!editor) throw new Error('instructions editor never mounted');

    await user.click(editor);
    // The editor auto-focuses to the end of the seeded text; the slash trigger only fires at a
    // word boundary, so a space has to precede it.
    await user.keyboard(' /');

    return waitFor(() => {
        const popup = document.querySelector('.ca-suggest__popover');

        if (!popup) throw new Error('slash popup never opened');

        return popup as HTMLElement;
    });
};

const renderModal = (overrides: Partial<Parameters<typeof ProjectInstructionsModal>[0]> = {}) => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    const view = renderWithProviders(
        <ProjectInstructionsModal
            isOpen
            projectName="Design Space"
            initialValue="Always cite sources."
            onClose={onClose}
            onSave={onSave}
            {...overrides}
        />,
    );

    return { ...view, onClose, onSave };
};

describe('ProjectInstructionsModal', () => {
    it('renders nothing while closed', () => {
        renderModal({ isOpen: false });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('names the space in the explanatory copy', async () => {
        renderModal();

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Design Space')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Set space instructions' })).toBeInTheDocument();
    });

    it('seeds the editor with the current instructions', async () => {
        renderModal();

        await screen.findByRole('dialog');

        expect(screen.getByText('Always cite sources.')).toBeInTheDocument();
    });

    it('saves the seeded value and closes', async () => {
        const user = userEvent.setup();
        const { onSave, onClose } = renderModal();

        await screen.findByRole('dialog');
        await user.click(screen.getByRole('button', { name: 'Save instructions' }));

        expect(onSave).toHaveBeenCalledWith('Always cite sources.');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('trims the saved instructions', async () => {
        const user = userEvent.setup();
        const { onSave } = renderModal({ initialValue: '   padded text   ' });

        await screen.findByRole('dialog');
        await user.click(screen.getByRole('button', { name: 'Save instructions' }));

        expect(onSave).toHaveBeenCalledWith('padded text');
    });

    it('closes without saving on Cancel', async () => {
        const user = userEvent.setup();
        const { onSave, onClose } = renderModal();

        await screen.findByRole('dialog');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onSave).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('dismisses the slash popup on Escape without closing the dialog', async () => {
        const user = userEvent.setup();
        const { onClose } = renderStatefulModal();

        await screen.findByRole('dialog');
        await openSlashPopup(user);

        await user.keyboard('{Escape}');

        await waitFor(() => {
            expect(document.querySelector('.ca-suggest__popover')).toBeNull();
        });
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('lets a second, deliberate Escape close the dialog once the popup is gone', async () => {
        const user = userEvent.setup();
        const { onClose } = renderStatefulModal();

        await screen.findByRole('dialog');
        await openSlashPopup(user);

        await user.keyboard('{Escape}');
        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Guard: the deferral must not swallow a plain Escape when nothing is mid-edit.
    it('closes without saving when the dialog is dismissed with Escape', async () => {
        const user = userEvent.setup();
        const { onSave, onClose } = renderModal();

        await screen.findByRole('dialog');
        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onSave).not.toHaveBeenCalled();
    });

    it('re-seeds the editor from a new initial value when it is reopened', async () => {
        const { rerender, onSave } = renderModal();
        const user = userEvent.setup();

        await screen.findByRole('dialog');

        rerender(
            <ProjectInstructionsModal
                isOpen={false}
                projectName="Design Space"
                initialValue="Answer in bullet points."
                onClose={vi.fn()}
                onSave={onSave}
            />,
        );
        rerender(
            <ProjectInstructionsModal
                isOpen
                projectName="Design Space"
                initialValue="Answer in bullet points."
                onClose={vi.fn()}
                onSave={onSave}
            />,
        );

        expect(await screen.findByText('Answer in bullet points.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Save instructions' }));

        expect(onSave).toHaveBeenCalledWith('Answer in bullet points.');
    });
});
