import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileIcon, ImageIcon } from 'lucide-react';
import { http, HttpResponse } from 'msw';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import { filesUrl, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import {
    fileMeta,
    FileThumb,
    formatFileDate,
    formatFileSize,
    hasProminentEmbeddingStatus,
    isCodeTextFile,
    isHtmlFile,
    isImageFile,
    isMarkdownFile,
    isPdfFile,
    isPreviewable,
    isVideoFile,
    LibraryAttribution,
    LibraryBadges,
    LibraryEmbeddingStatusBadge,
    normalizeExtension,
    useLibraryDownload,
} from './file-preview';

const libraryItem = (overrides: Partial<LibraryItem> = {}): LibraryItem => ({
    _id: 'file-1',
    agentId: 'agent-1',
    agentName: 'Test Agent',
    agentSlug: 'test-agent',
    name: 'brief.pdf',
    title: 'Brief',
    extension: 'pdf',
    type: 'Document',
    url: 'https://files.localhost/download/brief.pdf',
    thumbnailUrl: '',
    isGenerated: false,
    conversationId: null,
    originType: null,
    projectId: null,
    creatorId: 'user-1',
    creatorName: 'Ada Lovelace',
    isPublic: false,
    isMyItem: true,
    isLikedByThisUser: false,
    likes: [],
    likesCount: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
});

describe('normalizeExtension', () => {
    it('strips leading dots and lowercases', () => {
        expect(normalizeExtension('.PNG')).toBe('png');
        expect(normalizeExtension('..Jpeg')).toBe('jpeg');
        expect(normalizeExtension()).toBe('');
    });
});

describe('file kind predicates', () => {
    it('classifies by extension', () => {
        expect(isImageFile(libraryItem({ extension: 'webp', type: 'Document' }))).toBe(true);
        expect(isVideoFile(libraryItem({ extension: 'mov', type: 'Document' }))).toBe(true);
        expect(isPdfFile(libraryItem({ extension: 'pdf' }))).toBe(true);
        expect(isHtmlFile(libraryItem({ extension: 'htm' }))).toBe(true);
        expect(isMarkdownFile(libraryItem({ extension: 'markdown' }))).toBe(true);
        expect(isCodeTextFile(libraryItem({ extension: 'tsx' }))).toBe(true);
    });

    it('falls back to the item type for images and videos', () => {
        expect(isImageFile(libraryItem({ extension: 'unknown', type: 'Image' }))).toBe(true);
        expect(isVideoFile(libraryItem({ extension: 'unknown', type: 'Video' }))).toBe(true);
    });

    it('treats an unrecognised extension as not previewable', () => {
        expect(isPreviewable(libraryItem({ extension: 'dwg', type: 'Document' }))).toBe(false);
        expect(isPreviewable(libraryItem({ extension: 'md' }))).toBe(true);
    });

    it('never marks embedding status as prominent', () => {
        expect(hasProminentEmbeddingStatus(libraryItem())).toBe(false);
    });
});

describe('fileMeta', () => {
    it('maps every known family to its label', () => {
        expect(fileMeta('pdf').label).toBe('PDF');
        expect(fileMeta('.PNG').label).toBe('Image');
        expect(fileMeta('mp4').label).toBe('Video');
        expect(fileMeta('docx').label).toBe('Word');
        expect(fileMeta('csv').label).toBe('Excel');
        expect(fileMeta('pptx').label).toBe('PowerPoint');
        expect(fileMeta('txt').label).toBe('Text');
        expect(fileMeta('md').label).toBe('Markdown');
        expect(fileMeta('markdown').label).toBe('Markdown');
    });

    it('falls back to a generic file for anything else', () => {
        expect(fileMeta('dwg')).toEqual({ label: 'File', Icon: FileIcon });
    });
});

describe('formatFileSize', () => {
    it('renders bytes without a decimal', () => {
        expect(formatFileSize(512)).toBe('512 B');
    });

    it('keeps one decimal below ten of a unit', () => {
        expect(formatFileSize(1024)).toBe('1.0 KB');
        expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('rounds at ten of a unit and above', () => {
        expect(formatFileSize(20480)).toBe('20 KB');
        expect(formatFileSize(1073741824)).toBe('1.0 GB');
    });

    it('renders nothing for a missing or non-positive size', () => {
        expect(formatFileSize()).toBe('');
        expect(formatFileSize(0)).toBe('');
        expect(formatFileSize(-5)).toBe('');
    });
});

describe('formatFileDate', () => {
    it('formats a valid date', () => {
        expect(formatFileDate('2026-03-04T10:00:00.000Z')).toBe('Mar 4, 2026');
    });

    it('renders nothing for a missing or unparseable value', () => {
        expect(formatFileDate()).toBe('');
        expect(formatFileDate('not a date')).toBe('');
    });
});

describe('FileThumb', () => {
    it('prefers the thumbnail over the full image url', () => {
        renderWithProviders(
            <FileThumb
                item={libraryItem({
                    type: 'Image',
                    thumbnailUrl: 'https://files.localhost/thumb.png',
                    url: 'https://files.localhost/full.png',
                })}
                Icon={ImageIcon}
            />,
        );

        expect(screen.getByRole('presentation')).toHaveAttribute('src', 'https://files.localhost/thumb.png');
    });

    it('falls back to the full url when there is no thumbnail', () => {
        renderWithProviders(
            <FileThumb
                item={libraryItem({ type: 'Image', thumbnailUrl: '', url: 'https://files.localhost/full.png' })}
                Icon={ImageIcon}
            />,
        );

        expect(screen.getByRole('presentation')).toHaveAttribute('src', 'https://files.localhost/full.png');
    });

    it('shows no image for a video without a thumbnail', () => {
        const { container } = renderWithProviders(
            <FileThumb item={libraryItem({ type: 'Video', extension: 'mp4', thumbnailUrl: '' })} Icon={ImageIcon} />,
        );

        expect(container.querySelector('img')).toBeNull();
    });

    it('swaps to the icon when the image fails to load', () => {
        const { container } = renderWithProviders(
            <FileThumb
                item={libraryItem({ type: 'Image', thumbnailUrl: 'https://files.localhost/broken.png' })}
                Icon={ImageIcon}
            />,
        );

        fireEvent.error(screen.getByRole('presentation'));

        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders the supplied fallback instead of the icon', () => {
        renderWithProviders(<FileThumb item={libraryItem()} Icon={ImageIcon} fallback={<span>No preview</span>} />);

        expect(screen.getByText('No preview')).toBeInTheDocument();
    });
});

describe('LibraryEmbeddingStatusBadge', () => {
    it('renders nothing without an embedding status', () => {
        const { container } = renderWithProviders(<LibraryEmbeddingStatusBadge item={libraryItem()} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('labels each terminal status', () => {
        renderWithProviders(<LibraryEmbeddingStatusBadge item={libraryItem({ embeddingStatus: 'indexed' })} />);

        expect(screen.getByLabelText('Content Searchable')).toBeInTheDocument();
    });

    it('labels a failed embedding', () => {
        renderWithProviders(<LibraryEmbeddingStatusBadge item={libraryItem({ embeddingStatus: 'failed' })} />);

        expect(screen.getByLabelText('Failed')).toBeInTheDocument();
    });

    it('labels a file that was never embedded', () => {
        renderWithProviders(<LibraryEmbeddingStatusBadge item={libraryItem({ embeddingStatus: 'not-available' })} />);

        expect(screen.getByLabelText('Not searchable')).toBeInTheDocument();
    });

    it('labels an in-progress embedding', () => {
        renderWithProviders(<LibraryEmbeddingStatusBadge item={libraryItem({ embeddingStatus: 'chunked' })} />);

        expect(screen.getByLabelText('Indexing content')).toBeInTheDocument();
    });

    it('labels a converting document', () => {
        renderWithProviders(
            <LibraryEmbeddingStatusBadge item={libraryItem({ embeddingStatus: 'document-converting' })} />,
        );

        expect(screen.getByLabelText('Reading document')).toBeInTheDocument();
    });

    it('labels a document under analysis', () => {
        renderWithProviders(<LibraryEmbeddingStatusBadge item={libraryItem({ embeddingStatus: 'md-available' })} />);

        expect(screen.getByLabelText('Analyzing content')).toBeInTheDocument();
    });
});

describe('LibraryBadges', () => {
    it('marks a private file', () => {
        renderWithProviders(<LibraryBadges item={libraryItem({ isPublic: false })} />);

        expect(screen.getByLabelText('Private')).toBeInTheDocument();
    });

    it('marks a public file and includes the embedding badge by default', () => {
        renderWithProviders(<LibraryBadges item={libraryItem({ isPublic: true, embeddingStatus: 'indexed' })} />);

        expect(screen.getByLabelText('Public')).toBeInTheDocument();
        expect(screen.getByLabelText('Content Searchable')).toBeInTheDocument();
    });

    it('can hide the embedding badge', () => {
        renderWithProviders(
            <LibraryBadges item={libraryItem({ embeddingStatus: 'indexed' })} showEmbeddingStatus={false} />,
        );

        expect(screen.queryByLabelText('Content Searchable')).not.toBeInTheDocument();
    });
});

describe('LibraryAttribution', () => {
    it('renders nothing without a creator or an agent', () => {
        const { container } = renderWithProviders(
            <LibraryAttribution item={libraryItem({ creatorName: '', agentName: undefined, agentSlug: undefined })} />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('links a project-scoped file to its space', () => {
        renderWithProviders(
            <LibraryAttribution item={libraryItem({ originType: 'project', projectId: 'project-9' })} />,
        );

        expect(screen.getByRole('link', { name: 'Test Agent' })).toHaveAttribute(
            'href',
            '/agent/test-agent/spaces/project-9',
        );
    });

    it('links a conversation-scoped file to its chat', () => {
        renderWithProviders(<LibraryAttribution item={libraryItem({ conversationId: 'chat-9' })} />);

        expect(screen.getByRole('link', { name: 'Test Agent' })).toHaveAttribute(
            'href',
            '/agent/test-agent/chat/chat-9',
        );
    });

    it('links a generated file to the agent lightbox', () => {
        renderWithProviders(<LibraryAttribution item={libraryItem({ isGenerated: true })} />);

        expect(screen.getByRole('link', { name: 'Test Agent' })).toHaveAttribute(
            'href',
            '/agent/test-agent?lightboxFileId=file-1',
        );
    });

    it('links an unattributed file to the agent root', () => {
        renderWithProviders(<LibraryAttribution item={libraryItem()} />);

        expect(screen.getByRole('link', { name: 'Test Agent' })).toHaveAttribute('href', '/agent/test-agent');
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });

    it('hides the agent link when asked', () => {
        renderWithProviders(<LibraryAttribution item={libraryItem()} showAgentLink={false} />);

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });

    it('reports a navigation away from the list', async () => {
        const user = userEvent.setup();
        const onNavigate = vi.fn();

        renderWithProviders(<LibraryAttribution item={libraryItem()} onNavigate={onNavigate} />);

        await user.click(screen.getByRole('link', { name: 'Test Agent' }));

        expect(onNavigate).toHaveBeenCalledTimes(1);
    });
});

const DownloadHarness = ({ items }: { items: LibraryItem[] }) => {
    const { downloadFile, downloadFiles, downloadingId, isBulkDownloading } = useLibraryDownload();

    return (
        <>
            <button type="button" onClick={() => downloadFile(items[0])}>
                One
            </button>
            <button type="button" onClick={() => downloadFiles(items)}>
                Many
            </button>
            <span>{`downloading:${String(downloadingId)}`}</span>
            <span>{`bulk:${String(isBulkDownloading)}`}</span>
            <Toaster />
        </>
    );
};

describe('useLibraryDownload', () => {
    let clickSpy: ReturnType<typeof vi.spyOn>;
    let consoleError: ReturnType<typeof vi.spyOn>;
    let downloads: { href: string; download: string }[];

    beforeEach(() => {
        downloads = [];
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        clickSpy = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(function click(this: HTMLAnchorElement) {
                downloads.push({ href: this.href, download: this.download });
            });

        Object.defineProperty(window.URL, 'createObjectURL', {
            configurable: true,
            writable: true,
            value: () => 'blob:mock',
        });
        Object.defineProperty(window.URL, 'revokeObjectURL', {
            configurable: true,
            writable: true,
            value: () => {},
        });
    });

    afterEach(() => {
        clickSpy.mockRestore();
        consoleError.mockRestore();
    });

    it('downloads a single file under a sanitised name', async () => {
        const user = userEvent.setup();
        const item = libraryItem({ name: 'Q1 Brief.pdf', extension: 'pdf' });

        server.use(http.get(item.url, () => HttpResponse.arrayBuffer(new ArrayBuffer(4))));

        renderWithProviders(<DownloadHarness items={[item]} />);
        await user.click(screen.getByRole('button', { name: 'One' }));

        expect(await screen.findByText('File downloaded')).toBeInTheDocument();
        expect(downloads).toEqual([{ href: 'blob:mock', download: 'q1-brief.pdf' }]);
        expect(screen.getByText('downloading:null')).toBeInTheDocument();
    });

    it('reports a failed single download', async () => {
        const user = userEvent.setup();
        const item = libraryItem();

        server.use(http.get(item.url, () => new HttpResponse(null, { status: 500 })));

        renderWithProviders(<DownloadHarness items={[item]} />);
        await user.click(screen.getByRole('button', { name: 'One' }));

        expect(await screen.findByText('Failed to download file. Please try again later.')).toBeInTheDocument();
        expect(downloads).toHaveLength(0);
    });

    it('does nothing for an empty selection', async () => {
        const user = userEvent.setup();

        renderWithProviders(<DownloadHarness items={[]} />);
        await user.click(screen.getByRole('button', { name: 'Many' }));

        expect(downloads).toHaveLength(0);
        expect(screen.getByText('bulk:false')).toBeInTheDocument();
    });

    it('delegates a one-item bulk download to the single-file path', async () => {
        const user = userEvent.setup();
        const item = libraryItem({ name: 'notes.txt', extension: 'txt' });

        server.use(http.get(item.url, () => HttpResponse.arrayBuffer(new ArrayBuffer(4))));

        renderWithProviders(<DownloadHarness items={[item]} />);
        await user.click(screen.getByRole('button', { name: 'Many' }));

        expect(await screen.findByText('File downloaded')).toBeInTheDocument();
        expect(downloads).toEqual([{ href: 'blob:mock', download: 'notes.txt' }]);
    });

    it('zips a multi-file selection through the bulk download url', async () => {
        const user = userEvent.setup();
        const items = [libraryItem(), libraryItem({ _id: 'file-2', name: 'deck.pptx', extension: 'pptx' })];
        let requestedUrl = '';

        server.use(
            http.get(filesUrl('/download/multiple'), ({ request }) => {
                requestedUrl = request.url;

                return HttpResponse.arrayBuffer(new ArrayBuffer(4));
            }),
        );

        renderWithProviders(<DownloadHarness items={items} />);
        await user.click(screen.getByRole('button', { name: 'Many' }));

        expect(await screen.findByText('Downloaded 2 files')).toBeInTheDocument();
        expect(downloads).toEqual([{ href: 'blob:mock', download: 'files.zip' }]);

        await waitFor(() => {
            expect(new URL(requestedUrl).searchParams.get('fileIds')).toBe('file-1,file-2');
        });
    });

    it('reports a failed bulk download', async () => {
        const user = userEvent.setup();
        const items = [libraryItem(), libraryItem({ _id: 'file-2' })];

        server.use(http.get(filesUrl('/download/multiple'), () => new HttpResponse(null, { status: 500 })));

        renderWithProviders(<DownloadHarness items={items} />);
        await user.click(screen.getByRole('button', { name: 'Many' }));

        expect(await screen.findByText('Failed to download files. Please try again later.')).toBeInTheDocument();
        expect(screen.getByText('bulk:false')).toBeInTheDocument();
    });
});
