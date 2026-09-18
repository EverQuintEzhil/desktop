import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';
import type { GeneratedItem } from '@/types/gallery';

import { showGenerationReadyToast } from './show-generation-ready-toast';

installPointerCaptureShims();

const item = (overrides: Record<string, unknown> = {}): GeneratedItem =>
    ({
        _id: 'file-1',
        uniqueId: 'file-1',
        url: 'https://api.localhost/files/file-1/raw',
        title: 'A cat on a bicycle',
        ...overrides,
    }) as unknown as GeneratedItem;

const renderToaster = () => renderWithProviders(<Toaster />);

describe('showGenerationReadyToast', () => {
    afterEach(() => {
        toast.dismiss();
    });

    it('renders the image title and the ready line', async () => {
        renderToaster();
        showGenerationReadyToast({ file: item(), isVideo: false, onView: vi.fn() });

        expect(await screen.findByText('Image Generation')).toBeInTheDocument();
        expect(screen.getByText(/Ready · Click to view/)).toBeInTheDocument();
    });

    it('titles a video generation differently', async () => {
        renderToaster();
        showGenerationReadyToast({ file: item(), isVideo: true, onView: vi.fn() });

        expect(await screen.findByText('Video Generation')).toBeInTheDocument();
        expect(screen.queryByText('Image Generation')).not.toBeInTheDocument();
    });

    it('requests the thumbnail variant of the file url and labels it with the title', async () => {
        renderToaster();
        showGenerationReadyToast({ file: item(), isVideo: false, onView: vi.fn() });

        const image = await screen.findByAltText('A cat on a bicycle');

        expect(image).toHaveAttribute('src', 'https://api.localhost/files/file-1/raw?thumbnail=true');
    });

    it('falls back to the generation title when the file has no title', async () => {
        renderToaster();
        showGenerationReadyToast({ file: item({ title: '' }), isVideo: true, onView: vi.fn() });

        expect(await screen.findByAltText('Video Generation')).toBeInTheDocument();
    });

    it('calls onView and dismisses the toast when the body is clicked', async () => {
        const user = userEvent.setup();
        const onView = vi.fn();

        renderToaster();
        showGenerationReadyToast({ file: item(), isVideo: false, onView });

        await user.click(await screen.findByRole('button', { name: /Image Generation/ }));

        expect(onView).toHaveBeenCalledTimes(1);
        await vi.waitFor(() => {
            expect(screen.queryByText('Image Generation')).not.toBeInTheDocument();
        });
    });

    it('activates from the keyboard with Enter and with Space', async () => {
        const user = userEvent.setup();
        const onView = vi.fn();

        renderToaster();
        showGenerationReadyToast({ file: item(), isVideo: false, onView });

        const body = await screen.findByRole('button', { name: /Image Generation/ });

        body.focus();
        await user.keyboard('{Enter}');
        expect(onView).toHaveBeenCalledTimes(1);

        renderToaster();
        showGenerationReadyToast({ file: item(), isVideo: false, onView });

        const secondBody = (await screen.findAllByRole('button', { name: /Image Generation/ }))[0];

        secondBody.focus();
        await user.keyboard(' ');
        expect(onView).toHaveBeenCalledTimes(2);
    });

    it('dismisses without viewing when the close affordance is used', async () => {
        const user = userEvent.setup();
        const onView = vi.fn();

        renderToaster();
        showGenerationReadyToast({ file: item(), isVideo: false, onView });

        await user.click(await screen.findByRole('button', { name: 'Close toast' }));

        expect(onView).not.toHaveBeenCalled();
        await vi.waitFor(() => {
            expect(screen.queryByText('Image Generation')).not.toBeInTheDocument();
        });
    });
});
