import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UploadFilesProvider } from '@/context';
import { installGalleryDomShims, installPointerCaptureShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { makeGalleryFile } from '@/test/fixtures/gallery';
import { envelope, getJson, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import { LightboxMediaFileId } from './lightbox-media';

installGalleryDomShims();
installPointerCaptureShims();
installScrollIntoViewShim();

const Harness = ({ fileId }: { fileId: string }) => (
    <UploadFilesProvider>
        <LightboxMediaFileId
            fileId={fileId}
            isOpen
            onClose={() => {}}
            fileInputRef={{ current: null }}
            onChangeFile={() => {}}
            renderFiles={() => null}
            fileInputDisabled={false}
        />
    </UploadFilesProvider>
);

const flushPending = async (ms = 60) => {
    await act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    });
};

describe('LightboxMediaFileId', () => {
    it('renders the fetched file title', async () => {
        server.use(getJson('/files/file-a', makeGalleryFile({ _id: 'file-a', title: 'Alpha study' })));
        renderWithProviders(<Harness fileId="file-a" />);

        expect(await screen.findByText('Alpha study')).toBeInTheDocument();
    });

    it('renders the not-found state when the request fails', async () => {
        server.use(respond('get', '/files/file-a', () => httpError(404)));
        renderWithProviders(<Harness fileId="file-a" />);

        expect(await screen.findByText('Image not found')).toBeInTheDocument();
    });

    it('keeps the newest file when a slower earlier request resolves last', async () => {
        let releaseSlowRequest = () => {};
        const slowRequestReleased = new Promise<void>((resolve) => {
            releaseSlowRequest = resolve;
        });

        server.use(
            respond('get', '/files/file-a', async () => {
                await slowRequestReleased;

                return envelope(makeGalleryFile({ _id: 'file-a', title: 'Alpha study' }));
            }),
            getJson('/files/file-b', makeGalleryFile({ _id: 'file-b', title: 'Bravo study' })),
        );

        const { rerender } = renderWithProviders(<Harness fileId="file-a" />);

        rerender(<Harness fileId="file-b" />);

        expect(await screen.findByText('Bravo study')).toBeInTheDocument();

        releaseSlowRequest();
        await flushPending();

        expect(screen.getByText('Bravo study')).toBeInTheDocument();
        expect(screen.queryByText('Alpha study')).not.toBeInTheDocument();
        expect(screen.queryByText('Image not found')).not.toBeInTheDocument();
    });
});
