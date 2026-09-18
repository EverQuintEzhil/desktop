import { fireEvent, screen } from '@testing-library/react';
import { delay, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';
import { server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import { ESCAPE_CANCELS_EDIT_PROPS } from '@/utils/escape-cancels-edit';

import ImageEditorModal from './image-editor-modal';

installPointerCaptureShims();

const IMAGE_URL = 'https://files.localhost/download/photo.png';

/**
 * The canvas editor cannot mount in jsdom, so this file holds the modal on its loading branch
 * with a request that never settles. That branch still renders the same `DialogContent`, which
 * is where `onEscapeKeyDown` lives — the one line the field-level tests in
 * `components/intensity-control` and `components/crop` cannot cover, because their harnesses
 * supply that prop themselves.
 */
const renderModal = () => {
    server.use(
        http.get(IMAGE_URL, async () => {
            await delay('infinite');

            return new Response();
        }),
    );

    const onClose = vi.fn();

    const view = renderWithProviders(
        <ImageEditorModal imageUrl={IMAGE_URL} imageName="photo" isOpen onClose={onClose} />,
    );

    return { ...view, onClose };
};

// The real fields that carry this mark are inside the canvas editor, which cannot mount here.
const appendFieldMidEdit = () => {
    const input = document.createElement('input');

    Object.entries(ESCAPE_CANCELS_EDIT_PROPS).forEach(([name, value]) => input.setAttribute(name, value));
    screen.getByRole('dialog').appendChild(input);
    input.focus();

    return input;
};

describe('ImageEditorModal', () => {
    it('shows the loading state while the image is being fetched', () => {
        renderModal();

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('defers to a field that is cancelling its own edit with Escape', () => {
        const { onClose } = renderModal();
        const input = appendFieldMidEdit();

        fireEvent.keyDown(input, { key: 'Escape' });

        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('stays open while a held Escape auto-repeats onto the body', () => {
        const { onClose } = renderModal();

        fireEvent.keyDown(document.body, { key: 'Escape', repeat: true });

        expect(onClose).not.toHaveBeenCalled();
    });

    it('closes on Escape when no field is mid-edit', () => {
        const { onClose } = renderModal();

        fireEvent.keyDown(document.body, { key: 'Escape' });

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
