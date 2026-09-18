import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadFilesProvider, useUploadFilesContext } from '@/context';
import { installPointerCaptureShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { authenticatedUser } from '@/test/fixtures/auth';
import { apiUrl, envelope, failureEnvelope, filesUrl, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ModelValueType } from '@/types/admin';
import type { FileType } from '@/types/chat';
import type { GeneratedItem } from '@/types/gallery';
import type { Role } from '@/types/store';
import type { GalleryAgentUiType, UiUsageConfigType } from '@/types/ui';

import { useLightboxMediaActions, type UseLightboxMediaActionsOptions } from './use-lightbox-media-actions';

installPointerCaptureShims();
installScrollIntoViewShim();

type Api = ReturnType<typeof useLightboxMediaActions>;

let api: Api;

const makeItem = (overrides: Partial<GeneratedItem> = {}): GeneratedItem => ({
    _id: 'file-1',
    is_deleted: false,
    created_at: 1735689600000,
    updated_at: 1735689600000,
    title: 'Generated media',
    meta: {
        aspect_ratio: 1,
        bitrate: 0,
        created: 0,
        dpi: 0,
        duration: 0,
        height: 512,
        modified: 0,
        size: 1024,
        width: 512,
    },
    ai: {
        model_id: 'model-1',
        model_name: 'Imagen 3',
        model_provider: 'google',
        arguments: { prompt: 'a red balloon', options: { aspectRatio: '1:1' } },
    },
    url: 'https://files.localhost/download/file-1',
    creator_name: 'Ada Lovelace',
    creator_id: 'user-1',
    extension: 'png',
    likes: [],
    likes_count: 3,
    is_public: false,
    ...overrides,
});

const makeUsageItem = () =>
    makeItem({
        ai: {
            model_id: 'model-1',
            model_name: 'Imagen 3',
            model_provider: 'google',
            arguments: { prompt: 'a red balloon' },
            usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
        },
    });

const galleryUiConfig = (usage?: UiUsageConfigType): GalleryAgentUiType => ({
    componentType: 'gallery',
    type: 'image',
    usage,
});

interface ProbeProps {
    options: UseLightboxMediaActionsOptions;
    isMyItem?: boolean;
}

const Probe = ({ options, isMyItem = true }: ProbeProps) => {
    api = useLightboxMediaActions(options);

    return (
        <div>
            {api.renderLightboxHeader({ isMyItem })}
            {api.renderConfirmationModal()}
            {api.renderRelatedFilesThumbnails()}
            {api.renderRelatedFilesCarousel()}
        </div>
    );
};

const renderLightbox = (
    overrides: Partial<UseLightboxMediaActionsOptions> = {},
    probeProps: Omit<ProbeProps, 'options'> = {},
    role: NonNullable<Role> = 'user',
) => {
    const options: UseLightboxMediaActionsOptions = {
        isOpen: true,
        isVideo: false,
        currentItem: makeItem(),
        downloadName: 'my-image',
        agentId: 'agent-1',
        onClose: vi.fn(),
        onChangeFile: () => {},
        renderFiles: () => null,
        fileInputDisabled: false,
        ...overrides,
    };

    const view = renderWithProviders(
        <UploadFilesProvider>
            <Toaster />
            <Probe options={options} {...probeProps} />
        </UploadFilesProvider>,
        { preloadedState: { user: { ...authenticatedUser, role } } },
    );

    return { ...view, options };
};

/** Icon-only buttons in the header carry no accessible name — see Findings. */
const headerButtons = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('.lightbox-button-group button'));

const openEllipsisMenu = async (container: HTMLElement) => {
    const buttons = headerButtons(container);
    const trigger = buttons.find((button) => button.getAttribute('aria-haspopup') === 'dialog');

    fireEvent.click(trigger as HTMLButtonElement);

    return screen.findByRole('menu');
};

const menuItemLabels = (menu: HTMLElement) =>
    within(menu)
        .getAllByRole('menuitem')
        .map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim());

let uploadFilesState: FileType[] = [];
let uploadFilesActions: ReturnType<typeof useUploadFilesContext>['actions'];

const ContextFilesProbe = () => {
    const { state, actions } = useUploadFilesContext();

    uploadFilesState = state.files;
    uploadFilesActions = actions;

    return null;
};

const baseLightboxOptions = (
    overrides: Partial<UseLightboxMediaActionsOptions> = {},
): UseLightboxMediaActionsOptions => ({
    isOpen: true,
    isVideo: false,
    currentItem: makeItem(),
    onClose: () => {},
    onChangeFile: () => {},
    renderFiles: () => null,
    fileInputDisabled: false,
    ...overrides,
});

describe('useLightboxMediaActions', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('public visibility toggle', () => {
        it('flips optimistically before the write lands and clears the loading flag after', async () => {
            let release = () => {};
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });

            server.use(
                http.put(apiUrl('/files/file-1'), async () => {
                    await gate;

                    return envelope({ _id: 'file-1' });
                }),
            );

            renderLightbox();

            let pending: Promise<void> = Promise.resolve();

            act(() => {
                pending = api.handlePublicChange(true);
            });

            await waitFor(() => expect(api.isPublic).toBe(true));
            expect(api.isPublicLoading).toBe(true);

            release();
            await act(async () => {
                await pending;
            });

            expect(api.isPublicLoading).toBe(false);
        });

        it('sends the isPublic body and reports the updated item back', async () => {
            const bodies: unknown[] = [];

            server.use(
                http.put(apiUrl('/files/file-1'), async ({ request }) => {
                    bodies.push(await request.json());

                    return envelope({ _id: 'file-1' });
                }),
            );

            const onItemChange = vi.fn();

            renderLightbox({ onItemChange });

            await act(async () => {
                await api.handlePublicChange(true);
            });

            expect(bodies).toEqual([{ isPublic: true }]);
            expect(onItemChange).toHaveBeenCalledTimes(1);
            expect(onItemChange.mock.calls[0][0]).toMatchObject({ _id: 'file-1', is_public: true });
        });

        it('rolls the flag back and toasts when the write 500s', async () => {
            server.use(respond('put', '/files/file-1', () => httpError(500)));

            const onItemChange = vi.fn();

            renderLightbox({ onItemChange });

            await act(async () => {
                await api.handlePublicChange(true);
            });

            expect(api.isPublic).toBe(false);
            expect(onItemChange).not.toHaveBeenCalled();
            expect(await screen.findByText('Failed to update public status')).toBeInTheDocument();
        });

        it('rolls the flag back on a success:false envelope', async () => {
            server.use(respond('put', '/files/file-1', () => failureEnvelope('nope')));

            renderLightbox();

            await act(async () => {
                await api.handlePublicChange(true);
            });

            expect(api.isPublic).toBe(false);
            expect(await screen.findByText('Failed to update public status')).toBeInTheDocument();
        });

        it('recovers on a retry after a failed write', async () => {
            server.use(respond('put', '/files/file-1', () => httpError(500)));

            renderLightbox();

            await act(async () => {
                await api.handlePublicChange(true);
            });
            expect(api.isPublic).toBe(false);

            server.use(respond('put', '/files/file-1', () => envelope({ _id: 'file-1' })));

            await act(async () => {
                await api.handlePublicChange(true);
            });

            expect(api.isPublic).toBe(true);
        });

        it('writes through the Private/Public switch in the header', async () => {
            const bodies: unknown[] = [];

            server.use(
                http.put(apiUrl('/files/file-1'), async ({ request }) => {
                    bodies.push(await request.json());

                    return envelope({ _id: 'file-1' });
                }),
            );

            renderLightbox();

            fireEvent.click(screen.getByLabelText('Public'));

            await waitFor(() => expect(bodies).toEqual([{ isPublic: true }]));
        });
    });

    describe('like', () => {
        it('merges the new like counts onto the current item', () => {
            const onLikeItemClicked = vi.fn();

            renderLightbox({ onLikeItemClicked });

            act(() => {
                api.handleLikeItemClicked(5, true);
            });

            expect(onLikeItemClicked).toHaveBeenCalledTimes(1);
            expect(onLikeItemClicked.mock.calls[0][0]).toMatchObject({
                _id: 'file-1',
                likes_count: 5,
                isLikedByThisUser: true,
            });
        });
    });

    describe('remix', () => {
        it('hands the prompt and item straight to onRemix when nothing was drawn', async () => {
            const onRemix = vi.fn();
            const onClose = vi.fn();
            const setShowRemixInput = vi.fn();

            renderLightbox({
                onRemix,
                onClose,
                controlledShowRemixInput: true,
                controlledSetShowRemixInput: setShowRemixInput,
                isVideo: true,
            });

            await act(async () => {
                await api.handleRemix({ stopPropagation: () => {} } as React.FormEvent, 'make it blue');
            });

            expect(onRemix).toHaveBeenCalledWith('make it blue', expect.objectContaining({ _id: 'file-1' }));
            expect(setShowRemixInput).toHaveBeenCalledWith(false);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does nothing when no onRemix handler was supplied', async () => {
            const onClose = vi.fn();

            renderLightbox({ onClose });

            await act(async () => {
                await api.handleRemix({ stopPropagation: () => {} } as React.FormEvent, 'make it blue');
            });

            expect(onClose).not.toHaveBeenCalled();
        });

        it('applies the item parameters as defaults while remix is open and resets them on close', async () => {
            const setDefaultParameters = vi.fn();
            const resetDefaultParameters = vi.fn();
            const item = makeItem();

            const Harness = ({ open }: { open: boolean }) => {
                api = useLightboxMediaActions({
                    isOpen: true,
                    isVideo: true,
                    currentItem: item,
                    onClose: () => {},
                    onChangeFile: () => {},
                    renderFiles: () => null,
                    fileInputDisabled: false,
                    controlledShowRemixInput: open,
                    controlledSetShowRemixInput: () => {},
                    setDefaultParameters,
                    resetDefaultParameters,
                });

                return <div />;
            };

            const { rerender } = renderWithProviders(
                <UploadFilesProvider>
                    <Harness open={false} />
                </UploadFilesProvider>,
            );

            expect(setDefaultParameters).not.toHaveBeenCalled();

            rerender(
                <UploadFilesProvider>
                    <Harness open />
                </UploadFilesProvider>,
            );

            expect(setDefaultParameters).toHaveBeenCalledWith({ aspectRatio: '1:1' }, 'model-1');
            expect(resetDefaultParameters).not.toHaveBeenCalled();

            rerender(
                <UploadFilesProvider>
                    <Harness open={false} />
                </UploadFilesProvider>,
            );

            expect(resetDefaultParameters).toHaveBeenCalledTimes(1);
        });
    });

    describe('download', () => {
        it('opens the crop/export modal for an image', () => {
            renderLightbox();

            act(() => {
                api.handleDownloadClicked({ stopPropagation: () => {} } as React.MouseEvent);
            });

            expect(api.showCropExportModal).toBe(true);
        });

        it('is inert while the remix input is open', () => {
            const setShowCropExportModal = vi.fn();

            renderLightbox({
                isVideo: true,
                controlledShowRemixInput: true,
                controlledSetShowRemixInput: () => {},
                controlledShowCropExportModal: false,
                controlledSetShowCropExportModal: setShowCropExportModal,
            });

            act(() => {
                api.handleDownloadClicked({ stopPropagation: () => {} } as React.MouseEvent);
            });

            expect(setShowCropExportModal).not.toHaveBeenCalled();
        });

        it('downloads the blob directly for a video', async () => {
            const createObjectURL = vi.fn(() => 'blob:video');
            const revokeObjectURL = vi.fn();

            Object.defineProperty(window.URL, 'createObjectURL', { configurable: true, value: createObjectURL });
            Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

            const requested: string[] = [];

            server.use(
                http.get(filesUrl('/download/file-1'), ({ request }) => {
                    requested.push(request.url);

                    return new Response('video-bytes');
                }),
            );

            renderLightbox({ isVideo: true, downloadName: 'clip' });

            act(() => {
                api.handleDownloadClicked({ stopPropagation: () => {} } as React.MouseEvent);
            });

            await waitFor(() => expect(requested).toEqual(['https://files.localhost/download/file-1']));
            expect(await screen.findByText('Video downloaded')).toBeInTheDocument();
        });
    });

    describe('escape precedence', () => {
        it('closes the lightbox when nothing else is open', () => {
            const onClose = vi.fn();

            renderLightbox({ onClose });

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('ignores keys other than Escape', () => {
            const onClose = vi.fn();

            renderLightbox({ onClose });

            fireEvent.keyDown(document, { key: 'Enter' });
            expect(onClose).not.toHaveBeenCalled();

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('leaves the lightbox open when escapeClosesLightbox is false', () => {
            const onClose = vi.fn();
            const { container } = renderLightbox({ onClose, escapeClosesLightbox: false });

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).not.toHaveBeenCalled();

            const buttons = headerButtons(container);

            fireEvent.click(buttons[buttons.length - 1]);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('closes the remix input first, leaving the lightbox open', () => {
            const onClose = vi.fn();
            const setShowRemixInput = vi.fn();

            renderLightbox({
                onClose,
                isVideo: true,
                controlledShowRemixInput: true,
                controlledSetShowRemixInput: setShowRemixInput,
            });

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(setShowRemixInput).toHaveBeenCalledWith(false);
            expect(onClose).not.toHaveBeenCalled();
        });

        it('closes the related-files carousel before anything else', async () => {
            server.use(
                respond('get', '/files/rel-1', () =>
                    envelope({ title: 'Reference', url: 'https://files.localhost/download/rel-1' }),
                ),
            );

            const onClose = vi.fn();

            renderLightbox({ onClose, relatedFileIds: ['rel-1'] });

            const thumbnail = await screen.findByRole('button', { name: 'Reference' });

            fireEvent.click(thumbnail);
            expect(await screen.findByRole('button', { name: 'Close preview' })).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Escape' });

            await waitFor(() =>
                expect(screen.queryByRole('button', { name: 'Close preview' })).not.toBeInTheDocument(),
            );
            expect(onClose).not.toHaveBeenCalled();

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('is swallowed entirely while the AI usage dialog is open', async () => {
            const onClose = vi.fn();
            const item = makeItem({
                ai: {
                    model_id: 'model-1',
                    model_name: 'Imagen 3',
                    model_provider: 'google',
                    arguments: { prompt: 'a red balloon' },
                    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
                },
            });

            const { container } = renderLightbox({ onClose, currentItem: item });

            const menu = await openEllipsisMenu(container);

            fireEvent.click(within(menu).getByText('AI Usage'));

            expect(await screen.findByRole('dialog')).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).not.toHaveBeenCalled();

            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('opens the AI usage dialog from the header pill and closes it before the lightbox', async () => {
            const onClose = vi.fn();
            const item = makeItem({
                ai: {
                    model_id: 'model-1',
                    model_name: 'Imagen 3',
                    model_provider: 'google',
                    arguments: { prompt: 'a red balloon' },
                    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
                },
            });

            renderLightbox({ onClose, currentItem: item });

            const pill = screen.getByRole('button', { name: 'View AI Usage (30 tokens)' });

            fireEvent.click(pill);
            expect(await screen.findByRole('dialog')).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).not.toHaveBeenCalled();

            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not listen while the lightbox is closed', () => {
            const onClose = vi.fn();
            const item = makeItem();

            const Harness = ({ isOpen }: { isOpen: boolean }) => {
                api = useLightboxMediaActions({
                    isOpen,
                    isVideo: false,
                    currentItem: item,
                    onClose,
                    onChangeFile: () => {},
                    renderFiles: () => null,
                    fileInputDisabled: false,
                });

                return <div />;
            };

            const { rerender } = renderWithProviders(
                <UploadFilesProvider>
                    <Harness isOpen={false} />
                </UploadFilesProvider>,
            );

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).not.toHaveBeenCalled();

            rerender(
                <UploadFilesProvider>
                    <Harness isOpen />
                </UploadFilesProvider>,
            );

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('delete', () => {
        it('confirms, reports the remaining items and closes', async () => {
            const remaining = [makeItem({ _id: 'file-2' })];
            const onDeleteItemAsyncClicked = vi.fn().mockResolvedValue(remaining);
            const onAfterDelete = vi.fn();

            renderLightbox({ onDeleteItemAsyncClicked, onAfterDelete });

            act(() => {
                api.onDeleteClicked(makeItem());
            });

            expect(await screen.findByText('Are you sure you want to delete?')).toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

            expect(onDeleteItemAsyncClicked).toHaveBeenCalledTimes(1);
            await waitFor(() => expect(onAfterDelete).toHaveBeenCalledWith(remaining));
            await waitFor(() => expect(screen.queryByText('Are you sure you want to delete?')).not.toBeInTheDocument());
        });

        it('keeps the confirmation open when the delete rejects', async () => {
            const onDeleteItemAsyncClicked = vi.fn().mockRejectedValue(new Error('boom'));
            const onAfterDelete = vi.fn();

            renderLightbox({ onDeleteItemAsyncClicked, onAfterDelete });

            act(() => {
                api.onDeleteClicked(makeItem());
            });

            await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

            await waitFor(() => expect(onDeleteItemAsyncClicked).toHaveBeenCalledTimes(1));
            expect(onAfterDelete).not.toHaveBeenCalled();
            expect(screen.getByText('Are you sure you want to delete?')).toBeInTheDocument();
        });

        it('cancels without calling the handler', async () => {
            const onDeleteItemAsyncClicked = vi.fn().mockResolvedValue([]);

            renderLightbox({ onDeleteItemAsyncClicked });

            act(() => {
                api.onDeleteClicked(makeItem());
            });

            await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

            await waitFor(() => expect(screen.queryByText('Are you sure you want to delete?')).not.toBeInTheDocument());
            expect(onDeleteItemAsyncClicked).not.toHaveBeenCalled();
        });

        it('opens no confirmation when there is no delete handler', () => {
            renderLightbox();

            act(() => {
                api.onDeleteClicked(makeItem());
            });

            expect(screen.queryByText('Are you sure you want to delete?')).not.toBeInTheDocument();
        });
    });

    describe('header', () => {
        it('renders the creator, model name and formatted date', () => {
            renderLightbox();

            expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
            expect(screen.getByText('Imagen 3')).toBeInTheDocument();
            expect(screen.getByText('Jan 01, 2025')).toBeInTheDocument();
        });

        it('drops the model name when the item has none', () => {
            const item = makeItem({
                ai: {
                    model_id: 'model-1',
                    model_name: '',
                    model_provider: 'google',
                    arguments: { prompt: 'p' },
                },
            });

            renderLightbox({ currentItem: item });

            expect(screen.queryByText('Imagen 3')).not.toBeInTheDocument();
        });

        it("hides the visibility switch and delete button for someone else's item", () => {
            renderLightbox({ onDeleteItemAsyncClicked: vi.fn() }, { isMyItem: false });

            expect(screen.queryByLabelText('Public')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Private')).not.toBeInTheDocument();
        });

        it('drops every media action while the item is still running', () => {
            const { container } = renderLightbox({
                currentItem: makeItem({ isRunning: true }),
                onDeleteItemAsyncClicked: vi.fn(),
                onLikeItemClicked: vi.fn(),
            });

            expect(screen.queryByLabelText('Public')).not.toBeInTheDocument();
            // Only the ellipsis trigger and the close button remain.
            expect(headerButtons(container)).toHaveLength(2);
        });

        it('omits the close button when showCloseButton is false', () => {
            const withClose = renderLightbox();

            expect(withClose.container.querySelector('.lightbox-button-group .lucide-x')).not.toBeNull();
            withClose.unmount();

            const { container } = renderLightbox({ showCloseButton: false });

            expect(container.querySelector('.lightbox-button-group .lucide-x')).toBeNull();
        });

        it('renders the caller-supplied header-left slot and the comparison tabs', () => {
            renderLightbox({
                renderHeaderLeft: () => <span>Header slot</span>,
                showComparisonTabs: true,
                activeTab: 'edited',
                onActiveTabChange: vi.fn(),
            });

            expect(screen.getByText('Header slot')).toBeInTheDocument();
            expect(screen.getByLabelText('Compare')).toBeInTheDocument();
            expect(screen.getByLabelText('Original')).toBeInTheDocument();
        });

        it('reports the tab the user picked', async () => {
            const onActiveTabChange = vi.fn();

            renderLightbox({
                showComparisonTabs: true,
                activeTab: 'comparison',
                onActiveTabChange,
            });

            fireEvent.click(screen.getByLabelText('Original'));

            await waitFor(() => expect(onActiveTabChange).toHaveBeenCalledWith('original'));
        });
    });

    describe('ellipsis menu', () => {
        it('offers the image actions and the three export formats', async () => {
            const { container } = renderLightbox({ onDeleteItemAsyncClicked: vi.fn() });

            const menu = await openEllipsisMenu(container);

            expect(menuItemLabels(menu)).toEqual([
                'Crop Image',
                'Delete',
                'Copy',
                'Copy Link',
                'Export as JPEG',
                'Export as PNG',
                'Export as WEBP',
            ]);
        });

        it('drops the copy and export entries for a video', async () => {
            const { container } = renderLightbox({ isVideo: true });

            const menu = await openEllipsisMenu(container);

            expect(within(menu).queryByText('Copy')).not.toBeInTheDocument();
            expect(within(menu).queryByText('Export as')).not.toBeInTheDocument();
            expect(within(menu).getByText('Copy Link')).toBeInTheDocument();
            expect(within(menu).getByText('Download')).toBeInTheDocument();
            expect(within(menu).queryByText('Crop Image')).not.toBeInTheDocument();
        });

        it('copies a share link built from the current path', async () => {
            const user = userEvent.setup();
            const writeText = vi.fn().mockResolvedValue(undefined);

            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

            const { container } = renderLightbox();
            const menu = await openEllipsisMenu(container);

            fireEvent.click(within(menu).getByText('Copy Link'));

            expect(writeText).toHaveBeenCalledWith('http://localhost:3000/file-1');
            expect(await screen.findByText('Link copied to clipboard')).toBeInTheDocument();
            await user.keyboard('{Escape}');
        });

        it('opens the crop modal from the menu', async () => {
            const { container } = renderLightbox();
            const menu = await openEllipsisMenu(container);

            fireEvent.click(within(menu).getByText('Crop Image'));

            await waitFor(() => expect(api.showCropExportModal).toBe(true));
        });

        it('opens the delete confirmation from the menu', async () => {
            const { container } = renderLightbox({ onDeleteItemAsyncClicked: vi.fn() });
            const menu = await openEllipsisMenu(container);

            fireEvent.click(within(menu).getByText('Delete'));

            expect(await screen.findByText('Are you sure you want to delete?')).toBeInTheDocument();
        });

        it('hides the AI usage entry when the item carries no usage', async () => {
            const { container } = renderLightbox();
            const menu = await openEllipsisMenu(container);

            expect(within(menu).queryByText('AI Usage')).not.toBeInTheDocument();
        });
    });

    describe('usage visibility', () => {
        it('shows the pill, the menu entry and the dialog when the agent has no usage config', async () => {
            const { container } = renderLightbox({ currentItem: makeUsageItem() });

            expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'View AI Usage (30 tokens)' })).toBeInTheDocument();

            const menu = await openEllipsisMenu(container);

            expect(within(menu).getByText('AI Usage')).toBeInTheDocument();
        });

        it('hides every usage surface when the agent hides usage for everyone', async () => {
            const { container } = renderLightbox({
                currentItem: makeUsageItem(),
                agentUiConfig: galleryUiConfig({ hidden: true }),
            });

            expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'View AI Usage (30 tokens)' })).not.toBeInTheDocument();

            const menu = await openEllipsisMenu(container);

            expect(within(menu).getByText('Copy Link')).toBeInTheDocument();
            expect(within(menu).queryByText('AI Usage')).not.toBeInTheDocument();
            expect(screen.queryByText('AI Usage Estimate')).not.toBeInTheDocument();
        });

        it('hides every usage surface when the viewer role is not listed', async () => {
            const { container } = renderLightbox({
                currentItem: makeUsageItem(),
                agentUiConfig: galleryUiConfig({ visibleToRoles: ['admin'] }),
            });

            expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'View AI Usage (30 tokens)' })).not.toBeInTheDocument();

            const menu = await openEllipsisMenu(container);

            expect(within(menu).getByText('Copy Link')).toBeInTheDocument();
            expect(within(menu).queryByText('AI Usage')).not.toBeInTheDocument();
        });

        it('keeps the usage surfaces for a role that is listed', async () => {
            const { container } = renderLightbox(
                { currentItem: makeUsageItem(), agentUiConfig: galleryUiConfig({ visibleToRoles: ['admin'] }) },
                {},
                'admin',
            );

            const pill = screen.getByRole('button', { name: 'View AI Usage (30 tokens)' });

            fireEvent.click(pill);
            expect(await screen.findByRole('dialog')).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Escape' });
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

            const menu = await openEllipsisMenu(container);

            expect(within(menu).getByText('AI Usage')).toBeInTheDocument();
        });

        it('lets escape close the lightbox while usage is hidden', async () => {
            const onClose = vi.fn();

            renderLightbox({
                onClose,
                currentItem: makeUsageItem(),
                agentUiConfig: galleryUiConfig({ hidden: true }),
            });

            expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
            expect(api.tokenUsageOpen).toBe(false);

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('related files', () => {
        it('shows one skeleton per id and then the fetched thumbnails, filtering out the mask', async () => {
            server.use(
                respond('get', '/files/rel-1', () =>
                    envelope({ ai: { prompt: 'A reference photo' }, url: 'https://files.localhost/download/rel-1' }),
                ),
            );
            server.use(respond('get', '/files/rel-2', () => envelope({ title: 'mask.png' })));

            const { container } = renderLightbox({ relatedFileIds: ['rel-1', 'rel-2'] });

            expect(container.querySelectorAll('.related-file-thumbnail--skeleton')).toHaveLength(2);

            expect(await screen.findByRole('button', { name: 'A reference photo' })).toBeInTheDocument();
            expect(container.querySelectorAll('.related-file-thumbnail--skeleton')).toHaveLength(0);
            expect(screen.getAllByRole('button', { name: /reference photo|mask/ })).toHaveLength(1);
        });

        it('falls back to the download url and the "video" name when the payload has neither', async () => {
            server.use(respond('get', '/files/rel-1', () => envelope({})));

            renderLightbox({ relatedFileIds: ['rel-1'] });

            const thumbnail = await screen.findByRole('button', { name: 'video' });

            expect(within(thumbnail).getByAltText('video')).toHaveAttribute(
                'src',
                'https://files.localhost/download/rel-1',
            );
        });

        it('renders nothing when there are no related ids', () => {
            const { container } = renderLightbox();

            expect(container.querySelector('.related-files-thumbnails')).toBeNull();
        });

        it('keeps the files that resolved when one related id fails', async () => {
            server.use(
                respond('get', '/files/rel-1', () =>
                    envelope({ title: 'Survivor', url: 'https://files.localhost/download/rel-1' }),
                ),
            );
            server.use(respond('get', '/files/rel-2', () => httpError(404, 'Gone')));

            const { container } = renderLightbox({ relatedFileIds: ['rel-1', 'rel-2'] });

            expect(await screen.findByRole('button', { name: 'Survivor' })).toBeInTheDocument();
            await waitFor(() =>
                expect(container.querySelectorAll('.related-file-thumbnail--skeleton')).toHaveLength(0),
            );
        });

        it('clears the loading skeletons when every related id fails', async () => {
            server.use(respond('get', '/files/rel-1', () => httpError(500, 'Boom')));

            const { container } = renderLightbox({ relatedFileIds: ['rel-1'] });

            expect(container.querySelectorAll('.related-file-thumbnail--skeleton')).toHaveLength(1);
            await waitFor(() =>
                expect(container.querySelectorAll('.related-file-thumbnail--skeleton')).toHaveLength(0),
            );
        });

        it('stages both related files in the composer under distinct tempIds', async () => {
            server.use(
                respond('get', '/files/rel-1', () =>
                    envelope({ title: 'One', url: 'https://files.localhost/download/rel-1' }),
                ),
            );
            server.use(
                respond('get', '/files/rel-2', () =>
                    envelope({ title: 'Two', url: 'https://files.localhost/download/rel-2' }),
                ),
            );

            renderWithProviders(
                <UploadFilesProvider>
                    <ContextFilesProbe />
                    <Probe
                        options={baseLightboxOptions({
                            relatedFileIds: ['rel-1', 'rel-2'],
                            controlledShowEditPromptModal: true,
                            controlledSetShowEditPromptModal: () => {},
                        })}
                    />
                </UploadFilesProvider>,
            );

            await waitFor(() => expect(uploadFilesState).toHaveLength(2));
            // A shared tempId makes the composer treat two files as one, silently dropping an upload.
            expect(new Set(uploadFilesState.map((file) => file.tempId)).size).toBe(2);
        });

        it('opens the carousel from the keyboard', async () => {
            server.use(
                respond('get', '/files/rel-1', () =>
                    envelope({ title: 'Reference', url: 'https://files.localhost/download/rel-1' }),
                ),
            );

            renderLightbox({ relatedFileIds: ['rel-1'] });

            const thumbnail = await screen.findByRole('button', { name: 'Reference' });

            fireEvent.keyDown(thumbnail, { key: 'Enter' });

            expect(await screen.findByRole('button', { name: 'Close preview' })).toBeInTheDocument();
            expect(api.relatedCarouselOpen).toBe(true);
        });
    });

    describe('edit-prompt modal state', () => {
        it('seeds the prompt and pushes the item options back as defaults', () => {
            const setDefaultParameters = vi.fn();

            renderLightbox({ setDefaultParameters });

            act(() => {
                api.openEditPromptModal();
            });

            expect(api.editPromptValue).toBe('a red balloon');
            expect(api.showEditPromptModal).toBe(true);
            expect(setDefaultParameters).toHaveBeenCalledWith({ aspectRatio: '1:1' }, 'model-1');
        });

        it('warns when the related images exceed the model upload limit', async () => {
            server.use(
                respond('get', '/files/rel-1', () =>
                    envelope({ title: 'One', url: 'https://files.localhost/download/rel-1' }),
                ),
            );
            server.use(
                respond('get', '/files/rel-2', () =>
                    envelope({ title: 'Two', url: 'https://files.localhost/download/rel-2' }),
                ),
            );

            const selectedModel = {
                name: 'Imagen',
                modelId: 'model-1',
                options: { maxImageUploads: 1 },
            } as unknown as ModelValueType;

            renderLightbox({
                relatedFileIds: ['rel-1', 'rel-2'],
                selectedModel,
                controlledShowEditPromptModal: true,
                controlledSetShowEditPromptModal: () => {},
            });

            expect(await screen.findByText('This model supports up to 1 uploaded image.')).toBeInTheDocument();
        });
    });

    describe('composer files on mount/close', () => {
        it('leaves files already staged in the composer untouched when the lightbox mounts with the modal closed', () => {
            const stagedFiles: FileType[] = [
                {
                    name: 'staged.png',
                    type: 'image',
                    url: 'blob:staged-1',
                    tempId: 'temp-staged-1',
                    isUploading: false,
                },
            ];

            const { rerender } = renderWithProviders(
                <UploadFilesProvider>
                    <ContextFilesProbe />
                </UploadFilesProvider>,
            );

            act(() => {
                uploadFilesActions.setFiles(stagedFiles);
            });

            expect(uploadFilesState).toEqual(stagedFiles);

            rerender(
                <UploadFilesProvider>
                    <ContextFilesProbe />
                    <Probe options={baseLightboxOptions()} />
                </UploadFilesProvider>,
            );

            expect(uploadFilesState).toEqual(stagedFiles);
        });

        it("clears the composer only on the modal's true-to-false closing edge", async () => {
            server.use(
                respond('get', '/files/rel-1', () =>
                    envelope({ title: 'Reference', url: 'https://files.localhost/download/rel-1' }),
                ),
            );

            const options = baseLightboxOptions({
                relatedFileIds: ['rel-1'],
                controlledSetShowEditPromptModal: () => {},
            });

            const { rerender } = renderWithProviders(
                <UploadFilesProvider>
                    <ContextFilesProbe />
                    <Probe options={{ ...options, controlledShowEditPromptModal: false }} />
                </UploadFilesProvider>,
            );

            expect(await screen.findByRole('button', { name: 'Reference' })).toBeInTheDocument();
            expect(uploadFilesState).toEqual([]);

            rerender(
                <UploadFilesProvider>
                    <ContextFilesProbe />
                    <Probe options={{ ...options, controlledShowEditPromptModal: true }} />
                </UploadFilesProvider>,
            );

            await waitFor(() => expect(uploadFilesState).toHaveLength(1));
            expect(uploadFilesState[0]).toMatchObject({ name: 'Reference' });

            rerender(
                <UploadFilesProvider>
                    <ContextFilesProbe />
                    <Probe options={{ ...options, controlledShowEditPromptModal: false }} />
                </UploadFilesProvider>,
            );

            await waitFor(() => expect(uploadFilesState).toEqual([]));
        });

        it("does not revoke a staged file's blob url when the lightbox mounts with the modal closed", () => {
            const revokeObjectURL = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

            const stagedFiles: FileType[] = [
                {
                    name: 'staged.png',
                    type: 'image',
                    url: 'blob:staged-1',
                    tempId: 'temp-staged-1',
                    isUploading: false,
                },
            ];

            const { rerender } = renderWithProviders(
                <UploadFilesProvider>
                    <ContextFilesProbe />
                </UploadFilesProvider>,
            );

            act(() => {
                uploadFilesActions.setFiles(stagedFiles);
            });

            revokeObjectURL.mockClear();

            rerender(
                <UploadFilesProvider>
                    <ContextFilesProbe />
                    <Probe options={baseLightboxOptions()} />
                </UploadFilesProvider>,
            );

            expect(revokeObjectURL).not.toHaveBeenCalled();
        });
    });
});
